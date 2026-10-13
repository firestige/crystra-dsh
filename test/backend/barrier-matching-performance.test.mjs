import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileCommitment,verifyCommitment,splitCommitment} from '../../src/backend/dsh-barrier.js';

// This deadline kills the regression worker, not the production Barrier.
// Old source takes minutes; the corrected complete/deficit/split sequence needs milliseconds.
test('Astra 8192/2048 deficit, alternate retain split, and full recovery finish without pathological work',()=>{
  const run=spawnSync(process.execPath,[new URL('./matching-performance-worker.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
  assert.equal(run.error,undefined,run.error?.message);assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(run.stdout);assert.equal(result.matched,2048);assert.equal(result.missing,6144);assert.equal(result.completed,8192);
});
function fixture(edges,order=edges.map((_,i)=>i)){
  const actions=order.map(i=>({id:`a${i}`,kind:'tool-completed',tool:'probe',match:{[`k${i}`]:true}}));
  const events=Array.from({length:edges[0].length},(_,j)=>{
    const seq=11+j*2,id=`c${j}`,args=Object.fromEntries(edges.flatMap((row,i)=>row[j]?[[`k${i}`,true]]:[]));
    return [{seq,type:'tool/call',data:{name:'probe',callId:id,arguments:JSON.stringify(args)}},{seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:'{}'}]}]}}}];
  }).flat();
  return {goal:compileCommitment({label:'matching regression',actions},{sessionId:'s',stepId:'step',seq:10},[]),facts:{sessionId:'s',seq:events.at(-1).seq,events}};
}
// Frozen reference for the old deterministic allocation, independent of predicate compilation.
function legacy(edges,order,retain=[]){
 const assignments=[],owner=new Map(),retained=new Set(retain);
 for(const root of [...order.filter(i=>retained.has(i)),...order.filter(i=>!retained.has(i))]){
  const queue=[root],seen=new Set(queue),parents=new Map();let free;
  search:for(let q=0;q<queue.length;q++)for(let j=0;j<edges[queue[q]].length;j++){
   if(!edges[queue[q]][j]||parents.has(j))continue;parents.set(j,queue[q]);
   if(!owner.has(j)){free=j;break search;}const other=owner.get(j);if(!seen.has(other)){seen.add(other);queue.push(other);}
  }
  while(free!==undefined){const i=parents.get(free),previous=assignments[i];assignments[i]=free;owner.set(free,i);free=previous;}
 }
 return {matches:order.filter(i=>assignments[i]!==undefined).map(i=>({actionId:`a${i}`,callId:`c${assignments[i]}`,callSeq:11+assignments[i]*2,resultSeq:12+assignments[i]*2})),missing:order.filter(i=>assignments[i]===undefined).map(i=>`a${i}`)};
}
const permutations=x=>x.length?x.flatMap((v,i)=>permutations(x.filter((_,j)=>i!==j)).map(t=>[v,...t])):[[]];
test('all three-by-three graphs preserve exact legacy witnesses and retain/defer feasibility in every declaration order',()=>{
 for(let mask=0;mask<512;mask++){
  const edges=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>Boolean(mask&(1<<(i*3+j)))));
  for(const order of permutations([0,1,2])){
   const {goal,facts}=fixture(edges,order),expected=legacy(edges,order),actual=verifyCommitment(goal,facts,[]);
   assert.deepEqual(actual.matches,expected.matches);assert.deepEqual(actual.missing,expected.missing);
   for(let bits=1;bits<7;bits++){
    const retain=order.filter(i=>bits&(1<<i)),defer=order.filter(i=>!(bits&(1<<i))),selected=legacy(edges,order,retain);
    const proposal={baseVersion:1,reason:'Equivalent maximum is allowed',retain:retain.map(i=>`a${i}`),defer:defer.map(i=>`a${i}`)};
    const allowed=selected.matches.length===retain.length&&retain.every(i=>selected.matches.some(m=>m.actionId===`a${i}`));
    if(!allowed)assert.throws(()=>splitCommitment(goal,proposal,facts,[]),/actual completed/);
    else{const split=splitCommitment(goal,proposal,facts,[]);assert.deepEqual(split.commitment.revision.basis,selected.matches);assert.deepEqual(split.pending.map(p=>p.action.id),goal.actions.filter(a=>proposal.defer.includes(a.id)).map(a=>a.id));}
   }
  }
 }
});
test('local exhausted component leaves unrelated capacity usable and reopens on new evidence',()=>{
 const {goal,facts}=fixture([[true,false],[true,false],[true,false],[false,true]]);
 const first=verifyCommitment(goal,facts,[]);assert.deepEqual(first.matches.map(m=>m.actionId),['a0','a3']);assert.deepEqual(first.missing,['a1','a2']);
 const extra=fixture([[true,true,true,false],[true,true,true,false],[true,true,true,false],[false,false,false,true]]);
 const recovered=verifyCommitment(goal,extra.facts,[]);assert.equal(recovered.decision,'GO');assert.equal(new Set(recovered.matches.map(m=>m.callSeq)).size,4);
});
test('long alternating path still reallocates witnesses after the direct free-candidate path is exhausted',()=>{
 const n=256,edges=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===n-1?j===0:j===i||j===i+1));
 const {goal,facts}=fixture(edges),actual=verifyCommitment(goal,facts,[]);assert.equal(actual.decision,'GO');assert.deepEqual(actual.matches,legacy(edges,edges.map((_,i)=>i)).matches);
});
test('candidate sharing distinguishes assertion kind, result path and expected value while preserving separate identities',()=>{
 const {goal,facts}=fixture([[true],[true],[true],[true]]);
 goal.actions=goal.actions.map((a,i)=>({...a,match:{k0:true},...(i?{kind:'result-equals',path:[i===3?'other':'value'],equals:i===2?1:0}:{})}));
 facts.events[1].data.message.content[0].content[0].text='{"value":0,"other":1}';
 const actual=verifyCommitment(goal,facts,[]);assert.deepEqual(actual.matches.map(m=>m.actionId),['a0']);assert.deepEqual(actual.missing,['a1','a2','a3']);
 const p={baseVersion:1,reason:'Retain result proof instead of weaker completion',retain:['a1'],defer:['a0','a2','a3']};
 assert.equal(splitCommitment(goal,p,facts,[]).commitment.revision.basis[0].actionId,'a1');
});
test('seeded rectangular overlap graphs preserve legacy assignments beyond exhaustive three-by-three coverage',()=>{
 let seed=61013;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let sample=0;sample<300;sample++){
  const n=4+sample%9,m=3+sample%8,density=[.15,.5,.85][sample%3];
  const edges=Array.from({length:n},()=>Array.from({length:m},()=>random()<density));
  const order=Array.from({length:n},(_,i)=>i);if(sample%2)order.reverse();
  const {goal,facts}=fixture(edges,order),actual=verifyCommitment(goal,facts,[]),expected=legacy(edges,order);
  assert.deepEqual(actual.matches,expected.matches);assert.deepEqual(actual.missing,expected.missing);
  const retain=order.filter(()=>random()<.5);if(!retain.length||retain.length===n)continue;
  const selected=legacy(edges,order,retain),proposal={baseVersion:1,reason:'Preserve exact completed allocation',retain:retain.map(i=>`a${i}`),defer:order.filter(i=>!retain.includes(i)).map(i=>`a${i}`)};
  const allowed=selected.matches.length===retain.length&&retain.every(i=>selected.matches.some(m=>m.actionId===`a${i}`));
  if(allowed)assert.deepEqual(splitCommitment(goal,proposal,facts,[]).commitment.revision.basis,selected.matches);
  else assert.throws(()=>splitCommitment(goal,proposal,facts,[]),/actual completed/);
 }
});
