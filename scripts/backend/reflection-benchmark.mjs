import {performance} from 'node:perf_hooks';
import {compileCommitment,verifyCommitment} from '../../src/backend/barrier.js';
const actions=Array.from({length:20},(_,i)=>({id:`a${i}`,kind:'tool-completed',tool:'check',match:{case:i}}));
const goal=compileCommitment({label:'20 checks',actions},{sessionId:'benchmark',seq:0,stepId:'s'},[]);
const samples=[];
for(const noise of [100,1000,10000]) {
  const events=Array.from({length:noise},(_,i)=>({seq:i+1,type:'message',data:{}}));
  for(let i=0;i<actions.length;i++) {
    const id=`c${i}`;
    events.push({seq:events.length+1,type:'tool/call',data:{callId:id,name:'check',arguments:JSON.stringify({case:i})}});
    events.push({seq:events.length+1,type:'tool/result',sourceEventSeqs:[events.length],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:'{}'}]}]}}});
  }
  const evidence={sessionId:'benchmark',seq:events.length,events};
  for(let i=0;i<10;i++)verifyCommitment(goal,evidence,[]);
  const times=[];
  for(let i=0;i<7;i++) {const start=performance.now();for(let n=0;n<30;n++)if(verifyCommitment(goal,evidence,[]).decision!=='GO')throw Error('Benchmark correctness failure');times.push((performance.now()-start)/30);}
  samples.push({noiseEvents:noise,actions:20,iterationsPerSample:30,millisecondsPerVerification:times,medianMs:[...times].sort((a,b)=>a-b)[3]});
}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,design:'Same 20 actions, varying irrelevant history. 10 warmups; 7 samples of 30 verifications. No candidate optimization comparison.',samples},null,2));
