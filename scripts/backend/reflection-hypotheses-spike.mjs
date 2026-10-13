import {nativeEvidence} from '../../src/backend/dsh-evidence.js';
import {compileCommitment,verifyCommitment,splitCommitment} from '../../src/backend/dsh-barrier.js';
import {Controller} from '../../src/backend/controller.js';
import {digest,canonical} from '../../src/backend/value.js';
import {openJournal} from '../../src/backend/dsh-journal.js';
import {Session} from '@deepseek-ai/dsh-session';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const mode=process.argv[2],spec=JSON.parse(process.argv[3]??'{}');
const caught=async fn=>{try{return {ok:true,value:await fn()};}catch(e){return {ok:false,error:e.message,name:e.name};}};
const action=(id='a')=>({id,tool:'probe',kind:'result-equals',match:{case:'public'},path:['x'],equals:0});
const goal=actions=>compileCommitment({label:'Observe checkable commitments',actions},{sessionId:'worker',stepId:'s',seq:0},[]);
const pair=(seq=1,args={case:'public'},text='{"x":0}',tool='probe')=>[{seq,type:'tool/call',data:{callId:`c${seq}`,name:tool,arguments:JSON.stringify(args)}},{seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{id:`r${seq}`,role:'user',source:{kind:'tool',callId:`c${seq}`},content:[{type:'tool-result',toolCallId:`c${seq}`,content:[{type:'text',text}]}]}}}];
const ev=events=>({sessionId:'worker',seq:events.at(-1)?.seq??0,events});
async function boundaries(){
 const out={H1:{},H2:{},H3:{}};
 out.H1.helper=[];
 for(const [name,value] of [['empty',[]],['hole',Array(1)],['null',[null]],['extra',Object.assign([],{extra:true})]]){
  const g=goal([{...action(),equals:value}]);out.H1.helper.push({name,key:canonical(value),decision:verifyCommitment(g,ev(pair(1,{case:'public'},'{"x":[]}')),[]).decision,snapshot:await caught(()=>{const s=Session.create('snapshot');s.append('probe/data',{value});return s.snapshotEvents();})});
 }
 for(const field of ['actions','path'])out.H1[field+'Hole']=await caught(()=>{const a=action();if(field==='path')a.path=Array(1);return compileCommitment({label:'hole control',actions:field==='actions'?Array(1):[a]},{sessionId:'worker',seq:0,stepId:'s'},[]);});
 const g=goal([action('a'),{...action('b'),match:{case:'missing'}}]),p={baseVersion:1,reason:'Second operation has not run; retain actual first result',retain:['a'],defer:['b']};
 const split=splitCommitment(g,p,ev(pair()),[]);g.actions[0].equals=999;
 out.H2.helper={shared:split.commitment.actions[0].equals===999,historyUnchanged:split.commitment.versions[0].actions[0].equals===0,pendingUnchanged:split.pending[0].action.equals===0};
 let ctx,handle,journal;const root=await mkdtemp(join(tmpdir(),'reflection-boundaries-'));
 class Adapter extends LlmAdapter{index=0;async *stream(){const call=this.index++===0;const block=call?{type:'tool-call',id:'native',name:'probe',arguments:'{"case":"public"}'}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:call?'tool-calls':'stop'}};}}
 try{
 ctx=new Context();for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm','dsh-system-prompt','dsh-tools','dsh-session-persistence-jsonl','dsh-agent-loop']){const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,({'dsh-system-prompt':{includeHarnessIdentity:false,includeRuntimeContext:false},'dsh-tools':{mode:'native'},'dsh-session-persistence-jsonl':{root,compression:'none'},'dsh-agent-loop':{agents:[],maxParallelToolCalls:1}})[n]??{});}
 ctx.llm.registerAdapter(['hypothesis-fixture'],new Adapter());
 handle=await ctx.agents.create({sessionId:'worker',agentOptions:{provider:'hypothesis-fixture',model:'offline'},setup:ac=>{ac.tools.register({name:'probe',description:'Controlled boundary probe',parameters:{type:'object'},output:{schema:{type:'object'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:()=>({x:0})});}});
 const data={body:'consensus'},ref={id:'c',published_version:1,publication_event_id:'p',actor:'user:test',data_hash:digest(data)};
 journal=await openJournal(ctx.sessionPersistence,'worker');
 const opts={workerSessionId:'worker',journal,resolve:async()=>({reference:ref,data,effective:true}),evidence:nativeEvidence(async()=>{await ctx.sessions.flush(handle.agent.session);return ev(handle.agent.session.snapshotEvents());})};
 const ctrl=await Controller.open(opts,{scope:'spike',references:[ref]});
 const input={label:'First done, second pending',actions:[action('a'),{...action('b'),match:{case:'missing'}}]};
 assert.equal(await ctrl.declare(input),'GO');input.actions[0].equals=333;
 handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run probe'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);
 const native=handle.agent.session.snapshotEvents();out.H3.normalNative={events:native,verdict:verifyCommitment(goal([action()]),ev(native),[])};
 assert.equal(await ctrl.revise(p),'GO');const before=ctrl.snapshot();
 const snapshot=ctrl.snapshot();snapshot.active.actions[0].equals=444;snapshot.active.versions[0].actions[0].equals=555;snapshot.pending[0].action.equals=666;
 const read=await journal.read();read.active.actions[0].equals=777;
 out.H2.controller={inputIsolated:before.active.actions[0].equals===0,snapshotsIsolated:JSON.stringify(ctrl.snapshot())===JSON.stringify(before),finish:await ctrl.finish(),state:ctrl.snapshot()};
 assert.equal(out.H2.controller.inputIsolated,true);assert.equal(out.H2.controller.snapshotsIsolated,true);assert.equal(out.H2.controller.finish,'NO_GO');assert.equal(ctrl.snapshot().active,null);assert.equal(ctrl.snapshot().pending.length,1);
 await journal.close();journal=await openJournal(ctx.sessionPersistence,'worker');const restored=await Controller.open({...opts,journal});out.H2.restored={state:restored.snapshot(),finish:await restored.finish()};assert.deepEqual(restored.snapshot(),ctrl.snapshot());
 // Host JS input is a separate trust boundary from JSON model arguments.
 const j2=await openJournal(ctx.sessionPersistence,'host-hole');try{const hc=await Controller.open({...opts,workerSessionId:'host-hole',journal:j2,evidence:nativeEvidence(async()=>({sessionId:'host-hole',seq:0,events:[]}))},{scope:'spike',references:[ref]});out.H1.hostDeclare=await caught(()=>hc.declare({label:'Host sparse expectation',actions:[{...action(),equals:Array(1)}]}));out.H1.hostState=hc.snapshot();}finally{await j2.close();}
 out.H1.jsonRepresentability={holeIsJSONExpressible:false,extraArrayPropertyIsJSONExpressible:false,encodedHole:JSON.stringify(Array(1)),encodedExtra:JSON.stringify(Object.assign([],{extra:true}))};
 out.H3.helper=[];
 for(const kind of ['missing-seq','nan-seq','fractional-seq','missing-content','object-content']){const events=pair();if(kind==='missing-seq')delete events[1].seq;if(kind==='nan-seq')events[1].seq=NaN;if(kind==='fractional-seq')events[1].seq=1.5;if(kind==='missing-content')delete events[1].data.message.content;if(kind==='object-content')events[1].data.message.content={};out.H3.helper.push({kind,result:await caught(()=>verifyCommitment(goal([action()]),{sessionId:'worker',seq:3,events},[]))});}
 out.H3.nativeAppend=[];
 for(const kind of ['normal','missing-content','object-content','missing-block-content','wrong-call-id']){
  const s=Session.create('fault-'+kind);s.append('session/end-seed',{});const [c,r]=pair();if(kind==='missing-content')delete r.data.message.content;if(kind==='object-content')r.data.message.content={};if(kind==='missing-block-content')delete r.data.message.content[0].content;if(kind==='wrong-call-id')r.data.message.content[0].toolCallId='wrong';
  let faultState=null;const fc=await Controller.open({workerSessionId:s.id,journal:{read:async()=>structuredClone(faultState),append:async v=>{faultState=structuredClone(v);}},resolve:opts.resolve,evidence:nativeEvidence(async()=>({sessionId:s.id,seq:s.seq-1,events:s.snapshotEvents()}))},{scope:'spike',references:[ref]});assert.equal(await fc.declare({label:'Fault event check',actions:[action()]}),'GO');const faultBefore=fc.snapshot();s.append('tool/call',c.data);
  const appended=await caught(()=>s.append('tool/result',r.data,{surfaceOp:'append',sourceEventSeqs:[1]}));
  const record={kind,appended,events:s.snapshotEvents(),verify:await caught(()=>verifyCommitment(goal([action()]),ev(s.snapshotEvents()),[])),restore:await caught(()=>{Session.create(s.id,structuredClone(s.snapshotEvents()),s.header);return 'accepted';})};
  // Persist exact native event snapshots into an isolated native JSONL store.
  let store;record.persistence=await caught(async()=>{store=await ctx.sessionPersistence.create(s.header);await store.append(s.snapshotEvents());await store.flush();await store.close();store=null;const reader=await ctx.sessionPersistence.open(s.id,'read');try{return {count:(await reader.read()).events.length};}finally{await reader.close();}});
  await store?.close();record.controllerFinish=await caught(()=>fc.finish());record.stateUnchanged=JSON.stringify(fc.snapshot())===JSON.stringify(faultBefore);if(fc.snapshot().active){const seq=s.seq;const [nc,nr]=pair(seq);s.append('tool/call',nc.data);s.append('tool/result',nr.data,{surfaceOp:'append',sourceEventSeqs:[seq]});record.retry=await caught(()=>fc.finish());record.activeAfterRetry=fc.snapshot().active?.id??null;}out.H3.nativeAppend.push(record);
 }
 out.H3.corruptRestore=[];
 for(const kind of ['missing','fractional','duplicate']){const events=structuredClone(native);if(kind==='missing')delete events[1].seq;else if(kind==='fractional')events[1].seq=.5;else events[1].seq=0;out.H3.corruptRestore.push({kind,result:await caught(()=>{Session.create('worker',events,handle.agent.session.header);return 'accepted';})});}
 }finally{await journal?.close();await handle?.dispose();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
 return out;
}
async function nativeProbe(){
 const root=await mkdtemp(join(tmpdir(),'reflection-native-'));let ctx,handle;const stats={spec};
 const text='x'.repeat(spec.bytes??0);const value={x:spec.fault==='array'?[]:spec.fault==='null-array'?[null]:0,...(spec.bytes?{extra:text}:{})};
 class A extends LlmAdapter{index=0;async *stream(){const call=this.index++<(spec.matching??1);const block=call?{type:'tool-call',id:'native-'+this.index,name:'probe',arguments:JSON.stringify(spec.matching?Object.fromEntries(Array.from({length:spec.matching},(_,i)=>['f'+i,true])):{case:'public'})}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:call?'tool-calls':'stop'}};}}
 try{ctx=new Context();for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm','dsh-system-prompt','dsh-tools','dsh-session-persistence-jsonl','dsh-agent-loop']){const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,({'dsh-system-prompt':{includeHarnessIdentity:false,includeRuntimeContext:false},'dsh-tools':{mode:'native'},'dsh-session-persistence-jsonl':{root,compression:'none'},'dsh-agent-loop':{agents:[],maxParallelToolCalls:1}})[n]??{});}ctx.llm.registerAdapter(['native-probe'],new A());
 handle=await ctx.agents.create({sessionId:'worker',agentOptions:{provider:'native-probe',model:'offline'},setup:ac=>{ac.tools.register({name:'probe',description:'Native boundary probe',parameters:{type:'object'},output:{schema:{type:'object'},render:()=>spec.fault==='undefined'?undefined:spec.fault==='object'?{}:spec.fault==='invalid-part'?[{type:'text'}]:[{type:'text',text:JSON.stringify(value)}]},execute:()=>value});}});
 const start=performance.now();stats.run=await caught(async()=>{handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run probe'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);return 'flushed';});stats.pipelineMs=performance.now()-start;
 const events=handle.agent.session.snapshotEvents();const result=events.find(e=>e.type==='tool/result');stats.eventCount=events.length;stats.resultShape=result?{messageContentArray:Array.isArray(result.data.message?.content),blocks:result.data.message?.content?.map(b=>({type:b.type,isError:b.isError,contentArray:Array.isArray(b.content),parts:Array.isArray(b.content)?b.content.map(p=>({type:p.type,textType:typeof p.text})):null}))}:null;
 if(spec.kind!=='none'){const a=action();if(['array','null-array'].includes(spec.fault))a.equals=[];if(spec.kind==='completed'){a.kind='tool-completed';delete a.path;delete a.equals;}const g=goal(spec.matching?Array.from({length:spec.matching},(_,i)=>({id:'a'+i,tool:'probe',kind:'tool-completed',match:{['f'+i]:true}})):[a]);const t=performance.now();stats.verdict=await caught(()=>verifyCommitment(g,ev(events),[]));stats.barrierMs=performance.now()-t;}
 if(spec.fault)stats.events=events;
 await handle.dispose();handle=null;stats.restore=await caught(async()=>{const reader=await ctx.sessionPersistence.open('worker','read');try{const r=await reader.read();return r.events.length;}finally{await reader.close();}});stats.peakRSSKiB=process.resourceUsage().maxRSS;
 }finally{await handle?.dispose();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}return stats;
}
function resource(){
 const t0=performance.now();let g,events,edges;
 if(spec.family==='payload'){
  const text='x'.repeat(spec.bytes);const args={case:'public',...(spec.location==='args-side'?{extra:text}:{})};const value=spec.location==='selected'?text:0;
  const rendered=JSON.stringify({x:value,...(spec.location==='result-side'?{extra:text}:{}),...(spec.location==='wide'?{extra:Object.fromEntries(Array.from({length:spec.bytes},(_,i)=>['k'+i,i]))}:{})});
  g=goal([{...action(),...(spec.kind==='completed'?{kind:'tool-completed'}:{}),equals:value}].map(a=>{if(a.kind==='tool-completed'){delete a.path;delete a.equals;}return a;}));events=pair(1,args,rendered);
 }else{
  const n=spec.A,m=spec.X;edges=0;const matrix=Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>spec.graph==='dense'?true:spec.graph==='chain'?(i===n-1?j===0:j===i||j===i+1):i===j));
  g=goal(matrix.map((_,i)=>({id:'a'+i,kind:'tool-completed',tool:'probe',match:{['f'+i]:true}})));events=[];
  for(let j=0;j<m;j++){const args={};for(let i=0;i<n;i++)if(matrix[i][j]){args['f'+i]=true;edges++;}events.push(...pair(1+2*j,args));}
  for(let j=0;j<(spec.noise??0);j++)events.push(...pair(events.length+1,{extra:'z'.repeat(4096)},'{"x":0}','unrelated'));
 }
 const setupMs=performance.now()-t0;const timings=[];let verdict;
 for(let i=0;i<8;i++){const t=performance.now();verdict=verifyCommitment(g,ev(events),[]);if(i>=3)timings.push(performance.now()-t);}
 assert.equal(verdict.decision,'GO');if(spec.family==='matching')assert.equal(verdict.matches.length,spec.A);
 return {spec,setupMs,timings,medianMs:[...timings].sort((a,b)=>a-b)[2],peakRSSKiB:process.resourceUsage().maxRSS,bytes:Buffer.byteLength(JSON.stringify(events)),edges,decision:verdict.decision,matches:verdict.matches.length};
}
if(mode==='--boundaries'){console.log(JSON.stringify(await boundaries()));}
else if(mode==='--native'){console.log(JSON.stringify(await nativeProbe()));}
else if(mode==='--resource'){console.log(JSON.stringify(resource()));}
else{
 const dir=resolve('artifacts/backend-rebuild/reflection-hypotheses',`run-${Date.now()}`);await mkdir(dir,{recursive:true});
 const sourceHashes={};for(const name of ['barrier','controller','index','value'])sourceHashes[name]=digest(await readFile(`src/backend/${name}.js`,'utf8'));
 const results={date:'2026-10-13',node:process.version,sourceHashes,boundaries:null,resources:[]};
 async function run(arg,s={},timeout=15000){return new Promise(resolve=>{const child=spawn(process.execPath,['--max-old-space-size=256',new URL(import.meta.url).pathname,arg,JSON.stringify(s)],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='',reason=null;child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);const timer=setTimeout(()=>{reason='timeout';child.kill('SIGKILL');},timeout);const monitor=setInterval(async()=>{try{const usage=await new Promise(done=>{const ps=spawn('ps',['-o','rss=','-p',String(child.pid)]);let v='';ps.stdout.on('data',x=>v+=x);ps.on('close',()=>done(Number(v.trim())));});if(usage>512*1024){reason='rss-limit';child.kill('SIGKILL');}}catch{}},100);child.on('close',(code,signal)=>{clearTimeout(timer);clearInterval(monitor);let result;try{result=JSON.parse(stdout);}catch{}resolve({code,signal,reason,stderr,result});});});}
 results.boundaries=await run('--boundaries',{},30000);await writeFile(join(dir,'boundaries.json'),JSON.stringify(results.boundaries,null,2));console.log('Boundaries',results.boundaries.code,results.boundaries.stderr.slice(-1200));
 const specs=[];for(const bytes of [4096,262144,4194304,16777216])for(const location of ['selected','args-side','result-side'])specs.push({family:'payload',bytes,location});for(const bytes of [4096,262144,4194304,16777216])specs.push({family:'payload',bytes,location:'result-side',kind:'completed'});specs.push({family:'payload',bytes:10000,location:'wide'});
 for(const A of [1,20,64,256])for(const graph of ['sparse','dense','chain'])specs.push({family:'matching',A,X:A,graph});for(const graph of ['sparse','dense','chain'])specs.push({family:'matching',A:64,X:256,graph});specs.push({family:'matching',A:64,X:64,graph:'sparse',noise:256});
 const stopped=new Set();for(let repeat=0;repeat<3;repeat++){const order=repeat%2?[...specs].reverse():specs;for(const s of order){if(stopped.has(s.family))continue;const r=await run('--resource',s);results.resources.push({repeat,spec:s,...r});if(r.code!==0)stopped.add(s.family);await writeFile(join(dir,'results.json'),JSON.stringify(results,null,2));}console.log('Resource repeat completed',repeat+1);}
 results.native=[];for(const fault of ['undefined','object','invalid-part','array','null-array'])results.native.push(await run('--native',{fault,kind:'equals'}));for(let repeat=0;repeat<3;repeat++)for(const bytes of [4096,4194304,16777216])for(const kind of ['none','completed','equals']){const r=await run('--native',{bytes,kind});results.native.push({repeat,spec:{bytes,kind},...r});}results.native.push(await run('--native',{matching:20,kind:'completed'}));console.log('Native probes completed');
 for(const name of Object.keys(sourceHashes))assert.equal(digest(await readFile(`src/backend/${name}.js`,'utf8')),sourceHashes[name]);
 await writeFile(join(dir,'results.json'),JSON.stringify(results,null,2));console.log('EVIDENCE_DIR '+dir);
 if(results.boundaries.code!==0)process.exitCode=1;
}
