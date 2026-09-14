import {createDraftWorkflowAdapter} from './draft-workflow-adapter.js';
import {workflowDraftLayout} from './workflow-draft-projection.js';
/** Read-only conditional workbench; no implicit editing or Agent session authority. */
export function createDraftWorkflowIntegration({React,Core,gateway,renderMarkdown,quote,canQuote=()=>false,adapter=createDraftWorkflowAdapter({gateway})}){
 const unavailable=reason=>React.createElement('p',{role:'status'},'草案不可用：'+reason);
 function Studio({value,onQuote}){
  const [header,setHeader]=React.useState(null);
  const resolveLayout=React.useCallback(async(ir,expanded,direction)=>workflowDraftLayout(value,ir,expanded,direction),[value]);
  return React.createElement('div',{style:{height:'100%',display:'flex',flexDirection:'column'}},React.createElement('div',{ref:setHeader}),React.createElement(Core.WorkflowMapViewer,{initialIR:value.ir,resolveLayout,headerContainer:header,mode:'studio',onQuote,onIdentity:()=>{}}));
 }
 function select(id,revision){
  const item=adapter.getSnapshot().workflows.find(row=>row.context.definitionId===id&&row.context.definitionRevision===revision);if(!item)return undefined;
  const p=item.projection,key=JSON.stringify([id,revision,p.snapshotRevision]);
  const reference=quote&&canQuote()&&p.inputBinding?(value)=>{const current=adapter.getSnapshot().workflows.find(row=>row.context.definitionId===id&&row.context.definitionRevision===revision);if(current?.projection!==p||!canQuote())return false;return quote({definitionId:id,revision,...value});}:undefined;
  const discuss=reference?selection=>{const v=p.resources.value,r=v.catalog.find(item=>item.id===selection.resourceId),file=v.workspace.files.find(item=>item.path===selection.path);if(!r?.files.some(item=>item.path===selection.path)||!file||file.truncated)return false;return reference({kind:'resource',resourceId:r.id,path:file.path,resourceRevision:file.revision??p.snapshotRevision});}:undefined;
  const panels=Object.fromEntries(['studio','resources','crystallization'].map(name=>{
   const surface=p[name];let content;
   if(surface.state!=='available')content=unavailable(surface.reason);
   else if(name==='studio')content=React.createElement(Studio,{key,value:surface.value,onQuote:reference?(_text,objectId)=>reference({kind:'activity',objectId}):undefined});
   else if(name==='resources')content=React.createElement(Core.WorkflowResourceViewer,{key,definitionId:id,revision,...surface.value,renderMarkdown,onDiscuss:discuss});
   else content=React.createElement(Core.WorkflowCrystallizationView,{key,data:surface.value,onQuote:reference?value=>reference({kind:'crystallization',proposalId:value.proposalId}):undefined});
   return [name,React.createElement('div',{key,style:{height:'100%',minHeight:0,display:'flex',flexDirection:'column'}},React.createElement('p',{role:'note',style:{margin:'4px 12px',fontSize:12}},p.provenance==='fixture'?'条件草案 · 设计快照，仅用于探索效果。':'条件草案 · 生效取决于精确来源与版本。'),React.createElement('div',{style:{flex:1,minHeight:0}},content))];
  }));
  return {title:p.entry.title,description:'条件草案 · '+revision,panels};
 }
 const bindings={subscribe:adapter.subscribe,getSnapshot:()=>{const s=adapter.getSnapshot();return {state:s.phase==='ready'?'valid':'invalid',authority:'draft',entries:s.workflows.filter(row=>row.projection.inputBinding).map(row=>({definitionId:row.context.definitionId,revision:row.context.definitionRevision,...row.projection.inputBinding}))};}};
 return {bindings,getSnapshot:adapter.getSnapshot,subscribe:adapter.subscribe,select,
  directory(){const s=adapter.getSnapshot();return {entries:s.workflows.map(row=>row.projection.entry),phase:s.phase==='ready'?'ready':s.phase==='idle'?'loading':'unavailable'};},
  start:adapter.refresh,dispose:adapter.dispose};
}
