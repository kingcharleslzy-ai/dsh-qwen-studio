import {execFile} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const dataHome = process.env.DSH_HOME || join(homedir(), '.dsh');
const configPath = join(dataHome, 'h3-video', 'film.json');
const bundledBridge = fileURLToPath(new URL('./bridge.py', import.meta.url));
const string = {type:'string'};
const integer = {type:'integer'};
const presets = ['turbo480','turbo768','quality480','quality768'];
export const name = 'h3-film-local';
export const inject = ['tools','skills','attachments'];

async function local(op, payload, signal) {
  const config = await readFile(configPath,'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') throw Error('请按 studio-model-setup 技能配置 h3-video/film.json 后使用长片工具。');
    throw error;
  });
  return new Promise((resolve,reject) => {
    const child = execFile(config.python, [config.bridge || bundledBridge,configPath,op], {
      signal, timeout: 850000, maxBuffer: 2*1024*1024,
      env:{...process.env,PATH:config.path || process.env.PATH}
    }, (error,stdout,stderr) => {
      if(error) return reject(Error(stderr.trim().slice(-1800) || error.message));
      try { resolve(JSON.parse(stdout)); } catch(err) { reject(err); }
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(payload));
  });
}

function filmId(exec) {
  if (!exec.agent?.id || !exec.callId) return randomUUID();
  return createHash('sha256').update(JSON.stringify([exec.agent.id,exec.callId])).digest('hex').slice(0,32);
}

export function apply(ctx) {
  function register(name,description,properties,required,execute) {
    ctx.tools.register({name,description,parameters:{type:'object',properties,required,additionalProperties:false},
      timeoutMs:900000,output:{schema:{type:'object',properties:{id:string,status:string},required:['id','status']},
        render:(_args,{preview,...value})=>[{type:'text',text:JSON.stringify(value)},...(preview?[{type:'image',attachment:preview}]:[])]},execute});
  }
  const characterIds = {type:'array',items:string,description:'依次引用 h3_character_list 中的角色 ID；分镜设置覆盖全片，空数组为空镜。'};
  register('h3_character_list','查看本机人物库、角色 ID 和各参考图的固定顺序。',{},[],(args,exec)=>local('character_list',args,exec.signal));
  register('h3_character_save','以名称保存或更新本机角色卡；已创建的电影锁定原版。每张图使用 DSH 图片附件 ID。',
    {name:string,reference_images:{type:'array',items:string}},['name','reference_images'],(args,exec)=>local('character_save',args,exec.signal));
  const shot = {type:'object',properties:{character_ids:characterIds,purpose:string,prompt:string,seconds:integer,narration:string},
    required:['purpose','prompt','seconds'],additionalProperties:false};
  register('h3_film_create','为完整多镜头 H3 视频创建本机 SVD 项目。自行拆分镜头，秒数相加等于成片时长；返回项目 ID 后持续调用 h3_film_next。',
    {character_ids:characterIds,title:string,brief:string,duration_seconds:integer,representative:integer,preset:{type:'string',enum:presets},shots:{type:'array',items:shot}},
    ['title','brief','duration_seconds','shots'],(args,exec)=>local('create',{...args,id:filmId(exec)},exec.signal));
  async function present(state) {
    if (state.gallery_path) {
      const id=basename(state.gallery_path,'.mp4');
      if (/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
        return {...state,playback_markdown:'[播放完整影片](/api/h3-video/video?id='+id+')'};
    }
    if (!state.contact_sheet) return state;
    const {contact_sheet,...result}=state;
    result.preview=await ctx.attachments.saveImage({data:await readFile(contact_sheet),mediaType:'image/jpeg',name:'shot-review.jpg'});
    return result;
  }
  register('h3_film_next','继续同一个长片项目，从持久记录逐镜执行。返回当前片段供模型审片，全部通过后剪辑导出完整 MP4。',
    {id:string},['id'],async ({id},exec)=>{
      const next=await local('next',{id},exec.signal);
      if(next.status!=='generate')return present(next);
      const toolName=next.job_id?'h3_video_status':'h3_generate_video';
      const tool=ctx.tools.get(toolName,exec.agent,exec.toolSet);
      if(!tool)throw Error('当前会话需要启用视频工具 '+toolName);
      const args=next.job_id?{id:next.job_id}:next.generation;
      // The H3 tool keys submissions on agent ID and call ID. Both must remain
      // stable when a film is resumed in a different chat or device session.
      const result=await tool.execute(args,{...exec,agent:{id:'h3-film-'+id},callId:next.take});
      return present(await local('receipt',{id,take:next.take,receipt:result},exec.signal));
    });
  register('h3_film_status','查询项目当前状态、审片素材或完整母版，无生成开销。',
    {id:string},['id'],async (args,exec)=>present(await local('status',args,exec.signal)));
  register('h3_film_narration','修改指定分镜的本地配音文案，例如缩短超时旁白。空字符串留白。',
    {id:string,shot_number:integer,narration:string},['id','shot_number','narration'],(args,exec)=>local('narration',args,exec.signal));
  register('h3_film_finish_review','完整观看并听检母版后，按母版 SHA-256 登记最终审片结论。未观看时保留待审状态。',
    {id:string,sha256:string,notes:string},['id','sha256','notes'],async (args,exec)=>present(await local('finish_review',args,exec.signal)));
  register('h3_film_review','记录当前镜头的实际审片结果。reject 时可修订提示词重生成；accept 后继续 h3_film_next。',
    {id:string,review_token:string,decision:{type:'string',enum:['accept','reject']},reason:string,replacement_prompt:string},
    ['id','review_token','decision','reason'],(args,exec)=>local('review',args,exec.signal));
}
