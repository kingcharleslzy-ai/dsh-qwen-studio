import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const repo='kingcharleslzy-ai/dsh-qwen-studio';
const headers={'user-agent':'qwen-studio-market',accept:'application/vnd.github+json'};
if(process.env.GH_TOKEN)headers.authorization=`Bearer ${process.env.GH_TOKEN}`;
const response=await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`,{headers,signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Release list HTTP ${response.status}`);
const releases=await response.json(),git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const versions=releases.filter(r=>!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name)).flatMap(r=>{
 const version=r.tag_name.slice(1);if(!r.assets.some(a=>a.name===`dsh-qwen-studio-${version}.tgz`))return [];
 let commit;try{commit=git(['rev-parse','--verify',`refs/tags/bundle-v${version}^{commit}`]);}catch{return [];}
 const pkg=JSON.parse(git(['show',`${commit}:package.json`]));
 if(pkg.name!=='dsh-qwen-studio'||pkg.version!==version||!pkg.engines?.dsh)throw Error('Invalid bundle manifest');
 // The market must never point at an unbuilt source checkout.
 git(['cat-file','-e',`${commit}:lib/index.js`]);git(['cat-file','-e',`${commit}:lib/client.js`]);git(['cat-file','-e',`${commit}:lib/maintenance.js`]);
 return [{version,publishTimestamp:Math.floor(Date.parse(r.published_at)/1000),source:{type:'git',url:`https://github.com/${repo}`,commit},engines:{dsh:pkg.engines.dsh}}];
});
if(!versions.length)throw Error('No published precompiled market releases');
const labels={mlx:{title:{en:'Apple Silicon / MLX',zh:'苹果本机 MLX'}},cuda:{title:{en:'Self-hosted CUDA',zh:'自部署 CUDA'}},lora:{title:'LoRA'},controlnet:{title:'ControlNet'},presets:{title:{en:'Presets',zh:'整套预设'}},editing:{title:{en:'Reference editing',zh:'原生参考编辑'}}};
const icon='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#24262b"/><rect x="14" y="14" width="36" height="36" rx="7" fill="none" stroke="#93b4ff" stroke-width="3"/><circle cx="25" cy="25" r="4" fill="#93b4ff"/><path d="M17 45l12-13 8 8 6-6 7 10" fill="none" stroke="#93b4ff" stroke-width="3"/></svg>').toString('base64');
const index={format:1,title:{en:'Qwen Studio',zh:'图像 · Qwen Studio'},description:{en:'Verified releases for DSH image generation and editing.',zh:'DSH 生图与编辑插件的已校验发行版本。'},metadata:{categories:{vision:{title:{en:'Image generation',zh:'图像生成'}}},labels},plugins:[{name:'dsh-qwen-studio',title:{en:'Qwen Studio',zh:'图像 · Qwen Studio'},description:{en:'Qwen Image 2.1 on Apple Silicon MLX or your NVIDIA server. Reference editing, LoRA, ControlNet, inpainting, shared presets and live agent progress.',zh:'本机 MLX 或自己的 NVIDIA 服务器：原生参考编辑、LoRA、结构控制、蒙版、整套预设及对话实时进度。'},icon,author:'kingcharleslzy-ai',homepage:`https://github.com/${repo}#readme`,repository:{url:`https://github.com/${repo}`},metadata:{category:'vision',labels:Object.keys(labels)},versions:versions.sort((a,b)=>b.publishTimestamp-a.publishTimestamp)}]};
mkdirSync('market-dist',{recursive:true});writeFileSync('market-dist/index.json',JSON.stringify(index,null,2)+'\n');
writeFileSync('market-dist/index.html','<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Qwen Studio 插件源</title><main><h1>图像 · Qwen Studio</h1><p>在 DSH 自定义插件市场中添加 <a href="index.json">index.json</a>。本机 MLX 或自己的 NVIDIA 服务器；地址、目录、密钥由用户自行配置。</p><p><a href="https://github.com/'+repo+'">安装与 Agent 指南</a></p></main></html>');
console.log(`Market generated with ${versions.length} immutable precompiled versions`);
