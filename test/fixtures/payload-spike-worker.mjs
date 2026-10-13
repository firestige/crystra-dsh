import {nativeEvidence} from '../../src/backend/dsh-evidence.js';
import {compileCommitment,verifyCommitment} from '../../src/backend/dsh-barrier.js';
import {Controller} from '../../src/backend/controller.js';
import {digest} from '../../src/backend/value.js';
import {openJournal} from '../../src/backend/dsh-journal.js';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const spec=JSON.parse(process.argv[2]);
const nested=(depth,array=false)=>array?'['.repeat(depth)+'0'+']'.repeat(depth):'{"n":'.repeat(depth)+'0'+'}'.repeat(depth);
const raw=spec.overflow?'1e400':nested(spec.depth??0,spec.array);
const argsRaw=spec.location.startsWith('args')?raw:'0',resultRaw=spec.location.startsWith('result')?raw:'0';
const args=spec.location==='args-target'?`{"suite":"public","x":${argsRaw}}`:`{"suite":"public","x":0,"extra":${argsRaw}}`;
const text=spec.location==='result-target'?`{"x":${resultRaw}}`:`{"x":0,"extra":${resultRaw}}`;
const data={body:'Payload spike local fixture'},ref={id:'c',published_version:1,publication_event_id:'p',actor:'user:test',data_hash:digest(data)};
const input={label:'Check observable payload',actions:[{id:'check',tool:'probe',kind:spec.location.startsWith('result')?'result-equals':'tool-completed',match:{suite:'public',...(spec.location==='args-target'?{x:0}:{})},...(spec.location.startsWith('result')?{path:['x'],equals:0}:{})}]};
const caught=async fn=>{try{return {status:'returned',value:await fn()};}catch(e){return {status:'threw',name:e.name,message:e.message,stack:e.stack};}};
const output={spec,inputBytes:Buffer.byteLength(args)+Buffer.byteLength(text),node:process.version};
if(spec.mode==='compile'){
 const val=JSON.parse(raw);if(spec.location==='args-target')input.actions[0].match.x=val;else input.actions[0].equals=val;
 output.compile=await caught(()=>compileCommitment(input,{sessionId:'worker',stepId:'s',seq:0},[ref]));
 // Avoid serializing deeply nested successful goal, which itself may exhaust JSON.stringify.
 if(output.compile.status==='returned')output.compile.value={compiled:true};
 let stored=null;const options={workerSessionId:'worker',journal:{read:async()=>structuredClone(stored),append:async state=>{stored=structuredClone(state);}},resolve:async()=>({reference:ref,data,effective:true}),evidence:nativeEvidence(async()=>({sessionId:'worker',seq:0,events:[]}))};
 const controller=await Controller.open(options,{scope:'payload',references:[ref]});output.declare=await caught(()=>controller.declare(input));output.responsibility={active:controller.snapshot().active?.id,pending:controller.snapshot().pending.length,history:controller.snapshot().history.length};
}else if(spec.mode==='pure'){
 const goal=compileCommitment(input,{sessionId:'worker',stepId:'s',seq:0},[ref]);
 const events=[{seq:1,type:'tool/call',data:{callId:'c',name:'probe',arguments:args}},{seq:2,type:'tool/result',sourceEventSeqs:[1],data:{message:{source:{callId:'c'},content:[{type:'tool-result',toolCallId:'c',content:[{type:'text',text}]}]}}}];
 output.verify=await caught(()=>verifyCommitment(goal,{sessionId:'worker',seq:2,events},[ref]));
}else{
 const root=await mkdtemp(join(tmpdir(),'crystra-payload-'));let ctx,handle,journal;const events=[];
 const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
 const start=async()=>{ctx=new Context();for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});await load('dsh-session-persistence-jsonl',{root,compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});};
 class Adapter extends LlmAdapter {index=0;async *stream(){const index=this.index++,call=index%2===0;const block=call?{type:'tool-call',id:index===0?'probe-call':'normal',name:'probe',arguments:index===0?args:'{"suite":"public","x":0,"recovery":true}'}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:call?'tool-calls':'stop'}};}}
 try{
  await start();ctx.llm.registerAdapter(['payload-fixture'],new Adapter());
  handle=await ctx.agents.create({sessionId:'worker',agentOptions:{provider:'payload-fixture',model:'offline'},setup:ac=>{ac.tools.register({name:'probe',description:'Deterministic payload probe',parameters:{type:'object'},output:{schema:{type:'object'},render:args=>[{type:'text',text:args.recovery?'{"x":0}':text}]},execute:()=>({x:0})});}});
  journal=await openJournal(ctx.sessionPersistence,'worker');
  const options=()=>({workerSessionId:'worker',journal,resolve:async()=>({reference:ref,data,effective:true}),evidence:nativeEvidence(async()=>({sessionId:'worker',seq:events.at(-1)?.seq??0,events}))});
  // Session begins with native initialization facts; use those as the declaration anchor.
  events.push(...handle.agent.session.snapshotEvents());
  const controller=await Controller.open(options(),{scope:'payload',references:[ref]});
  output.declare=await caught(()=>controller.declare(input));const before=controller.snapshot();
  output.execution=await caught(async()=>{handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run the payload probe once.'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);});
  events.splice(0,events.length,...handle.agent.session.snapshotEvents());
  output.events=structuredClone(events);output.finish=await caught(()=>controller.finish());
  output.stateUnchanged=JSON.stringify(controller.snapshot())===JSON.stringify(before);
  output.responsibility={active:controller.snapshot().active?.id,pending:controller.snapshot().pending.length,history:controller.snapshot().history.length};
  // A normal later execution must not hide whether the old bad evidence remains poison.
  handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run a normal recovery probe.'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);
  events.splice(0,events.length,...handle.agent.session.snapshotEvents());output.retryEvents=structuredClone(events);
  output.retryWithNormalEvidence=await caught(()=>controller.finish());
  await journal.close();journal=null;await handle.dispose();handle=null;await ctx.fiber.dispose();
  await start();journal=await openJournal(ctx.sessionPersistence,'worker');
  const saved=await ctx.sessionPersistence.open('worker','read');try{const native=await saved.read();events.splice(0,events.length,...native.events);}finally{await saved.close();}
  const restored=await Controller.open(options());output.restoredResponsibility={active:restored.snapshot().active?.id,pending:restored.snapshot().pending.length,history:restored.snapshot().history.length};
  output.restoredFinish=await caught(()=>restored.finish());
 }catch(e){output.host={status:'threw',name:e.name,message:e.message,stack:e.stack};}
 finally{await journal?.close();await handle?.dispose();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
}
console.log('PAYLOAD_RESULT '+JSON.stringify(output));
