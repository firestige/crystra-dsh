import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCommitment,verifyCommitment,COMPARISON_LIMITS} from '../../src/backend/dsh-barrier.js';
const anchor={sessionId:'budget',stepId:'s',seq:0};
const action={id:'a',tool:'probe',kind:'result-equals',match:{suite:'public'},path:['x'],equals:0};
const compile=a=>compileCommitment({label:'Bounded comparison',actions:[a]},anchor,[]);
const nested=n=>JSON.parse('['.repeat(n)+'0'+']'.repeat(n));
const events=(value,id='c',seq=1)=>[{seq,type:'tool/call',data:{callId:id,name:'probe',arguments:'{"suite":"public"}'}},{seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:JSON.stringify({x:value})}]}]}}}];
const verify=(goal,es)=>verifyCommitment(goal,{sessionId:'budget',seq:es.at(-1).seq,events:es},[]);
test('supported depth is comparable; over-depth candidate does not poison a later valid execution',()=>{
  const value=nested(COMPARISON_LIMITS.maxDepth);
  assert.equal(verify(compile({...action,equals:value}),events(value)).decision,'GO');
  assert.throws(()=>compile({...action,equals:nested(COMPARISON_LIMITS.maxDepth+1)}),/unsupported comparison value/);
  const bad=events(nested(COMPARISON_LIMITS.maxDepth+1));
  assert.equal(verify(compile(action),bad).decision,'NO_GO');
  const verdict=verify(compile(action),[...bad,...events(0,'fresh',3)]);
  assert.equal(verdict.decision,'GO');assert.equal(verdict.matches[0].callSeq,3);
});
test('node budget supports its boundary and rejects wide subtrees without skipping later evidence',()=>{
  const value=Array(COMPARISON_LIMITS.maxNodes-1).fill(0);
  assert.equal(verify(compile({...action,equals:value}),events(value)).decision,'GO');
  const over=Array(COMPARISON_LIMITS.maxNodes).fill(0);
  assert.throws(()=>compile({...action,equals:over}),/unsupported comparison value/);
  assert.equal(verify(compile(action),events(over)).decision,'NO_GO');
  assert.equal(verify(compile(action),[...events(over),...events(0,'fresh',3)]).decision,'GO');
});
test('an invalid selected value cannot equal null; completion alone does not inspect result fields',()=>{
  const es=events(0);es[1].data.message.content[0].content[0].text='{"x":1e400}';
  assert.equal(verify(compile({...action,equals:null}),es).decision,'NO_GO');
  const {path,equals,...completed}=action;
  assert.equal(verify(compile({...completed,kind:'tool-completed'}),es).decision,'GO');
});
