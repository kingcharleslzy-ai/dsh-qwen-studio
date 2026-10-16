#!/usr/bin/env python3
"""Qwen Image worker v4. Durable generation and reference-image variations."""
import base64
import concurrent.futures
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(os.environ.get('QWEN_DATA_DIR', Path(__file__).resolve().parent)).resolve()
MODEL_ID = 'qwen-image-2.1-mlx'
ACTIVE = {'queued', 'loading', 'running', 'saving', 'cancelling'}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    with temp.open('w') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)


def validate(data):
    if not isinstance(data, dict): raise ValueError('请求格式错误')
    prompt = data.get('prompt', '')
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 16000: raise ValueError('提示词需为1–16000个字符')
    width, height = data.get('width', 1024), data.get('height', 1024)
    if any(type(v) is not int or not 512 <= v <= 2048 or v % 16 for v in [width, height]): raise ValueError('尺寸应为512–2048之间的16倍数')
    steps, seed = data.get('steps', 40), data.get('seed')
    if type(steps) is not int or not 1 <= steps <= 60: raise ValueError('步数应为1–60')
    if seed is not None and (type(seed) is not int or not 0 <= seed < 2**32): raise ValueError('种子应为0–4294967295')

    # --- 反向提示词 ---------------------------------------------------------
    # mflux 只在 guidance > 1.0 时才会计算真 CFG 的负向分支
    # (qwen_image_21.py: do_true_cfg = config.guidance > 1.0 and bool(negative_prompt))，
    # 所以 guidance 留在 1.0 时反向提示词不会参与采样。这里在"只给了反向词却没抬
    # guidance"的情况下自动抬到 2.5，并把这次自动抬升记录进任务，免得静默改变行为。
    negative = data.get('negative_prompt')
    if negative is not None:
        if not isinstance(negative, str) or len(negative) > 8000: raise ValueError('反向提示词需为0–8000个字符')
        negative = negative.strip() or None

    guidance = data.get('guidance', 1.0)
    if type(guidance) not in (int, float) or isinstance(guidance, bool) or not 1.0 <= guidance <= 10.0:
        raise ValueError('引导强度应为1.0–10.0')
    guidance = float(guidance)
    guidance_auto_raised = False
    if negative and guidance <= 1.0:
        guidance = 2.5
        guidance_auto_raised = True

    scheduler = data.get('scheduler', 'linear')
    if scheduler not in ('linear', 'flow_match_euler_discrete', 'seedvr2_euler'):
        raise ValueError('调度器仅支持 linear / flow_match_euler_discrete / seedvr2_euler')

    params = dict(prompt=prompt.strip(), width=width, height=height, steps=steps, seed=seed,
                  negative_prompt=negative, guidance=guidance, scheduler=scheduler)
    if guidance_auto_raised: params['guidance_auto_raised'] = True
    source = data.get('source_image_id')
    if source is not None:
        if not isinstance(source, str) or not re.fullmatch('[a-f0-9]{32}', source): raise ValueError('参考图片ID无效')
        strength = data.get('change_strength', .45)
        if type(strength) not in (int, float) or not .05 <= strength <= .95: raise ValueError('变化幅度应为0.05–0.95')
        if steps < 2: raise ValueError('图生图至少需要2步')
        params.update(source_image_id=source, change_strength=strength)
    elif 'change_strength' in data:
        raise ValueError('变化幅度需要配合参考图片')
    return params


class Cancelled(Exception): pass


class JobQueue:
    def __init__(self, root, runner):
        self.root, self.runner = Path(root), runner
        self.lock = threading.RLock()
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        self.jobs, self.events, self.futures = {}, {}, {}
        self.pending = 0
        self.closing = False
        self.loaded = False
        self.last_finished = time.monotonic()
        self.current = None
        # Interrupted work is explicit, never silently shown as still generating.
        for path in (self.root / 'images').glob('*/job.json'):
            try:
                record = json.loads(path.read_text())
                if not re.fullmatch('[a-f0-9]{32}', record.get('id', '')): continue
                if record.get('status') in ACTIVE or record.get('status') == 'running':
                    record.update(status='failed', error='上次服务中断，请重新生成')
                    atomic_json(path, record)
                self.jobs[record['id']] = record
            except (OSError, ValueError): continue

    def write(self, job):
        atomic_json(self.root / 'images' / job['id'] / 'job.json', job)

    def submit(self, data):
        params = validate(data)
        job_id = data.get('id', uuid.uuid4().hex)
        if not isinstance(job_id, str) or not re.fullmatch('[a-f0-9]{32}', job_id): raise ValueError('任务ID无效')
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                request = job.get('request', {k: job.get(k) for k in params})
                if request != params: raise ValueError('任务ID已被其他参数使用')
                return dict(job)
            if self.closing or self.pending >= 4: raise RuntimeError('队列已满或服务正在退出，请稍后重试')
            if params.get('source_image_id'):
                source_folder = self.root/'images'/params['source_image_id']
                source_path = (source_folder/'image.png').resolve()
                if not source_path.is_relative_to((self.root/'images').resolve()): raise ValueError('参考图片路径无效')
                source_job = json.loads((source_folder/'job.json').read_text())
                if source_job.get('status') != 'complete': raise ValueError('参考图片尚未生成完成')
                if source_path.stat().st_size > 64*1024*1024: raise ValueError('参考图片过大')
                pixels = source_path.read_bytes()
                if not pixels.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('参考图片不是PNG')
                # Own the input before acknowledging admission. Moving/deleting the
                # source later must not change this already accepted job.
                folder = self.root/'images'/job_id
                folder.mkdir(parents=True, exist_ok=True)
                reference = folder/'reference.pending.png'
                with reference.open('wb') as f:
                    f.write(pixels); f.flush(); os.fsync(f.fileno())
                os.replace(reference, folder/'reference.png')
            job = dict(id=job_id, status='queued', model=MODEL_ID, started_at=time.time(), **params)
            job['sampling_steps'] = params['steps'] - max(1, int(params['steps'] * (1-params['change_strength']))) if params.get('source_image_id') else params['steps']
            job['request'] = dict(params)
            job['seed'] = params['seed'] if params['seed'] is not None else secrets.randbelow(2**32)
            job.update(step=0, phase='queued', worker_pid=os.getpid())
            self.write(job)  # Admission receipt is durable before HTTP 202.
            self.jobs[job_id] = job
            self.events[job_id] = threading.Event()
            self.pending += 1
            self.futures[job_id] = self.pool.submit(self.run, job_id)
            return dict(job)

    def progress(self, job_id, phase, step=0):
        with self.lock:
            job = self.jobs[job_id]
            if self.events[job_id].is_set(): raise Cancelled()
            job.update(status=phase, phase=phase, step=step)
            self.write(job)

    def run(self, job_id):
        start = time.monotonic()
        with self.lock:
            self.current = job_id
            job = self.jobs[job_id]
            event = self.events[job_id]
        try:
            if event.is_set(): raise Cancelled()
            output = self.root / 'images' / job_id / 'image.png'
            result = self.runner(job, output, lambda phase, step=0: self.progress(job_id, phase, step), event)
            with self.lock:
                # Once the output is committed, completion wins over a late cancellation.
                job.update(status='complete', phase='complete', step=job.get('sampling_steps',job['steps']), output=str(output), elapsed_seconds=round(time.monotonic()-start, 2), **(result or {}))
        except Cancelled:
            with self.lock: job.update(status='cancelled', phase='cancelled')
        except Exception as exc:
            with self.lock: job.update(status='failed', phase='failed', error=str(exc))
        finally:
            with self.lock:
                self.write(job)
                self.pending -= 1
                self.current = None
                self.last_finished = time.monotonic()
                self.events.pop(job_id, None)
                self.futures.pop(job_id, None)

    def cancel(self, job_id):
        with self.lock:
            if job_id not in self.jobs: raise ValueError('任务不存在')
            job = self.jobs[job_id]
            if job['status'] in ACTIVE:
                self.events[job_id].set()
                job.update(status='cancelling', phase='cancelling')
                self.write(job)
            return dict(job)

    def idle_seconds(self):
        try:
            value = json.loads((self.root/'state/runtime-config.json').read_text())['idle_seconds']
            if type(value) not in (int, float) or not 6 <= value <= 86400: raise ValueError()
            return float(value)
        except (OSError, ValueError, KeyError, TypeError): return 600.0

    def health(self):
        with self.lock:
            current = self.jobs.get(self.current, {})
            return dict(status='ok', version=4, pid=os.getpid(), loaded=self.loaded, busy=self.pending > 0,
                pending=self.pending, closing=self.closing, current_id=self.current, phase=current.get('phase','idle'),
                step=current.get('step',0), steps=current.get('steps',40), idle_seconds=self.idle_seconds(),
                idle_remaining_seconds=None if self.pending else max(0, round(self.idle_seconds()-(time.monotonic()-self.last_finished))))

    def stop_if_idle(self):
        with self.lock:
            if self.pending: return False
            self.closing = True
            return True


QWEN = None
QUEUE = None

def generate(job, output, progress, cancel):
    global QWEN
    os.environ['HF_HUB_OFFLINE'] = '1'
    import mlx.core as mx
    if QWEN is None:
        progress('loading')
        from mflux.models.qwen21.variants.txt2img.qwen_image_21 import QwenImage21
        from mflux.models.common.resolution.config_resolution import ConfigResolution
        model = Path(os.environ.get('QWEN_MODEL_PATH', str(ROOT/'models/qwen-image-2.1')))
        config = ConfigResolution.resolve_restricted('qwen-image-2.1','qwen-image-2.1',model_path=str(model),base_model='qwen-image-2.1')
        QWEN = QwenImage21(model_config=config, model_path=str(model))
        QUEUE.loaded = True
    # One model, one executor, one active job. Callback reads this job only.
    offset = job['steps'] - job.get('sampling_steps', job['steps'])
    class Progress:
        def call_in_loop(self, t, **kwargs): progress('running', int(t)-offset+1)
    callback = Progress()
    QWEN.callbacks.register(callback)
    try:
        progress('running')
        reference = dict(image_path=str(output.parent/'reference.png'), image_strength=1-job['change_strength']) if job.get('source_image_id') else {}
        # guidance / negative_prompt / scheduler 缺省时行为与改动前完全一致
        # （guidance 1.0 = 跳过错向分支，scheduler linear = 原采样器）。
        image = QWEN.generate_image(
            prompt=job['prompt'], seed=job['seed'], width=job['width'], height=job['height'],
            num_inference_steps=job['steps'],
            guidance=job.get('guidance', 1.0),
            scheduler=job.get('scheduler', 'linear'),
            negative_prompt=job.get('negative_prompt'),
            **reference)
        progress('saving', job.get('sampling_steps', job['steps']))
        temp = output.with_name('image.pending.png')
        image.save(path=str(temp), export_json_metadata=True)
        os.replace(temp, output)
        return {'peak_mlx_gb': round(mx.get_peak_memory()/1e9, 2)}
    finally:
        QWEN.callbacks.in_loop.remove(callback)


def main():
    global QUEUE
    state = ROOT/'state'; state.mkdir(exist_ok=True)
    key = state/'api-key'
    if not key.exists():
        key.write_text(secrets.token_urlsafe(32)); key.chmod(0o600)
    token = key.read_text().strip()
    QUEUE = JobQueue(ROOT, generate)
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, code, value):
            body = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers()
            try: self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError): pass
        def do_GET(self):
            if self.path == '/health': return self.send_json(200, QUEUE.health())
            self.send_json(404, {'error':'Unknown route'})
        def do_POST(self):
            if self.headers.get('Authorization') != 'Bearer '+token: return self.send_json(401, {'error':'Unauthorized'})
            try:
                length = int(self.headers.get('Content-Length',0))
                if not 0 < length <= 65536: raise ValueError('请求大小无效')
                data = json.loads(self.rfile.read(length))
                if self.path == '/v1/jobs': return self.send_json(202, QUEUE.submit(data))
                if self.path == '/v1/cancel': return self.send_json(200, QUEUE.cancel(data.get('id')))
                if self.path == '/v1/unload':
                    if not QUEUE.stop_if_idle(): return self.send_json(409, {'error':'正在生成，不能卸载'})
                    self.send_json(200, {'ok':True})
                    threading.Thread(target=server.shutdown,daemon=True).start(); return
                self.send_json(404, {'error':'Unknown route'})
            except ValueError as exc: self.send_json(400, {'error':str(exc)})
            except RuntimeError as exc: self.send_json(409, {'error':str(exc)})
            except Exception as exc: self.send_json(500, {'error':str(exc)})
        def log_message(self, fmt, *args): print(time.strftime('%Y-%m-%d %H:%M:%S'),fmt%args,flush=True)
    server = ThreadingHTTPServer(('127.0.0.1',19388),Handler)
    def watch():
        while not QUEUE.closing:
            time.sleep(1)
            with QUEUE.lock:
                if not QUEUE.pending and time.monotonic()-QUEUE.last_finished >= QUEUE.idle_seconds():
                    QUEUE.closing = True
                    print('Idle timeout: unloading model and stopping backend',flush=True)
                    threading.Thread(target=server.shutdown,daemon=True).start()
    threading.Thread(target=watch,daemon=True).start()
    print('Qwen worker v3 listening on 127.0.0.1:19388',flush=True)
    try: server.serve_forever()
    finally: server.server_close(); QUEUE.pool.shutdown(wait=True)

if __name__ == '__main__': main()
