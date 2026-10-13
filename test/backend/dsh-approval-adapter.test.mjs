import test from 'node:test';
import assert from 'node:assert/strict';
import {createDshApprovalAdapter} from '../../src/backend/dsh-approval-adapter.js';
import {consensusApprovalPresentation} from '../../src/backend/consensus-approval-display.js';
const presentation=consensusApprovalPresentation({type:'publish',id:'a',reason:'why',activate:true},{scope:'P',documents:[]},{data:{body:{iv:'full body'}}});
test('substitute approval adapter receives semantic intent, persists before returning audited decision',async()=>{
 const events=[];let flushed=false;
 const agent={session:{id:'s',snapshotEvents:()=>events}};
 const adapter=createDshApprovalAdapter({get:()=>({request:async request=>{assert.match(request.reason,/full body/);assert.equal(request.presentation,undefined);events.push({seq:1,type:'approval/asked',data:{id:'a',callId:'c',toolName:'crystra_consensus_approve'}},{seq:2,type:'approval/decided',data:{id:'a',outcome:'allowed-once'}});return 'allowed-once';}}),sessions:{flush:async()=>{flushed=true;}}});
 assert.deepEqual(await adapter({agent,callId:'c',presentation}),{outcome:'allowed-once',approvalEvidence:{sessionId:'s',requestId:'a',askedSeq:1,decidedSeq:2,outcome:'allowed-once'}});assert.ok(flushed);
});
test('missing service, transport failure, missing proof and flush failure fail closed without throwing',async()=>{
 for(const ctx of [{},{get:()=>{throw Error('gone');}},{approval:{request:async()=>{throw Error('offline');}}},{approval:{request:async()=> 'allowed-once'},sessions:{flush:async()=>{throw Error('disk');}}},{approval:{request:async()=> 'allowed-once'},sessions:{flush:async()=>{}}}]){
  const result=await createDshApprovalAdapter(ctx)({agent:{session:{id:'s',snapshotEvents:()=>[]}},callId:'c',presentation});assert.equal(result.outcome,'unavailable');
 }
});
test('old matching decision cannot authorize a new request with a reused call identity',async()=>{
 const events=[{seq:1,type:'approval/asked',data:{id:'old',callId:'c',toolName:'crystra_consensus_approve'}},{seq:2,type:'approval/decided',data:{id:'old',outcome:'allowed-once'}}];
 assert.equal((await createDshApprovalAdapter({approval:{request:async()=> 'allowed-once'},sessions:{flush:async()=>{}}})({agent:{session:{id:'s',snapshotEvents:()=>events}},callId:'c',presentation})).outcome,'unavailable');
});
test('real DSH approvals recover after a failed durable flush and continue in the same session',async()=>{
 const {Context}=await import('@deepseek-ai/cordis'),{Session}=await import('@deepseek-ai/dsh-session'),{default:ApprovalService}=await import('@deepseek-ai/dsh-user-approval');
 const ctx=new Context();try{
  await ctx.plugin(ApprovalService,{policy:'ask'});ctx.on('approval/request',()=> 'allowed-once');
  const session=Session.create('adapter-recovery');session.append('turn/start',{turn:1});let fail=true;
  const adapter=createDshApprovalAdapter({get:()=>ctx.approval,sessions:{flush:async()=>{if(fail)throw Error('persistence unavailable');}}});
  assert.equal((await adapter({agent:{session,ctx},callId:'first',presentation})).outcome,'unavailable');
  fail=false;const recovered=await adapter({agent:{session,ctx},callId:'second',presentation});assert.equal(recovered.outcome,'allowed-once');assert.equal(session.eventAt(recovered.approvalEvidence.askedSeq).data.callId,'second');
  assert.equal(session.snapshotEvents().filter(e=>e.type==='approval/asked').length,2);
  assert.equal(session.snapshotEvents().filter(e=>e.type==='approval/decided').length,2);
 }finally{await ctx.fiber.dispose();}
});
