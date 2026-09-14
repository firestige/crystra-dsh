import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createDraftAuthoringStore} from '../src/host/draft-authoring-store.js';
const context={environment:'exploration',draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),workspaceId:'w',resourceId:'r',accessAllowed:true,writeAllowed:true};
const proposal={proposalId:'p1',workspaceId:'w',resourceId:'r',baseRevision:null,candidateRevision:'r1',candidate:{title:'draft'},sourceRefs:['design:v8']};
test('persists immutable revision and pending event atomically; same proposal is idempotent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));try{
 const options={root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:c=>typeof c.title==='string'};
 const store=createDraftAuthoringStore(options);const first=await store.commit(proposal);assert.equal(first.state,'committed');
 assert.deepEqual(await store.commit({...proposal,candidate:{title:'draft'}}),first);
 const restored=await createDraftAuthoringStore(options).read();assert.equal(restored.currentRevision,'r1');assert.equal(restored.revisions.length,1);assert.equal(restored.events.length,1);assert.equal(restored.events[0].status,'pending');
 await assert.rejects(store.commit({...proposal,candidate:{title:'other'}}),/PROPOSAL_CONFLICT/);
 await assert.rejects(store.commit({...proposal,proposalId:'p2',candidateRevision:'r2'}),/REVISION_CONFLICT/);
 assert.equal((await store.read()).revisions.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('rechecks permission after validation and never persists a partial candidate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));let allowed=true;try{
 const store=createDraftAuthoringStore({root,isolation:'draft-authoring-only',getContext:()=>({...context,writeAllowed:allowed}),validateCandidate:async()=>{allowed=false;return true;}});
 await assert.rejects(store.commit(proposal),/WRITE_NOT_ALLOWED/);allowed=true;assert.equal((await store.read()).revisions.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('rejects a different source lock and unsupported authority instead of adopting old state',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));try{
 const options={root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:()=>true};await createDraftAuthoringStore(options).commit(proposal);
 await assert.rejects(createDraftAuthoringStore({...options,getContext:()=>({...context,sourceLockDigest:'b'.repeat(64)})}).read(),/STORE_BINDING_CHANGED/);
 await assert.rejects(createDraftAuthoringStore({...options,getContext:()=>({...context,environment:'production'})}).commit(proposal),/EXPLORATION_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('validation cannot mutate the committed candidate or trusted binding',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));try{
 const store=createDraftAuthoringStore({root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:(candidate,binding)=>{candidate.title='mutated';binding.workspaceId='foreign';return true;}});
 await store.commit(proposal);assert.equal((await store.read()).revisions[0].candidate.title,'draft');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('concurrent writers cannot both advance the same base revision',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));let release,entered;const waiting=new Promise(resolve=>entered=resolve);try{
 const options={root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:()=>true};
 const first=createDraftAuthoringStore({...options,validateCandidate:()=>new Promise(resolve=>{release=()=>resolve(true);entered();})});
 const pending=first.commit(proposal);await waiting;
 await assert.rejects(createDraftAuthoringStore(options).commit({...proposal,proposalId:'other',candidateRevision:'other'}),/STORE_BUSY/);
 release();await pending;assert.equal((await first.read()).revisions.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('enforces storage limits in UTF-8 bytes for non-ASCII resources',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-test-'));try{
 const store=createDraftAuthoringStore({root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:()=>true});
 await assert.rejects(store.commit({...proposal,candidate:{text:'晶'.repeat(350000)}}),/PROPOSAL_TOO_LARGE/);
 assert.equal((await store.read()).revisions.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('durable delivery acknowledgement is exact, idempotent and cannot reorder pending revisions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-authoring-ack-'));try{
 const store=createDraftAuthoringStore({root,isolation:'draft-authoring-only',getContext:()=>context,validateCandidate:()=>true});
 const first=await store.commit(proposal),second=await store.commit({...proposal,proposalId:'p2',baseRevision:'r1',candidateRevision:'r2'});
 const receipt=(r)=>({status:'queued',eventId:r.eventId,resourceRevision:r.revision,sessionId:'s',messageId:'m-'+r.eventId});
 await assert.rejects(store.acknowledge(receipt(second)),/NOTIFICATION_ORDER/);
 await assert.rejects(store.acknowledge({...receipt(first),resourceRevision:'other'}),/NOTIFICATION_RECEIPT/);
 await store.acknowledge(receipt(first));await store.acknowledge(receipt(first));
 await assert.rejects(store.acknowledge({...receipt(first),sessionId:'foreign'}),/NOTIFICATION_RECEIPT/);
 await store.acknowledge(receipt(second));const state=await store.read();assert.equal(state.revisions.length,2);assert.deepEqual(state.events.map(e=>e.status),['queued','queued']);
 }finally{await rm(root,{recursive:true,force:true});}
});
