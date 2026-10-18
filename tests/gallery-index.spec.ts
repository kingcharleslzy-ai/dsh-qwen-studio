import {test,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,rename,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {GalleryIndex,batchAction,readJobs,restoreGalleryFlags,closeGalleryIndexes} from '../src/storage.js';
test('damaged or missing flags never turn into writable empty data; restore keeps damaged evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qwen-flags-')),id='a'.repeat(32);
 try{await mkdir(join(dir,'images',id),{recursive:true});await writeFile(join(dir,'images',id,'job.json'),JSON.stringify({status:'complete',started_at:1}));await batchAction(dir,[id],'favorite',true);await batchAction(dir,[id],'archived',true);
 const backup=await readFile(join(dir,'state/gallery.json.bak'),'utf8');expect(JSON.parse(backup)[id].favorite).toBe(true);
 await writeFile(join(dir,'state/gallery.json'),'{broken');await expect(batchAction(dir,[id],'favorite',false)).rejects.toThrow('停止写入');expect(await readFile(join(dir,'state/gallery.json'),'utf8')).toBe('{broken');await restoreGalleryFlags(dir);expect((await readJobs(dir))[0]?.favorite).toBe(true);
 await rm(join(dir,'state/gallery.json'));await expect(readJobs(dir)).rejects.toThrow('停止写入');await restoreGalleryFlags(dir);expect((await readJobs(dir))[0]?.favorite).toBe(true);
 }finally{closeGalleryIndexes();await rm(dir,{recursive:true,force:true});}
});
test('148 idle jobs read once; active tasks update and membership changes reconcile without stale flags',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qwen-index-'));await mkdir(join(dir,'images'));let index:GalleryIndex|undefined;
 try{for(let i=0;i<148;i++){const id=i.toString(16).padStart(32,'0');await mkdir(join(dir,'images',id));await writeFile(join(dir,'images',id,'job.json'),JSON.stringify({status:i===0?'running':'complete',step:1,started_at:i}));}
 index=new GalleryIndex(await realpath(dir));await index.read();const baseline=index.metrics.recordReads;for(let i=0;i<10;i++)await index.read();expect(index.metrics.recordReads-baseline).toBeGreaterThanOrEqual(10);expect(index.metrics.recordReads-baseline).toBeLessThanOrEqual(12);expect(index.metrics.scans).toBe(1);
 const id='0'.repeat(32);await writeFile(join(dir,'images',id,'job.json'),JSON.stringify({status:'running',step:7,started_at:0}));expect((await index.read()).find(j=>j.id===id)?.step).toBe(7);
 await mkdir(join(dir,'trash'));await rename(join(dir,'images',id),join(dir,'trash',id));expect((await index.read()).find(j=>j.id===id)?.deleted).toBe(true);
 }finally{index?.close();await rm(dir,{recursive:true,force:true});}
});

test('snapshot sends changed tasks only and falls back to a full snapshot for expired revisions',async()=>{
 const {GallerySnapshots}=await import('../src/gallery-snapshot.js'),snap=new GallerySnapshots();
 const jobs=Array.from({length:148},(_,i)=>({id:i.toString(16).padStart(32,'0'),status:'complete',prompt:'x',width:512,height:512,steps:40,seed:1,started_at:i}));
 const first=snap.project(jobs,null);expect(first.jobs?.length).toBe(148);expect(snap.project(jobs,first.jobsRevision)).not.toHaveProperty('jobs');
 const changed=jobs.map((j,i)=>i===0?{...j,step:4,status:'running'}:j);const next=snap.project(changed,first.jobsRevision);expect(next.jobChanges?.length).toBe(1);expect(next).not.toHaveProperty('jobs');expect(snap.project(changed,'missing').jobs?.length).toBe(148);
});
