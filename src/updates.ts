/** Verified package updates. Model/gallery/configuration files are never package payloads. */
import { readFile, writeFile, mkdir, readdir, lstat, rm, realpath, cp, open } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { satisfies } from "semver";
import { atomicJSON } from "./storage.js";
const exec = promisify(execFile);
export const REPO = "kingcharleslzy-ai/dsh-qwen-studio";
export const PACKAGE = "dsh-qwen-studio";
export interface UpdatePreferences { autoCheck: boolean; autoInstall: boolean; intervalHours: number }
export interface UpdateState { checkedAt?: string; availableVersion?: string; hasUpdate?: boolean; error?: string; deferred?: string; pendingVersion?: string; restartRequired?: boolean; backupId?: string }
export interface Release { version: string; url: string; sha256: string }
export const defaults: UpdatePreferences = { autoCheck: true, autoInstall: false, intervalHours: 6 };
export function validatePreferences(value: unknown): UpdatePreferences {
  const v = value as UpdatePreferences;
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !Object.hasOwn(defaults,k)) || typeof v.autoCheck !== "boolean" || typeof v.autoInstall !== "boolean" || !Number.isInteger(v.intervalHours) || v.intervalHours < 1 || v.intervalHours > 168) throw Error("更新设置无效：检查间隔为 1–168 小时，检查与安装为独立开关");
  return v;
}
export function newer(a: string, b: string) {
  const parse = (v: string) => { if (!/^\d+\.\d+\.\d+$/.test(v)) throw Error("仅支持正式版版本号"); return v.split('.').map(Number); };
  const x=parse(a),y=parse(b); for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]!>y[i]!; return false;
}
async function json<T>(path: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(path,"utf8")) as T; } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT') return fallback; throw Error(`无法读取更新状态：${basename(path)}`,{cause:e}); } }
async function download(url: string, limit: number, fetcher = fetch) {
  const u=new URL(url);
  if(u.protocol!=="https:" || !["api.github.com","github.com"].includes(u.hostname) || u.username || u.password) throw Error("更新来源无效");
  const r=await fetcher(url,{headers:{accept:"application/vnd.github+json","user-agent":PACKAGE},signal:AbortSignal.timeout(90000)});
  if(!r.ok) throw Error(`GitHub 更新请求失败：HTTP ${r.status}`);
  const chunks: Uint8Array[]=[];let size=0;
  if(!r.body) throw Error("更新响应为空");
  for await (const part of r.body) { size+=part.length;if(size>limit) { throw Error("更新文件超过大小限制"); } chunks.push(part); }
  return Buffer.concat(chunks);
}
export async function latestRelease(fetcher=fetch): Promise<Release> {
  const r=JSON.parse((await download(`https://api.github.com/repos/${REPO}/releases/latest`,1024*1024,fetcher)).toString());
  if(r.draft || r.prerelease || !/^v\d+\.\d+\.\d+$/.test(r.tag_name)) throw Error("不是有效的正式发布版本");
  const version=r.tag_name.slice(1),name=`${PACKAGE}-${version}.tgz`;
  const base=`https://github.com/${REPO}/releases/download/${r.tag_name}/`;
  if(!r.assets?.some((a:any)=>a.name===name&&a.browser_download_url===base+name) || !r.assets.some((a:any)=>a.name==='SHA256SUMS.txt'&&a.browser_download_url===base+'SHA256SUMS.txt')) throw Error("发行版缺少安装包或校验文件");
  const sums=(await download(base+'SHA256SUMS.txt',65536,fetcher)).toString();
  const sha256=sums.split(/\r?\n/).map(l=>l.trim().split(/\s+\*?/)).find(a=>a[1]===name)?.[0];
  if(!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) throw Error("安装包 SHA256 无效");
  return {version,url:base+name,sha256};
}
/** Validate archive entries before extraction, rejecting links and runtime data. */
export function inspectPackage(archive: Buffer, expectedVersion: string) {
  if(!/^\d+\.\d+\.\d+$/.test(expectedVersion))throw Error("发行版本号无效");
  const raw=gunzipSync(archive,{maxOutputLength:10*1024*1024}),files=new Map<string,Buffer>();
  for(let at=0;at+512<=raw.length;) {
    const h=raw.subarray(at,at+512);if(h.every(v=>v===0))break;
    const str=(a:number,b:number)=>h.subarray(a,b).toString().replace(/\0.*$/s,'');
    const name=(str(345,500)?str(345,500)+'/':'')+str(0,100),kind=str(156,157),size=parseInt(str(124,136).trim()||'0',8);
    const checksum=parseInt(str(148,156).trim(),8);let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:h[i]!;
    if(sum!==checksum || !Number.isSafeInteger(size)||size<0||at+512+size>raw.length)throw Error("安装包归档损坏");
    if(!['','0','5'].includes(kind)||!name.startsWith('package/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||/^(?:package\/)?\//.test(name)||/(^|\/)(?:state|images|trash|models|node_modules|\.git|venv|\.venv)(\/|$)/.test(name))throw Error("安装包包含不允许的路径或链接");
    if(kind!=='5') { if(files.has(name))throw Error("安装包存在重复路径");files.set(name,raw.subarray(at+512,at+512+size)); }
    at+=512+Math.ceil(size/512)*512;
  }
  const pkg=JSON.parse(files.get('package/package.json')?.toString()??'{}');
  if(pkg.name!==PACKAGE||pkg.version!==expectedVersion||pkg.repository?.url!==`git+https://github.com/${REPO}.git`||pkg.dependencies&&Object.keys(pkg.dependencies).length)throw Error("安装包身份或依赖不符合独立发行约定");
  for(const p of ['lib/index.js','lib/client.js','lib/maintenance.js','backend/server.py','skills/qwen-image/SKILL.md','cordis.patch.yml']) if(!files.has('package/'+p))throw Error(`安装包缺少 ${p}`);
  return files;
}
export function installedPaths(packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  let profile=resolve(packageRoot,'../..');
  while(basename(dirname(profile)) !== 'profiles' && dirname(profile)!==profile) profile=dirname(profile);
  if(basename(packageRoot)!==PACKAGE || basename(dirname(packageRoot))!=='node_modules' || basename(dirname(profile))!=='profiles' || !existsSync(join(profile,'package.json')))throw Error("更新只能用于 DSH profile 中的正式安装；开发源码请使用 Git 更新");
  profile=realpathSync(profile);
  const canonical=realpathSync(packageRoot);
  if(!canonical.startsWith(join(profile,'node_modules')+'/') && !canonical.startsWith(join(profile,'node_modules')+'\\'))
    throw Error("开发源码链接不自动覆盖，请使用正式安装包");
  return {packageRoot:canonical,profile,state:join(profile,'qwen-studio-updates')};
}
export function cliCommand() {
  if(process.env.DSH_QWEN_CLI) return {command:process.env.DSH_QWEN_CLI,args:[] as string[]};
  if(process.platform==='darwin') {
    const bundled='/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh';
    if(existsSync(bundled))return {command:'/bin/sh',args:[bundled]};
  }
  return {command:process.platform==='win32'?'dsh.cmd':'dsh',args:[] as string[]};
}
export class PackageInstaller {
  readonly paths: ReturnType<typeof installedPaths>;
  constructor(packageRoot?: string, private run:(command:string,args:string[],env?:Record<string,string>)=>Promise<string|void>=(command,args,env)=>exec(command,args,{timeout:180000,maxBuffer:2*1024*1024,windowsHide:true,env:{...process.env,...env}}).then(({stdout})=>stdout)) { this.paths=installedPaths(packageRoot); }
  private async invoke(tarball:string) {
    const profileName=basename(this.paths.profile),home=resolve(this.paths.profile,'../../');
    if(resolve(home,'profiles',profileName)!==this.paths.profile)throw Error("仅支持 DSH_HOME/profiles/<名称> 的标准安装");
    const cli=cliCommand();
    // Native installer owns dependency/lockfile bookkeeping. No restart/reload commands.
    await this.run(cli.command,[...cli.args,'plugin','--profile',profileName,'add',tarball],{DSH_HOME:home});
  }
  async backups() {
    const root=join(this.paths.state,'backups');
    const entries=await readdir(root).catch((e)=>{if(e.code==='ENOENT')return [];throw e;});
    return Promise.all(entries.filter(n=>/^\d{13}-[a-f0-9-]+$/.test(n)).sort().reverse().map(async id=>({id,...await json<{version?:string}>(join(root,id,'manifest.json'),{})})));
  }
  private async locked<T>(fn:()=>Promise<T>) {
    await mkdir(this.paths.state,{recursive:true,mode:0o700});
    const lock=join(this.paths.state,"install.lock");
    const fd=await open(lock,"wx",0o600).catch(()=>{throw Error("另一个安装/回滚正在进行；如进程异常退出，请确认任务停止后移除 install.lock");});
    await fd.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
    try { return await fn(); } finally { await fd.close(); await rm(lock,{force:true}); }
  }
  async install(release:Release,fetcher=fetch) { return this.locked(()=>this.installUnlocked(release,fetcher)); }
  private async installUnlocked(release: Release, fetcher=fetch) {
    const archive=await download(release.url,5*1024*1024,fetcher);
    if(createHash('sha256').update(archive).digest('hex')!==release.sha256)throw Error("安装包校验失败，未修改安装");
    const payload = inspectPackage(archive,release.version);
    const manifest = JSON.parse(payload.get('package/package.json')!.toString());
    const cli = cliCommand();
    const hostVersion = (await this.run(cli.command,[...cli.args,'--version']))?.trim();
    if(!hostVersion || !manifest.engines?.dsh || !satisfies(hostVersion,manifest.engines.dsh,{includePrerelease:true}))
      throw Error("当前 DSH 版本与新版插件不兼容或版本未确认，未修改安装");
    if((await lstat(this.paths.packageRoot)).isSymbolicLink()||await realpath(this.paths.packageRoot)!==this.paths.packageRoot)throw Error("开发链接安装不自动覆盖，请先改用正式安装包");
    const id=`${Date.now()}-${randomUUID()}`,folder=join(this.paths.state,'backups',id);
    await mkdir(folder,{recursive:true,mode:0o700});
    const old=await json<{version:string}>(join(this.paths.packageRoot,'package.json'),{version:''});
    // tar creates a reinstallable snapshot; only this plugin, never model/gallery data.
    await cp(this.paths.packageRoot,join(folder,'package'),{recursive:true,filter:source=>!['node_modules','.git'].includes(basename(source))});
    const snapshotManifest = { ...old } as Record<string,any>;
    snapshotManifest.scripts = { ...(snapshotManifest.scripts ?? {}) };
    for(const hook of ["prepare","preinstall","install","postinstall","prepublish","prepublishOnly"]) delete snapshotManifest.scripts[hook];
    await atomicJSON(join(folder,'package/package.json'),snapshotManifest);
    await this.run('tar',['-czf',join(folder,'previous.tgz'),'-C',folder,'package']);
    await rm(join(folder,'package'),{recursive:true});
    await atomicJSON(join(folder,'manifest.json'),{version:old.version,createdAt:new Date().toISOString()});
    const archivePath=join(this.paths.state,`${PACKAGE}-${release.version}-${release.sha256.slice(0,12)}.tgz`);
    await writeFile(archivePath,archive,{mode:0o600});
    try {
      await this.invoke(archivePath);
      const installed=await json<{version:string}>(join(this.paths.profile,'node_modules',PACKAGE,'package.json'),{version:''});
      if(installed.version!==release.version)throw Error("安装后的版本未确认");
    } catch(e) {
      try { await this.invoke(join(folder,'previous.tgz')); }
      catch { throw Error(`安装失败且自动回滚失败；备份 ${id} 已保留，请手动回滚`,{cause:e}); }
      throw Error("安装失败，已重新安装原版本；备份已保留",{cause:e});
    }
    return {backupId:id,pendingVersion:release.version,restartRequired:true};
  }
  async rollback(id:string) { return this.locked(()=>this.rollbackUnlocked(id)); }
  private async rollbackUnlocked(id:string) {
    if(!/^\d{13}-[a-f0-9-]+$/.test(id))throw Error("备份 ID 无效");
    const folder=join(this.paths.state,'backups',id),m=await json<{version:string}>(join(folder,'manifest.json'),{version:''});
    if(!/^\d+\.\d+\.\d+$/.test(m.version))throw Error("备份不存在或版本无效");
    await this.invoke(join(folder,'previous.tgz'));
    const installed=await json<{version:string}>(join(this.paths.profile,'node_modules',PACKAGE,'package.json'),{version:''});
    if(installed.version!==m.version)throw Error('回滚后的版本未确认，请检查原生安装器');
    return {pendingVersion:m.version,restartRequired:true,backupId:id};
  }
}
export class UpdateController {
  private state: UpdateState={}; private prefs:UpdatePreferences={...defaults};
  private timer:ReturnType<typeof setTimeout>|undefined; private inflight:Promise<unknown>|undefined; private stopped=false; private cachedRelease: {at:number;value:Release} | undefined;
  constructor(readonly root:string, readonly runningVersion:string, private guard:<T>(fn:()=>Promise<T>)=>Promise<T>, private installer:Pick<PackageInstaller,'install'|'backups'|'rollback'>, private latest=latestRelease) {}
  async init() {
    await mkdir(this.root,{recursive:true,mode:0o700});
    this.prefs=validatePreferences(await json(join(this.root,'preferences.json'),{...defaults}));
    this.state=await json(join(this.root,'status.json'),{});
    if(this.state.pendingVersion===this.runningVersion)await this.record({restartRequired:false,pendingVersion:'',hasUpdate:this.state.availableVersion?newer(this.state.availableVersion,this.runningVersion):false});
    this.schedule(30000); return this.snapshot();
  }
  snapshot(){return {preferences:{...this.prefs},...this.state,runningVersion:this.runningVersion};}
  private async record(patch:UpdateState){this.state={...this.state,...patch};await atomicJSON(join(this.root,'status.json'),this.state);}
  private schedule(delay=this.prefs.intervalHours*3600000){clearTimeout(this.timer);if(this.stopped||!this.prefs.autoCheck)return;this.timer=setTimeout(()=>{void this.check(true).catch(()=>{}).finally(()=>this.schedule(this.state.deferred ? 60000 : undefined));},delay);this.timer.unref?.();}
  stop(){this.stopped=true;clearTimeout(this.timer);}
  async preferences(patch:Partial<UpdatePreferences>){const value=validatePreferences({...this.prefs,...patch});await atomicJSON(join(this.root,'preferences.json'),value);this.prefs=value;this.schedule(30000);return this.snapshot();}
  async check(automatic=false){
    if(this.inflight)return this.inflight;
    this.inflight=(async()=>{
      try {
        if(automatic&&!this.prefs.autoCheck)return this.snapshot();
        const r=automatic && this.cachedRelease && Date.now()-this.cachedRelease.at<600000 ? this.cachedRelease.value : await this.latest();
        this.cachedRelease={at:Date.now(),value:r};
        await this.record({checkedAt:new Date().toISOString(),availableVersion:r.version,hasUpdate:newer(r.version,this.runningVersion),error:'',deferred:''});
        if(automatic&&!this.stopped&&this.prefs.autoCheck&&this.prefs.autoInstall&&this.state.hasUpdate&&!this.state.restartRequired)await this.installRelease(r);
      }catch(e){const error=e instanceof Error?e.message:String(e);await this.record({error,deferred:/延后|正在上传|正在工作/.test(error)?error:""});if(!automatic)throw e;}
      return this.snapshot();
    })().finally(()=>{this.inflight=undefined;});return this.inflight;
  }
  private async installRelease(r:Release){
    await this.guard(async()=>{await this.record(await this.installer.install(r));});
  }
  async install(){if(this.inflight)throw Error("更新操作进行中");if(this.state.restartRequired)throw Error("更新已安装，请先手动重新打开 DSH");
    this.inflight=(async()=>{try{const r=await this.latest();if(!newer(r.version,this.runningVersion))return this.snapshot();await this.installRelease(r);return this.snapshot();}catch(e){await this.record({error:e instanceof Error?e.message:String(e)});throw e;}})().finally(()=>{this.inflight=undefined;});return this.inflight;
  }
  async backups(){return this.installer.backups();}
  async rollback(id:string){if(this.inflight)throw Error("更新操作进行中");this.inflight=this.guard(async()=>{await this.record(await this.installer.rollback(id));return this.snapshot();}).finally(()=>{this.inflight=undefined;});return this.inflight;}
}
