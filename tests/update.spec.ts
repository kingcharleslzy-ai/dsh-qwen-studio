import {test,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {UpdateController,PackageInstaller,inspectPackage,defaults,validatePreferences,latestRelease} from '../src/updates.js';
const exec=promisify(execFile);
const release={version:'2.13.0',url:'https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/download/v2.13.0/dsh-qwen-studio-2.13.0.tgz',sha256:'0'.repeat(64)};
async function fixture(){return mkdtemp(join(tmpdir(),'qwen-updater-'));}
test('checks are on, installations off; network checking never starts inference or installs',async()=>{
 const dir=await fixture(),install=vi.fn(),guard=vi.fn(async(fn:any)=>fn());
 const c=new UpdateController(dir,'2.12.0',guard,{install,backups:async()=>[],rollback:vi.fn()},async()=>release);
 try{expect((await c.init()).preferences).toEqual(defaults);await c.check(true);expect(install).not.toHaveBeenCalled();expect(guard).not.toHaveBeenCalled();expect(c.snapshot()).toMatchObject({hasUpdate:true,availableVersion:'2.13.0'});await c.preferences({autoCheck:false,autoInstall:true});await c.check(true);expect(install).not.toHaveBeenCalled();expect(()=>validatePreferences({...defaults,intervalHours:0})).toThrow();expect(()=>validatePreferences({...defaults,secret:true})).toThrow();}finally{c.stop();await rm(dir,{recursive:true,force:true});}
});
test('busy tasks defer installation; pending restart prevents repeated installations; settings survive reload',async()=>{
 const dir=await fixture();let busy=true;
 const install=vi.fn(async()=>({pendingVersion:'2.13.0',restartRequired:true,backupId:'test'}));
 const c=new UpdateController(dir,'2.12.0',async fn=>{if(busy)throw Error('任务正在生成，延后');return fn();},{install,backups:async()=>[],rollback:vi.fn()},async()=>release);
 try{await c.init();await c.preferences({autoInstall:true});await c.check(true);expect(install).not.toHaveBeenCalled();expect(c.snapshot().error).toContain('延后');busy=false;await c.check(true);expect(install).toHaveBeenCalledTimes(1);await c.check(true);expect(install).toHaveBeenCalledTimes(1);expect(c.snapshot().restartRequired).toBe(true);c.stop();const next=new UpdateController(dir,'2.13.0',async fn=>fn(),{install,backups:async()=>[],rollback:vi.fn()},async()=>release);await next.init();expect(next.snapshot()).toMatchObject({restartRequired:false,preferences:{autoInstall:true}});next.stop();}finally{c.stop();await rm(dir,{recursive:true,force:true});}
});
test('bad checksums, missing assets and prereleases never install',async()=>{
 const fake=vi.fn(async(url:any)=>new Response(JSON.stringify({tag_name:'v2.13.0',prerelease:true,assets:[]})));
 await expect(latestRelease(fake as any)).rejects.toThrow('正式');
 const dir=await fixture(),root=join(dir,'profiles/test/node_modules/dsh-qwen-studio');
 await mkdir(root,{recursive:true});await writeFile(join(dir,'profiles/test/package.json'),'{}');await writeFile(join(root,'package.json'),'{}');
 const run=vi.fn();try{const installer=new PackageInstaller(await realpath(root),run);await expect(installer.install(release,async()=>new Response('wrong') as any)).rejects.toThrow('校验');expect(run).not.toHaveBeenCalled();}finally{await rm(dir,{recursive:true,force:true});}
});
test('verified installer snapshots, uses profile CLI, preserves user state and can roll back',async()=>{
 const dir=await fixture(),profile=join(dir,'profiles/test'),root=join(profile,'node_modules/dsh-qwen-studio'),stage=join(dir,'staging');
 const pkg=(version:string)=>({name:'dsh-qwen-studio',version,repository:{url:'git+https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git'},engines:{dsh:'>=0.2.1-rc.1 <0.2.2-0'}});
 await mkdir(root,{recursive:true});await writeFile(join(profile,'package.json'),'{}');await writeFile(join(profile,'cordis.patch.yml'),'user settings');await writeFile(join(root,'package.json'),JSON.stringify(pkg('2.12.0')));
 for(const path of ['lib/index.js','lib/client.js','lib/maintenance.js','backend/server.py','skills/qwen-image/SKILL.md','cordis.patch.yml']){await mkdir(join(stage,'package',path,'..'),{recursive:true});await writeFile(join(stage,'package',path),'fixture');}
 await writeFile(join(stage,'package/package.json'),JSON.stringify(pkg('2.13.0')));await exec('tar',['--format=ustar','-czf',join(dir,'new.tgz'),'-C',stage,'package']);const archive=await readFile(join(dir,'new.tgz'));
 const commands:string[][]=[];
 const run=async(command:string,args:string[])=>{if(args.at(-1)==='--version')return '0.2.1-rc.2';if(command==='tar'){await exec(command,args);return;}commands.push(args);const target=args.at(-1)!;const version=target.endsWith('previous.tgz')?'2.12.0':'2.13.0';await writeFile(join(root,'package.json'),JSON.stringify(pkg(version)));};
 const installer=new PackageInstaller(await realpath(root),run);
 try{expect(inspectPackage(archive,'2.13.0').size).toBe(7);const result=await installer.install({...release,sha256:createHash('sha256').update(archive).digest('hex')},async()=>new Response(archive) as any);expect(result.restartRequired).toBe(true);expect((await installer.backups())[0]?.id).toBe(result.backupId);await installer.rollback(result.backupId);expect(JSON.parse(await readFile(join(root,'package.json'),'utf8')).version).toBe('2.12.0');expect(await readFile(join(profile,'cordis.patch.yml'),'utf8')).toBe('user settings');expect(commands.every(a=>a.includes('--profile')&&a.includes('test')&&!a.includes('restart')&&!a.includes('--home'))).toBe(true);await expect(installer.rollback('../bad')).rejects.toThrow('ID');}finally{await rm(dir,{recursive:true,force:true});}
});
test('unsafe linked archive rejected before install',async()=>{
 const dir=await fixture();try{await mkdir(join(dir,'package'));await exec('ln',['-s','/etc/passwd',join(dir,'package/leak')]);await exec('tar',['--format=ustar','-czf',join(dir,'bad.tgz'),'-C',dir,'package']);const archive=await readFile(join(dir,'bad.tgz'));expect(()=>inspectPackage(archive,'2.13.0')).toThrow('路径或链接');}finally{await rm(dir,{recursive:true,force:true});}
});

test('worker maintenance blocks upload races and new generation after package replacement',async()=>{
 const {Worker}=await import('../src/worker.js');
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));
 const worker=new Worker(()=>({connectionMode:'local'}));
 let release!:()=>void;const task=worker.withActivity(()=>new Promise<void>(r=>{release=r;}));
 try{await expect(worker.withMaintenance(async()=>{})).rejects.toThrow('延后');release();await task;await worker.withMaintenance(async()=>{});await expect(worker.withActivity(async()=>{})).rejects.toThrow('手动重启');await expect(worker.post('/v1/jobs',{},true)).rejects.toThrow('手动重启');}finally{await worker.dispose();vi.unstubAllGlobals();}
});
