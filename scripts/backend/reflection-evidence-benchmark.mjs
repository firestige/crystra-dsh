// Diagnostic evidence, not a timing SLA or an optimization gate.
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as current from '../../src/backend/barrier.js';
const implementations=[{label:'current',api:current}];
if(process.argv[2])implementations.unshift({label:'baseline',api:await import(pathToFileURL(resolve(process.argv[2])).href)});
function fixture(kind,size,actionCount=5,payloadBytes=0) {
  const actions=Array.from({length:actionCount},(_,i)=>({id:`a${i}`,kind:kind==='noise'?'tool-completed':'result-equals',tool:'check',match:kind==='noise'?{case:i}:{suite:'public'},...(kind==='noise'?{}:{path:['exitCode'],equals:0})}));
  const events=[];
  if(kind==='noise')for(let i=0;i<size;i++)events.push({seq:events.length+1,type:'message',data:{}});
  for(let i=0;i<(kind==='noise'?actionCount:size);i++) {
    const callId=`c${i}`;
    events.push({seq:events.length+1,type:'tool/call',data:{callId,name:'check',arguments:JSON.stringify(kind==='noise'?{case:i}:{suite:'public'})}});
    if(kind!=='missing')events.push({seq:events.length+1,type:'tool/result',sourceEventSeqs:[events.length],data:{message:{source:{callId},content:[{type:'tool-result',toolCallId:callId,content:[{type:'text',text:JSON.stringify({exitCode:1,payload:'x'.repeat(payloadBytes)})}]}]}}});
  }
  return {actions,events,expected:kind==='noise'?'GO':'NO_GO'};
}
const scenarios=[...[100,1000,10000].map(size=>({kind:'noise',size,actionCount:20})),...['missing','value-mismatch'].flatMap(kind=>[50,100,200].map(size=>({kind,size,actionCount:5}))),...[1,5,20].map(actionCount=>({kind:'value-mismatch',size:100,actionCount})),...[0,10000].map(payloadBytes=>({kind:'value-mismatch',size:50,actionCount:5,payloadBytes}))];
const records=[];
for(const spec of scenarios) {
  const f=fixture(spec.kind,spec.size,spec.actionCount,spec.payloadBytes);
  const record={...spec,eventCount:f.events.length,expected:f.expected,measurements:[]};
  for(const {label,api} of implementations) {
    const goal=api.compileCommitment({label:'Diagnostic fixture',actions:f.actions},{sessionId:'perf',seq:0,stepId:'s'},[]);
    const evidence={sessionId:'perf',seq:f.events.length,events:f.events};
    const check=events=>{const v=api.verifyCommitment(goal,{...evidence,events},[]);if(v.decision!==f.expected||new Set(v.matches.map(m=>m.callSeq)).size!==v.matches.length)throw Error('Diagnostic correctness mismatch');return v;};
    for(let i=0;i<3;i++)check(f.events);
    const samples=[];
    for(let i=0;i<5;i++){const started=performance.now();for(let j=0;j<3;j++)check(f.events);samples.push((performance.now()-started)/3);}
    let eventTypeReads=0;
    check(f.events.map(e=>new Proxy(e,{get(target,key,receiver){if(key==='type')eventTypeReads++;return Reflect.get(target,key,receiver);}})));
    record.measurements.push({label,millisecondsPerVerification:samples,medianMs:[...samples].sort((a,b)=>a-b)[2],eventTypeReads});
  }
  records.push(record);
}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,design:'Five samples of three verifications after three warmups. Diagnostic event-type reads expose scaling independently of wall-clock noise. Both implementations must return known verdicts. Sequential single-process comparison is not an optimization-benefit claim.',records},null,2));
