import { useEffect, useState } from "react";
import { request } from "./api.js";
import type { UpdatePreferences, UpdateState } from "../updates.js";
import { ParameterHelp } from "./parameter-help.js";
type State = UpdateState & { preferences: UpdatePreferences; runningVersion: string; backups?: {id:string;version?:string}[] };
export function UpdateSettings() {
  const [value,setValue]=useState<State>(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let alive=true;void request<State>("updates").then(v=>{if(!v.preferences)throw Error("更新服务尚未加载，请重新打开 DSH");if(alive)setValue(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
  async function action(data:unknown) {
    setBusy(true);setError("");
    try { await request("updates",data);setValue(await request<State>("updates")); }
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  const toggle=(key:"autoCheck"|"autoInstall")=>void action({action:"preferences",preferences:{[key]:!value?.preferences[key]}});
  return <section className="q2-update-settings"><div className="q2-field-title"><h3>插件更新</h3><ParameterHelp name="插件更新" text="默认每 6 小时自动检查，自动安装默认关闭。安装前校验 SHA256 并保留可回滚安装包。上传、排队、生成期间延后；不会自动重启 DSH。模型、图库、预设和服务器依赖不随插件升级。" /></div>
    {value&&<><p className="q2-muted">运行版本 {value.runningVersion}{value.availableVersion?` · 最新 ${value.availableVersion}`:""}{value.checkedAt?` · 检查于 ${new Date(value.checkedAt).toLocaleString()}`:""}</p>
    <div className="q2-update-toggles"><label><input type="checkbox" checked={value.preferences.autoCheck} disabled={busy} onChange={()=>toggle("autoCheck")}/>自动检查更新</label><label><input type="checkbox" checked={value.preferences.autoInstall} disabled={busy} onChange={()=>toggle("autoInstall")}/>自动安装更新</label></div>
    <label>检查间隔（小时）<select aria-label="更新检查间隔" value={value.preferences.intervalHours} disabled={busy} onChange={e=>void action({action:"preferences",preferences:{intervalHours:Number(e.target.value)}})}>{[...new Set([1,6,12,24,value.preferences.intervalHours])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    {value.restartRequired&&<p role="status">已安装 {value.pendingVersion}，请方便时手动退出并重新打开 DSH。</p>}
    {value.error&&<p role="status">{value.error}</p>}
    <div className="q2-actions"><button disabled={busy} onClick={()=>void action({action:"check"})}>检查更新</button><button disabled={busy||!value.hasUpdate||value.restartRequired} onClick={()=>void action({action:"install"})}>安装新版</button></div>
    {!!value.backups?.length&&<details><summary>安装备份与回滚</summary>{value.backups.map(b=><div key={b.id} className="q2-actions"><span>{b.version} · {b.id.slice(0,13)}</span><button disabled={busy} onClick={()=>{if(window.confirm(`回滚插件到 ${b.version}？设置、预设和图库保留，完成后需手动重启。`))void action({action:"rollback",id:b.id,confirm:true});}}>回滚</button></div>)}</details>}</>}
    {error&&<p role="status">{error}</p>}
    <details><summary>收藏记录恢复</summary><p className="q2-muted">仅在收藏记录损坏时使用。恢复上一次操作前的标记，损坏文件另存保留，不修改图片原件。</p><button disabled={busy} onClick={async()=>{if(!window.confirm("恢复上一次收藏/归档标记备份？当前记录会先另存，图片原件保留。"))return;setBusy(true);try{await request("gallery-restore",{confirm:true});setError("收藏记录已恢复，请重新打开图库");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}>恢复收藏备份</button></details>
  </section>;
}
