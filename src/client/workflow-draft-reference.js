const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=4096;
/** Public native Input facade only: append a conditional reference, never submit it. */
export function createWorkflowDraftReference({input,sessions,conversation,focusInput}){
 return reference=>{
  const binding=input.getSnapshot();
  if(binding.kind!=='active'||binding.definitionId!==reference?.definitionId||binding.revision!==reference?.revision||
     sessions.list.getSnapshot().current!==binding.sessionId)return false;
  const keys=reference.kind==='resource'?['resourceId','path','resourceRevision']:reference.kind==='activity'?['objectId']:reference.kind==='crystallization'?['proposalId']:null;
  if(!keys||!keys.every(key=>text(reference[key])))return false;
  const scope=sessions.scope(binding.sessionId);
  if(!scope||sessions.scopeOf(scope)!==binding.sessionId)return false;
  const facade=conversation.input.for(scope),state=facade.state.getSnapshot();
  if(state.phase!=='plain'||typeof state.draft!=='string')return false;
  const target={authority:'draft',definitionId:binding.definitionId,revision:binding.revision,workspaceId:binding.workspaceId,kind:reference.kind,...Object.fromEntries(keys.map(key=>[key,reference[key]]))};
  const next=state.draft+(state.draft?'\n\n':'')+'Crystra 对象引用（草案）：\n'+JSON.stringify(target);
  facade.setDraft(next);
  if(facade.state.getSnapshot().draft!==next)return false;
  focusInput?.();return true;
 };
}
