const id=value=>typeof value==='string'&&value.trim().length>0&&value.length<=4096;
/** A binding source is admitted by its adapter before this resolver. Names and paths never infer identity. */
export function resolveWorkflowSessionBinding(identity,bindings,workspaces,sessions){
 if(!id(identity?.definitionId)||!id(identity?.revision)||bindings?.state!=='valid'||!Array.isArray(bindings.entries)||
    workspaces?.phase!=='ready'||workspaces.baselinesReady!==true||!Array.isArray(workspaces.items)||
    sessions?.phase!=='ready'||!Array.isArray(sessions.ids)||!sessions.byId)return {kind:'unavailable'};
 const matches=bindings.entries.filter(entry=>entry?.definitionId===identity.definitionId&&entry?.revision===identity.revision);
 if(!matches.length)return {kind:'unbound'};
 if(matches.length!==1)return {kind:'ambiguous'};
 const binding=matches[0];
 if(!['workspaceId','packageRoot','sessionId'].every(key=>id(binding[key])))return {kind:'unavailable'};
 const owners=workspaces.items.filter(workspace=>workspace.workspaceId===binding.workspaceId);
 if(owners.length!==1||owners[0].path!==binding.packageRoot||!owners[0].sessionIds?.includes(binding.sessionId)||
   workspaces.archivedSessionIds?.includes(binding.sessionId)||!sessions.ids.includes(binding.sessionId)||
   !Object.hasOwn(sessions.byId,binding.sessionId)||sessions.byId[binding.sessionId]?.id!==binding.sessionId)return {kind:'unavailable'};
 return {kind:'bound',...identity,workspaceId:binding.workspaceId,sessionId:binding.sessionId};
}
