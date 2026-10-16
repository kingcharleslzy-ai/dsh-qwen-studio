import { useId, useRef, useState } from 'react';
import { FolderOpen, File } from 'lucide-react';
interface DesktopPaths {
  __DSH_DIRECTORY_PICKER__?: { pick(): Promise<string | null> };
  __DSH_HOST_PATHS__?: { pathFor(file: globalThis.File): string };
}
export function PathField({label, name, value, placeholder, kind='directory', onChange, onError}:{
 label:string; name:string; value:string; placeholder:string; kind?:'file'|'directory'|'python';
 onChange(value:string):void; onError(message:string):void;
}) {
 const id=useId(),input=useRef<HTMLInputElement>(null),[picking,setPicking]=useState(false);
 const desktop=window as Window & DesktopPaths;
 async function pick(){
  onError('');
  if(kind==='file'){
   if(!desktop.__DSH_HOST_PATHS__){onError('当前环境无法取得本机文件路径，请手动输入。');return;}
   input.current?.click();return;
  }
  if(!desktop.__DSH_DIRECTORY_PICKER__){onError('当前环境不支持本机文件夹选择，请手动输入。');return;}
  setPicking(true);
  try {const path=await desktop.__DSH_DIRECTORY_PICKER__.pick();if(path)onChange(kind==='python'?path.replace(/\/$/,'')+'/bin/python':path);}
  catch(e){onError(e instanceof Error?e.message:String(e));}
  finally{setPicking(false);}
 }
 return <div className="q2-path-field"><label htmlFor={id}>{label}</label><div className="q2-path-row">
 <input id={id} aria-label={name} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>
 <button type="button" disabled={picking} aria-label={`选择${name}`} onClick={()=>void pick()}>{kind==='file'?<File/>:<FolderOpen/>}{kind==='file'?'选择文件':kind==='python'?'选择 Python 环境':'选择文件夹'}</button>
 </div>{kind==='file'&&<input type="file" ref={input} hidden tabIndex={-1} onChange={e=>{
  const file=e.target.files?.[0];
  if(file)try {const path=desktop.__DSH_HOST_PATHS__?.pathFor(file);if(!path)throw Error('没有取得本机文件路径，请手动输入。');onChange(path);}catch(error){onError(error instanceof Error?error.message:String(error));}
  e.target.value='';
 }}/>}</div>;
}
