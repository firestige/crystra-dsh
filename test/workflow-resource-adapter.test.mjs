import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkflowResourceAdapter} from '../src/client/workflow-resource-adapter.js';
const selection={definitionId:'wf',definitionRevision:'r1',workspaceId:'w'},workspace={files:[{path:'a.md',content:'source',revision:'base',truncated:false}]},catalog=[{id:'r',files:[{path:'a.md'}]}];
test('resource save applies only an exact receipt and ignores late results after revocation',async()=>{
 let current=true,saveResolve;const gateway={call:async(endpoint,payload)=>endpoint==='resources/read'?{ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',files:[{resourceId:'r',path:'a.md',revision:'base',content:'source'}]}}:new Promise(resolve=>{saveResolve=resolve;})};
 const port=createWorkflowResourceAdapter({gateway,selection,workspace,catalog,snapshotRevision:'s1',expiresAt:'expires',writeAllowed:true,isCurrent:()=>current,proposalId:()=> 'p'});await port.load();
 const save=port.save({resourceId:'r',path:'a.md',baseRevision:'base',baseContent:'source',content:'changed'});await Promise.resolve();current=false;saveResolve({ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',resourceId:'r',path:'a.md',revision:'draft-sha256:x',content:'changed'}});
 await assert.rejects(save,/DRAFT_BINDING_CHANGED/);assert.equal(port.getSnapshot().workspace.files[0].content,'source');port.dispose();
});
test('missing declared files and mismatched receipts never enable a stale editable workspace',async()=>{
 const port=createWorkflowResourceAdapter({gateway:{call:async()=>({ok:true,value:{authority:'draft',snapshotRevision:'other',expiresAt:'expires',files:[]}})},selection,workspace,catalog,snapshotRevision:'s1',expiresAt:'expires',writeAllowed:true,isCurrent:()=>true});
 await port.load();assert.equal(port.getSnapshot().phase,'unavailable');await assert.rejects(port.save({}),/RESOURCE_UNAVAILABLE/);port.dispose();
});
test('a verified save receipt advances the editable baseline to the immutable candidate',async()=>{
 const revision='draft-sha256:'+'a'.repeat(64);const port=createWorkflowResourceAdapter({selection,workspace,catalog,snapshotRevision:'s1',expiresAt:'expires',writeAllowed:true,isCurrent:()=>true,proposalId:()=> 'p',gateway:{call:async(endpoint,payload)=>({ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',...(endpoint==='resources/read'?{files:[{resourceId:'r',path:'a.md',revision:'base',content:'source'}]}:{resourceId:'r',path:'a.md',revision,content:payload.proposal.content})}})}});
 await port.load();await port.save({resourceId:'r',path:'a.md',baseRevision:'base',baseContent:'source',content:'changed'});assert.equal(port.getSnapshot().workspace.files[0].revision,revision);assert.equal(port.getSnapshot().workspace.files[0].content,'changed');port.dispose();
});
test('retry after a lost save response reuses the original proposal identity',async()=>{
 const ids=[];let fail=true;const port=createWorkflowResourceAdapter({selection,workspace,catalog,snapshotRevision:'s1',expiresAt:'expires',writeAllowed:true,isCurrent:()=>true,proposalId:()=>String(ids.length+1),gateway:{call:async(endpoint,payload)=>{
 if(endpoint==='resources/read')return {ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',files:[{resourceId:'r',path:'a.md',revision:'base',content:'source'}]}};
 ids.push(payload.proposal.proposalId);if(fail){fail=false;throw Error('response lost');}return {ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',resourceId:'r',path:'a.md',revision:'draft-sha256:'+'b'.repeat(64),content:'changed'}};
 }}});await port.load();const proposal={resourceId:'r',path:'a.md',baseRevision:'base',baseContent:'source',content:'changed'};await assert.rejects(port.save(proposal),/response lost/);await port.save(proposal);assert.equal(ids[0],ids[1]);port.dispose();
});
test('persisted notification receipts survive reload and reject false delivery claims',async()=>{
 const revision='draft-sha256:'+'c'.repeat(64);let notification={eventId:'event-c',status:'pending',resourceRevision:revision};
 const port=createWorkflowResourceAdapter({selection,workspace,catalog,snapshotRevision:'s1',expiresAt:'expires',isCurrent:()=>true,gateway:{call:async()=>({ok:true,value:{authority:'draft',snapshotRevision:'s1',expiresAt:'expires',files:[{resourceId:'r',path:'a.md',revision,content:'candidate',notification}]}})}});
 await port.load();assert.deepEqual(port.getSnapshot().workspace.files[0].notification,notification);
 notification={...notification,status:'delivered'};await port.load();assert.equal(port.getSnapshot().phase,'unavailable');assert.equal(port.getSnapshot().workspace.files[0].content,'source');port.dispose();
});
