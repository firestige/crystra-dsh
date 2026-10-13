import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCommitment,verifyCommitment} from '../../src/backend/dsh-barrier.js';

// Worker intentionally uses subset DP, not the production augmenting-path algorithm.
export function oracle(edges,nCalls) {
  let states=new Set([0]);
  for(const row of edges){const next=new Set(states);for(const mask of states)for(let j=0;j<nCalls;j++)if(row[j]&&!(mask&(1<<j)))next.add(mask|(1<<j));states=next;}
  let best=0;for(const mask of states){let v=mask,count=0;while(v){v&=v-1;count++;}best=Math.max(best,count);}return best;
}
export function observe(input) {
  const {matrix,states=matrix[0].map(()=> 'ok'),mixed=false,expected,name}=input;
  const n=matrix.length,m=matrix[0].length;
  const actions=matrix.map((_,i)=>({id:`a${i}`,kind:mixed&&i%2?'result-equals':'tool-completed',tool:'probe',match:{[`f${i}`]:true},...(mixed&&i%2?{path:['exitCode'],equals:0}:{})}));
  const edges=matrix.map((row,i)=>row.map((edge,j)=>edge&&states[j]!=='error'&&states[j]!=='missing'&&(!mixed||i%2===0||states[j]!=='mismatch')));
  const wanted=expected??oracle(edges,m);
  const permutations=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n-1-i),Array.from({length:n},(_,i)=>(i+Math.floor(n/3))%n)];
  const orders=[Array.from({length:m},(_,i)=>i),Array.from({length:m},(_,i)=>m-1-i),Array.from({length:m},(_,i)=>(i+Math.floor(m/3))%m)];
  const observations=[];
  for(let variant=0;variant<3;variant++){
    const events=[],bySeq=new Map();
    const add=(j,seq,state=states[j])=>{
      const args={};for(let i=0;i<n;i++)if(matrix[i][j])args[`f${i}`]=true;
      const call={seq,type:'tool/call',data:{callId:'reused-text-id',name:'probe',arguments:JSON.stringify(args)}};
      events.push(call);bySeq.set(seq,{j,call});
      if(state!=='missing'){const result={seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{source:{callId:'reused-text-id'},content:[{type:'tool-result',toolCallId:'reused-text-id',isError:state==='error',content:[{type:'text',text:JSON.stringify({exitCode:state==='mismatch'?1:0})}]}]}}};events.push(result);bySeq.get(seq).result=result;}
    };
    // Identical qualifying operations outside the declaration/cutoff window cannot help.
    add(0,1,'ok');for(let k=0;k<m;k++)add(orders[variant][k],11+2*k);
    const cutoff=10+2*m;add(0,cutoff+1,'ok');
    const goal=compileCommitment({label:name,actions:permutations[variant].map(i=>actions[i])},{sessionId:'matching-spike',stepId:'s',seq:10},[]);
    const evidence={sessionId:'matching-spike',seq:cutoff,events};
    const actual=verifyCommitment(goal,evidence,[]);
    assert.deepEqual(verifyCommitment(goal,evidence,[]),actual,'repeat determinism');
    assert.equal(actual.matches.length,wanted,'independent cardinality');assert.equal(actual.decision,wanted===n?'GO':'NO_GO');
    assert.equal(new Set(actual.matches.map(w=>w.callSeq)).size,actual.matches.length,'execution reuse');
    assert.equal(new Set([...actual.matches.map(w=>w.actionId),...actual.missing]).size,n,'complete action partition');
    assert.equal(actual.matches.length+actual.missing.length,n,'partition cardinality');
    assert.deepEqual([...actual.matches.map(w=>w.actionId),...actual.missing].sort(),actions.map(a=>a.id).sort(),'exact action partition');
    for(const witness of actual.matches){
      const i=Number(witness.actionId.slice(1)),entry=bySeq.get(witness.callSeq);
      assert.ok(entry&&edges[i][entry.j],'witness eligibility');assert.equal(witness.callId,entry.call.data.callId);
      assert.equal(witness.resultSeq,entry.result.seq);assert.deepEqual(entry.result.sourceEventSeqs,[witness.callSeq]);
      assert.ok(witness.callSeq>10&&witness.resultSeq<=cutoff,'witness window');
      assert.equal(entry.call.data.name,actions[i].tool);assert.equal(JSON.parse(entry.call.data.arguments)[`f${i}`],true);
      if(actions[i].kind==='result-equals')assert.equal(JSON.parse(entry.result.data.message.content[0].content[0].text).exitCode,0);
    }
    observations.push({variant,decision:actual.decision,cardinality:actual.matches.length,matches:actual.matches,missing:actual.missing});
  }
  return {name,expected:wanted,observations};
}
if(process.argv[2]==='--worker'){
  const input=JSON.parse(readFileSync(0,'utf8'));
  try {process.stdout.write(JSON.stringify(observe(input)));}catch(error){process.stderr.write(error.stack);process.exitCode=1;}
}
