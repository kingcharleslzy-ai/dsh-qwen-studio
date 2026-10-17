"""Authenticated loopback gateway for a dedicated ComfyUI Qwen Image 2.1 service."""
import asyncio
import base64
import hashlib
import hmac
import io
import json
import logging
import os
from pathlib import Path
import re
import socket
import signal
import struct
import subprocess
import time
import uuid
from aiohttp import web, ClientSession, ClientTimeout, WSMsgType
from PIL import Image
from qwen_workflow import FEATURES, SCHEDULERS, graph, normalize, sigmas

ROOT=Path(os.environ.get('QWEN_REMOTE_ROOT',Path(__file__).resolve().parent))
COMFY='http://127.0.0.1:19489'
MODEL='qwen-image-2.1-int8'
CONFIG=ROOT/'gateway-config.json'
WINDOWS=os.name=='nt'
PROCESS_FLAGS={'creationflags': subprocess.CREATE_NO_WINDOW} if WINDOWS else {}

def atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data),encoding='utf-8');tmp.replace(path)

def asset_path(sha,kind):
    if not re.fullmatch('[a-f0-9]{64}',sha) or kind not in ('image','lora'): raise ValueError('Invalid asset reference')
    folder=ROOT/'ComfyUI'/('models/loras/dsh' if kind=='lora' else 'input/dsh')
    return folder/(sha+('.safetensors' if kind=='lora' else '.png'))

def validate_asset(path,kind,size):
    if kind=='image':
        with Image.open(path) as im:
            if im.format!='PNG' or max(im.size)>4096: raise ValueError('Images must be normalized PNG, up to 4096 pixels')
            im.verify()
    else:
        with path.open('rb') as f:
            raw=f.read(8)
            if len(raw)!=8: raise ValueError('Incomplete safetensors file')
            length=struct.unpack('<Q',raw)[0]
            if length<2 or length>16*1024**2 or 8+length>=size: raise ValueError('Invalid safetensors header')
            tensors=json.loads(f.read(length));tensors.pop('__metadata__',None)
            if not tensors or not any(re.search(r'(?:lora_[AB]|lora_up|lora_down|lokr_w[12])(?:\.|$)',k) for k in tensors): raise ValueError('Not LoRA weights')
            for tensor in tensors.values():
                start,end=tensor['data_offsets']
                if type(start) is not int or type(end) is not int or not 0<=start<=end<=size-length-8: raise ValueError('Incomplete LoRA tensor')

class Service:
    def __init__(self):
        self.config=json.loads(CONFIG.read_text())
        self.process=None;self.log=None;self.lock=asyncio.Lock();self.last=time.monotonic()
        self.jobs={};self.tasks={};self.cancelled=set();self.current=None;self.uploads={}
        for p in (ROOT/'jobs').glob('*/job.json'):
            job=json.loads(p.read_text())
            if job['status'] not in ('complete','cancelled','failed'):
                job.update(status='failed',error='Gateway restarted before completion');atomic(p,job)
            self.jobs[job['id']]=job
    async def call(self,path,data=None):
        async with self.session.request('GET' if data is None else 'POST',COMFY+path,json=data) as r:
            raw=await r.read()
            body=json.loads(raw) if raw else {}
            if r.status>=400: raise RuntimeError(f'ComfyUI HTTP {r.status}: {str(body)[:1200]}')
            return body
    def patch(self,id,**values):
        job=self.jobs[id];job.update(values);atomic(ROOT/'jobs'/id/'job.json',job)
        return self.public(job)
    def public(self,job):
        return {k:v for k,v in job.items() if k not in ('request','prompt_id','image_file')}
    async def ensure(self):
        if self.process and self.process.poll() is None: return
        for port in (19489,8188,8189):
            with socket.socket() as sock:
                if sock.connect_ex(('127.0.0.1',port))==0: raise RuntimeError(f'GPU service port {port} is occupied; inspect it before starting Qwen')
        used=int(subprocess.check_output(['nvidia-smi','--query-gpu=memory.used','--format=csv,noheader,nounits'],text=True,**PROCESS_FLAGS).strip().splitlines()[0])
        if used>6000: raise RuntimeError(f'GPU already uses {used} MiB; free it before loading Qwen')
        self.log=(ROOT/'comfy.log').open('ab')
        command=[str(ROOT/('venv/Scripts/python.exe' if WINDOWS else 'venv/bin/python')),'-u','main.py','--listen','127.0.0.1','--port','19489','--disable-auto-launch','--disable-all-custom-nodes','--whitelist-custom-nodes','dsh_qwen','--preview-method','none','--offline']
        self.process=subprocess.Popen(command,cwd=ROOT/'ComfyUI',stdout=self.log,stderr=self.log,**PROCESS_FLAGS,start_new_session=not WINDOWS,env={**os.environ,'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1'})
        for _ in range(360):
            if self.process.poll() is not None: raise RuntimeError('ComfyUI exited; inspect comfy.log')
            try: await self.call('/system_stats'); return
            except (OSError,asyncio.TimeoutError): await asyncio.sleep(1)
        raise RuntimeError('ComfyUI startup timed out')
    async def stop(self):
        if self.process and self.process.poll() is None:
            if WINDOWS:
                await asyncio.to_thread(subprocess.run,['taskkill','/PID',str(self.process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,**PROCESS_FLAGS)
            else:
                os.killpg(self.process.pid,signal.SIGTERM)
            try: await asyncio.to_thread(self.process.wait,30)
            except subprocess.TimeoutExpired:
                if not WINDOWS: os.killpg(self.process.pid,signal.SIGKILL)
                await asyncio.to_thread(self.process.wait,10)
        self.process=None
        if self.log:self.log.close();self.log=None
    async def idle(self):
        while True:
            await asyncio.sleep(10)
            if not any(not t.done() for t in self.tasks.values()) and time.monotonic()-self.last>self.config.get('idle_seconds',300):
                async with self.lock: await self.stop()
    async def asset(self,request):
        sha=request.match_info['sha'];kind=request.query.get('kind','image');path=asset_path(sha,kind)
        if request.method=='HEAD':return web.Response(status=200 if path.is_file() else 404)
        if sha in self.uploads:raise ValueError('Asset is already uploading; retry after the current transfer')
        limit=2*1024**3 if kind=='lora' else 64*1024**2
        if request.content_length is not None and request.content_length>limit:raise ValueError('Asset too large')
        if path.is_file():
            size=0
            async for chunk in request.content.iter_chunked(1024*1024):
                size+=len(chunk)
                if size>limit:raise ValueError('Asset too large')
            return web.json_response({'sha':sha,'cached':True})
        path.parent.mkdir(parents=True,exist_ok=True)
        tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.part')
        self.uploads[sha]=True
        try:
            digest=hashlib.sha256();size=0
            with tmp.open('xb') as f:
                async for chunk in request.content.iter_chunked(1024*1024):
                    size+=len(chunk)
                    if size>limit:raise ValueError('Asset too large')
                    digest.update(chunk);f.write(chunk)
            if digest.hexdigest()!=sha:raise ValueError('Asset checksum mismatch')
            validate_asset(tmp,kind,size);tmp.replace(path)
            return web.json_response({'sha':sha,'bytes':size,'cached':False})
        finally:
            tmp.unlink(missing_ok=True);self.uploads.pop(sha,None)
    async def admit(self,data):
        p=normalize(data);id=p['id']
        for key in ('source_sha','mask_sha','control_sha'):
            if p.get(key) and not asset_path(p[key],'image').is_file():raise ValueError('Missing uploaded '+key)
        for lora in p['loras']:
            if not asset_path(lora['sha'],'lora').is_file():raise ValueError('Missing uploaded LoRA')
        if (p.get('mask_sha') or p.get('control_sha')) and not (ROOT/'ComfyUI/models/model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors').is_file():raise ValueError('Qwen Image 2.1 Union weights are not ready')
        if id in self.jobs:
            if self.jobs[id]['request']!=p:raise ValueError('Job id parameter conflict')
            return self.jobs[id]
        if sum(not t.done() for t in self.tasks.values())>=4:raise ValueError('Remote queue is full')
        job={'id':id,'request':p,'status':'queued','step':0,'steps':p['steps'],'sampling_steps':len(sigmas(p))-1,'progress_supported':True,'started_at':time.time()}
        self.jobs[id]=job;self.patch(id)
        self.tasks[id]=asyncio.create_task(self.generate(id))
        return job
    async def submit(self,request):return web.json_response(self.public(await self.admit(await request.json())),status=202)
    async def get_job(self,request):
        id=request.match_info['id']
        if id not in self.jobs:raise web.HTTPNotFound()
        return web.json_response(self.public(self.jobs[id]))
    async def image(self,request):
        job=self.jobs.get(request.match_info['id'])
        if not job or job['status']!='complete':raise web.HTTPNotFound()
        return web.FileResponse(ROOT/'jobs'/job['id']/'image.png')
    async def cancel(self,request):
        id=request.match_info['id'];job=self.jobs.get(id)
        if not job:raise web.HTTPNotFound()
        if job['status'] in ('complete','failed','cancelled'):return web.json_response(self.public(job))
        self.cancelled.add(id)
        self.patch(id,status='cancelling')
        if self.current==id and job.get('prompt_id'):await self.call('/interrupt',{})
        return web.json_response(self.public(job))
    async def events(self,ws,id):
        async for msg in ws:
            if msg.type==WSMsgType.TEXT:
                event=json.loads(msg.data);d=event.get('data',{})
                if d.get('prompt_id')!=self.jobs[id].get('prompt_id'):continue
                if event.get('type')=='progress':
                    self.patch(id,status='running',step=int(d['value']),sampling_steps=int(d['max']),phase='采样')
                elif event.get('type')=='executing':
                    node=d.get('node');phase='解码与保存' if node in ('8','9') else '编码与模型准备'
                    self.patch(id,phase=phase)
            elif msg.type in (WSMsgType.ERROR,WSMsgType.CLOSE,WSMsgType.CLOSED):break
    async def generate(self,id):
        async with self.lock:
            job=self.jobs[id];p=job['request'];started=time.monotonic();event_task=None
            if id in self.cancelled:self.patch(id,status='cancelled');return
            try:
                self.current=id;self.patch(id,status='loading',phase='启动服务与加载模型')
                await self.ensure()
                if id in self.cancelled:self.patch(id,status='cancelled');return
                client='dsh-'+id
                async with self.session.ws_connect(COMFY+'/ws',params={'clientId':client},heartbeat=20) as ws:
                    result=await self.call('/prompt',{'prompt':graph(p),'client_id':client})
                    pid=result['prompt_id'];job['prompt_id']=pid
                    self.patch(id,status='running',phase='编码与模型准备')
                    event_task=asyncio.create_task(self.events(ws,id))
                    for _ in range(1800):
                        if id in self.cancelled:await self.call('/interrupt',{})
                        entry=(await self.call('/history/'+pid)).get(pid)
                        if entry:
                            if entry.get('status',{}).get('status_str')=='error':
                                if id in self.cancelled:self.patch(id,status='cancelled');return
                                raise RuntimeError(str(entry['status']['messages'])[:2000])
                            images=entry.get('outputs',{}).get('9',{}).get('images',[])
                            if images:
                                if id in self.cancelled:self.patch(id,status='cancelled');return
                                self.patch(id,status='saving',phase='保存图片')
                                async with self.session.get(COMFY+'/view',params={k:images[0][k] for k in ('filename','subfolder','type')}) as response:
                                    if response.status!=200:raise RuntimeError('Generated image unavailable')
                                    png=await response.read()
                                if p.get('mask_sha'):
                                    with Image.open(io.BytesIO(png)) as generated,Image.open(asset_path(p['source_sha'],'image')) as source,Image.open(asset_path(p['mask_sha'],'image')) as mask:
                                        size=(p['width'],p['height']);source=source.convert('RGB').resize(size,Image.Resampling.LANCZOS)
                                        mask=mask.convert('L').resize(size,Image.Resampling.NEAREST).point(lambda v:255 if v>=128 else 0)
                                        output=Image.composite(generated.convert('RGB'),source,mask);buffer=io.BytesIO();output.save(buffer,format='PNG');png=buffer.getvalue()
                                destination=ROOT/'jobs'/id/'image.png';tmp=destination.with_suffix('.pending.png');tmp.write_bytes(png);tmp.replace(destination)
                                seconds=round(time.monotonic()-started,2)
                                self.patch(id,status='complete',step=job['sampling_steps'],elapsed_seconds=seconds,phase='已完成',guidance=p['guidance'],guidance_auto_raised=p.get('guidance_auto_raised',False))
                                logging.info('Complete %s in %ss, control=%s, mask=%s, LoRAs=%s',id,seconds,bool(p.get('control_sha')),bool(p.get('mask_sha')),len(p['loras']))
                                return
                        await asyncio.sleep(.5)
                    raise RuntimeError('Generation exceeded 30 minutes')
            except Exception as e:
                logging.exception('Job %s failed',id)
                self.patch(id,status='cancelled' if id in self.cancelled else 'failed',error=str(e))
            finally:
                if event_task:
                    event_task.cancel()
                    await asyncio.gather(event_task,return_exceptions=True)
                self.current=None;self.last=time.monotonic()
    async def legacy(self,request):
        data=await request.json();w,h=map(int,data.get('size','1024x1024').split('x'))
        if data.get('n',1)!=1:raise ValueError('Only n=1 is supported')
        job=await self.admit({'id':uuid.uuid4().hex,'model':data.get('model',MODEL),'prompt':data.get('prompt'),'width':w,'height':h,'steps':data.get('num_inference_steps',40),'seed':data.get('seed',0)})
        task=self.tasks.get(job['id'])
        if task:await asyncio.shield(task)
        if job['status']!='complete':raise RuntimeError(job.get('error',job['status']))
        png=(ROOT/'jobs'/job['id']/'image.png').read_bytes()
        return web.json_response({'created':int(time.time()),'data':[{'b64_json':base64.b64encode(png).decode()}]})
    async def capabilities(self,request):return web.json_response({'protocol':'dsh-qwen','version':1,'features':list(FEATURES),'schedulers':list(SCHEDULERS)})
    async def models(self,request):return web.json_response({'object':'list','data':[{'id':MODEL,'object':'model','owned_by':'local-4090d'}]})
    async def health(self,request):return web.json_response({'loaded':bool(self.process and self.process.poll() is None),'status':'ok','busy':any(not t.done() for t in self.tasks.values()),'idle_seconds':self.config.get('idle_seconds',300)})
    async def runtime_config(self,request):
        data=await request.json()
        seconds=data.get('idle_seconds')
        if set(data)!={'idle_seconds'} or type(seconds) is not int or not 6<=seconds<=86400:raise ValueError('idle_seconds must be an integer from 6 to 86400')
        config={**self.config,'idle_seconds':seconds}
        atomic(CONFIG,config);self.config=config
        # Status/config reads do not reset idle time. Active jobs are always protected.
        return web.json_response({'idle_seconds':seconds})
    async def unload(self,request):
        if any(not t.done() for t in self.tasks.values()):return web.json_response({'error':'Generation active'},status=409)
        async with self.lock:
            if any(not t.done() for t in self.tasks.values()):return web.json_response({'error':'Generation active'},status=409)
            await self.stop()
        return web.json_response({'unloaded':True})
    async def lifecycle(self,app):
        self.session=ClientSession(timeout=ClientTimeout(total=60));idle=asyncio.create_task(self.idle())
        yield
        idle.cancel()
        for task in self.tasks.values():task.cancel()
        await asyncio.gather(idle,*self.tasks.values(),return_exceptions=True)
        await self.stop();await self.session.close()

def create_app():
    service=Service()
    @web.middleware
    async def boundary(request,handler):
        if not hmac.compare_digest(request.headers.get('Authorization',''),'Bearer '+service.config['api_key']):return web.json_response({'error':'Unauthorized'},status=401)
        try:return await handler(request)
        except (ValueError,TypeError,KeyError) as e:return web.json_response({'error':str(e)},status=400)
        except web.HTTPException:raise
        except Exception as e:
            logging.exception('Gateway request failed');return web.json_response({'error':str(e)},status=503)
    app=web.Application(middlewares=[boundary],client_max_size=2*1024**3)
    app.cleanup_ctx.append(service.lifecycle)
    app.add_routes([web.get('/v1/models',service.models),web.get('/v1/qwen/capabilities',service.capabilities),web.get('/v1/qwen/health',service.health),web.post('/v1/qwen/unload',service.unload),web.post('/v1/qwen/runtime-config',service.runtime_config),
        web.route('HEAD','/v1/qwen/assets/{sha}',service.asset),web.put('/v1/qwen/assets/{sha}',service.asset),
        web.post('/v1/qwen/jobs',service.submit),web.get('/v1/qwen/jobs/{id}',service.get_job),
        web.get('/v1/qwen/jobs/{id}/image',service.image),web.post('/v1/qwen/jobs/{id}/cancel',service.cancel),
        web.post('/v1/images/generations',service.legacy),web.get('/health',service.health),web.post('/unload',service.unload)])
    return app

if __name__=='__main__':
    ROOT.mkdir(parents=True,exist_ok=True)
    logging.basicConfig(filename=ROOT/'gateway.log',level=logging.INFO,format='%(asctime)s %(message)s')
    web.run_app(create_app(),host='127.0.0.1',port=19488,print=None)
