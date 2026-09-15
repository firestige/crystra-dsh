import {resolveTaskSessionBinding} from './task-session-binding.js';

/** Current Task controls selection; late inventory updates never carry navigation authority. */
export function createTaskInputController({inventory,sessions,drafts,workspaces}){
 let taskId,disposed=false,updating=false;
 let snapshot=Object.freeze({kind:'inactive'});
 const listeners=new Set();
 const selections=new Map();
 const resolve=()=>{
  const d=drafts?.getSnapshot();
  if(!d||d.ownerTaskIds?.includes(taskId)||!d.knownTaskIds?.includes(taskId))return resolveTaskSessionBinding(taskId,inventory.getSnapshot(),sessions.list.getSnapshot(),selections.get(taskId));
  const ws=workspaces?.list.getSnapshot(),ss=sessions.list.getSnapshot();
  if(d.state!=='valid'||ws?.phase!=='ready'||ws.baselinesReady!==true||ss?.phase!=='ready')return {kind:'unavailable'};
  const matches=d.entries.filter(e=>e.taskId===taskId);if(!matches.length)return {kind:'unbound'};if(matches.length!==1)return {kind:'ambiguous'};
  const b=matches[0],owners=ws.items?.filter(w=>w.workspaceId===b.workspaceId);
  if(owners?.length!==1||owners[0].path!==b.packageRoot||!owners[0].sessionIds?.includes(b.sessionId)||ws.archivedSessionIds?.includes(b.sessionId)||!ss.ids?.includes(b.sessionId)||!Object.hasOwn(ss.byId??{},b.sessionId)||ss.byId[b.sessionId]?.id!==b.sessionId)return {kind:'unavailable'};
  return {kind:'bound',authority:'draft',sessionId:b.sessionId,workspaceId:b.workspaceId};
 };
 function publish(next){
  if(JSON.stringify(next)===JSON.stringify(snapshot))return;
  snapshot=Object.freeze(next);for(const listener of [...listeners])listener();
 }
 function update(){
  if(disposed||updating)return;
  updating=true;
  try{
   if(!taskId){publish({kind:'inactive'});return;}
   const resolved=resolve();
   if(resolved.kind!=='bound'){const list=sessions.list.getSnapshot();const choices=(resolved.sessionIds??[]).filter(id=>list.ids?.includes(id)&&list.byId?.[id]?.id===id).map(id=>({id,label:list.byId[id].displayTitle??id}));publish({...resolved,taskId,choices});return;}
   if(sessions.list.getSnapshot().current!==resolved.sessionId)sessions.open(resolved.sessionId);
   const latest=resolve();
   if(latest.kind!=='bound'||latest.sessionId!==resolved.sessionId){publish({kind:'unavailable',taskId});return;}
   publish({...latest,taskId,kind:sessions.list.getSnapshot().current===latest.sessionId?'active':'selecting'});
  }catch{publish({kind:'unavailable',taskId});}
  finally{updating=false;}
 }
 const stops=[inventory.subscribe(update),sessions.list.subscribe(update),...(drafts?[drafts.subscribe(update)]:[]),...(workspaces?[workspaces.list.subscribe(update)]:[])];
 return Object.freeze({getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  setTask(id){taskId=id;update();},
  selectSession(id){if(!taskId)return;if(id===undefined)selections.delete(taskId);else {const decision=resolveTaskSessionBinding(taskId,inventory.getSnapshot(),sessions.list.getSnapshot(),id);if(decision.kind!=='bound')return;selections.set(taskId,id);}update();},
  dispose(){disposed=true;for(const stop of stops)stop();listeners.clear();},
 });
}
