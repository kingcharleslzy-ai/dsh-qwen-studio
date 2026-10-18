/** Publish an immutable precompiled Git snapshot for the native DSH market. */
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(readFileSync('package.json','utf8')),tarball=resolve(`${pkg.name}-${pkg.version}.tgz`),ref=`refs/tags/bundle-v${pkg.version}`;
const temp=mkdtempSync(join(tmpdir(),'qwen-market-bundle-'));
const env={...process.env,GIT_INDEX_FILE:join(temp,'index'),GIT_AUTHOR_NAME:'Qwen Studio releases',GIT_AUTHOR_EMAIL:'noreply@github.com',GIT_COMMITTER_NAME:'Qwen Studio releases',GIT_COMMITTER_EMAIL:'noreply@github.com'};
const git=args=>execFileSync('git',args,{encoding:'utf8',env}).trim();
try{
 execFileSync('tar',['-xzf',tarball,'-C',temp]);
 // Git package managers may install devDependencies before any prepare hook.
 // The market tree is runtime-only so installation never builds/downloads tooling.
 const manifestPath=join(temp,'package/package.json');
 const runtimeManifest=JSON.parse(readFileSync(manifestPath,'utf8'));
 delete runtimeManifest.devDependencies;delete runtimeManifest.scripts;delete runtimeManifest.packageManager;
 writeFileSync(manifestPath,JSON.stringify(runtimeManifest,null,2)+'\n');
 git(['read-tree','--empty']);git([`--work-tree=${join(temp,'package')}`,'add','-f','--all']);
 const tree=git(['write-tree']),commit=git(['commit-tree',tree,'-m',`Precompiled ${pkg.name} ${pkg.version}`]);
 if(process.env.QWEN_BUNDLE_DRY_RUN !== '1') {
   const existing=git(['ls-remote','origin',ref]).split(/\s+/)[0];
   if(existing) {
     git(['fetch','origin',ref]);
     if(git(['rev-parse',`${existing}^{tree}`])!==tree) throw Error('Immutable bundle tag already exists with different contents');
     console.log('Existing identical bundle snapshot retained');
   } else {
     git(['update-ref',ref,commit,'0000000000000000000000000000000000000000']);
     git(['push','origin',ref]);
   }
 }
 writeFileSync('.bundle-commit.txt',commit+'\n');
 console.log(`Published immutable precompiled bundle ${ref} at ${commit}`);
}finally{rmSync(temp,{recursive:true,force:true});}
