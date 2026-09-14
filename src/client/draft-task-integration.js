import {createTaskAssetRenderers} from './draft-task-assets.js';
import {createDraftTaskAdapter} from './draft-task-adapter.js';
import {createDraftTaskPanel} from './draft-task-panels.js';
/** Add explicit host drafts to the existing directory without replacing owner records. */
export function createDraftTaskIntegration({React,Core,source,gateway,renderMarkdown}){
 const adapter=createDraftTaskAdapter({gateway}),known=new Set(),panels=new Map();
 let previousOwner,previousDraft,cached;
 const controller={...source,
  subscribe(listener){const a=source.subscribe(listener),b=adapter.subscribe(listener);return()=>{a();b();};},
  getSnapshot(){
   const owner=source.getSnapshot(),draft=adapter.getSnapshot();
   if(owner!==previousOwner||draft!==previousDraft){
    previousOwner=owner;previousDraft=draft;
    const existing=new Set(owner.taskList.items.map(item=>item.task_id));
    const extra=draft.tasks.filter(item=>!existing.has(item.context.taskId)).map(item=>{known.add(item.context.taskId);return {task_id:item.context.taskId,display_name:`草案 · ${item.context.taskId}`};});
    cached={...owner,taskList:{...owner.taskList,items:[...extra,...owner.taskList.items],...(extra.length?{phase:'ready'}:{})}};
   }
   return cached;
  },
  async loadTasks(cursor){await Promise.all([source.loadTasks(cursor),adapter.refresh()]);},
 };
 const bindings={subscribe:controller.subscribe,getSnapshot:()=>{
  const ownerTaskIds=source.getSnapshot().taskList.items.map(t=>t.task_id);
  const draft=adapter.getSnapshot();
  return {state:draft.phase==='ready'?'valid':'invalid',ownerTaskIds,knownTaskIds:[...known],entries:draft.tasks.filter(t=>!ownerTaskIds.includes(t.context.taskId)&&t.projection.inputBinding).map(t=>({taskId:t.context.taskId,...t.projection.inputBinding}))};
 }};
 return {controller,bindings,start:()=>adapter.refresh(),dispose:()=>adapter.dispose(),
  renderTaskPanels(id){
   if(!known.has(id)||source.getSnapshot().taskList.items.some(item=>item.task_id===id))return {};
   if(!panels.has(id)){const taskSource=adapter.taskSource(id);panels.set(id,createDraftTaskPanel({React,Core,source:taskSource,renderers:createTaskAssetRenderers({React,Core,source:taskSource,renderMarkdown})}));}
   const Panel=panels.get(id);
   return Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(surface=>[surface,React.createElement(Panel,{taskId:id,surface})]));
  },
 };
}
