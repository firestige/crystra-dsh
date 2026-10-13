import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Context} from '@deepseek-ai/cordis';
import {Session} from '@deepseek-ai/dsh-session';
import {Controller} from '../../src/backend/controller.js';
import {openJournal} from '../../src/backend/dsh-journal.js';
import {compileCommitment,verifyCommitment} from '../../src/backend/barrier.js';
import {digest} from '../../src/backend/value.js';
const action={id:'probe',tool:'probe',kind:'result-equals',match:{suite:'public'},path:['x'],equals:0};
const malformed={
  'missing content':message=>{delete message.content;},
  'object content':message=>{message.content={};},
  'null content':message=>{message.content=null;},
  'null content member':message=>{message.content=[null];},
};
function resultData(callId){return {message:{id:`result-${callId}`,role:'user',source:{kind:'tool',callId},content:[{type:'tool-result',toolCallId:callId,content:[{type:'text',text:'{"x":0}'}]}]}};}
function call(session,id){return session.append('tool/call',{callId:id,name:'probe',arguments:'{"suite":"public"}'});}
function result(session,c,data=resultData(c.data.callId)){return session.append('tool/result',data,{surfaceOp:'append',sourceEventSeqs:[c.seq]});}
for(const [name,mutate] of Object.entries(malformed))test(`native malformed ${name}: NO_GO, preserved responsibility, fresh execution closes`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-event-shape-'));const ctx=new Context();let journal;
 try{
  for(const n of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,n.endsWith('jsonl')?{root,compression:'none'}:{});}
  const session=Session.create('worker');session.append('session/end-seed',{});
  const data={body:'Require actual successful probe'},ref={id:'c',published_version:1,publication_event_id:'p',actor:'user:test',data_hash:digest(data)};
  journal=await openJournal(ctx.sessionPersistence,'worker');
  const options=()=>({workerSessionId:'worker',journal,resolve:async()=>({reference:ref,data,effective:true}),evidence:async()=>({sessionId:'worker',seq:session.seq-1,events:session.snapshotEvents()})});
  const controller=await Controller.open(options(),{scope:'event-shape',references:[ref]});
  assert.equal(await controller.declare({label:'Probe x is zero',actions:[action]}),'GO');
  const original=controller.snapshot().active;
  const badCall=call(session,'bad');const badData=resultData('bad');mutate(badData.message);result(session,badCall,badData);
  const badPrefix=session.snapshotEvents();
  assert.equal(await controller.finish(),'NO_GO');
  assert.deepEqual(controller.snapshot().active,original);assert.equal(controller.snapshot().history.length,0);assert.equal(controller.snapshot().pending.length,0);
  assert.equal(controller.snapshot().lastCheck.decision,'NO_GO');
  // Reopen the managed state journal without deleting or repairing the evidence prefix.
  await journal.close();journal=await openJournal(ctx.sessionPersistence,'worker');
  const restored=await Controller.open(options());assert.equal(await restored.finish(),'NO_GO');assert.deepEqual(restored.snapshot().active,original);
  const goodCall=call(session,'good');const goodResult=result(session,goodCall);
  assert.deepEqual(session.snapshotEvents().slice(0,badPrefix.length),badPrefix,'invalid evidence remains unchanged');
  assert.equal(await restored.finish(),'GO');
  const closed=restored.snapshot();assert.equal(closed.active,null);assert.equal(closed.history.length,1);assert.equal(closed.pending.length,0);
  assert.equal(closed.history[0].verification.matches[0].callSeq,goodCall.seq);assert.equal(closed.history[0].verification.matches[0].resultSeq,goodResult.seq);
  await journal.close();journal=await openJournal(ctx.sessionPersistence,'worker');const closedRestored=await Controller.open(options());assert.equal(await closedRestored.finish(),'GO');assert.deepEqual(closedRestored.snapshot(),closed);
 }finally{await journal?.close();await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
test('malformed content cannot fulfill tool-completed, or make a duplicate outcome usable',()=>{
 const session=Session.create('worker');session.append('session/end-seed',{});
 const goal=compileCommitment({label:'Run probe',actions:[{id:'probe',tool:'probe',kind:'tool-completed',match:{suite:'public'}}]},{sessionId:'worker',stepId:'s',seq:0},[]);
 const evidence=()=>({sessionId:'worker',seq:session.seq-1,events:session.snapshotEvents()});
 const bad=call(session,'duplicate');const invalid=resultData('duplicate');delete invalid.message.content;result(session,bad,invalid);
 assert.equal(verifyCommitment(goal,evidence(),[]).decision,'NO_GO');
 result(session,bad);assert.equal(verifyCommitment(goal,evidence(),[]).decision,'NO_GO','same-call outcomes remain ambiguous');
 const good=call(session,'fresh');result(session,good);const v=verifyCommitment(goal,evidence(),[]);assert.equal(v.decision,'GO');assert.equal(v.matches[0].callSeq,good.seq);
});
