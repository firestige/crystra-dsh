import {resolveWorkflowSessionBinding} from './workflow-session-binding.js';
/** Selection follows the current exact workflow; inactive pages never reopen a package Session. */
export function createWorkflowInputController({bindings,workspaces,sessions}){
 let identity,disposed=false,updating=false,snapshot=Object.freeze({kind:'inactive'});
 const listeners=new Set();
 function publish(next){if(JSON.stringify(next)===JSON.stringify(snapshot))return;snapshot=Object.freeze(next);for(const listener of listeners)listener();}
 const resolve=()=>resolveWorkflowSessionBinding(identity,bindings.getSnapshot(),workspaces.list.getSnapshot(),sessions.list.getSnapshot());
 function update(){
  if(disposed||updating)return;updating=true;
  try{
   if(!identity){publish({kind:'inactive'});return;}
   const current=resolve();
   if(current.kind!=='bound'){publish({...identity,...current});return;}
   if(sessions.list.getSnapshot().current!==current.sessionId)sessions.open(current.sessionId);
   const latest=resolve();
   if(latest.kind!=='bound'||latest.sessionId!==current.sessionId){publish({...identity,kind:'unavailable'});return;}
   publish({...latest,kind:sessions.list.getSnapshot().current===latest.sessionId?'active':'selecting'});
  }catch{publish({...identity,kind:'unavailable'});}finally{updating=false;}
 }
 const stops=[bindings.subscribe(update),workspaces.list.subscribe(update),sessions.list.subscribe(update)];
 return {getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  setWorkflow:next=>{identity=next?{definitionId:next.definitionId,revision:next.revision}:undefined;update();},
  dispose:()=>{disposed=true;for(const stop of stops)stop();listeners.clear();},
 };
}
