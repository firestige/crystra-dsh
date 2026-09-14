import test from 'node:test';import assert from 'node:assert/strict';
import {createResourceNotificationDelivery} from '../src/host/resource-notification-delivery.js';
const binding={workspaceId:'workspace',packageRoot:'/package',sessionId:'session'};
const event={eventId:'event-one',resourceId:'file',path:'a.md',beforeRevision:'r0',afterRevision:'draft-sha256:'+'a'.repeat(64)};
const selection={definitionId:'workflow',definitionRevision:'v1'};
function fixture(){let live=true,flushOk=true,injects=0;const session={events:[]},agent={id:'session',session,inject(message){injects++;session.events.push({type:'agent/inbox/spliced',data:{target:'next-step',start:0,inserted:[message]}});}};const ctx={agents:{get:()=>live?agent:undefined},sessions:{get:()=>session,flush:async()=>flushOk}};
 return {session,agent,ctx,setLive:v=>live=v,setFlush:v=>flushOk=v,get injects(){return injects;},delivery:createResourceNotificationDelivery({ctx,resolveWorkspace:async()=>({workspaceId:'workspace',path:'/package',sessionKey:'session'})})};}
test('non-waking notice is durably queued once across acknowledgement retries',async()=>{
 const f=fixture(),input={binding,event,selection,isCurrent:async()=>true};const receipt=await f.delivery(input);assert.equal(receipt.status,'queued');assert.equal(f.injects,1);assert.equal(f.session.events[0].data.target,'next-step');
 assert.deepEqual(await f.delivery(input),receipt);assert.equal(f.injects,1);
 const message=f.session.events[0].data.inserted[0];assert.equal(message.source.kind,'plugin');assert.equal(message.source.form,'notice');assert.match(message.content[0].text,/不授权进一步修改/);assert.match(message.content[0].text,/resourceRevision/);
});
test('missing durability, wrong membership and expired sources never produce a delivery receipt',async()=>{
 const f=fixture(),input={binding,event,selection,isCurrent:async()=>true};f.setLive(false);await assert.rejects(f.delivery(input),/SESSION_UNAVAILABLE/);assert.equal(f.injects,0);f.setLive(true);
 await assert.rejects(f.delivery({...input,binding:{...binding,workspaceId:'foreign'}}),/SESSION_UNAVAILABLE/);assert.equal(f.injects,0);
 await assert.rejects(f.delivery({...input,isCurrent:async()=>false}),/SOURCE_CHANGED/);assert.equal(f.injects,0);
 f.setFlush(false);await assert.rejects(f.delivery(input),/DURABILITY_UNAVAILABLE/);assert.equal(f.injects,1);f.setFlush(true);assert.equal((await f.delivery(input)).status,'queued');assert.equal(f.injects,1);
});
test('same event identity with altered content cannot replace or duplicate the queued notice',async()=>{
 const f=fixture(),input={binding,event,selection,isCurrent:async()=>true};await f.delivery(input);await assert.rejects(f.delivery({...input,event:{...event,path:'other'}}),/IDENTITY_CONFLICT/);assert.equal(f.injects,1);
});
test('membership revoked during asynchronous workspace resolution prevents injection',async()=>{
 const f=fixture();let checks=0;const delivery=createResourceNotificationDelivery({ctx:f.ctx,resolveWorkspace:async()=>{if(++checks===2)f.setLive(false);return {workspaceId:'workspace',path:'/package',sessionKey:'session'};}});
 await assert.rejects(delivery({binding,event,selection,isCurrent:async()=>true}),/SESSION_UNAVAILABLE/);assert.equal(f.injects,0);
});

test('a canceled unconsumed notice can be explicitly requeued without duplicating live work',async()=>{
 const f=fixture(),input={binding,event,selection,isCurrent:async()=>true};const receipt=await f.delivery(input);f.session.events.push({type:'agent/inbox/spliced',data:{target:'next-step',start:0,removedCount:1,inserted:[],outcome:'canceled'}});assert.equal(await f.delivery.inspect(input),'canceled');assert.deepEqual(await f.delivery({...input,receipt}),receipt);assert.equal(f.injects,2);assert.equal(await f.delivery.inspect(input),'queued');await f.delivery({...input,receipt});assert.equal(f.injects,2);
});
test('a no-op native inject cannot manufacture a queued receipt',async()=>{
 const f=fixture();f.agent.inject=()=>{};await assert.rejects(f.delivery({binding,event,selection,isCurrent:async()=>true}),/NOTIFICATION_NOT_QUEUED/);
});
