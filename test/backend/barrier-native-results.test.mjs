import test from 'node:test';import assert from 'node:assert/strict';
import {captureNativeResults} from '../fixtures/native-result-probe.mjs';
import {compileCommitment,verifyCommitment} from '../../src/backend/dsh-barrier.js';

test('native DSH emits one associated result block, preserving renderer text parts',{timeout:5000},async()=>{
  const specs=[{callId:'fragment',tool:'fragmented',content:[{type:'text',text:'{"exit'},{type:'text',text:'Code":0}'}]},{callId:'prose',tool:'prose',content:[{type:'text',text:'Result: '},{type:'text',text:'{"exitCode":0}'}]},{callId:'plain',tool:'plain'}];
  const evidence=await captureNativeResults(specs);
  const results=evidence.events.filter(e=>e.type==='tool/result'),calls=evidence.events.filter(e=>e.type==='tool/call');
  assert.equal(results.length,3);
  for(const [i,event] of results.entries()) {
    assert.equal(Object.hasOwn(event.data,'value'),false,'Native event does not persist the generic execute return value');
    assert.equal(event.data.message.content.length,1);assert.equal(event.data.message.source.callId,calls[i].data.callId);assert.equal(event.data.message.content[0].toolCallId,calls[i].data.callId);
    assert.deepEqual(event.sourceEventSeqs,[calls[i].seq]);
    if(specs[i].content)assert.deepEqual(event.data.message.content[0].content,specs[i].content);
    const action={id:'a',tool:specs[i].tool,kind:'result-equals',match:{suite:'public'},path:['exitCode'],equals:0};
    const goal=compileCommitment({label:'Check rendered result',actions:[action]},{sessionId:evidence.sessionId,seq:0,stepId:'s'},[]);
    assert.equal(verifyCommitment(goal,evidence,[]).decision,i===1?'NO_GO':'GO');
  }
});
test('DSH native call IDs are step-local in validation; source sequence still identifies each execution',{timeout:5000},async()=>{
  const evidence=await captureNativeResults([{callId:'reused',tool:'check',args:{suite:'first'},value:{exitCode:1}},{callId:'reused',tool:'check',args:{suite:'second'},value:{exitCode:0}}]);
  const calls=evidence.events.filter(e=>e.type==='tool/call'),results=evidence.events.filter(e=>e.type==='tool/result');
  assert.equal(evidence.events.findLast(e=>e.type==='turn/end').data.reason.kind,'completed');assert.equal(calls.length,2);assert.equal(results.length,2);
  assert.equal(calls[0].data.callId,calls[1].data.callId);assert.notEqual(calls[0].data.step,calls[1].data.step);
  assert.deepEqual(results.map(r=>r.sourceEventSeqs),calls.map(c=>[c.seq]));
});

test('native repeated IDs remain separate successful executions for Barrier', {timeout:5000},async()=>{
  const evidence=await captureNativeResults([{callId:'reused',tool:'check',args:{suite:'first'},value:{exitCode:0}},{callId:'reused',tool:'check',args:{suite:'second'},value:{exitCode:0}}]);
  const goal=compileCommitment({label:'Both suites pass',actions:['first','second'].map(id=>({id,kind:'result-equals',tool:'check',match:{suite:id},path:['exitCode'],equals:0}))},{sessionId:evidence.sessionId,seq:0,stepId:'s'},[]);
  const verdict=verifyCommitment(goal,evidence,[]);
  assert.equal(verdict.decision,'GO');assert.equal(new Set(verdict.matches.map(m=>m.callSeq)).size,2);
});
