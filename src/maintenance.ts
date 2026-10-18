import { readFile } from "node:fs/promises";
import {homedir} from "node:os";
import { join } from "node:path";
import { PackageInstaller, UpdateController } from "./updates.js";
import {readJobs,closeGalleryIndexes} from "./storage.js";
import { active } from "./shared.js";
export async function main(args=process.argv.slice(2)) {
  const installer=new PackageInstaller(),p=installer.paths;
  const version=JSON.parse(await readFile(join(p.packageRoot,'package.json'),'utf8')).version as string;
  const controller=new UpdateController(p.state,version,async fn=>{
    // CLI maintenance is deliberately conservative. UI also has the worker gate.
    const config=await readFile(join(p.profile,'cordis.patch.yml'),'utf8').catch(()=>"");
    const match=config.match(/^\s+localMfluxDirectory:\s*(.+)\s*$/m);
    const raw = match?.[1]?.trim() ?? join(homedir(),'.dsh/qwen-studio');
    let directory = raw;
    if(raw.startsWith('"')) directory=JSON.parse(raw);
    else if(raw.startsWith("'")) directory=raw.slice(1,-1).replaceAll("''", "'");
    if(directory.startsWith('~/')) directory=join(homedir(),directory.slice(2));
    {
      if((await readJobs(directory)).some(active)) throw Error('仍有未结束任务，请在 DSH 插件设置中维护或等任务结束');
    }
    const r=await fetch('http://127.0.0.1:19388/health',{signal:AbortSignal.timeout(1500)}).catch(()=>null);
    if(r?.ok&&(await r.json() as {busy?:boolean}).busy)throw Error('本机仍在生图');
    return fn();
  },installer);
  try {
    await controller.init();
    const command=args[0]??'status';
    let result:unknown;
    if(command==='status')result=controller.snapshot();
    else if(command==='check')result=await controller.check();
    else if(command==='install')result=await controller.install();
    else if(command==='backups')result=await controller.backups();
    else if(command==='rollback'&&args[1])result=await controller.rollback(args[1]);
    else if(command==='preferences'&&args[1])result=await controller.preferences(JSON.parse(args[1]));
    else throw Error('用法：qwen-studio-maintain status | check | install | backups | rollback <ID> | preferences <JSON>');
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  } finally {controller.stop();closeGalleryIndexes();}
}
