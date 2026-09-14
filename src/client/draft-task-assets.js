import {isTaskDiagram} from 'crystra-ui-core';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&Object.keys(v).every(k=>names.includes(k));
const sameIdentity=(a,b)=>keys(a,['planRun','wave','workflow','workflowRun','traceRoot'])&&Object.keys(a).every(k=>a[k]===b?.[k]);
const rows=v=>Array.isArray(v)&&v.length<=1000;
/** Optional, inert display assets. Their enclosing source lock, identity and expiry remain mandatory. */
export function validateTaskAssets(assets,surfaces){
 if(assets===undefined)return true;
 if(!object(assets)||Object.keys(assets).some(k=>!['plan','execution','gateContexts'].includes(k)))return false;
 if(assets.plan!==undefined){
  const a=assets.plan;
  if(surfaces.plan?.state!=='available'||!keys(a,['identity','summary','dag','documentMarkdown'])||a.identity!==surfaces.plan.value.identity||typeof a.documentMarkdown!=='string'||a.documentMarkdown.length>500000||!isTaskDiagram(a.summary)||!isTaskDiagram(a.dag))return false;
 }
 if(assets.execution!==undefined){
  const a=assets.execution;
  if(surfaces.execution?.state!=='available'||!keys(a,['plan','selections','waves'])||!isTaskDiagram(a.plan)||!rows(a.selections)||!rows(a.waves))return false;
  const waves=surfaces.execution.value.waves,ids=new Set(),nodes=new Map();
  const visit=node=>{if(typeof node==='string')return;const id=node.props['data-dag-node']??node.props['data-section-id'];if(id)nodes.set(id,(nodes.get(id)??0)+1);node.children.forEach(visit);};visit(a.plan);
  for(const row of a.selections){if(!keys(row,['nodeId','waveId'])||typeof row.nodeId!=='string'||nodes.get(row.nodeId)!==1||ids.has(row.nodeId)||!waves.some(w=>w.id===row.waveId))return false;ids.add(row.nodeId);}
  ids.clear();
  for(const row of a.waves){const wave=waves.find(w=>w.id===row?.id);if(!keys(row,['id','identity','diagram'])||!wave||ids.has(row.id)||!sameIdentity(row.identity,wave.identity)||!isTaskDiagram(row.diagram))return false;ids.add(row.id);}
 }
 if(assets.gateContexts!==undefined){
  const entries=assets.gateContexts,gates=surfaces.gate?.value?.gates;
  if(surfaces.gate?.state!=='available'||!rows(entries)||entries.length>100)return false;
  const seen=new Set(),text=v=>typeof v==='string'&&v.length<=50000;
  for(const row of entries){
   if(!keys(row,['gateId','evidenceId','context']))return false;
   const gate=gates.find(g=>g.id===row.gateId),key=JSON.stringify([row.gateId,row.evidenceId]),c=row.context;
   if(!gate?.evidence.some(e=>e.id===row.evidenceId)||seen.has(key)||!keys(c,['id','kind','title','summary','sections','references'])||c.id!==row.evidenceId||!['id','kind','title','summary','references'].every(k=>text(c[k]))||!Array.isArray(c.sections)||c.sections.length>20||!c.sections.every(v=>keys(v,['title','body'])&&text(v.title)&&text(v.body)))return false;
   seen.add(key);
  }
 }
 return true;
}
export function createTaskAssetRenderers({React,Core,source,renderMarkdown}){
 const h=React.createElement;
 const get=context=>{const state=source.getSnapshot();if(state.state!=='valid')return;const p=state.projection;
  if(p.snapshotRevision!==context.snapshotRevision||Object.keys(p.binding).some(k=>p.binding[k]!==context.binding[k]))return;
  return p.assets;
 };
 const diagram=(value,label)=>h(Core.TaskDiagram,{diagram:value,label});
 return {
  gateContext:(gateId,evidenceId,context,onBack)=>{const row=get(context)?.gateContexts?.find(r=>r.gateId===gateId&&r.evidenceId===evidenceId);return row?h(Core.TaskEvidenceContext,{data:row.context,onBack}):undefined;},
  planSummary:context=>{const a=get(context)?.plan;return a&&diagram(a.summary,'计划结构摘要');},
  planDocument:(identity,context)=>{const a=get(context)?.plan;return a?.identity===identity&&renderMarkdown?renderMarkdown(a.documentMarkdown):undefined;},
  planDag:(identity,context)=>{const a=get(context)?.plan;return a?.identity===identity?h(Core.TaskDiagramExplorer,{diagram:a.dag,label:'计划 DAG'}):undefined;},
  executionPlan:(select,context)=>{const a=get(context)?.execution;if(!a)return;return h(Core.TaskDiagram,{diagram:a.plan,label:'计划运行图',selectableIds:a.selections.map(r=>r.nodeId),onSelect:nodeId=>{const current=get(context)?.execution;if(current!==a)return;const row=a.selections.find(r=>r.nodeId===nodeId);if(row)select(row.waveId);}});},
  executionWave:(wave,context)=>{const a=get(context)?.execution?.waves.find(r=>r.id===wave.id&&sameIdentity(r.identity,wave.identity));return a&&diagram(a.diagram,'工作流运行图');},
 };
}
