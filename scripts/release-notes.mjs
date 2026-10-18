import {readFileSync,writeFileSync} from 'node:fs';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const text=readFileSync('CHANGELOG.md','utf8'),section=text.split(/^## /m).find(s=>s.startsWith(version+' '));
if(!section)throw Error('Missing changelog section for '+version);
writeFileSync('release-notes.md','## '+section.trim()+'\n\nInstall the compiled `.tgz`; verify it against SHA256SUMS.txt. Your model paths, server address and credentials must be configured on your own machine. No automatic DSH restart.\n');
