import {plain,same,digest} from './value.js';

/** Native-tool observation and around-dispatch routing; never changes the worker's tools/prompt. */
export function connectCrystallization(ctx,ready,options){
 const config=plain(options.auto)?options.auto:{};
 const pending=new Map();let tail=Promise.resolve(),failure=null,stopped=false;
 const stats={observed:0,crystallized:0,skipped:0};
 const key=(id,seq)=>`${id}:${seq}`;
 const internal=agent=>agent.session.id.startsWith('crystra-crystallization-eval-')||agent.session.id.startsWith('crystra-reflection-');
 const idle=async()=>{let current;do{current=tail;await current;}while(current!==tail);if(failure)throw failure;};
 function schedule(operation){
  tail=tail.then(async()=>{if(failure)return;await operation();}).catch(error=>{failure=error;});
 }
 const offExecute=ctx.on('tools/execute',async(exec,next)=>{
  if(stopped||!exec.agent||exec.parent!==undefined||internal(exec.agent)||exec.name.startsWith('crystra_'))return next();
  const service=await ready;
  if(service.isOriginalExecution())return next();
  if(!plain(exec.arguments)||Object.keys(exec.arguments).length!==1||!Object.hasOwn(exec.arguments,'input'))return next();
  let request;
  if(typeof config.select==='function')request=await config.select(exec);
  else if(plain(exec.arguments)&&Object.keys(exec.arguments).length===1&&Object.hasOwn(exec.arguments,'input'))request={scope:config.scope??options.namespace,boundary:exec.name,input:exec.arguments.input};
  if(!request)return next();
  if(request.boundary!==exec.name||!same(exec.arguments.input,request.input))throw new Error('Automatic crystallization selection must preserve native tool and input');
  digest(request);await idle();
  const events=exec.agent.session.snapshotEvents(),completed=new Set(events.filter(e=>e.type==='tool/result').flatMap(e=>e.sourceEventSeqs??[]));
  const calls=events.filter(e=>e.type==='tool/call'&&e.data.callId===exec.callId&&e.data.name===exec.name&&!completed.has(e.seq));
  if(calls.length!==1){stats.skipped++;return next();}
  const call=calls[0];
  if(!same(JSON.parse(call.data.arguments),exec.arguments)){stats.skipped++;return next();}
  const context=await service.context(request);
  const fast=await service.tryRun(request);
  pending.set(key(exec.agent.session.id,call.seq),{request:structuredClone(request),context,fast,started:performance.now()});
  if(!fast)return next();
  stats.crystallized++;
  return {isError:false,value:fast.output,content:[{type:'text',text:JSON.stringify(fast.output)}]};
 });
 const offEvent=ctx.on('session/event',(session,event)=>{
  if(stopped||event.type!=='tool/result')return;
  if(event.sourceEventSeqs?.length!==1)return;
  const id=key(session.id,event.sourceEventSeqs[0]),entry=pending.get(id);if(!entry)return;
  pending.delete(id);
  // Start durability independently of the evaluation queue while this session is live.
  const durationMs=performance.now()-entry.started;
  const durable=Promise.resolve().then(()=>ctx.sessions.flush(session));
  durable.catch(()=>{}); // The queued operation below owns failure propagation.
  if(entry.fast){
   schedule(async()=>{
    await durable;
    const service=await ready;
    await service.recordRoute(entry.request,entry.fast.reference,{sessionId:session.id,callSeq:event.sourceEventSeqs[0],resultSeq:event.seq},{isError:event.data.message?.content?.some(b=>b.isError===true)??true});
   });
   return; // A fast output must never qualify its own replacement.
  }
  const blocks=event.data.message?.content;
  if(!Array.isArray(blocks)||blocks.length!==1||blocks[0].type!=='tool-result'||blocks[0].isError||blocks[0].content?.length!==1||blocks[0].content[0].type!=='text'){stats.skipped++;schedule(()=>durable);return;}
  try{digest(JSON.parse(blocks[0].content[0].text));}catch{stats.skipped++;schedule(()=>durable);return;}
  schedule(async()=>{
   // session/event is a synchronous observer. Flush outside append's critical section.
   await durable;
   const service=await ready;
   const result=await service.observe(entry.request,{sessionId:session.id,callSeq:event.sourceEventSeqs[0],resultSeq:event.seq},entry.context,durationMs);
   if(result.path==='original')stats.observed++;
  });
 });
 return {whenIdle:idle,status:()=>({...stats,error:failure?.message??null,pending:pending.size}),stop(){stopped=true;offExecute();offEvent();pending.clear();},async close(){this.stop();await tail;}};
}
