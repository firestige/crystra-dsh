/** A question is bound to the selected Gate, not the first pending queue entry. */
export async function askSelectedGate({task,runs,ask,signal}){
 for(;;){
  signal?.throwIfAborted();
  const changed=new AbortController();
  const stop=runs.subscribeGate(task,()=>changed.abort(new Error('GATE_SUBJECT_CHANGED')));
  try{
   const run=(await runs.read(task)).current;
   const gate=run?.plan.graph.nodes.find(n=>n.id===run.selectedGateId&&run.nodes[n.id].state==='awaiting-decision'&&!run.nodes[n.id].feedback);
   if(!gate)return;
   if(changed.signal.aborted)continue;
   const answer=await ask({question:gate.goal||gate.title,detail:['Plan '+run.plan.revision,...(run.nodes[gate.id].revision?[run.nodes[gate.id].revision.reason,'Sources: '+run.nodes[gate.id].revision.resultIdentities.join(', ')]:[]),'范围：'+gate.exitConditions.join('；'),'请结合审核工作台中的本版结果与来源作决定。'].join('\n'),choices:['确认此版本','需要修改'],signal:signal?AbortSignal.any([signal,changed.signal]):changed.signal});
   if(changed.signal.aborted)continue;
   return {gateId:gate.id,planDigest:run.planDigest,answer};
  }catch(error){if(!changed.signal.aborted||signal?.aborted)throw error;}
  finally{stop();}
 }
}
