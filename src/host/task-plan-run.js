import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const text=v=>typeof v==='string'&&v.trim().length>0;
/** Plan progress is owned here; Workflow execution and business results remain owned by Execution. */
export function createTaskPlanRuns({stateRoot,flow,runtime,activeAgentForTask}){
 const tails=new Map(),gateListeners=new Map();
 const serial=(task,action)=>{const run=(tails.get(task.taskId)??Promise.resolve()).then(action);const tail=run.catch(()=>undefined);tails.set(task.taskId,tail);void tail.then(()=>{if(tails.get(task.taskId)===tail)tails.delete(task.taskId);});return run;};
 const file=task=>{if(!/^task-[a-zA-Z0-9-]+$/.test(task.taskId))throw Error('TASK_ID_INVALID');return join(stateRoot,'plan-runs',`${task.taskId}.json`);};
 async function load(task){try{const value=JSON.parse(await readFile(file(task),'utf8'));if(value.taskId!==task.taskId||!Array.isArray(value.runs))throw Error('PLAN_RUN_STORE_INVALID');return value;}catch(e){if(e.code==='ENOENT')return {taskId:task.taskId,runs:[]};throw e;}}
 async function save(task,value){await mkdir(join(stateRoot,'plan-runs'),{recursive:true,mode:0o700});const target=file(task),temp=`${target}.${randomUUID()}.new`;await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,target);}
 async function accepted(task,planDigest){const view=await flow.read(task);if(!view.brief.confirmed||!view.plan.confirmed)throw Error('PLAN_UNCONFIRMED');if(view.plan.digest!==planDigest)throw Error('PLAN_CHANGED');if(!view.plan.value.graph)throw Error('PLAN_GRAPH_MISSING');return view;}
 const predecessors=(run,id)=>run.plan.graph.edges.filter(e=>e.kind==='normal'&&e.target===id).map(e=>e.source);
 const eligible=(run,id)=>predecessors(run,id).every(id=>run.nodes[id]?.state==='completed');
 function sources(run,id){const seen=new Set();const visit=id=>{for(const parent of predecessors(run,id)){if(!seen.has(parent)){seen.add(parent);visit(parent);}}};visit(id);return [...seen].sort().map(nodeId=>{const n=run.nodes[nodeId];return {nodeId,state:n.state,resultIdentity:n.result?.reference?.identity??null,contentIdentity:n.result?.reference?.contentIdentity??null,answerId:n.decision?.answerId??null};});}
 function revalidate(run){for(let pass=0;pass<run.plan.graph.nodes.length;pass++){let changed=false;for(const definition of run.plan.graph.nodes.filter(n=>['action','milestone'].includes(n.kind))){const node=run.nodes[definition.id];if(node.assessment&&node.assessment.basis!==JSON.stringify(sources(run,definition.id))){(node.assessmentHistory??=[]).push(node.assessment);delete node.assessment;node.state='needs-attention';changed=true;}}for(const g of run.plan.graph.nodes.filter(n=>n.kind==='gate')){const n=run.nodes[g.id];if(n.decision&&(!eligible(run,g.id)||JSON.stringify(n.decision.sources)!==JSON.stringify(sources(run,g.id)))){(n.decisionHistory??=[]).push(n.decision);delete n.decision;n.state='pending';n.invalidation='审核来源已变化，需要重新检查并确认';changed=true;}else if(n.state==='awaiting-decision'&&!eligible(run,g.id)){n.state='pending';changed=true;}}if(!changed)break;}gates(run);}
 function gates(run){for(const n of run.plan.graph.nodes)if(n.kind==='gate'&&run.nodes[n.id].state==='pending'&&eligible(run,n.id)&&n.entryConditions.length===0)run.nodes[n.id].state='awaiting-decision';if(!run.selectedGateId)run.selectedGateId=run.plan.graph.nodes.find(n=>n.kind==='gate'&&run.nodes[n.id].state==='awaiting-decision')?.id;}
 async function refresh(task,doc){
  const owner=runtime();if(!owner)return;
  const candidates=doc.runs.flatMap(run=>run.plan.graph.nodes.filter(n=>n.kind==='wave'&&run.nodes[n.id].deliveryId).map(n=>({run,node:run.nodes[n.id]})));
  if(!candidates.length)return;
  let snapshot;try{snapshot=await owner.ownerProjection.snapshot();}catch{for(const {node} of candidates)node.observationError='EXECUTION_UNAVAILABLE';return;}
  for(const {node} of candidates){
   const rows=snapshot.deliveries.filter(d=>d.deliveryId===node.deliveryId&&d.task.identity===task.taskId&&d.worktree===task.workspacePath);
   if(rows.length!==1){node.observationError='EXECUTION_IDENTITY_UNAVAILABLE';continue;}
   const row=rows[0];delete node.observationError;node.execution=row;
   if(owner.control.readWorkflowRun)node.workflowRun=await owner.control.readWorkflowRun({taskId:task.taskId,deliveryId:node.deliveryId}).catch(()=>({state:'unavailable',reason:'WORKFLOW_RUN_UNAVAILABLE'}));
   if(row.lifecycle!=='TERMINAL'){node.state='running';continue;}
   if(row.terminal?.outcome!=='SUCCEEDED'){node.state='failed';continue;}
   let result;try{result=await owner.control.readBusinessResult({taskId:task.taskId,deliveryId:node.deliveryId});}catch{result={state:'unavailable',reason:'RESULT_READ_FAILED'};}
   node.result=result;
   if(result.state!=='available'){node.state='result-unavailable';continue;}
   node.state=node.assessment?.resultIdentity===result.reference.identity?(node.assessment.conclusion==='satisfied'?'completed':'needs-attention'):'result-available';
  }
  for(const run of doc.runs)revalidate(run);
 }
 async function readInner(task){const doc=await load(task),before=JSON.stringify(doc);await refresh(task,doc);if(JSON.stringify(doc)!==before)await save(task,doc);const view=await flow.read(task);const current=doc.runs.findLast(r=>r.planDigest===view.plan.digest)??null;return {current,history:doc.runs,planCurrent:view.plan.confirmed,assessmentCurrent:!!current?.deliveryAssessment&&current.deliveryAssessment.basis===basis(current)};}
 function runFor(doc,view){let run=doc.runs.findLast(r=>r.planDigest===view.plan.digest);if(!run){run={id:`plan-run-${randomUUID()}`,planDigest:view.plan.digest,briefDigest:view.brief.digest,plan:view.plan.value,createdAt:new Date().toISOString(),nodes:Object.fromEntries(view.plan.value.graph.nodes.map(n=>[n.id,{state:'pending'}]))};doc.runs.push(run);gates(run);}return run;}
 function validateSources(run,id,request,view){const confirmations=[view.brief,view.plan].filter(item=>item.confirmed&&item.confirmation?.digest===item.digest).map(item=>item.confirmation.answerId).filter(Boolean);const allowed=new Set([run.planDigest,run.briefDigest,...confirmations,...sources(run,id).flatMap(s=>[s.resultIdentity,s.answerId]).filter(Boolean)]);if(!text(request.reason)||!Array.isArray(request.sourceIdentities)||!request.sourceIdentities.length||request.sourceIdentities.some(v=>!allowed.has(v)))throw Error('NODE_ASSESSMENT_SOURCE_INVALID');}
 async function checkInner(task,request,entry){
  const view=await accepted(task,request.planDigest),doc=await load(task);await refresh(task,doc);const run=runFor(doc,view),definition=run.plan.graph.nodes.find(n=>n.id===request.nodeId),node=run.nodes[request.nodeId];
  if(!definition||!eligible(run,request.nodeId))throw Error('NODE_PREDECESSOR_UNSATISFIED');validateSources(run,request.nodeId,request,view);
  const assessment={reason:request.reason,sourceIdentities:request.sourceIdentities,source:'control-plane-agent',assessedAt:new Date().toISOString(),basis:JSON.stringify(sources(run,request.nodeId))};
  if(entry)node.entryAssessment=assessment;
  else {if(!['action','milestone'].includes(definition.kind)||!['satisfied','unsatisfied'].includes(request.conclusion))throw Error('NODE_ASSESSMENT_INVALID');if(definition.entryConditions.length&&node.entryAssessment?.basis!==assessment.basis)throw Error('NODE_ENTRY_UNCHECKED');node.assessment={...assessment,conclusion:request.conclusion};node.state=request.conclusion==='satisfied'?'completed':'needs-attention';gates(run);}
  await save(task,doc);return readInner(task);
 }
 async function startInner(task,request,agent){
  const view=await accepted(task,request.planDigest),wave=view.plan.value.graph.nodes.find(n=>n.id===request.waveId&&n.kind==='wave');
  if(!wave)throw Error('PLAN_WAVE_UNKNOWN');if(!text(wave.workflowSelector))throw Error('WAVE_WORKFLOW_UNBOUND');
  if(agent?.session?.id!==task.sessionId)throw Error('TASK_SESSION_CHANGED');const owner=runtime();if(!owner)throw Error('EXECUTION_NOT_CONFIGURED');
  const bindings=await owner.readRepositoryBindings?.(task.workspacePath);if(!text((view.plan.bindingProposal?.documentDigest??view.plan.value.roleBindingsDigest))||bindings?.documentState!=='PRESENT'||(view.plan.bindingProposal?.documentDigest??view.plan.value.roleBindingsDigest)!==bindings.documentDigest)throw Error('PLAN_ROLE_BINDINGS_CHANGED');
  const doc=await load(task);await refresh(task,doc);const run=runFor(doc,view);
  const node=run.nodes[wave.id];if(node.state==='start-failed'&&!node.deliveryId&&['ERROR','RECOVERY'].includes(node.startResult?.kind)){(node.startFailures??=[]).push({result:node.startResult,error:node.startError,recordedAt:new Date().toISOString()});node.state='pending';delete node.startError;}if(node.state!=='pending')return readInner(task);if(!eligible(run,wave.id))throw Error('WAVE_PREDECESSOR_UNSATISFIED');if(wave.entryConditions.length&&node.entryAssessment?.basis!==JSON.stringify(sources(run,wave.id)))throw Error('WAVE_ENTRY_UNCHECKED');
  node.state='starting';await save(task,doc);
  const prompt=JSON.stringify({taskId:task.taskId,brief:view.brief.value,briefDigest:view.brief.digest,plan:view.plan.value,planDigest:request.planDigest,planRunId:run.id,formalBindingsDigest:(view.plan.bindingProposal?.documentDigest??view.plan.value.roleBindingsDigest),wave,confirmation:view.plan.confirmation});
  try{const result=await owner.invokeForSession({sessionKey:String(agent.id),agent,operation:{operation:'create',selector:wave.workflowSelector},images:[],onTerminal:async()=>{const recipient=activeAgentForTask?await activeAgentForTask(task):agent;recipient?.followup?.({id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'crystra'},content:[{type:'text',text:'当前 Task 的 Workflow 已返回。请读取正式运行结果，按已确认 Plan 检查 Wave 条件，再推进审核或报告缺口。此通知不是用户批准。'}]});},controlTask:{taskId:task.taskId,sessionId:task.sessionId,workspacePath:task.workspacePath,prompt}});node.startResult=result;if(result.kind==='RECOVERY'){node.state='start-failed';node.startError='EXISTING_DELIVERY_REQUIRES_EXACT_RECOVERY';}else if(['START_UNCERTAIN','TERMINAL'].includes(result.kind)&&result.deliveryId&&result.worktree===task.workspacePath){node.deliveryId=result.deliveryId;node.state='running';}else{node.state='start-failed';}}
  catch(e){node.state='start-uncertain';node.startError=e.message;}
  await save(task,doc);return readInner(task);
 }
 async function recoverInner(task,request,agent){
  const view=await accepted(task,request.planDigest);if(agent?.session?.id!==task.sessionId)throw Error('TASK_SESSION_CHANGED');const owner=runtime();if(!owner)throw Error('EXECUTION_NOT_CONFIGURED');
  const bindings=await owner.readRepositoryBindings?.(task.workspacePath);if(bindings?.documentState!=='PRESENT'||bindings.documentDigest!==(view.plan.bindingProposal?.documentDigest??view.plan.value.roleBindingsDigest))throw Error('PLAN_ROLE_BINDINGS_CHANGED');
  const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),node=run?.nodes[request.waveId];
  if(!node?.deliveryId)throw Error('WAVE_DELIVERY_UNAVAILABLE');
  if(node.execution?.lifecycle==='TERMINAL')return readInner(task);
  const result=await owner.invokeForSession({sessionKey:String(agent.id),agent,operation:{operation:'recover',deliveryId:node.deliveryId},images:[]});
  if(result.kind!=='RECOVERY'||result.deliveryId!==node.deliveryId||result.worktree!==task.workspacePath)throw Error(result.code??'WAVE_RECOVERY_FAILED');
  (node.recoveries??=[]).push({deliveryId:node.deliveryId,recoveredAt:new Date().toISOString()});await save(task,doc);return readInner(task);
 }
 async function assessInner(task,request){
  await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),node=run?.nodes[request.waveId];
  if(!node||node.result?.state!=='available'||node.result.reference.identity!==request.resultIdentity)throw Error('WAVE_RESULT_CHANGED');
  if(!['satisfied','unsatisfied'].includes(request.conclusion)||!text(request.reason))throw Error('WAVE_ASSESSMENT_INVALID');
  node.assessment={resultIdentity:request.resultIdentity,conclusion:request.conclusion,reason:request.reason,source:'control-plane-agent',assessedAt:new Date().toISOString()};node.state=request.conclusion==='satisfied'?'completed':'needs-attention';gates(run);await save(task,doc);return readInner(task);
 }
 const basis=run=>JSON.stringify(Object.entries(run.nodes).map(([id,n])=>({id,state:n.state,result:n.result?.reference?.identity??null,content:n.result?.reference?.contentIdentity??null,decision:n.decision?.answerId??null})));
 async function deliveryInner(task,request){
  await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest);if(!run)throw Error('PLAN_RUN_MISSING');
  const actual=new Set(Object.values(run.nodes).filter(n=>n.result?.state==='available').map(n=>n.result.reference.identity));
  if(!Array.isArray(request.resultIdentities)||request.resultIdentities.some(id=>!actual.has(id)))throw Error('DELIVERY_SOURCE_INVALID');
  if(!['deliverable','conditional','not-deliverable'].includes(request.conclusion)||!text(request.summary)||!Array.isArray(request.criteria)||!Array.isArray(request.conditions)||!request.conditions.every(text))throw Error('DELIVERY_ASSESSMENT_INVALID');
  const decisions=new Set(Object.values(run.nodes).flatMap(n=>n.decision?[n.decision.answerId]:[]));const decisionIds=request.decisionIds??[];if(!Array.isArray(decisionIds)||decisionIds.some(id=>!decisions.has(id)))throw Error('DELIVERY_SOURCE_INVALID');
  const sources=new Set([...request.resultIdentities,...decisionIds]);
  const indices=new Set();for(const c of request.criteria){if(!Number.isSafeInteger(c.index)||c.index<0||c.index>=run.plan.acceptance.length||indices.has(c.index)||!['supported','unsupported','unknown'].includes(c.status)||!text(c.reason)||(c.status==='supported'&&!sources.has(c.sourceIdentity??c.resultIdentity)))throw Error('DELIVERY_SOURCE_INVALID');indices.add(c.index);}
  if(request.conclusion==='deliverable'&&(request.criteria.length!==run.plan.acceptance.length||request.criteria.some(c=>c.status!=='supported')))throw Error('DELIVERY_CONDITIONS_UNMET');
  if(request.conclusion==='conditional'&&!request.conditions.length)throw Error('DELIVERY_CONDITIONS_MISSING');
  const candidates=request.candidates??[];
  if(!Array.isArray(candidates)||candidates.some(c=>!text(c.name)||!actual.has(c.resultIdentity)||!request.resultIdentities.includes(c.resultIdentity)||Object.keys(c).some(k=>!['name','resultIdentity','artifactId'].includes(k))||(c.artifactId!==undefined&&!Object.values(run.nodes).some(n=>n.result?.reference?.identity===c.resultIdentity&&Object.hasOwn(n.result.result.artifacts,c.artifactId)))))throw Error('DELIVERY_CANDIDATE_INVALID');
  run.deliveryAssessment={planDigest:request.planDigest,conclusion:request.conclusion,summary:request.summary,resultIdentities:request.resultIdentities,decisionIds,candidates,criteria:request.criteria,conditions:request.conditions,source:'control-plane-agent',assessedAt:new Date().toISOString(),basis:basis(run)};
  await save(task,doc);return readInner(task);
 }
 async function triggerInner(task,request){
  const view=await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),gate=run?.plan.graph.nodes.find(n=>n.id===request.gateId&&n.kind==='gate');
  if(!gate||!eligible(run,gate.id)||run.nodes[gate.id].state!=='pending'||!text(request.reason))throw Error('GATE_TRIGGER_INVALID');
  if(gate.entryConditions.length)validateSources(run,gate.id,request,view);
  run.nodes[gate.id].triggerAssessment={sourceIdentities:request.sourceIdentities??[],reason:request.reason,source:'control-plane-agent',assessedAt:new Date().toISOString()};run.nodes[gate.id].state='awaiting-decision';gates(run);await save(task,doc);return readInner(task);
 }
 async function confirmInner(task,request){
  const view=await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),gate=run?.plan.graph.nodes.find(n=>n.id===request.gateId&&n.kind==='gate'),node=run?.nodes[request.gateId];
  if(run?.selectedGateId!==request.gateId)throw Error('GATE_SUBJECT_CHANGED');
  if(!gate||node.state!=='awaiting-decision'||!eligible(run,gate.id))throw Error('GATE_NOT_AWAITING_DECISION');
  if(node.feedback)throw Error('GATE_FEEDBACK_UNRESOLVED');
  if(request.answer!=='确认此版本'||!request.answerId?.startsWith(`session:${task.sessionId}:question:`))throw Error('GATE_CONFIRMATION_INVALID');
  node.decision={question:gate.goal||gate.title,scope:gate.exitConditions,planDigest:request.planDigest,answer:request.answer,answerId:request.answerId,confirmedAt:new Date().toISOString(),sources:sources(run,gate.id)};node.state='completed';gates(run);await save(task,doc);return readInner(task);
 }
 async function respondInner(task,request){
  await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);
  const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),node=run?.nodes[request.gateId];
  if(run?.selectedGateId!==request.gateId)throw Error('GATE_SUBJECT_CHANGED');
  if(node?.state!=='awaiting-decision'||!text(request.answer)||!request.answerId?.startsWith(`session:${task.sessionId}:question:`))throw Error('GATE_RESPONSE_INVALID');
  node.feedback={answer:request.answer,answerId:request.answerId,planDigest:request.planDigest,recordedAt:new Date().toISOString()};
  await save(task,doc);return readInner(task);
 }
 async function reviseInner(task,request){
  await accepted(task,request.planDigest);const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),node=run?.nodes[request.gateId];
  if(!node?.feedback||!eligible(run,request.gateId)||!text(request.reason))throw Error('GATE_REVISION_INVALID');
  const available=new Set(sources(run,request.gateId).filter(s=>s.resultIdentity).map(s=>s.resultIdentity));
  if(!Array.isArray(request.resultIdentities)||!request.resultIdentities.length||request.resultIdentities.some(id=>!available.has(id)))throw Error('GATE_REVISION_SOURCE_INVALID');
  (node.feedbackHistory??=[]).push(node.feedback);delete node.feedback;
  node.revision={reason:request.reason,resultIdentities:request.resultIdentities,source:'control-plane-agent',revisedAt:new Date().toISOString()};node.state='awaiting-decision';await save(task,doc);return readInner(task);
 }
 async function selectInner(task,request){
  await accepted(task,request.planDigest);const doc=await load(task),run=doc.runs.findLast(r=>r.planDigest===request.planDigest);
  const gate=run?.plan.graph.nodes.find(n=>n.id===request.gateId&&n.kind==='gate');
  if(!gate||!['awaiting-decision','completed'].includes(run.nodes[gate.id].state))throw Error('GATE_UNAVAILABLE');
  if(run.selectedGateId!==gate.id){run.selectedGateId=gate.id;await save(task,doc);for(const listener of gateListeners.get(task.taskId)??[])listener();}
  return readInner(task);
 }
 async function artifactInner(task,request){
  const doc=await load(task);await refresh(task,doc);const run=doc.runs.findLast(r=>r.planDigest===request.planDigest),node=run?.nodes[request.waveId];
  if(!node?.deliveryId||node.result?.state!=='available'||node.result.reference.identity!==request.resultIdentity||!Object.hasOwn(node.result.result.artifacts,request.artifactId))throw Error('ARTIFACT_SOURCE_INVALID');
  const owner=runtime();if(!owner?.control.readArtifactContent)return {state:'unavailable',reason:'ARTIFACT_CONTENT_UNAVAILABLE'};
  return owner.control.readArtifactContent({taskId:task.taskId,deliveryId:node.deliveryId,resultIdentity:request.resultIdentity,artifactId:request.artifactId});
 }
 return {checkEntry:(task,request)=>serial(task,()=>checkInner(task,request,true)),assessNode:(task,request)=>serial(task,()=>checkInner(task,request,false)),recoverWave:(task,request,agent)=>serial(task,()=>recoverInner(task,request,agent)),reviseGate:(task,request)=>serial(task,()=>reviseInner(task,request)),readArtifact:(task,request)=>serial(task,()=>artifactInner(task,request)),respondGate:(task,request)=>serial(task,()=>respondInner(task,request)),subscribeGate(task,listener){const listeners=gateListeners.get(task.taskId)??new Set();gateListeners.set(task.taskId,listeners);listeners.add(listener);return()=>{listeners.delete(listener);if(!listeners.size)gateListeners.delete(task.taskId);};},selectGate:(task,request)=>serial(task,()=>selectInner(task,request)),assessDelivery:(task,request)=>serial(task,()=>deliveryInner(task,request)),triggerGate:(task,request)=>serial(task,()=>triggerInner(task,request)),read:task=>serial(task,()=>readInner(task)),start:(task,request,agent)=>serial(task,()=>startInner(task,request,agent)),assessWave:(task,request)=>serial(task,()=>assessInner(task,request)),confirmGate:(task,request)=>serial(task,()=>confirmInner(task,request))};
}
