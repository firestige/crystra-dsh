import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {realpathSync} from 'node:fs';
import {join} from 'node:path';
import {nativeConfig,Config} from '../../src/backend/native-config.js';
const ref={id:'a',published_version:1,publication_event_id:'p',actor:'user',data_hash:'a'.repeat(64)};
const configured=root=>({enabled:true,project:{root,scope:'test',references:[ref]},squidex:{baseUrl:'http://127.0.0.1:1946',app:'test',schema:'agreements',managementTokenRef:'CMS_WRITE',consumerTokenRef:'CMS_READ'}});
test('native settings defaults do not activate unconfigured agents',()=>assert.equal(Config({}).enabled,false));
test('native settings require explicit project, exact publications and local CMS',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-config-'));try{
  const c=configured(root);assert.equal(nativeConfig({},c).projectRoot,realpathSync(root));
  for(const bad of [{...c,project:undefined},{...c,project:{...c.project,references:[]}},{...c,squidex:{...c.squidex,baseUrl:'https://example.com'}}])assert.throws(()=>nativeConfig({},bad));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('CMS credentials are resolved by host ref and never accepted as agent identity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-config-'));try{
  const seen=[];const runtime=nativeConfig({credentials:{resolve:async name=>{seen.push(name);return {value:'host-token'};}}},configured(root));
  assert.equal(await runtime.core.consensus.squidex.consumerToken(),'host-token');assert.deepEqual(seen,['CMS_READ']);
  assert.deepEqual(runtime.core.consensus.principals,{'agent:worker':'Proposer','host:dsh-user':'Publisher'});
  assert.equal(await runtime.core.consensus.identifyAgent(), 'agent:worker');
  await assert.rejects(nativeConfig({},configured(root)).core.consensus.squidex.consumerToken(),/credential/i);
  await assert.rejects(nativeConfig({get:()=>({resolve:async()=>undefined}),get credentials(){throw Error('undeclared access');}},configured(root)).core.consensus.squidex.consumerToken(),/host credential unavailable/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('reflection and code capability adapters are declarative and independent of the business model',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-config-'));try{
  const c=configured(root);c.reflection={enabled:true,provider:'expert',model:'high',files:['core.js'],experiments:[]};c.crystallization={enabled:true,provider:'expert',model:'high',python:'/usr/bin/python3'};
  const runtime=nativeConfig({},c);assert.equal(runtime.core.reflection.agentOptions.model,'high');assert.equal((await runtime.core.reflection.requestFor(null,'Check core')).root,realpathSync(root));
  assert.equal(runtime.core.crystallization.agentOptions.provider,'expert');assert.ok(runtime.core.crystallization.code.root.includes('crystra'));
  assert.throws(()=>nativeConfig({},{...c,reflection:{...c.reflection,model:''}}));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('explicit initializing project permits an empty seed without making it a managed consensus',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-setup-'));try{
  const c=configured(root);c.project={root,scope:'test',references:[],initializing:true};
  const runtime=nativeConfig({},c);assert.equal(runtime.core.initializing,true);assert.deepEqual(runtime.manifest.references,[]);
  assert.throws(()=>nativeConfig({},{...c,project:{...c.project,initializing:false}}));
 }finally{await rm(root,{recursive:true,force:true});}
});

function crystalConfigured(root){return {...configured(root),reflection:{enabled:true,provider:'expert',model:'high',files:['core.js'],experiments:[]},crystallization:{enabled:true,provider:'expert',model:'high',python:'/usr/bin/python3'}};}
async function applicability(input,extra={}){
 const ctx={crystraConsensus:{ready:Promise.resolve({resolve:async()=>({})})},...extra};return nativeConfig(ctx,input).core.crystallization.context();
}
test('reflection, evaluation and credential routing changes do not invalidate an admitted native crystal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystal-applicability-'));try{
  const input=crystalConfigured(root),basis=await applicability(input);
  const variants=[
   {...input,reflection:{enabled:false}},
   {...input,reflection:{...input.reflection,provider:'other',model:'other',reasoningEffort:'low',timeoutMs:12,files:['other.js'],experiments:[{id:'other',command:'/usr/bin/true',args:[],timeoutMs:10}]}},
   {...input,crystallization:{...input.crystallization,provider:'other',model:'other',reasoningEffort:'low',timeoutMs:99}},
   {...input,squidex:{...input.squidex,managementTokenRef:'NEW_WRITE',consumerTokenRef:'NEW_READ',timeoutMs:99}},
   {...input,squidex:{baseUrl:input.squidex.baseUrl,app:'test',schema:'agreements',managementClientId:'new-write',managementSecretRef:'WRITE_SECRET',consumerClientId:'new-read',consumerSecretRef:'READ_SECRET'}},
   {...input,crystallization:{...input.crystallization,executionTimeoutMs:2000}},
  ];
  for(const variant of variants)assert.deepEqual(await applicability(variant),basis);
  assert.ok(!JSON.stringify(basis).includes('CMS_WRITE'));assert.ok(!JSON.stringify(basis).includes('CMS_READ'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('project consensus, source identity and execution environment changes invalidate native crystallization',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystal-relevant-')),other=await mkdtemp(join(tmpdir(),'crystal-other-'));try{
  const input=crystalConfigured(root),basis=await applicability(input);
  for(const variant of [
   {...input,project:{...input.project,root:other}}, {...input,project:{...input.project,scope:'other'}},
   ...[{id:'b'},{published_version:2},{publication_event_id:'p2'},{actor:'other'},{data_hash:'b'.repeat(64)}].map(change=>({...input,project:{...input.project,references:[{...ref,...change}]}})),
   ...[{baseUrl:'http://127.0.0.1:1947'},{app:'other'},{schema:'other'}].map(change=>({...input,squidex:{...input.squidex,...change}})),
   {...input,crystallization:{...input.crystallization,python:'/opt/other/python3'}},
   {...input,crystallization:{...input.crystallization,executionTimeoutMs:3000}},
  ])assert.notDeepEqual(await applicability(variant),basis);
  const changed=[{...ref,published_version:2,publication_event_id:'p2'}],ctx={crystraConsensusApproval:{ready:Promise.resolve({manifest:()=>({references:changed})})}};
  const current=await applicability(input,ctx);assert.deepEqual(current.references,changed);assert.notDeepEqual(current,basis);
 }finally{await rm(root,{recursive:true,force:true});await rm(other,{recursive:true,force:true});}
});
test('unavailable, missing or malformed effective publications never yield a crystallization context',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystal-context-failure-'));try{
  const input=crystalConfigured(root);
  await assert.rejects(applicability(input,{crystraConsensus:{ready:Promise.resolve({resolve:async()=>{throw Error('publication withdrawn');}})}}),/withdrawn/);
  await assert.rejects(applicability(input,{crystraConsensusApproval:{ready:Promise.resolve({manifest:()=>({references:[]})})}}),/consensus approval/i);
  await assert.rejects(applicability(input,{crystraConsensusApproval:{ready:Promise.resolve({manifest:()=>({references:[{...ref,data_hash:'bad'}]})})}}),/publication reference/i);
 }finally{await rm(root,{recursive:true,force:true});}
});
