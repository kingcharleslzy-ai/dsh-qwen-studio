import {createElement as h, useState, useEffect, useRef} from 'react';
const base = '/api/h3-video/';
const pendingKey = 'dsh-h3-video.pending';
const modes = [['turbo480','480p · Turbo'],['turbo768','768p · Turbo'],['quality480','480p · 质量'],['quality768','768p · 质量']];
const labels = {queued:'已排队',running:'生成中',complete:'已完成',failed:'生成失败',unknown:'等待确认'};
const url = id => base+'video?id='+encodeURIComponent(id);
async function api(route, data) {
  const response = await fetch(base+route, data ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {cache:'no-store'});
  const value = await response.json();
  if(!response.ok) throw Error(value.error || '请求失败');
  return value;
}
const css = `
  .h3page{box-sizing:border-box;height:100%;overflow:auto;padding:clamp(18px,4vw,54px);padding-top:max(32px,var(--dsh-frame-top-clearance,0px));font-family:"Instrument Sans",sans-serif;font-size:14px;line-height:1.55;color:inherit}
  .h3page *{box-sizing:border-box}.h3wrap{max-width:1080px;margin:0 auto}.h3page h1{font-size:clamp(28px,4vw,44px);line-height:1.08;margin:0 0 6px;letter-spacing:-.04em}.h3page h2{margin:0 0 12px;font-size:16px}
  .h3head{border-bottom:1px solid color-mix(in srgb,currentColor 20%,transparent);margin-bottom:24px;padding:8px 0 20px;display:flex;justify-content:space-between;align-items:end;gap:12px}.h3page small,.h3meta{opacity:.72}
  .h3grid{display:grid;grid-template-columns:minmax(240px,5fr) minmax(270px,7fr);gap:clamp(16px,3vw,40px)}.h3form{display:grid;gap:14px;align-content:start}.h3form label{display:grid;gap:5px;font-weight:600}
  .h3page textarea,.h3page select,.h3page input,.h3page button,.h3page a{font:inherit}.h3page textarea,.h3page select,.h3page input{border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:5px;color:inherit;background:transparent;padding:9px;width:100%}.h3page select option{color:CanvasText;background:Canvas}
  .h3advanced{border-block:1px solid color-mix(in srgb,currentColor 18%,transparent);padding-block:10px}.h3advanced summary{cursor:pointer;font-weight:600}.h3advanced label{margin-top:10px}.h3advanced small{display:block;margin-top:4px}
  .h3page textarea{resize:vertical;min-height:130px}.h3options{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .h3page button,.h3page a{color:inherit;cursor:pointer}.h3page button{border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;border-radius:5px;padding:7px 12px}
  .h3page button:disabled{opacity:.45;cursor:default}.h3page .h3go{background:#a7e8c0;color:#112d20;border-color:#75ae8b;font-weight:700;padding:11px}.h3screen{background:#121b18;color:#bcd4c6;aspect-ratio:16/9;display:grid;place-items:center;border-radius:7px;overflow:hidden}.h3screen video{width:100%;height:100%;object-fit:contain}
  .h3foot{margin-top:9px;display:flex;align-items:center;justify-content:space-between}.h3clips{display:flex;flex-wrap:wrap;gap:8px}.h3clips button[aria-pressed=true]{border-color:#489065;font-weight:700}
  .h3collection{margin-top:28px;border-top:1px solid color-mix(in srgb,currentColor 17%,transparent);padding-top:18px}.h3msg{overflow-wrap:anywhere}.h3page :focus-visible{outline:2px solid #449765;outline-offset:3px}
  .h3nav,.h3bar,.h3actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .h3nav button[aria-pressed=true]{color:Canvas;background:CanvasText}.h3head{align-items:center}
  .h3bar{margin:16px 0}.h3bar input[type=search],.h3bar input:not([type]){width:min(100%,300px)}
  .h3bar label{display:flex;align-items:center;gap:6px}.h3privacy{margin-inline-start:auto}.h3privacy input{width:auto}.h3bar select{width:auto}
  .h3import{position:relative;border:1px solid color-mix(in srgb,currentColor 25%,transparent);padding:7px 12px;border-radius:5px;cursor:pointer}.h3import input{position:absolute;inset:0;opacity:0;cursor:pointer}.h3import:focus-within{outline:2px solid #449765}
  .h3count{opacity:.7;margin:14px 0}.h3cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(205px,100%),1fr));gap:24px 16px}
  .h3card{position:relative;min-width:0}.h3card .h3open{display:grid;width:100%;text-align:start;padding:0;gap:5px;border:none}
  .h3open strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.h3thumb,.h3frame{position:relative;display:grid;place-items:center;background:#141817;border-radius:8px;overflow:hidden;aspect-ratio:16/9;width:100%}
  .h3thumb img,.h3frame video{width:100%;height:100%;object-fit:contain}.h3thumb img{object-fit:cover}
  .h3triangle,.h3card .h3star{position:absolute;border:0;background:#111b;color:white;border-radius:99px}
  .h3triangle{left:8px;bottom:8px;padding:1px 8px;font-size:11px}.h3card .h3star{top:8px;right:8px;width:30px;height:30px;padding:0;font-size:21px}
  .h3empty{margin:35px 0;opacity:.78}.h3dialog{color:CanvasText;background:Canvas;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:12px;width:min(680px,92vw);max-height:88vh;padding:18px;overflow:auto}
  .h3dialog::backdrop{background:#0009}.h3dialog header{margin:0 0 12px}.h3actions{margin-top:12px}
  .h3player .h3playbtn{position:absolute;font-size:24px;background:#101a;padding:10px 17px;border-radius:99px;color:white;border:1px solid #fff9}
  .h3inline,.h3tool{display:grid;gap:6px;max-width:560px;margin:8px 0}.h3inline video,.h3tool video{max-width:100%;max-height:320px;border-radius:8px;background:#161818}.h3inline button{justify-self:start;cursor:pointer}.h3foot{gap:8px;flex-wrap:wrap}
  @media(max-width:720px){.h3grid{grid-template-columns:1fr}.h3page{padding:16px}.h3head{align-items:center}}
`;
const clipId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const posterUrl=id=>base+'poster?id='+encodeURIComponent(id);
const clipTitle=clip=>clip.title || 'H3 · '+clip.id.slice(0,8);
const dateLabel=time=>new Date(time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
// Electron's custom app scheme can return a poster yet stall on media range
// requests. Read via the authenticated page origin and give Chromium a Blob
// only when playback is requested. Revoke it when the player goes away.
function bindPlayer(video,id){
  const abort=new AbortController();
  let objectUrl='',loading=false,disposed=false,compat=false;
  const local=location.protocol==='dsh-app:';
  function report(text){video.closest('.h3player,.h3inline')?.querySelector('.h3playmsg')?.replaceChildren(text);}
  async function load(){
    if(disposed || loading)return;
    if(objectUrl){await video.play().catch(()=>{});return;}
    loading=true;compat=true;report('正在准备兼容预览…');
    try{
      let res=await fetch(base+'preview?id='+encodeURIComponent(id),{signal:abort.signal});
      if(!res.ok && local)res=await fetch(url(id),{signal:abort.signal});
      if(!res.ok){const err=await res.json().catch(()=>({}));throw Error(err.error || 'HTTP '+res.status);}
      const blob=await res.blob();
      if(disposed)return;
      if(!blob.size)throw Error('文件为空');
      objectUrl=URL.createObjectURL(blob);video.src=objectUrl;
      await video.play();report('');
    }catch(e){if(!disposed)report('播放未开始：'+(video.error?.message || e.message)+'。可重试或下载 MP4。');}
    finally{loading=false;}
  }
  const trigger=()=>{if(local || video.error)load();else video.play().catch(()=>load());};
  const fail=()=>{
    if(disposed)return;
    if(!compat && !local){load();return;}
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
    report('无法播放预览（'+(video.error?.message || video.error?.code || '媒体错误')+'）');
  };
  const playing=()=>report('');
  let lastSecond=-1;
  function updateTime(){
    const second=Math.floor(video.currentTime);
    if(second===lastSecond || !Number.isFinite(video.duration))return;
    lastSecond=second;
    const format=t=>Math.floor(t/60)+':'+String(Math.floor(t)%60).padStart(2,'0');
    video.closest('.h3player,.h3inline')?.querySelector('.h3time')?.replaceChildren(format(second)+' / '+format(video.duration));
  }
  video.addEventListener('timeupdate',updateTime);
  video.addEventListener('error',fail);video.addEventListener('playing',playing);
  if(!local)video.src=url(id);
  return {trigger,dispose(){
    disposed=true;abort.abort();video.removeEventListener('timeupdate',updateTime);video.removeEventListener('error',fail);video.removeEventListener('playing',playing);
    video.pause();video.removeAttribute('src');video.load();if(objectUrl)URL.revokeObjectURL(objectUrl);
  }};
}
function Player({id,title,autoStart=false}){
  const node=useRef(null),control=useRef(null);
  const [started,setStarted]=useState(autoStart);
  useEffect(()=>{
    const bound=bindPlayer(node.current,id);control.current=bound;if(autoStart)bound.trigger();
    return ()=>{bound.dispose();control.current=null;};
  },[id]);
  return h('div',{className:'h3player'},h('div',{className:'h3frame'},
    h('video',{ref:node,controls:started,playsInline:true,preload:'metadata',poster:posterUrl(id),'aria-label':title}),
    !started && h('button',{className:'h3playbtn','aria-label':'播放 '+title,onClick:()=>{setStarted(true);control.current?.trigger();}},'▶')),
    h('div',{className:'h3foot'},h('span',{className:'h3playmsg',role:'status'}),h('small',{className:'h3time'}),started && h('button',{onClick:()=>control.current?.trigger()},'重新播放'),h('a',{href:url(id),download:'H3-'+id+'.mp4'},'下载 MP4')));
}
// Adapted from dsh-comfyui's MIT inline-media observer. Only our playback
// links and known H3 cache links resolve to this fixed same-origin route.
function installChatPlayers(){
  if(typeof document==='undefined')return;
  const mounted=new Map();
  function idFor(link){
    if(link.closest('.h3page,.h3inline,.h3tool') || link.hasAttribute('download'))return;
    let u;try{u=new URL(link.getAttribute('href'),location.href);}catch{return;}
    if(u.host===location.host && u.protocol===location.protocol && u.pathname===base+'video'){
      const id=u.searchParams.get('id');if(clipId.test(id))return id;
    }
    if(!['file:',location.protocol].includes(u.protocol) || (u.host && u.host!==location.host))return;
    const match=u.pathname.match(/\/attachments\/videos\/h3\/([a-f0-9-]+)\.mp4$/);
    if(match && clipId.test(match[1]))return match[1];
  }
  function scan(){
    for(const [link,entry] of mounted){
      if(link.isConnected && entry.wrap.isConnected && idFor(link)===entry.id)continue;
      entry.dispose();entry.wrap.remove();mounted.delete(link);
    }
    for(const link of document.querySelectorAll('a[href*="/h3-video/video"],a[href*="/videos/h3/"]')){
      const id=idFor(link);if(!id || mounted.has(link))continue;
      const wrap=document.createElement('span');wrap.className='h3inline';
      const video=document.createElement('video');video.playsInline=true;video.preload='none';video.poster=posterUrl(id);
      const button=document.createElement('button');button.textContent='▶ 播放视频';button.type='button';
      const message=document.createElement('span');message.className='h3playmsg';message.setAttribute('role','status');
      const time=document.createElement('small');time.className='h3time';wrap.append(video,button,message,time);link.after(wrap);
      const player=bindPlayer(video,id);button.onclick=()=>{video.controls=true;player.trigger();};
      mounted.set(link,{id,wrap,dispose:player.dispose});
    }
  }
  let frame=0;
  const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;scan();});});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});scan();
  return ()=>{observer.disconnect();cancelAnimationFrame(frame);for(const v of mounted.values()){v.dispose();v.wrap.remove();}};
}

async function importBlob(blob,title,signal){
  const response=await fetch(base+'import',{method:'POST',headers:{'content-type':'video/mp4'},body:blob,signal});
  const value=await response.json();if(!response.ok)throw Error(value.error || '导入失败');
  const storedTitle=title.replace(/\.mp4$/i,'').slice(0,120);
  if(storedTitle && value.created)await api('mark',{id:value.id,field:'title',value:storedTitle});
  return value.id;
}
function DeliveredVideo({sessionId,file,readBytes}){
  const [id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const controller=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const title=file.path.split(/[\\/]/).pop();
  async function openDelivered(){
    if(busy)return;
    setBusy(true);setError('');
    const abort=new AbortController();controller.current=abort;
    try{
      const chunks=[];let offset=0,version;
      for(;;){
        const result=await readBytes(sessionId,file.path,{range:{offset,length:1024*1024}},abort.signal);
        if(!result.ok)throw Error(result.error?.message || '原文件不可读');
        const row=result.value;
        if((version!==undefined && version!==row.version) || row.offset!==offset)throw Error('读取期间文件发生变化');
        version=row.version;
        if(row.bytes>256*1024*1024 || offset+row.data.byteLength>256*1024*1024)throw Error('较大文件请使用视频库中的「导入 MP4」');
        chunks.push(row.data);offset+=row.data.byteLength;
        if(row.eof)break;
        if(!row.data.byteLength)throw Error('原文件读取中断');
      }
      const key=await importBlob(new Blob(chunks,{type:'video/mp4'}),title,abort.signal);
      if(!abort.signal.aborted)setId(key);
    }catch(e){if(!abort.signal.aborted)setError(e.message);}finally{if(!abort.signal.aborted)setBusy(false);}
  }
  return h('div',{className:'h3tool'},id?h(Player,{id,title,autoStart:true}):
    h('button',{disabled:busy,onClick:openDelivered},busy?'读取视频…':'▶ 在对话中播放 '+title),
    error&&h('small',{role:'alert'},error));
}

function Library({clips,refresh,privacy,setPrivacy}){
  const [filter,setFilter]=useState(privacy?'favorites':'all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(24);
  const [current,setCurrent]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState('');
  const modal=useRef(null);
  const groups=[...(privacy?[]:[['all','全部作品']]),['favorites','收藏'],...(privacy?[['private','隐私视频库']]:[]),['archive','归档'],['trash','回收站']];
  const category=c=>filter==='archive'||filter==='trash'?c.folder===filter:
    c.folder==='library' && (filter==='all'||(filter==='favorites'?c.favorite:!c.favorite));
  const filtered=clips.filter(c=>category(c) && (clipTitle(c)+' '+c.id+' '+dateLabel(c.time)).toLowerCase().includes(query.trim().toLowerCase()));
  const clip=clips.find(c=>c.id===current);
  useEffect(()=>{if(current && !modal.current.open)modal.current.showModal();},[current]);
  function close(){modal.current?.close();setCurrent('');setError('');}
  async function mark(id,field,value){
    setBusy(true);setError('');
    try{await api('mark',{id,field,value});await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function switchPrivacy(){setPrivacy(!privacy);setFilter(privacy?'all':'favorites');setLimit(24);}
  return h('section',{className:'h3library','aria-label':'视频库'},
    h('div',{className:'h3bar'},h('label',null,'筛选',h('select',{value:filter,'aria-label':'视频库筛选',onChange:e=>{setFilter(e.target.value);setLimit(24);}},groups.map(([id,label])=>h('option',{key:id,value:id},label)))),
    h('input',{type:'search',value:query,placeholder:'搜索片名、日期或任务 ID','aria-label':'搜索视频',onChange:e=>{setQuery(e.target.value);setLimit(24);}}),
    h('label',{className:'h3import'},busy?'正在处理…':'导入 MP4',h('input',{type:'file',accept:'video/mp4,.mp4',disabled:busy,onChange:async e=>{
      const file=e.target.files[0];e.target.value='';if(!file)return;
      setBusy(true);setError('');
      try{const id=await importBlob(file,file.name);await refresh();setFilter(privacy?'private':'all');setQuery('');setCurrent(id);setDraft(file.name.replace(/\.mp4$/i,''));}catch(err){setError(err.message);}finally{setBusy(false);}
    }})),
    h('button',{onClick:()=>refresh().catch(e=>setError(e.message))},'刷新'),
    h('label',{className:'h3privacy'},h('input',{type:'checkbox',checked:privacy,onChange:switchPrivacy}),'隐私模式')),
    h('div',{className:'h3count'},groups.find(([id])=>id===filter)?.[1]+' · '+filtered.length+' 部'),
    !current&&error&&h('p',{role:'alert'},error),
    filtered.length?h('div',{className:'h3cards'},filtered.slice(0,limit).map(c=>h('article',{className:'h3card',key:c.id},
      h('button',{className:'h3open','aria-label':'打开 '+clipTitle(c),onClick:()=>{setDraft(c.title);setCurrent(c.id);}},
        h('span',{className:'h3thumb'},h('img',{src:posterUrl(c.id),loading:'lazy',alt:'',onError:e=>{e.currentTarget.hidden=true;}}),h('span',{className:'h3triangle','aria-hidden':true},'▶')),
        h('strong',null,clipTitle(c)),h('small',null,dateLabel(c.time)+' · '+(c.bytes/1048576).toFixed(1)+' MB')),
      h('button',{className:'h3star',disabled:busy,'aria-pressed':c.favorite,'aria-label':(c.favorite?'取消收藏 ':'收藏 ')+clipTitle(c),onClick:()=>mark(c.id,'favorite',!c.favorite)},c.favorite?'★':'☆')))):
      h('p',{className:'h3empty'},query?'没有匹配的视频':filter==='favorites'&&privacy?'还没有收藏。打开「隐私视频库」，点击星标即可收藏。':'这里还没有视频。'),
    filtered.length>limit&&h('button',{onClick:()=>setLimit(limit+24)},'加载更多'),
    h('dialog',{ref:modal,className:'h3dialog',onClose:()=>setCurrent('')},clip&&h('div',null,
      h('header',{className:'h3foot'},h('h2',null,clipTitle(clip)),h('button',{onClick:close},'关闭')),
      h(Player,{id:clip.id,key:clip.id,title:clipTitle(clip)}),
      h('div',{className:'h3bar'},h('input',{'aria-label':'片名',value:draft,maxLength:120,placeholder:'为作品命名',onChange:e=>setDraft(e.target.value)}),h('button',{disabled:busy||draft===clip.title,onClick:()=>mark(clip.id,'title',draft)},'保存片名')),
      h('small',null,clip.id),h('div',{className:'h3actions'},
        h('button',{disabled:busy,onClick:()=>mark(clip.id,'favorite',!clip.favorite)},clip.favorite?'取消收藏':'收藏'),
        clip.folder!=='trash'&&h('button',{disabled:busy,onClick:()=>mark(clip.id,'folder',clip.folder==='archive'?'library':'archive')},clip.folder==='archive'?'取消归档':'归档'),
        h('button',{disabled:busy,onClick:()=>mark(clip.id,'folder',clip.folder==='trash'?'library':'trash')},clip.folder==='trash'?'恢复到视频库':'移入回收站')),error&&h('p',{role:'alert'},error))));
}

export function VideoPage() {
  const [page,setPage]=useState('create');
  const [privacy,setPrivacyState]=useState(()=>localStorage.getItem('h3-private-library')!=='off');
  function setPrivacy(value){setPrivacyState(value);localStorage.setItem('h3-private-library',value?'on':'off');}
  const [prompt,setPrompt]=useState(''),[preset,setPreset]=useState('turbo480'),[seed,setSeed]=useState('');
  const [duration,setDuration]=useState('5');
  const [invalidRefs,setInvalidRefs]=useState(false),[refs,setRefs]=useState([]),[uploading,setUploading]=useState(false);
  const [aspect,setAspect]=useState(''),[steps,setSteps]=useState('');
  const quality=preset.startsWith('quality');
  const validSteps=!quality || steps==='' || (Number.isInteger(Number(steps)) && Number(steps)>=4 && Number(steps)<=50);
  const seconds=Number(duration);
  const validDuration=Number.isFinite(seconds) && seconds>=1 && seconds<=15;
  const [pending,setPending]=useState(()=>localStorage.getItem(pendingKey)||'');
  const [sending,setSending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [clips,setClips]=useState([]),[selected,setSelected]=useState('');
  const submitLock=useRef(false);
  async function refresh() {
    const items=await api('gallery'); setClips(items);
    setSelected(old=>old && items.some(c=>c.id===old&&c.folder==='library')?old:'');
  }
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(!pending || sending) return;
    let stopped=false, timer;
    async function poll(){
      try{
        const job=await api('status',{id:pending});
        if(stopped)return;
        const timing=job.frames ? ' · '+job.frames+' 帧 · '+job.actual_seconds.toFixed(2)+' 秒' : '';
        setError(''); setMessage((labels[job.status] || job.status)+timing);
        if(job.status==='complete' || job.status==='failed'){
          localStorage.removeItem(pendingKey); setPending('');
          if(job.status==='failed')setError(job.message || '生成失败');
          else{setSelected(pending);await refresh();}
          return;
        }
      }catch(e){if(!stopped)setError(e.message);}
      if(!stopped)timer=setTimeout(poll,4500);
    }
    poll();return ()=>{stopped=true;clearTimeout(timer);};
  },[pending,sending]);
  async function loadRefs(files){
    setInvalidRefs(false);
    if(!files.length){setRefs([]);return;}
    setUploading(true);setError('');
    try{
      if(files.length>9)throw Error('每镜最多 9 张参考图');
      const items=[];
      for(const file of files){
        if(file.size>16*1024*1024)throw Error('图片超过 16 MiB');
        const res=await fetch(base+'reference',{method:'POST',headers:{'content-type':file.type},body:file});
        const value=await res.json();
        if(!res.ok)throw Error(value.error);
        if(items.some(item=>item.id===value.id))throw Error('同一张参考图只能选择一次');
        items.push({name:file.name,id:value.id});
      }
      setRefs(items);setPreset(old=>old.replace('turbo','quality'));
    }catch(e){setInvalidRefs(true);setRefs([]);setError(e.message);}finally{setUploading(false);}
  }
  async function generate(){
    if(submitLock.current || pending || !prompt.trim() || !validDuration || !validSteps)return;
    if(seed!=='' && (!Number.isInteger(Number(seed)) || Number(seed)<0 || Number(seed)>2147483647)){setError('种子范围为 0–2147483647');return;}
    submitLock.current=true;setSending(true);setError('');setMessage('正在连接 H3…');
    const id=crypto.randomUUID();localStorage.setItem(pendingKey,id);setPending(id);
    try{await api('generate',{id,prompt,preset,reference_images:refs.map(r=>r.id),duration_seconds:seconds,...(aspect?{aspect}:{}),...(quality && steps!==''?{steps:Number(steps)}:{}),...(seed!==''?{seed:Number(seed)}:{})});setMessage('已提交');}
    catch(e){setError(e.message);setMessage('可按任务 ID 查询提交结果');}
    finally{submitLock.current=false;setSending(false);}
  }
  async function release(){setError('');try{const r=await api('release',{});setMessage(({released:'显卡已释放，可切回 Qwen 生图。',busy:'队列或视频调度器仍在使用显卡。',shared:'当前没有由本插件启动的工作台。'})[r.status] || r.message);}catch(e){setError(e.message);}}
  return h('main',{className:'h3page'},h('div',{className:'h3wrap'},
    h('header',{className:'h3head'},h('div',null,h('h1',null,'视频'),h('span',{className:'h3meta'},'MiniMax H3')),h('nav',{className:'h3nav','aria-label':'视频导航'},[['create','创作'],['library','视频库']].map(([id,label])=>h('button',{key:id,'aria-pressed':page===id,onClick:()=>setPage(id)},label))),page==='create'&&h('button',{onClick:release,disabled:!!pending},'释放显卡')),
    page==='library'&&error&&h('p',{role:'alert'},error),
    page==='library'&&h(Library,{clips,refresh,privacy,setPrivacy}),
    h('div',{hidden:page!=='create'},
    h('div',{className:'h3grid'},h('section',{className:'h3form'},
      h('label',null,'画面与声音',h('textarea',{value:prompt,maxLength:12000,onChange:e=>setPrompt(e.target.value),placeholder:'描述主体、动作、镜头和环境声…'})),
      h('label',null,'人物 / 参考图（可选，最多 9 张）',h('input',{type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true,disabled:uploading||sending,onChange:e=>loadRefs(Array.from(e.target.files))})),
      (invalidRefs || refs.length>0) && h('button',{onClick:e=>{e.currentTarget.parentElement.querySelector('input[type=file]').value='';setRefs([]);setInvalidRefs(false);setError('');},disabled:uploading},'清空参考图'),
      uploading && h('small',null,'正在导入参考图…'),
      refs.length>0 && h('small',null,refs.map((r,i)=>'<Picture '+(i+1)+'> '+r.name).join(' · ')),
      h('label',null,'生成档位',h('select',{value:preset,onChange:e=>setPreset(e.target.value)},modes.filter(([id])=>!refs.length||id.startsWith('quality')).map(([id,label])=>h('option',{key:id,value:id},label)))),
      h('details',{className:'h3advanced'},h('summary',null,'高级设置'),
        h('label',null,'画幅',h('select',{value:aspect,onChange:e=>setAspect(e.target.value)},
          [['','跟随工作流'],['landscape','横屏'],['portrait','竖屏'],['square','方形']].map(([id,title])=>h('option',{key:id,value:id},title)))),
        h('label',null,'采样步数',h('input',{type:'number',min:4,max:50,step:1,disabled:!quality,value:quality?steps:'8',placeholder:'工作流默认（内置 20 步）',onChange:e=>setSteps(e.target.value),'aria-invalid':!validSteps})),
        h('small',null,quality?'4–50 步。步数越高通常越慢，可固定种子比较效果。':'内置 Turbo 使用 8 步蒸馏采样。选择质量档可调整步数。'),
        h('label',null,'随机种子',h('input',{type:'number',min:0,max:2147483647,value:seed,onChange:e=>setSeed(e.target.value),placeholder:'自动'})),h('small',null,'留空自动抽取；填写 0–2147483647 可复用同一随机输入。')),
      h('label',null,'单镜时长（秒）',h('input',{type:'number',min:1,max:15,step:'any',value:duration,onChange:e=>setDuration(e.target.value),'aria-invalid':!validDuration})),
      h('small',null,validDuration?'24 fps · 帧数按 H3 支持的长度向上对齐':'请输入 1–15 秒'),h('button',{className:'h3go',onClick:generate,disabled:uploading||invalidRefs||!validDuration||!validSteps||!prompt.trim()||!!pending||sending},pending?'正在处理…':'生成视频'),
      h('div',{className:'h3msg',role:'status'},message),error && h('div',{className:'h3msg',role:'alert'},error),
      pending && h('small',null,'任务 ',pending),pending && !sending && error && h('button',{onClick:()=>{localStorage.removeItem(pendingKey);setPending('');setMessage('已停止跟踪；原任务可在对话中按 ID 查询。');}},'停止跟踪此任务')),
      h('section',null,h('h2',null,'成片预览'),selected?h(Player,{key:selected,id:selected,title:'成片预览'}):h('div',{className:'h3screen'},'完成后可在这里播放'))))));
}
export function installVideoPlayers(ctx) {
  ctx.effect(()=>installChatPlayers(),'H3 chat players');
  ctx.effect(()=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);return ()=>style.remove();},'H3 player styles');
  ctx.inject(['remote','remote.workspaceFiles'],owner=>{
    owner.slots.inject('conversation.chat.turnTail',()=>owner.slots.register({name:'conversation.chat.turnTail',id:'h3-delivered-videos',inject:()=>({})},({turn,sessionId})=>{
      const files=turn?.data?.get('deliverables')?.presented || [];
      return [...new Set(files.map(f=>f.path).filter(p=>typeof p==='string' && /\.mp4$/i.test(p)))].map(path=>
        h(DeliveredVideo,{key:sessionId+'-'+path,sessionId,file:{path},readBytes:(...args)=>owner.remote.workspaceFiles.readBytes(...args)}));
    }));
  });
  for(const name of ['h3_generate_video','h3_video_status']){
    ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},({block})=>{
      const meta=block?.meta;
      if(meta?.status==='complete' && clipId.test(meta.id))return h('div',{className:'h3tool'},h(Player,{key:meta.id,id:meta.id,title:'H3 成片'}));
      return h('span',null,meta?.message || labels[meta?.status] || (block?.isError?'视频任务失败':block?.kind==='tool-result'?'H3 视频结果':'正在处理 H3 视频…'));
    }));
  }
}
