import { test, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RemoteQueue } from "../src/remote.js";
import { requiredFeatures, advancedParameters } from "../src/remote-protocol.js";
import { readJob } from "../src/storage.js";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
test("extended remote transfers owned resources once, retains preset references, and persists actual progress",async()=>{
  const uploads=new Map<string,Buffer>();const bodies:any[]=[];const reads=new Map<string,number>();
  const server=createServer(async(req,res)=>{
    expect(req.headers.authorization).toBe("Bearer test-key");res.setHeader("content-type","application/json");
    const url=new URL(req.url!,"http://local");
    if(url.pathname.endsWith("/capabilities"))return res.end(JSON.stringify({protocol:"dsh-qwen",version:1,features:[...requiredFeatures,"reference_edit","multi_image"],schedulers:["linear"]}));
    if(url.pathname.includes("/assets/")){
      const sha=url.pathname.split("/").at(-1)!;
      if(req.method==="HEAD"){res.statusCode=uploads.has(sha)?200:404;return res.end();}
      const chunks:Buffer[]=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);uploads.set(sha,bytes);return res.end('{}');
    }
    if(req.method==="POST"){
      let text='';for await(const c of req)text+=c;const body=JSON.parse(text);bodies.push(body);res.statusCode=202;return res.end(JSON.stringify({id:body.id}));
    }
    if(url.pathname.endsWith('/image'))return res.end(png);
    const id=url.pathname.split('/').at(-1)!;const n=(reads.get(id)||0)+1;reads.set(id,n);
    res.end(JSON.stringify({id,status:n<2?'running':'complete',step:n<2?3:20,sampling_steps:20,phase:'采样'}));
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const dir=await mkdtemp(join(tmpdir(),'qwen-extended-')),source='a'.repeat(32),mask='b'.repeat(32),second='f'.repeat(32);
  for(const [id,kind] of [[source,'source'],[mask,'mask'],[second,'source']]){
    const folder=join(dir,'assets/images',id!);await mkdir(folder,{recursive:true});await writeFile(join(folder,'image.png'),png);await writeFile(join(folder,'asset.json'),JSON.stringify({id,kind}));
  }
  const queue=new RemoteQueue(), config={localMfluxDirectory:dir,remoteBaseURL:`http://127.0.0.1:${(server.address() as any).port}/v1`,remoteApiKey:'test-key'};
  const params={prompt:'a blue cup',width:512,height:512,steps:20,seed:1,source_image_id:source,mask_image_id:mask,controlnet_image_id:source,controlnet_strength:.8,negative_prompt:'blur',guidance:1,scheduler:'linear'};
  try{
    const id='c'.repeat(32);await queue.submit(dir,config,{...params,id});
    await expect.poll(async()=> { const j=await readJob(dir,id); if(j?.status=== "failed") throw Error(j.error); return j?.step; }).toBe(3);
    await expect.poll(async()=> (await readJob(dir,id))?.status, {timeout:5000}).toBe('complete');
    expect(await readJob(dir,id)).toMatchObject({source_image_id:source,mask_image_id:mask,controlnet_image_id:source,progress_supported:true,guidance:2.5,guidance_auto_raised:true});
    expect(bodies[0]).not.toHaveProperty('source_image_id');expect(bodies[0]).not.toHaveProperty('lora_paths');
    expect(bodies[0].source_sha).toMatch(/^[a-f0-9]{64}$/);expect(uploads.size).toBe(1);
    expect(await readFile(join(dir,'images',id,'image.png'))).toEqual(png);
    expect(await readFile(join(dir,'images',id,'reference.png'))).toEqual(png);
    await queue.submit(dir,config,{...params,id:'d'.repeat(32)});
    await expect.poll(async()=>queue.size, {timeout:5000}).toBe(0);expect(uploads.size).toBe(1);
    const multi='9'.repeat(32);
    await queue.submit(dir,config,{id:multi,prompt:'two references',width:512,height:512,steps:20,seed:2,source_image_ids:[source,second],reference_mode:'edit'});
    await expect.poll(async()=>queue.size, {timeout:5000}).toBe(0);
    expect(bodies.at(-1).source_shas).toHaveLength(2);
    expect((await readJob(dir,multi))?.source_image_ids).toEqual([source,second]);
    expect(await readFile(join(dir,'images',multi,'reference-1.png'))).toEqual(png);
    expect(await readFile(join(dir,'images',multi,'reference-2.png'))).toEqual(png);
    await expect(queue.submit(dir,config,{...params,id:'e'.repeat(32),lora_paths:['/outside/style.safetensors']})).resolves.toBeDefined();
    await expect.poll(async()=>queue.size, {timeout:5000}).toBe(0);
    expect((await readJob(dir,'e'.repeat(32)))?.status).toBe('failed');expect(bodies.length).toBe(3);
  } finally {server.closeAllConnections();server.close();await rm(dir,{recursive:true,force:true});}
}, 20000);


test("native editing requires an explicit remote capability and does not drop its mode or accept partial-noise controls", () => {
 const capabilities = { protocol: "dsh-qwen", version: 1, features: [...requiredFeatures], schedulers: ["linear"] } as const;
 const args = { source_image_id: "b".repeat(32), reference_mode: "edit", width: 512, height: 512 };
 expect(() => advancedParameters(args, capabilities as any)).toThrow("更新网关");
 const supported = { ...capabilities, features: [...requiredFeatures, "reference_edit", "multi_image"] };
 expect(advancedParameters(args, supported as any)).toMatchObject({ reference_mode: "edit" });
 expect(() => advancedParameters({ ...args, change_strength: .45 }, supported as any)).toThrow("变化幅度");
 const ids = ["b".repeat(32), "c".repeat(32)];
 expect(advancedParameters({ source_image_ids: ids, reference_mode: "edit", width: 512, height: 512 }, supported as any)).toMatchObject({ source_image_ids: ids, reference_mode: "edit" });
 expect(() => advancedParameters({ source_image_ids: ids, reference_mode: "variation", width: 512, height: 512 }, supported as any)).toThrow("多图");
});
