import test from 'node:test';import assert from 'node:assert/strict';
import {extractExecutionFacts} from '../../src/backend/dsh-evidence.js';
import {compileCommitment,verifyCommitment} from '../../src/backend/barrier.js';
const call=(seq=1)=>({seq,type:'tool/call',data:{name:'probe',callId:'c',arguments:'{"label":"x"}'}});
const result=(seq=2)=>({seq,type:'tool/result',sourceEventSeqs:[1],data:{message:{source:{callId:'c'},content:[{type:'tool-result',toolCallId:'c',content:[{type:'text',text:'{"bytes":53}'}]}]}}});
const source=events=>({sessionId:'s',seq:events.at(-1)?.seq??0,events});
test('adapter preserves exact provenance and separates completion, structured result and strict original eligibility',()=>{
 const facts=extractExecutionFacts(source([call(),result()]));assert.equal(facts.executions.length,1);const e=facts.executions[0];assert.equal(e.callSeq,1);assert.equal(e.resultSeq,2);assert.equal(e.tool,'probe');assert.deepEqual(e.arguments,{label:'x'});assert.deepEqual(e.result,{found:true,value:{bytes:53}});assert.equal(e.original.found,true);assert.equal('data' in e,false);
 const r=result();r.data.message.content[0].content=[{type:'text',text:'{"bytes":'},{type:'text',text:'53}'}];
 const split=extractExecutionFacts(source([call(),r])).executions[0];assert.equal(split.result.found,true);assert.equal(split.original.found,false);
});
test('ambiguous outcomes, bad associations and future results never become executions',()=>{
 const r=result();for(const events of [[call(),r,{...r,seq:3}],[call(),{...r,sourceEventSeqs:[1,9]}],[call(),{...r,data:{message:{...r.data.message,source:{callId:'wrong'}}}}]])assert.equal(extractExecutionFacts(source(events)).executions.length,0);
 assert.equal(extractExecutionFacts({...source([call(),r]),seq:1}).executions.length,0);
 const bad=result();bad.data.message.content[0].isError=true;assert.equal(extractExecutionFacts(source([call(),bad])).executions.length,0);
});
test('domain Barrier consumes normalized executions without a host event envelope and refuses reuse',()=>{
 const goal=compileCommitment({label:'read',actions:[0,1].map(i=>({id:`a${i}`,kind:'result-equals',tool:'probe',match:{label:'x'},path:['bytes'],equals:53}))},{sessionId:'s',seq:0,stepId:'step'},[]);
 const facts={sessionId:'s',seq:2,executions:[{callSeq:1,resultSeq:2,callId:'c',tool:'probe',arguments:{label:'x'},result:{found:true,value:{bytes:53}}}]};
 const v=verifyCommitment(goal,facts,[]);assert.equal(v.decision,'NO_GO');assert.deepEqual(v.missing,['a1']);assert.equal(v.matches[0].callSeq,1);
});
test('malformed extra links block strict originals without widening the Barrier result policy',()=>{
 const r=result(),extra={...result(3),sourceEventSeqs:[1,9]},facts=extractExecutionFacts(source([call(),r,extra]));
 assert.equal(facts.executions.length,1);assert.equal(facts.executions[0].result.found,true);assert.equal(facts.executions[0].original.found,false);
});
test('crystallization core accepts host-independent facts and refuses ineligible original evidence',async()=>{
 const {Crystallization}=await import('../../src/backend/crystallization.js');
 for(const eligible of [true,false]){
  let stored=null;const c=await Crystallization.open({namespace:'facts-only',context:async()=>({basis:1}),original:async()=>({sessionId:'s',callSeq:1,resultSeq:2}),readFacts:async()=>({sessionId:'s',seq:2,executions:[{callSeq:1,resultSeq:2,tool:'double',arguments:{input:{x:1}},original:{found:eligible,value:2}}]}),evaluate:async()=>({decision:'decline',reason:'unused'}),resolve:async()=>({})},{read:async()=>stored,append:async s=>{stored=structuredClone(s);}});
  const run=()=>c.run({scope:'P',boundary:'double',input:{x:1}});if(eligible)assert.equal((await run()).output,2);else await assert.rejects(run(),/Unsupported native original/);
 }
});
test('windowed extraction does not decode prior steps; targeted original extraction still sees later duplicate links',()=>{
 let reads=0;const prior=call();Object.defineProperty(prior.data,'arguments',{get(){reads++;return '{"label":"old"}';}});
 const current={...call(3),data:{...call().data,callId:'new'}},out={...result(4),sourceEventSeqs:[3],data:{message:{source:{callId:'new'},content:[{type:'tool-result',toolCallId:'new',content:[{type:'text',text:'{"bytes":53}'}]}]}}};
 const native=source([prior,result(),current,out]);const facts=extractExecutionFacts(native,{after:2});assert.equal(reads,0);assert.equal(facts.executions.length,1);assert.equal(facts.executions[0].callSeq,3);
 const duplicate={...out,seq:5};const target=extractExecutionFacts(source([...native.events,duplicate]),{after:2,callSeq:3});assert.equal(target.executions.length,0);assert.equal(reads,0);
});
test('targeted strict extraction retains a malformed earlier link as an ambiguity',()=>{
 const c={...call(3)},r={...result(4),sourceEventSeqs:[3]},earlier={...result(1),sourceEventSeqs:[3,9]};
 const facts=extractExecutionFacts(source([earlier,c,r]),{after:2,callSeq:3});assert.equal(facts.executions.length,1);assert.equal(facts.executions[0].original.found,false);
});
