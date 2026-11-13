import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {connection, dataHome} from './connection.js';
import {ComfyUIClient} from './vendor/dsh-comfyui/comfyui.js';

export const limit = 16 * 1024 * 1024;
export function imageType(bytes) {
  if (bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) return 'png';
  if (bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))) return 'jpeg';
  if (bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return 'webp';
  throw Error('参考图支持 JPEG、PNG 和 WebP。');
}

export function validateIds(ids) {
  if (!Array.isArray(ids) || ids.length > 9 || ids.some(id => typeof id !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(id)) || new Set(ids).size !== ids.length)
    throw Error('请传入最多 9 个互不重复的 DSH 图片附件 ID。');
}

// Tunnel each upload to the same SSH host and port the worker just verified.
export async function uploadReferences(ids, port, signal) {
  const {cmd, sshHost} = await connection();
  let server;
  const peers = new Set();
  try {
    let localPort = port;
    if (cmd === 'ssh') {
      server = createServer(socket => {
        peers.add(socket);
        const child = spawn('ssh',['-T','-o','BatchMode=yes','-o','ConnectTimeout=10','-W','127.0.0.1:'+port,sshHost],{stdio:['pipe','pipe','ignore'],signal});
        const close = () => socket.destroy();
        child.stdin.on('error',close);
        child.on('error',close);
        child.on('close',close);
        socket.on('error',close);
        socket.on('close',() => { peers.delete(socket); child.kill(); });
        socket.pipe(child.stdin);
        child.stdout.pipe(socket);
      });
      await new Promise((resolve,reject) => server.once('error',reject).listen(0,'127.0.0.1',resolve));
      localPort = server.address().port;
    }
    const client = new ComfyUIClient('http://127.0.0.1:'+localPort,undefined,15000,limit);
    const inputs = [];
    for (const id of ids) {
      signal?.throwIfAborted();
      const digest = id.slice(7);
      const file = join(dataHome,'attachments','v1','objects',digest.slice(0,2),digest);
      if ((await stat(file)).size > limit) throw Error('每张图片上限 16 MiB。');
      const bytes = await readFile(file);
      if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('参考图附件校验失败。');
      const ext = imageType(bytes), filename = digest+'.'+ext;
      const uploaded = await client.uploadMedia(bytes,filename,'image/'+ext,{subfolder:'dsh-h3-ref',overwrite:true});
      if (uploaded.name !== filename || uploaded.subfolder !== 'dsh-h3-ref' || uploaded.type !== 'input') throw Error('ComfyUI 返回的参考图位置不一致。');
      inputs.push(uploaded.subfolder+'/'+filename);
    }
    return inputs;
  } finally {
    for (const socket of peers) socket.destroy();
    server?.close();
  }
}
