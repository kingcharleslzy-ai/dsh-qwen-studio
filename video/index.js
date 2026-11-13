import {applyVideoOptions, validateVideoOptions} from './advanced.js';
import { spawn } from 'node:child_process';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { connection, dataHome } from './connection.js';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {uploadReferences, validateIds} from './references.js';

export const name = 'h3-video';
export const inject = ['tools'];
import { registerStudio } from './studio.js';
const presets = ['turbo480', 'turbo768', 'quality480', 'quality768'];
const videos = join(dataHome, 'attachments', 'videos', 'h3');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function remote(args, signal) {
  const worker = await readFile(new URL('./worker.py', import.meta.url), 'utf8');
  const { cmd, argv, worker: config } = await connection();
  const payload = Buffer.from(JSON.stringify({ ...args, config })).toString('base64');
  const source = worker + '\nimport base64\ntry:\n    value = main(json.loads(base64.b64decode("' + payload +
    '")))\n    if value is not None: print(json.dumps(value))\nexcept Exception as exc:\n    sys.exit(ascii(str(exc)))\n';
  const binary = args.op === 'download';
  const limit = binary ? 128 * 1024 * 1024 : 65536;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { signal, windowsHide: true, timeout: 140000 });
    const chunks = [];
    let bytes = 0, stderr = '';
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > limit) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-1500); });
    child.stdin.on('error', () => {});
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0 || bytes > limit) return reject(Error(stderr.trim() || 'H3 connection interrupted'));
      const raw = Buffer.concat(chunks);
      try { resolve(binary ? raw : JSON.parse(raw.toString('utf8'))); } catch (err) { reject(err); }
    });
    child.stdin.end(source);
  });
}

async function collect(id, signal, waitMs) {
  if (!uuid.test(id)) throw Error('请输入 H3 返回的完整任务 ID。');
  const until = Date.now() + waitMs;
  let result;
  do {
    result = await remote({ op: 'status', id }, signal);
    if (!['running', 'queued'].includes(result.status) || Date.now() >= until) break;
    await sleep(3500, undefined, { signal });
  } while (true);
  if (result.status !== 'complete') return result;
  await mkdir(videos, { recursive: true });
  const path = join(videos, id + '.mp4');
  const verified = bytes => bytes.length === result.bytes && createHash('sha256').update(bytes).digest('hex') === result.sha256;
  const cached = await readFile(path).catch(e => { if (e.code !== 'ENOENT') throw e; });
  if (!cached || !verified(cached)) {
    const data = await remote({ op: 'download', id }, signal);
    if (!verified(data)) throw Error('视频传输校验失败，请用同一任务 ID 重试。');
    const tmp = path + '.' + randomUUID() + '.part';
    try {
      await writeFile(tmp, data, { flag: 'wx', mode: 0o600 });
      await rename(tmp, path);
    } finally { await rm(tmp, { force: true }); }
  }
  const { file, sha256, ...receipt } = result;
  return { ...receipt, path, playback_markdown: '[播放视频](/api/h3-video/video?id='+id+')' };
}

function tool(name, description, properties, required, execute) {
  return {
    name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
    timeoutMs: 300000,
    output: {
      schema: { type: 'object', properties: {
        playback_markdown:{type:'string'}, status: {type: 'string'}, id: {type: 'string'}, path: {type: 'string'}, message: {type: 'string'},
        duration_seconds: {type:'number'}, frames: {type:'integer'}, actual_seconds: {type:'number'},
        reference_images:{type:'array',items:{type:'string'}}, mode:{type:'string'}, preset: {type: 'string'}, seed: {type: 'integer'}, bytes: {type: 'integer'}, port: {type: 'integer'}
      }, required: ['status'] },
      presentationMeta: (_args,result) => ({status:result.status,id:result.id || '',message:result.message || ''}),
      render: (_args, result) => [{ type: 'text', text: JSON.stringify(result) }],
    },
    execute,
  };
}

async function submitVideo({prompt, reference_images = [], preset = reference_images?.length ? 'quality480' : 'turbo480', duration_seconds = 5, aspect, steps, seed = randomInt(2147483648)}, id, signal) {
  if (!uuid.test(id) || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000 ||
      !presets.includes(preset) || !Number.isInteger(seed) || seed < 0 || seed > 2147483647) {
    throw Error('请检查任务 ID、提示词、档位或随机种子。');
  }
  if (!Number.isFinite(duration_seconds) || duration_seconds < 1 || duration_seconds > 15)
    throw Error('每镜可请求 1–15 秒。较长视频请按镜头拆分。');
  validateVideoOptions(preset, aspect, steps);
  validateIds(reference_images);
  if (reference_images.length && preset.startsWith('turbo')) throw Error('参考图使用 quality480 或 quality768。');
  const frames = 5 + 17 * Math.ceil((duration_seconds * 24 - 5) / 17);
  const [mode, res] = preset.match(/^(turbo|quality)(480|768)$/).slice(1);
  const filename = 'H3-' + (mode === 'turbo' ? 'Turbo' : 'Quality') + '-' + res + 'p-' + (mode === 'turbo' ? 8 : 20) + 'steps.json';

  if (reference_images.length) {
    const workflow = JSON.parse(await readFile(new URL('./workflows/H3-Reference-Quality.json',import.meta.url),'utf8'));
    const ref = workflow['136'].inputs;
    ref.width = res === '480' ? 864 : 1344;
    ref.height = Number(res);
    applyVideoOptions(workflow, aspect, steps);
    const ready = await remote({op:'prepare',id},signal);
    if (ready.existing) return ready.existing;
    const images = await uploadReferences(reference_images,ready.port,signal);
    images.forEach((image,index) => {
      const key = index === 0 ? '137' : String(200+index);
      workflow[key] = {class_type:'LoadImage',inputs:{image}};
      ref['ref_images.ref_image_'+index] = [key,0];
    });
    return remote({op:'submit',id,port:ready.port,reference_images,prompt:prompt.trim(),preset,seed,duration_seconds,frames,workflow},signal);
  }
  const override = join(dataHome,'h3-video','workflows',filename);
  const raw = await readFile(override,'utf8').catch(err => {
    if (err.code !== 'ENOENT') throw err;
    return readFile(new URL('./workflows/'+filename,import.meta.url),'utf8');
  });
  const workflow = JSON.parse(raw);
  applyVideoOptions(workflow, aspect, steps);
  return remote({ op: 'submit', id, prompt: prompt.trim(), preset, seed, duration_seconds, frames, workflow }, signal);
}

export function apply(ctx) {
  ctx.inject(['webServer','attachments'], owner => registerStudio(owner, {
    videos, uuid, submitVideo, collect, release: () => remote({op:'release'}),
  }));
  ctx.tools.register(tool('h3_generate_video',
    '用 MiniMax H3 生成一个有声镜头。480p Turbo 预览用 turbo480，768p 质量档用 quality768。duration_seconds 指定 1–15 秒，默认 5 秒。按返回的任务 ID 继续查询，完成后将 playback_markdown 原样写入最终回复。',
    { reference_images:{type:'array',items:{type:'string'},description:'按 <Picture N> 顺序排列的 DSH 图片附件 ID；默认 quality480。'}, prompt: {type:'string'}, duration_seconds: {type:'number',description:'单镜请求时长（秒），1–15，默认 5。'}, preset: {type:'string',enum:presets}, aspect:{type:'string',enum:['landscape','portrait','square']}, steps:{type:'integer',minimum:4,maximum:50,description:'仅质量档可覆盖采样步数。'}, seed: {type:'integer', description:'0 到 2147483647，可复现同档位的随机输入。'} },
    ['prompt'], async (args, exec = {}) => {
      const id = exec.agent?.id && exec.callId ? stableId(exec.agent.id, exec.callId) : randomUUID();
      try {
        await submitVideo(args, id, exec.signal);
        return await collect(id, exec.signal, 65000);
      } catch (err) { throw Error('H3 任务 ' + id + '：' + err.message); }
    }));
  ctx.tools.register(tool('h3_video_status',
    '用生成时返回的 ID 查询同一个任务，完成后校验并取回 MP4。可以在稍后的对话中继续取片。',
    {id:{type:'string'}}, ['id'], ({ id }, exec = {}) => collect(id, exec.signal, 40000)));
  ctx.tools.register(tool('h3_release_gpu',
    '视频处理结束后，释放由本插件启动的空闲工作台，以便 DSH Qwen 生图。外部工作台继续由其原入口管理。',
    {}, [], (_args, exec = {}) => remote({ op:'release' }, exec.signal)));
}

function stableId(session, call) {
  const bytes = createHash('sha256').update(JSON.stringify([session, call])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = bytes.toString('hex');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
