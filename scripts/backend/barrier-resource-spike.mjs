// Isolated diagnostic processes; no remote model and no production mutations.
import {spawnSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const baseline=resolve(root,'artifacts/backend-rebuild/association-fix/barrier-before.js');
const current=resolve(root,'src/backend/barrier.js');
function fixture(kind,size) {
  const count=kind==='dense'?64:kind==='noise'?20:5;
  const actions=Array.from({length:count},(_,i)=>({id:`a${i}`,tool:'check',kind:kind==='mismatch'?'result-equals':'tool-completed',match:kind==='noise'?{case:i}:{suite:'public'},...(kind==='mismatch'?{path:['exitCode'],equals:0}:{})}));
  const events=[];
  if(kind==='noise')for(let i=0;i<size;i++)events.push({seq:events.length+1,type:'message',data:{}});
  for(let i=0;i<(kind==='noise'?count:size);i++){
    const callId=`c${i}`,callSeq=events.length+1;
    events.push({seq:callSeq,type:'tool/call',data:{callId,name:'check',arguments:JSON.stringify(kind==='noise'?{case:i}:{suite:'public'})}});
    if(kind!=='missing')events.push({seq:events.length+1,type:'tool/result',sourceEventSeqs:[callSeq],data:{message:{source:{callId},content:[{type:'tool-result',toolCallId:callId,isError:false,content:[{type:'text',text:JSON.stringify({exitCode:kind==='mismatch'?1:0})}]}]}}});
  }
  return {actions,evidence:{sessionId:'resource',seq:events.length,events},expected:kind==='missing'||kind==='mismatch'?0:count};
}
function validate(api,f) {
  const goal=api.compileCommitment({label:'Known diagnostic input',actions:f.actions},{sessionId:'resource',seq:0,stepId:'s'},[]);
  const verify=()=>api.verifyCommitment(goal,f.evidence,[]);
  const result=verify();assert.equal(result.matches.length,f.expected);assert.equal(result.decision,f.expected===f.actions.length?'GO':'NO_GO');
  assert.equal(new Set(result.matches.map(m=>m.callSeq)).size,result.matches.length);
  for(const m of result.matches){const a=f.actions.find(a=>a.id===m.actionId),c=f.evidence.events.find(e=>e.seq===m.callSeq),r=f.evidence.events.find(e=>e.seq===m.resultSeq);assert.equal(c.type,'tool/call');assert.equal(c.data.name,a.tool);const args=JSON.parse(c.data.arguments);for(const [k,v]of Object.entries(a.match))assert.deepEqual(args[k],v);assert.deepEqual(r.sourceEventSeqs,[c.seq]);assert.equal(r.data.message.source.callId,c.data.callId);assert.equal(r.data.message.content[0].isError,false);if(a.kind==='result-equals')assert.equal(JSON.parse(r.data.message.content[0].content[0].text).exitCode,0);}
  return {verify,goal,result};
}
function mem(){const {rss,heapUsed,heapTotal,external}=process.memoryUsage();return {rss,heapUsed,heapTotal,external};}
if(process.argv[2]==='worker') {
  const [impl,kind,sizeText]=process.argv.slice(3),api=await import(pathToFileURL(impl==='baseline'?baseline:current));
  const f=fixture(kind,Number(sizeText)),{verify,result}=validate(api,f);
  for(let i=0;i<10;i++)verify();global.gc?.();const before=mem(),samples=[];
  for(let i=0;i<30;i++){const t=performance.now();verify();samples.push(performance.now()-t);}
  const after=mem();global.gc?.();const afterGc=mem(),sorted=[...samples].sort((a,b)=>a-b);
  console.log(JSON.stringify({impl,kind,size:Number(sizeText),events:f.evidence.events.length,actions:f.actions.length,inputBytes:Buffer.byteLength(JSON.stringify(f)),verdict:result.decision,completed:result.matches.length,witnesses:result.matches,milliseconds:samples,medianMs:(sorted[14]+sorted[15])/2,p95Ms:sorted[Math.ceil(.95*sorted.length)-1],before,after,afterGc}));
} else if(process.argv[2]==='memory') {
  const api=await import(pathToFileURL(current)),kind=process.argv[3],samples=[];
  if(kind==='stable'){
    const f=fixture('noise',1000),{verify}=validate(api,f);for(let i=0;i<10;i++)verify();global.gc();samples.push({iteration:0,...mem()});
    for(let i=1;i<=1000;i++){verify();if(i%100===0){const beforeGc=mem();global.gc();samples.push({iteration:i,beforeGc,afterGc:mem()});}}
  }else{
    global.gc();samples.push({history:0,...mem()});
    // Return from a separate frame before GC; no last fixture is intentionally retained.
    const verifyGrowing=size=>{validate(api,fixture('noise',size));};
    for(let i=1;i<=100;i++){
      verifyGrowing(i*100);
      if(i%10===0){const beforeGc=mem();global.gc();samples.push({history:i*100,beforeGc,afterGc:mem()});}
    }
  }
  console.log(JSON.stringify({kind,samples,note:'Explicit GC is diagnostic only; RSS retention is not proof of a leak.'}));
} else {
  const out=resolve(root,'artifacts/backend-rebuild/outcome-resource-spike');await mkdir(out,{recursive:true});
  const hashes={};for(const p of [current,baseline,resolve(root,'src/backend/value.js'),fileURLToPath(import.meta.url)])hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');
  const scenarios=[...[100,1000,10000].map(n=>['noise',n]),...['missing','mismatch'].flatMap(k=>[50,100,200].map(n=>[k,n])),['dense',256]];
  const metadata={node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,loadavg:os.loadavg(),started:new Date().toISOString(),hashes,design:'Each scenario/implementation/round is a fresh process; 10 warmups and 30 individually timed calls. Three pairs, alternating baseline/current order. Known verdict and native witness validated before timing. 10s child budget; no semantic-change input included.'};
  const records=[],start=performance.now();
  for(let round=0;round<3;round++)for(const [kind,size]of scenarios)for(const impl of round%2?['current','baseline']:['baseline','current']){
    const r=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'worker',impl,kind,String(size)],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024});
    records.push(r.status===0?{round,...JSON.parse(r.stdout)}:{round,impl,kind,size,error:r.error?.message,status:r.status,signal:r.signal,stderr:r.stderr});
    await writeFile(resolve(out,'resource-timing.json'),JSON.stringify({metadata,records},null,2)+'\n');
    if(performance.now()-start>15*60*1000)throw Error('Overall resource budget reached');
  }
  for(const kind of ['stable','growing']){
    const r=spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'memory',kind],{cwd:root,encoding:'utf8',timeout:60000});
    await writeFile(resolve(out,`resource-memory-${kind}.json`),JSON.stringify(r.status===0?{metadata,...JSON.parse(r.stdout)}:{metadata,kind,status:r.status,signal:r.signal,error:r.error?.message,stderr:r.stderr},null,2)+'\n');
  }
  console.log(JSON.stringify({processes:records.length,failed:records.filter(r=>r.error||r.status!==undefined).length,output:out,elapsedMs:performance.now()-start}));
}
