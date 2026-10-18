/** Scan tracked text and built package code. No private addresses are embedded in this checker. */
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const files=[...execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),'lib/index.js','lib/client.js','lib/maintenance.js'];
const extra=JSON.parse(process.env.QWEN_PRIVATE_MARKERS||'[]').filter(v=>typeof v==='string'&&v.length>5);
const issues=[];
for(const file of new Set(files)){
 if(!existsSync(file)||!/\.(?:[cm]?js|tsx?|py|md|json|ya?ml|sh|svg)$/.test(file)||file==='package-lock.json')continue;
 const text=readFileSync(file,'utf8');
 const checks=[['personal home path',/\/(?:Users|home)\/[A-Za-z][\w.-]*\//],['credential',/\b(?:hf_[A-Za-z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{24,})\b/]];
 for(const [reason,rx] of checks)if(rx.test(text))issues.push(`${file}: ${reason}`);
 if(extra.some(marker=>text.includes(marker)))issues.push(`${file}: private deployment marker`);
 // Literal private network CIDRs in SSRF validation/tests are intentional definitions.
 if(!['src/image-import.ts','tests/image-import.spec.ts'].includes(file)&&!file.startsWith('lib/')){
   if(/\b(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)\b/.test(text))issues.push(`${file}: private IPv4 address`);
 }
}
if(issues.length){console.error([...new Set(issues)].join('\n'));process.exit(1);}
console.log(`Privacy check OK (${new Set(files).size} tracked/build files; private markers kept only in environment)`);
