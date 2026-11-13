import {open,link,readFile, mkdir, rename, rm, writeFile, readdir, stat} from 'node:fs/promises';
import {join, delimiter} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const fields = ['title','favorite','folder'];
export async function listClips(videos, uuid) {
  const entries = await readdir(videos,{withFileTypes:true}).catch(e => {
    if (e.code === 'ENOENT') return [];
    throw e;
  });
  const clips = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mp4')) continue;
    const id = entry.name.slice(0,-4);
    if (!uuid.test(id)) continue;
    try {
      const info = await stat(join(videos,entry.name));
      const marks = await Promise.all(fields.map(field =>
        readFile(join(videos,'.library',id+'.'+field),'utf8').catch(e => {
          if (e.code === 'ENOENT') return '';
          throw e;
        })));
      clips.push({id,time:info.mtimeMs,bytes:info.size,title:marks[0],favorite:marks[1]==='true',folder:marks[2] || 'library'});
    } catch (error) { if(error.code!=='ENOENT') throw error; }
  }
  return clips.sort((a,b)=>b.time-a.time || a.id.localeCompare(b.id));
}

export async function setMark(videos,uuid,{id,field,value}) {
  if (!uuid.test(id) || !fields.includes(field)) throw Error('无效的视频或操作');
  if (field==='favorite' && typeof value!=='boolean' ||
      field==='folder' && !['library','archive','trash'].includes(value) ||
      field==='title' && (typeof value!=='string' || value.length>120)) throw Error('无效的作品信息');
  await stat(join(videos,id+'.mp4'));
  const dir = join(videos,'.library');
  await mkdir(dir,{recursive:true});
  const dest=join(dir,id+'.'+field), tmp=dest+'.'+randomUUID()+'.tmp';
  try {
    await writeFile(tmp,String(value).trim(),{mode:0o600});
    await rename(tmp,dest);
  } finally {await rm(tmp,{force:true});}
}

// Coalesce simultaneous requests and limit first-visit thumbnail decoding.
const pending = new Map();
let tail = Promise.resolve();
export async function poster(videos,id) {
  const source=join(videos,id+'.mp4');
  const {mtimeMs,size}=await stat(source);
  const dir=join(videos,'.library','posters');
  const file=join(dir,id+'-'+Math.floor(mtimeMs)+'-'+size+'.jpg');
  try {return await readFile(file);} catch(e) {if(e.code!=='ENOENT') throw e;}
  if (!pending.has(file)) {
    const job=tail.then(async()=>{
      const {stdout}=await execute('ffmpeg',['-nostdin','-loglevel','error','-protocol_whitelist','file,pipe','-f','mov','-i',source,'-frames:v','1','-vf','scale=480:-2','-f','image2pipe','-c:v','mjpeg','pipe:1'],{encoding:'buffer',maxBuffer:2*1024*1024,timeout:12000,windowsHide:true,env:ffmpegEnv()});
      if (!stdout.length) throw Error('视频没有可读取的封面');
      await mkdir(dir,{recursive:true});
      const tmp=file+'.'+randomUUID()+'.tmp';
      try {await writeFile(tmp,stdout,{mode:0o600});await rename(tmp,file);} finally {await rm(tmp,{force:true});}
      return stdout;
    });
    tail=job.catch(()=>{});
    pending.set(file,job.finally(()=>pending.delete(file)));
  }
  return pending.get(file);
}

const transcodes=new Map();
let nextConversion=Promise.resolve();
export async function compatibleVideo(videos,id) {
  const original=join(videos,id+'.mp4');
  const {size,mtimeMs}=await stat(original);
  const dir=join(videos,'.library','playback');
  const target=join(dir,id+'-'+Math.floor(mtimeMs)+'-'+size+'.webm');
  try {await stat(target);return target;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!transcodes.has(target)){
    const job=nextConversion.then(async()=>{
      await mkdir(dir,{recursive:true});
      const tmp=join(dir,randomUUID()+'.webm');
      try{
        await execute('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-f','mov','-i',original,
          '-map','0:v:0','-map','0:a:0?','-vf','scale=min(1280\\,iw):-2','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6',
          '-row-mt','1','-threads','4','-pix_fmt','yuv420p','-crf','34','-b:v','0','-c:a','libopus','-b:a','96k',tmp],
          {timeout:1800000,windowsHide:true,env:ffmpegEnv()});
        await rename(tmp,target);return target;
      } finally {await rm(tmp,{force:true});}
    });
    nextConversion=job.catch(()=>{});
    transcodes.set(target,job.finally(()=>transcodes.delete(target)));
  }
  return transcodes.get(target);
}

function ffmpegEnv(){
  const extra=process.platform==='darwin'?['/opt/homebrew/bin','/usr/local/bin']:[];
  return {...process.env,PATH:[process.env.PATH,...extra].filter(Boolean).join(delimiter)};
}

export async function importVideo(videos,req) {
  await mkdir(videos,{recursive:true});
  const tmp=join(videos,randomUUID()+'.import');
  const hash=createHash('sha256'), head=Buffer.alloc(12);
  let size=0;
  const handle=await open(tmp,'wx',0o600);
  try {
    try {
      for await (const chunk of req) {
        if(size<12)chunk.copy(head,size,0,Math.min(chunk.length,12-size));
        size+=chunk.length;
        if(size>1024**3)throw Error('本地导入上限为 1 GiB');
        if(size>=12 && head.toString('ascii',4,8)!=='ftyp')throw Error('需要标准 MP4 文件');
        hash.update(chunk);await handle.writeFile(chunk);
      }
    }finally{await handle.close();}
    if(size<12)throw Error('MP4 文件不完整');
    const bytes=hash.digest().subarray(0,16);
    bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
    const s=bytes.toString('hex');
    const id=[s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
    let created=true;
    try{await link(tmp,join(videos,id+'.mp4'));}catch(e){if(e.code!=='EEXIST')throw e;created=false;}
    return {id,created};
  }finally{await rm(tmp,{force:true});}
}
