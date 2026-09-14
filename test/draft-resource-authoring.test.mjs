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
