import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const dir=resolve('artifacts/backend-rebuild/large-matching-spike');
let seed=61012;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const cases=[];
for(const n of [4,8,12])for(const density of [.15,.5,.85])for(let sample=0;sample<20;sample++){
  const matrix=Array.from({length:n},()=>Array.from({length:n},()=>random()<density));
  cases.push({name:`random-${n}-${density}-${sample}`,matrix,mixed:sample%2===1,states:Array.from({length:n},(_,j)=>sample%2?['ok','ok','mismatch','error','missing'][j%5]:'ok'),timeout:5000});
}
for(const n of [64,256]){
  const build=(kind,predicate,expected,basis)=>cases.push({name:`${kind}-${n}`,matrix:Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>predicate(i,j))),expected,basis,timeout:10000});
  // Last action needs call 0. Filling it forces a path through every earlier owner.
  build('alternating-path',(i,j)=>i===n-1?j===0:j===i||j===i+1,n,'Explicit perfect assignment: last action -> 0; action i -> i+1.');
  build('dense',()=>true,n,'Diagonal perfect assignment; n actions is upper bound.');
  build('isolated',(i,j)=>i!==n-1&&i===j,n-1,'Last action has no edge; other actions diagonal.');
  build('bottleneck',(i,j)=>i<n/2?j<n/4:j===i,n*3/4,'First half limited to n/4 calls; second half has n/2 disjoint diagonal calls.');
}
cases.push({name:'window-only-executions',matrix:[[true]],states:['missing'],expected:0,basis:'Only in-window call has no result; completed calls before declaration and after cutoff cannot satisfy.',timeout:5000});
mkdirSync(dir,{recursive:true});
const summary={seed:61012,node:process.version,sourceSha256:createHash('sha256').update(readFileSync('src/backend/barrier.js')).digest('hex'),randomCases:180,knownAnswerCases:8,windowOnlyCases:1,variantsPerCase:3,cases:[]};
for(const input of cases)test(input.name,{timeout:input.timeout+2000},()=>{
  const {timeout,...payload}=input;
  writeFileSync(resolve(dir,`${input.name}.input.json`),JSON.stringify(payload));
  const run=spawnSync(process.execPath,['scripts/backend/large-matching-spike.mjs','--worker'],{input:JSON.stringify(payload),encoding:'utf8',timeout,maxBuffer:16*1024*1024});
  const record={name:input.name,status:run.error?.code==='ETIMEDOUT'?'timeout':run.status===0?'passed':'failed',exitCode:run.status,error:run.error?.message??null,stderr:run.stderr,basis:input.basis??'Independent subset dynamic programming'};
  if(run.status===0)record.result=JSON.parse(run.stdout);
  writeFileSync(resolve(dir,`${input.name}.result.json`),JSON.stringify(record,null,2));summary.cases.push({name:record.name,status:record.status});
  writeFileSync(resolve(dir,'summary.json'),JSON.stringify(summary,null,2));
  assert.equal(run.error,undefined,run.error?.message);assert.equal(run.status,0,run.stderr);
});
