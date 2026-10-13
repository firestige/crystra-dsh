import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyNative} from '../../src/backend/native-plugin.js';
function host(entry,check=async()=>({ready:true,missing:[],warnings:[],action:"crystra doctor"})){
 const tools=new Map();const events=new Map(),agents=[],attached=[];let settings,hooks,source=entry;
 const ctx={tools:{register:t=>tools.set(t.name,t)},logger:{warn(){}},provide(n,v){this[n]=v;},inject(_names,fn){settings=()=>fn({settings:{installSection(_o,_n,_s,_e,h){hooks=h;h.setSource(()=>source);h.onChange();}}});},on(n,f){events.set(n,f);},effect(){},agents:{list:()=>agents}};
 function agent(id,cwd){const listeners=new Map();const a={session:{id,header:{cwd}},ctx:{on(n,f){listeners.set(n,f);return()=>listeners.delete(n);}}};a.listeners=listeners;agents.push(a);events.get('agent/created')?.({agent:a});return a;}
 applyNative(ctx,entry,(c)=>{c.crystraBackend={attach(_ac,a){attached.push(a.session.id);return {ready:Promise.resolve({snapshot:()=>({initializing:entry.project?.initializing===true})}),close:async()=>{}};}};},{check});
 return {ctx,tools,agent,attached,start:()=>settings(),change(v){source=v;hooks.onChange();}};
}
const root=mkdtempSync(join(tmpdir(),'native-lifecycle-'));
const config={enabled:true,project:{root,scope:'test',references:[{id:'a',published_version:1,publication_event_id:'p',actor:'user',data_hash:'a'.repeat(64)}]},squidex:{baseUrl:'http://127.0.0.1:1946',app:'a',schema:'a',managementTokenRef:'w',consumerTokenRef:'r'}};
test.after(()=>rmSync(root,{recursive:true,force:true}));
test('agents created while settings initialize are attached when ready',async()=>{const h=host(config);const a=h.agent('early',root);h.start();assert.deepEqual(h.attached,['early']);assert.equal(h.ctx.crystraNative.status().state,'enabled');await assert.doesNotReject(a.listeners.get('system-prompt/assemble')(null,null,()=>{}));});
test('disabled configuration releases pending guards and leaves later agents alone',()=>{const h=host({enabled:false});const a=h.agent('early',root);h.start();assert.equal(a.listeners.size,0);h.agent('later',root);assert.deepEqual(h.attached,[]);});
test('automatic selection excludes other projects and internal evaluation agents',()=>{const h=host(config);h.start();h.agent('worker',root);h.agent('other',tmpdir());h.agent('crystra-reflection-x',root);h.agent('crystra-crystallization-eval-x',root);assert.deepEqual(h.attached,['worker']);});
test('settings changes require restart without rebinding existing or new work',()=>{const h=host(config);h.start();h.agent('first',root);h.change({...config,enabled:false});assert.equal(h.ctx.crystraNative.status().restartRequired,true);h.agent('second',root);assert.deepEqual(h.attached,['first','second']);});
test('invalid native configuration blocks prompt assembly instead of silently proceeding',async()=>{const h=host({enabled:true});h.start();const a=h.agent('worker',root);assert.equal(h.ctx.crystraNative.status().state,'invalid');await assert.rejects(a.listeners.get('system-prompt/assemble')(null,null,()=>{}),/Crystra unavailable/);});
test('missing components give actionable diagnostic and stop only managed prompts',async()=>{const h=host(config,async()=>({ready:false,missing:['共识库无法连接'],warnings:[],action:'请运行 crystra doctor'}));h.start();const a=h.agent('managed',root);await assert.rejects(a.listeners.get('system-prompt/assemble')(null,null,()=>{}),/crystra doctor/);assert.deepEqual(h.ctx.crystraNative.status().components.missing,['共识库无法连接']);const other=h.agent('ordinary',tmpdir());assert.equal(other.listeners.size,0);});

test('native diagnosis does not label initialization attachments as managed tasks',async()=>{const c={...config,project:{root,scope:'test',references:[],initializing:true}},h=host(c);h.start();h.ctx.crystraConsensusApproval={ready:Promise.resolve({manifest:()=>({scope:'test',references:[]})})};h.agent('setup',root);const result=await h.tools.get('crystra_installation_status').execute();assert.equal(result.state,'initializing');assert.equal(result.ready,false);assert.deepEqual(result.managed,[]);assert.deepEqual(result.attached,['setup']);});
