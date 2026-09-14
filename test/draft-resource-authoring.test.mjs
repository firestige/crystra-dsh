import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createDraftResourceAuthoring} from '../src/host/draft-resource-authoring.js';
const context={environment:'exploration',draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),workspaceId:'w',accessAllowed:true,writeAllowed:true};
const resources=[{resourceId:'r',path:'notes.txt',revision:'source-r1',content:'source'}];
const request={proposalId:'p',resourceId:'r',path:'notes.txt',baseRevision:'source-r1',baseContent:'source',content:'edited'};
test('reopens exact isolated content and treats same proposal retry as idempotent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-resource-test-'));try{
 const options={root,resources,getContext:()=>context};const port=createDraftResourceAuthoring(options);
 const receipt=await port.save(request);assert.equal(receipt.authority,'draft');assert.equal(receipt.content,'edited');
 assert.deepEqual(await port.save(request),receipt);const reopened=createDraftResourceAuthoring(options);assert.deepEqual(await reopened.read('r','notes.txt'),receipt);
 await assert.rejects(port.save({...request,proposalId:'p2',content:'stale'}),/REVISION_CONFLICT/);
 assert.equal((await reopened.read('r','notes.txt')).content,'edited');assert.equal(resources[0].content,'source');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('rejects undeclared paths, wrong baselines, and changed or revoked authority',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-resource-test-'));let current=context;try{
 const port=createDraftResourceAuthoring({root,resources,getContext:()=>current});
 await assert.rejects(port.save({...request,path:'../foreign'}),/RESOURCE_UNAVAILABLE/);
 await assert.rejects(port.save({...request,baseContent:'wrong'}),/CONTENT_CONFLICT/);
 await port.save(request);current={...context,writeAllowed:false};await assert.rejects(port.save({...request,proposalId:'p3'}),/WRITE_NOT_ALLOWED/);
 current={...context,sourceLockDigest:'b'.repeat(64)};await assert.rejects(port.read('r','notes.txt'),/STORE_BINDING_CHANGED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('exact revision reads never silently advance to a newer resource candidate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-resource-test-'));let current=context;try{
 const port=createDraftResourceAuthoring({root,resources,getContext:()=>current});
 const first=await port.save(request);
 const second=await port.save({...request,proposalId:'p2',baseRevision:first.revision,baseContent:first.content,content:'newer'});
 assert.equal((await port.read('r','notes.txt')).revision,second.revision);
 assert.deepEqual(await port.readRevision('r','notes.txt',first.revision),first);
 assert.equal((await port.readRevision('r','notes.txt','source-r1')).content,'source');
 await assert.rejects(port.readRevision('r','notes.txt','latest'),/REVISION_UNAVAILABLE/);
 current={...context,accessAllowed:false};await assert.rejects(port.readRevision('r','notes.txt',first.revision),/ACCESS_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('asynchronous source checks gate reads and reject revoked writes before commit',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-resource-async-'));let allowed=true;try{
 const port=createDraftResourceAuthoring({root,resources,getContext:async()=>({...context,writeAllowed:allowed})});
 assert.equal((await port.read('r','notes.txt')).content,'source');await port.save(request);
 allowed=false;await assert.rejects(port.save({...request,proposalId:'p2'}),/WRITE_NOT_ALLOWED/);
 assert.equal((await port.read('r','notes.txt')).content,'edited');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('failed asynchronous initial authority is retained as a rejected read without an unhandled promise',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-resource-rejected-'));try{
 const port=createDraftResourceAuthoring({root,resources,getContext:async()=>{throw Error('SOURCE_REVOKED');}});await new Promise(resolve=>setImmediate(resolve));await assert.rejects(port.read('r','notes.txt'),/SOURCE_REVOKED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
