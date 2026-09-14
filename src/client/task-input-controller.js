import {resolveTaskSessionBinding} from './task-session-binding.js';

/** Current Task controls selection; late inventory updates never carry navigation authority. */
export function createTaskInputController({inventory,sessions}){
 let taskId,disposed=false,updating=false;
 let snapshot=Object.freeze({kind:'inactive'});
 const listeners=new Set();
 const selections=new Map();
 function publish(next){
  if(JSON.stringify(next)===JSON.stringify(snapshot))return;
  snapshot=Object.freeze(next);for(const listener of [...listeners])listener();
 }
 function update(){
  if(disposed||updating)return;
  updating=true;
  try{
   if(!taskId){publish({kind:'inactive'});return;}
   const resolved=resolveTaskSessionBinding(taskId,inventory.getSnapshot(),sessions.list.getSnapshot(),selections.get(taskId));
   if(resolved.kind!=='bound'){const list=sessions.list.getSnapshot();const choices=(resolved.sessionIds??[]).filter(id=>list.ids?.includes(id)&&list.byId?.[id]?.id===id).map(id=>({id,label:list.byId[id].displayTitle??id}));publish({...resolved,taskId,choices});return;}
   if(sessions.list.getSnapshot().current!==resolved.sessionId)sessions.open(resolved.sessionId);
   const latest=resolveTaskSessionBinding(taskId,inventory.getSnapshot(),sessions.list.getSnapshot(),selections.get(taskId));
   if(latest.kind!=='bound'||latest.sessionId!==resolved.sessionId){publish({kind:'unavailable',taskId});return;}
   publish({...latest,taskId,kind:sessions.list.getSnapshot().current===latest.sessionId?'active':'selecting'});
  }catch{publish({kind:'unavailable',taskId});}
  finally{updating=false;}
 }
 const stops=[inventory.subscribe(update),sessions.list.subscribe(update)];
 return Object.freeze({getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  setTask(id){taskId=id;update();},
  selectSession(id){if(!taskId)return;if(id===undefined)selections.delete(taskId);else {const decision=resolveTaskSessionBinding(taskId,inventory.getSnapshot(),sessions.list.getSnapshot(),id);if(decision.kind!=='bound')return;selections.set(taskId,id);}update();},
  dispose(){disposed=true;for(const stop of stops)stop();listeners.clear();},
 });
}
