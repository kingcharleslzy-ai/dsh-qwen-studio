import React from 'react';import {act,create} from 'react-test-renderer';
import {test,expect,vi} from 'vitest';
import {UpdateSettings} from '../src/client/update-settings.js';
import {pollSnapshot} from '../src/client/api.js';
test('settings show independent check/install controls and explicit manual installation',async()=>{
 let state:any={preferences:{autoCheck:true,autoInstall:false,intervalHours:6},runningVersion:'2.12.0',availableVersion:'2.13.0',hasUpdate:true,backups:[]};const calls:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{if(init?.body){const data=JSON.parse(String(init.body));calls.push(data);if(data.action==='preferences')state={...state,preferences:{...state.preferences,...data.preferences}};if(data.action==='install')state={...state,restartRequired:true,pendingVersion:'2.13.0'};}return new Response(JSON.stringify(state));}));
 let tree:ReturnType<typeof create>|undefined;
 try{await act(async()=>{tree=create(<UpdateSettings/>);});const inputs=tree!.root.findAllByType('input');expect(inputs[0]!.props.checked).toBe(true);expect(inputs[1]!.props.checked).toBe(false);await act(async()=>{inputs[1]!.props.onChange();});expect(state.preferences).toEqual({autoCheck:true,autoInstall:true,intervalHours:6});expect(calls.some(x=>x.action==='install')).toBe(false);const install=tree!.root.findAllByType('button').find(b=>b.children.includes('安装新版'))!;await act(async()=>{install.props.onClick();});expect(tree!.toJSON()&&JSON.stringify(tree!.toJSON())).toContain('手动退出并重新打开');}finally{await act(async()=>tree?.unmount());vi.unstubAllGlobals();}
});
test('client merges delta records, drops removed jobs and retains unchanged gallery without duplicating records',async()=>{
 const base:any={jobsRevision:'v1',jobs:[{id:'a',started_at:1,status:'complete'},{id:'b',started_at:2,status:'running'}],health:{status:'ok'}};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({jobsRevision:'v2',health:{status:'ok'},jobChanges:[{id:'b',started_at:2,status:'complete'}],removedJobIds:['a']}))));
 try{const next=await pollSnapshot(base);expect(next.jobs).toEqual([{id:'b',started_at:2,status:'complete'}]);expect(next.jobsRevision).toBe('v2');}finally{vi.unstubAllGlobals();}
});
