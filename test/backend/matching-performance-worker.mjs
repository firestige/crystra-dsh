import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {compileCommitment,verifyCommitment,splitCommitment} from '../../src/backend/dsh-barrier.js';
const action=i=>({id:`a${i}`,kind:'result-equals',tool:'probe',match:{label:'dense'},path:['bytes'],equals:53});
const events=[];
function add(j){const seq=11+j*2,id=`c${j}`;events.push({seq,type:'tool/call',data:{name:'probe',callId:id,arguments:'{"label":"dense"}'}},{seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:'{"bytes":53}'}]}]}}});}
const goal=compileCommitment({label:'Astra dense deficit',actions:Array.from({length:8192},(_,i)=>action(i))},{sessionId:'s',stepId:'step',seq:10},[]);
for(let j=0;j<2048;j++)add(j);
const facts=()=>({sessionId:'s',seq:events.at(-1).seq,events});
const start=performance.now(),failed=verifyCommitment(goal,facts(),[]);
assert.equal(failed.decision,'NO_GO');assert.deepEqual(failed.missing,goal.actions.slice(2048).map(a=>a.id));assert.equal(new Set(failed.matches.map(m=>m.callSeq)).size,2048);
// Retain an equivalent maximum other than the declaration prefix.
const split=splitCommitment(goal,{baseVersion:1,reason:'Carry all unfinished responsibility',retain:goal.actions.slice(6144).map(a=>a.id),defer:goal.actions.slice(0,6144).map(a=>a.id)},facts(),[]);
assert.equal(split.pending.length,6144);assert.equal(verifyCommitment(split.commitment,facts(),[]).decision,'GO');
for(let j=2048;j<8192;j++)add(j);
const complete=verifyCommitment(goal,facts(),[]);assert.equal(complete.decision,'GO');assert.equal(new Set(complete.matches.map(m=>m.callSeq)).size,8192);
console.log(JSON.stringify({ms:performance.now()-start,matched:failed.matches.length,missing:failed.missing.length,completed:complete.matches.length}));
