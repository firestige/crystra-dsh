import {randomUUID} from 'node:crypto';
import {writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {taskInstructions} from './task-flow.js';
import {advanceTaskControl,taskContextFor} from './task-chat-control.js';
import {validateGrillingBatch,validateGrillingQuestion} from './grilling-policy.js';

const documents=new Set(['brief.json','plan.json','control.json']);
const readTools=new Set(['read','read_image','glob','grep','web_search','web_fetch']);
const writeTool='crystra_write_task_document',readTool='crystra_read_task_context';
const documentInstructions='原生 DSH 管控文件请用 crystra_write_task_document 写入，file 仅可为 brief.json、plan.json、control.json。此工具只保存草稿/请求，不能写入人工确认或正式执行结果。其他文件工具只用于阅读；不得使用 shell 或子 Agent 绕过管控。';

/** Public rc.2 assembly, guard and turn-stopping seams; never wrap the model adapter. */
export function registerNativeTaskControl(ctx) {
 const states=new WeakMap(),feedback=new WeakMap();
 const disposers=[];
 disposers.push(ctx.on('system-prompt/assemble',async(_assembly,context,next)=>{
  const assembly=await next(),agent=context.agent;
  if(!agent)return assembly;
  states.delete(agent);
  if(!ctx.agents.roots().includes(agent)||['crystra-codex','crystra-copilot'].includes(assembly.variables?.provider))return assembly;
  const control=await ctx.crystraTaskControl.forSession(agent.session.id);
  if(!control)return assembly;
  const task=await control.tasks.admit(agent.session.id);
  const taskContext=await taskContextFor(control,task,agent.session);
  context.signal?.throwIfAborted();
  states.set(agent,{control,task,taskContext});
  const instructions=(taskContext?taskInstructions(taskContext):'当前是已登记的 Crystra Task 对话。首条消息尚在进入 DSH 持久历史；开始工作前必须调用 crystra_read_task_context 获取实际 Task 和管控规则。不得直接实施产品代码或假设 Task 身份。')+'\n'+documentInstructions;
  return {...assembly,variables:{...assembly.variables,crystra_task_context:instructions},contexts:[...assembly.contexts,{name:'crystra:task',text:'{{crystra_task_context}}'}]};
 }));
 disposers.push(ctx.tools.guard(exec=>{
  const state=exec.agent&&states.get(exec.agent);
  if(!state)return [writeTool,readTool].includes(exec.name)?'CRYSTRA_TASK_UNAVAILABLE':undefined;
  if(readTools.has(exec.name)||[writeTool,readTool].includes(exec.name))return;
  if(exec.name==='ask_user_question'){
   try{
    if((!state.taskContext||state.taskContext.stage==='requirements')){
     validateGrillingBatch(exec.arguments.questions);
     const q=exec.arguments.questions[0];validateGrillingQuestion({question:q.question,choices:q.options?.map(o=>o.label)});
    }
    return;
   }catch(error){return error.message;}
  }
  // Deny run_code as well: a Task has a deliberately small native tool surface.
  return 'CRYSTRA_TASK_CONTROL_ONLY: 使用管控文件提交需求、计划或请求；产品实施必须由 Execution Workflow 执行。';
 }));
 async function refresh(agent){
  const state=agent&&states.get(agent);if(!state)throw Error('CRYSTRA_TASK_UNAVAILABLE');
  const task=await state.control.tasks.admit(agent.session.id);if(!task)throw Error('CRYSTRA_TASK_UNAVAILABLE');
  if(state.task&&task.taskId!==state.task.taskId)throw Error('CRYSTRA_TASK_UNAVAILABLE');
  state.task=task;state.taskContext=await taskContextFor(state.control,task,agent.session);return state;
 }
 disposers.push(ctx.tools.register(defineTool({
  name:readTool,description:'Read current Crystra Task instructions, approved versions, installed Execution capabilities and control receipts. Call before writing the first document.',
  parameters:{},output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
  async execute(_args,exec){exec.signal?.throwIfAborted();const state=await refresh(exec.agent);return taskInstructions(state.taskContext)+'\n'+documentInstructions;}
 })));
 disposers.push(ctx.tools.register(defineTool({
  name:writeTool,description:'Save the current Crystra Task brief.json, plan.json or control.json. Never grants approval or starts execution by itself.',
  parameters:{file:{type:'string',required:true},content:{type:'string',required:true,description:'Complete strict JSON document'}},
  output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
  async execute({file,content},exec){
   const state=await refresh(exec.agent);
   if(!documents.has(file))throw Error('CRYSTRA_TASK_DOCUMENT_INVALID');
   JSON.parse(content);exec.signal?.throwIfAborted();
   // Revalidate selected topic before any write; the UI can change it during a turn.
   const task=await state.control.tasks.admit(exec.agent.session.id);
   if(task?.taskId!==state.task.taskId)throw Error('CRYSTRA_TASK_UNAVAILABLE');
   const release=await state.control.beginUpdate?.(task);
   const temporary=join(state.taskContext.artifactRoot,`.native-${randomUUID()}.tmp`);
   try{
    await writeFile(temporary,content,{flag:'wx',mode:0o600,signal:exec.signal});exec.signal?.throwIfAborted();
    // Rename replaces a target symlink instead of following it into product files.
    await rename(temporary,join(state.taskContext.artifactRoot,file));
   }finally{await rm(temporary,{force:true});release?.();}
   return `${file} 已保存，等待管控校验；不代表人工确认或执行成功。`;
  }
 })));
 disposers.push(ctx.on('agent/turn-stopping',async({agent,signal})=>{
  if(!states.has(agent))return;
  const pending=!states.get(agent).task;
  const state=await refresh(agent);
  let questionId;
  const ask=async({question,choices,detail,signal:questionSignal=signal})=>{
   questionSignal?.throwIfAborted();const id=randomUUID();
   const result=await ctx.userQuestions.ask({agent,signal:questionSignal,questions:[{id,question,detail,options:choices.map(label=>({label}))}]});
   questionSignal?.throwIfAborted();await state.control.tasks.admit(agent.session.id);questionId=id;
   const answer=result.answers.find(a=>a.id===id);return answer?.custom??answer?.selected?.join(', ')??'';
  };
  const transition=await advanceTaskControl({...state,agent,ask,answerId:()=>`session:${agent.session.id}:question:${questionId}`,signal});
  signal?.throwIfAborted();
  const diagnostic=transition.messages.join('\n');
  const freshDiagnostic=diagnostic&&feedback.get(agent)!==diagnostic;
  feedback.set(agent,diagnostic);
  if(pending||transition.advance||freshDiagnostic)agent.inject({id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'crystra'},content:[{type:'text',text:transition.messages.join('\n')+'\n管控状态已更新。请读取当前状态继续；本通知不代表新的人工批准。'}]});
 }));
 return ()=>{for(const dispose of disposers.reverse())dispose();};
}
