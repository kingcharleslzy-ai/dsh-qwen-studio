import {test,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {runCommand} from '../src/commands.js';
import {importAsset} from '../src/assets.js';
import {listResources} from '../src/resources.js';
import {resolveConfig} from '../src/resolved-config.js';
import {pythonInDirectory} from '../src/client/path-field.js';
import {closeGalleryIndexes} from '../src/storage.js';

test('venv directory picker preserves platform paths including UNC',()=>{
 expect(pythonInDirectory('C:\\图 像\\venv\\')).toBe('C:\\图 像\\venv\\Scripts\\python.exe');
 expect(pythonInDirectory('\\\\server\\share\\venv')).toBe('\\\\server\\share\\venv\\Scripts\\python.exe');
 expect(pythonInDirectory('/tmp/test/venv/')).toBe('/tmp/test/venv/bin/python');
 expect(resolveConfig({localMfluxDirectory:process.cwd()}).pythonPath).toBe(join(process.cwd(),process.platform==='win32'?'venv/Scripts/python.exe':'venv/bin/python'));
});

test('imported LoRA remains discoverable on the native filesystem',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qwen-lora-中文 '));
 const header=Buffer.from(JSON.stringify({'x.lora_A.weight':{dtype:'F32',shape:[1],data_offsets:[0,4]}}));
 const length=Buffer.alloc(8);length.writeBigUInt64LE(BigInt(header.length));
 try{
  const bytes=Buffer.concat([length,header,Buffer.alloc(4)]);
  const asset=await importAsset(dir,'unused','lora','测试.safetensors',(async function*(){yield bytes;})());
  const result=await listResources(resolveConfig({localMfluxDirectory:dir}));
  expect(result.warnings).toEqual([]);expect(result.items).toContainEqual(expect.objectContaining({kind:'lora',path:asset.path,name:'测试.safetensors'}));
 }finally{closeGalleryIndexes();await rm(dir,{recursive:true,force:true});}
});

test('invalid image reports readable Chinese and absent Python gives actionable path',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qwen-python-'));
 const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
 const stream=()=> (async function*(){yield gif;})();
 try{
  await expect(importAsset(dir,process.env.QWEN_TEST_PYTHON!,'source','x.gif',stream())).rejects.toThrow('请选择 PNG、JPEG 或 WebP 图片');
  await expect(importAsset(dir,join(dir,'missing-python'),'source','x.png',stream())).rejects.toThrow('找不到图片处理 Python');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test.runIf(process.platform==='win32')('real batch shim preserves argv in Chinese, space and shell-character paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qwen-command-'));
 const echo=join(dir,'echo.mjs');await writeFile(echo,'console.log(JSON.stringify(process.argv.slice(2)))');
 try{
  for(const folder of ['bin','中文 空格','A&B','percent%PATH%','bang!folder','paren(foo)']){
   const cli=join(dir,folder,'dsh.cmd');await mkdir(dirname(cli),{recursive:true});
   await writeFile(cli,`@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${process.execPath}" "${echo}" %*\r\n`);
   const args=['plugin','--profile','中文 profile','add',join(dir,folder,'包 名.tgz')];
   expect(JSON.parse((await runCommand(cli,args)).trim())).toEqual(args);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('control characters are rejected before spawning a shell',async()=>{
 await expect(runCommand('missing-command',['path\r\necho unsafe'])).rejects.toThrow('换行');
});
