/** Mechanical DSH lifecycle shared by the two internal evaluators.
 * Tools, evidence interpretation and durable business records belong to callers.
 */
export function createInternalAgentRunner(ctx,{closedMessage,closeReason,timeoutReason=closeReason,preCancelledReason=closeReason}){
 const live=new Set();let closed=false;
 const assertOpen=()=>{if(closed)throw new Error(closedMessage);};
 function begin({timeoutMs,signal}={}){
  assertOpen();
  const abort=new AbortController();let handle,timer,expired=false,settle;
  const done=new Promise(resolve=>{settle=resolve;});
  const cancel=(reason=closeReason)=>{abort.abort();handle?.agent.cancel({kind:'hook',reason});};
  const entry={done,cancel:()=>cancel()};live.add(entry);
  const onAbort=()=>cancel();signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)cancel();
  return {
   signal:abort.signal,get expired(){return expired;},
   async execute(options,message,{waitWhenIdle=false}={}){
    handle=await ctx.agents.create(options);
    timer=setTimeout(()=>{expired=true;cancel(timeoutReason);},timeoutMs);
    if(abort.signal.aborted)cancel(preCancelledReason);
    else handle.agent.followup(message);
    while(handle.agent.status!=='idle'&&!abort.signal.aborted)await new Promise(resolve=>setTimeout(resolve,10));
    if(waitWhenIdle||abort.signal.aborted)await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);
    return handle.agent.session.snapshotEvents();
   },
   async finish(finalize){
    clearTimeout(timer);signal?.removeEventListener('abort',onAbort);
    try{await handle?.dispose();}
    finally{try{await finalize?.();}finally{live.delete(entry);settle();}}
   },
  };
 }
 return {assertOpen,begin,async close(){closed=true;const entries=[...live];for(const entry of entries)entry.cancel();await Promise.all(entries.map(entry=>entry.done));}};
}
