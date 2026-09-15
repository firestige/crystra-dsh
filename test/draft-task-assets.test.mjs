import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTaskAssets} from '../src/client/draft-task-assets.js';
const graph={tag:'svg',props:{viewBox:'0 0 100 50'},children:[{tag:'g',props:{'data-section-id':'wave-node'},children:[]}]};
const identity={planRun:'p1',wave:'w1',workflow:'f1',workflowRun:'r1',traceRoot:'t1'};
const surfaces={plan:{state:'available',value:{identity:'plan1'}},execution:{state:'available',value:{waves:[{id:'wave1',identity}]}}};
const assets=()=>({plan:{identity:'plan1',summary:graph,dag:graph,documentMarkdown:'# Plan'},execution:{plan:graph,selections:[{nodeId:'wave-node',waveId:'wave1'}],waves:[{id:'wave1',identity,diagram:graph}]}});
test('rich assets bind exact plan and run identities, never a label or a latest alias',()=>{
 assert.equal(validateTaskAssets(assets(),surfaces),true);
 for(const mutate of [a=>a.plan.identity='other',a=>a.execution.waves[0].identity={...identity,workflowRun:'other'},a=>a.execution.selections[0].waveId='latest',a=>a.execution.selections[0].nodeId='absent',a=>a.execution.waves.push(a.execution.waves[0])]){
  const a=structuredClone(assets());mutate(a);assert.equal(validateTaskAssets(a,surfaces),false);
 }
});
test('optional rich assets reject active graphics and malformed documents before rendering',()=>{
 assert.equal(validateTaskAssets(undefined,surfaces),true);
 for(const mutate of [a=>a.plan.summary.children.push({tag:'script',props:{},children:['alert(1)']}),a=>a.plan.documentMarkdown={},a=>a.plan.extra=true]){
  const a=structuredClone(assets());mutate(a);assert.equal(validateTaskAssets(a,surfaces),false);
 }
 assert.equal(validateTaskAssets(assets(),{...surfaces,plan:{state:'unavailable',reason:'missing'}}),false);
});
test('retained asset callbacks cannot navigate after source revocation or run identity change',async()=>{
 const {createTaskAssetRenderers}=await import('../src/client/draft-task-assets.js');
 const binding={taskId:'task1',planRevision:'p1'};
 let state={state:'valid',projection:{binding,snapshotRevision:'s1',assets:assets()}};
 const r=createTaskAssetRenderers({React:{createElement:(type,props)=>({type,props})},Core:{TaskDiagram:'graph',TaskDiagramExplorer:'explorer'},source:{getSnapshot:()=>state},renderMarkdown:text=>text});
 const context={binding,snapshotRevision:'s1'};let selected;
 assert.equal(r.planDocument('plan1',context),'# Plan');assert.equal(r.planDocument('other',context),undefined);
 assert.ok(r.executionWave({id:'wave1',identity},context));assert.equal(r.executionWave({id:'wave1',identity:{...identity,workflowRun:'other'}},context),undefined);
 const view=r.executionPlan(id=>selected=id,context);view.props.onSelect('wave-node');assert.equal(selected,'wave1');
 selected=undefined;state={state:'invalid'};view.props.onSelect('wave-node');assert.equal(selected,undefined);assert.equal(r.planSummary(context),undefined);
});
test('Gate context is admitted only for the exact declared evidence item and remains inert text',()=>{
 const gateSurfaces={...surfaces,gate:{state:'available',value:{gates:[{id:'G-3',evidence:[{id:'ev1'}]}]}}};
 const a={gateContexts:[{gateId:'G-3',evidenceId:'ev1',context:{id:'ev1',kind:'receipt',title:'Exact receipt',summary:'Draft only',sections:[{title:'Body',body:'quoted content'}],references:'evidence:ev1@r1'}}]};
 assert.equal(validateTaskAssets(a,gateSurfaces),true);
 for(const mutate of [v=>v.gateContexts[0].gateId='G-5',v=>v.gateContexts[0].evidenceId='foreign',v=>v.gateContexts[0].context.id='foreign',v=>v.gateContexts.push(v.gateContexts[0]),v=>v.gateContexts[0].context.sections[0].body={},v=>v.gateContexts[0].context.url='https://example.com']){const copy=structuredClone(a);mutate(copy);assert.equal(validateTaskAssets(copy,gateSurfaces),false);}
});
test('context renderer preserves exact Gate/evidence pairing and drops revoked content',async()=>{
 const {createTaskAssetRenderers}=await import('../src/client/draft-task-assets.js');const binding={taskId:'t'};
 let state={state:'valid',projection:{binding,snapshotRevision:'s1',assets:{gateContexts:[{gateId:'G-3',evidenceId:'e1',context:{id:'e1',title:'Receipt'}}]}}};
 const r=createTaskAssetRenderers({React:{createElement:(type,props)=>({type,props})},Core:{TaskEvidenceContext:'context'},source:{getSnapshot:()=>state}}),ctx={binding,snapshotRevision:'s1'};
 assert.equal(r.gateContext('G-3','e1',ctx,()=>{}).props.data.title,'Receipt');assert.equal(r.gateContext('G-5','e1',ctx,()=>{}),undefined);
 state={state:'invalid'};assert.equal(r.gateContext('G-3','e1',ctx,()=>{}),undefined);
});
