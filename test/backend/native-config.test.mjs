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
