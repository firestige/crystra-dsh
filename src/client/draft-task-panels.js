/** Renders already-admitted exploration snapshots. No approval, execution, or writing callbacks. */
export function createDraftTaskPanel({React,Core,source,renderers={}}){
 const h=React.createElement;
 const missing=reason=>h('p',{role:'status'},`草案投影不可用：${reason}`);
 function Gate({gates}){
  const [selected,setSelected]=React.useState(gates[0]?.id);
  const data=gates.find(gate=>gate.id===selected);
  if(!data)return missing('没有可展示的已提供 Gate');
  return h(Core.TaskGatePanel,{queue:gates.map(({id,question,impact})=>({id,question,impact})),selectedId:data.id,data,onSelect:setSelected});
 }
 return function DraftTaskPanel({taskId,surface}){
  const state=React.useSyncExternalStore(source.subscribe,source.getSnapshot,source.getSnapshot);
  if(state.state!=='valid')return missing(state.reason??'正在读取');
  const snapshot=state.projection;
  if(snapshot.binding.taskId!==taskId)return missing('BINDING_CHANGED');
  const entry=snapshot.surfaces[surface];
  if(entry?.state!=='available')return missing(entry?.reason??'SURFACE_MISSING');
  const data=entry.value,context={binding:snapshot.binding,snapshotRevision:snapshot.snapshotRevision};
  let view;
  if(surface==='grilling')view=h(Core.TaskRequirementsPanel,{data});
  else if(surface==='delivery')view=h(Core.TaskDeliveryPanel,{data});
  else if(surface==='gate')view=h(Gate,{key:snapshot.snapshotRevision,gates:data.gates});
  else if(surface==='plan')view=h(Core.TaskPlanPanel,{data,
   summaryGraph:renderers.planSummary?.(context)??missing('计划图尚未提供'),
   renderDocument:identity=>renderers.planDocument?.(identity,context)??missing('计划文档尚未提供'),
   renderDag:identity=>renderers.planDag?.(identity,context)??missing('计划 DAG 尚未提供')});
  else if(surface==='execution')view=h(Core.TaskExecutionPanel,{data,
   renderPlanGraph:select=>renderers.executionPlan?.(select,context)??missing('计划运行图尚未提供'),
   renderWaveGraph:wave=>renderers.executionWave?.(wave,context)??missing('工作流运行图尚未提供')});
  else return missing('UNKNOWN_SURFACE');
  return h(React.Fragment,null,h('aside',{role:'note'},`草案探索 · ${snapshot.provenance==='fixture'?'设计样本，非运行事实':'服务投影，非正式契约'}`),view);
 };
}
