import {registerExternalChatPresenters,nativeToolCall,nativeToolResult} from './external-chat-presentation.js';
import {askSelectedGate} from './task-gate-question.js';
import {randomUUID} from 'node:crypto';
import {validateGrillingQuestion} from './grilling-policy.js';
import {roleBindingsTable} from './plan-confirmation.js';

/** DSH owns transport/history only; each provider owns its model and agent tools. */
export function createExternalChatAdapter({Base,ctx,providers}) {
 registerExternalChatPresenters(ctx);
 const routes=new Map(providers.map(p=>[p.id,p]));
 return new class extends Base {
  providerInfo(id){return {id,name:routes.get(id)?.name??id};}
  async listModels(provider){
   const p=routes.get(provider);if(!p)throw Error('EXTERNAL_CHAT_PROVIDER_UNKNOWN');
   return (await p.models()).map(m=>({...m,provider}));
  }
  async *stream(options){
   options.signal?.throwIfAborted();
   const provider=routes.get(options.provider),session=ctx.sessions.get(options.sessionId);
   const owners=ctx.workspaceRegistry.list().filter(w=>w.sessionIds.includes(options.sessionId));
   if(!provider||!session||owners.length!==1||owners[0].path!==session.header.cwd)throw Error('EXTERNAL_CHAT_BINDING_INVALID');
   if(!options.model)throw Error('EXTERNAL_CHAT_MODEL_REQUIRED');
   // Non-Chat consumers (e.g. automatic host title generation) cannot use this seam.
   const agent=ctx.agents?.roots().find(a=>a.session?.id===session.id);
   let lastQuestionId;
   const ask=async({question,choices,detail,signal=options.signal})=>{
    const id=randomUUID();
    const result=await ctx.userQuestions.ask({agent,signal,questions:[{id,question,...(detail?{detail}:{}),...(choices?.length?{options:choices.map(label=>({label}))}:{})}]});
    lastQuestionId=id;
    const answer=result.answers.find(a=>a.id===id);return answer?.custom??answer?.selected?.join(', ')??'';
   };
   const rootControl=ctx.crystraTaskControl;
   const control=rootControl?.forSession?await rootControl.forSession(session.id):rootControl;
   const task=control?await control.tasks.admit(session.id):undefined;
   const sourceMessages=session.ownEvents().filter(e=>e.type==='user/message'&&e.data?.source?.kind==='user').map(e=>({id:e.data.id,text:e.data.content?.filter(p=>p.type==='text').map(p=>p.text).join('\n')}))??[];
   const contextFor=async()=>task?{...await control.flow.prepare(task),sourceMessages,executionReady:!!control.execution?.(),run:await control.runs?.read(task),planningCapabilities:await control.execution?.()?.control?.planningCapabilities?.(),roleBindings:await control.execution?.()?.readRepositoryBindings?.(task.workspacePath),controlReceipts:(await control.requests?.receipts(task))?.slice(-5)}:undefined;
   let taskContext=await contextFor();
   let questionPending=false, releaseUpdate;
   const askProvider=async request=>{
    if(taskContext?.stage==='requirements')validateGrillingQuestion(request);
    if(questionPending)throw Error('GRILLING_ONE_QUESTION: 等待当前问题回答后再提问。');
    questionPending=true;
    releaseUpdate?.(); releaseUpdate=undefined;
    try{return await ask(request);}finally{questionPending=false; releaseUpdate=task?await control.beginUpdate?.(task):undefined;}
   };
   const callScope=randomUUID();
   const turn=agent?.phase?.turn??0,step=agent?.phase?.step??0;
   const calls=new Map();let index=-1,active;
   // Native assistant streams own Chat presentation and persistence in DSH 0.1.5.
   function* closeBlock(){if(active){yield {type:'block-end',index,block:{type:active.type,text:active.text}};active=undefined;}}
   function* content(type,text,messageId){if(active?.type!==type||(messageId!==undefined&&active?.messageId!==messageId)){yield* closeBlock();index++;active={type,messageId,text:''};yield {type:'block-start',index,blockType:type};}active.text+=text;yield {type:type==='reasoning'?'reasoning-delta':'text-delta',index,text};}
   try {
   for(let pass=0;pass<4;pass++){
   let advance=false;
   releaseUpdate=task?await control.beginUpdate?.(task):undefined;
   try {
   for await(const event of provider.run({model:options.model,cwd:owners[0].path,sessionId:session.id,messages:options.messages,signal:options.signal,ask:askProvider,taskContext})){
    options.signal?.throwIfAborted();
    if(event.type==='text'||event.type==='reasoning'){yield* content(event.type,event.text,event.messageId);}
    else if(event.type==='tool-start'){
     yield* closeBlock();
     const callId=`${options.provider}:${callScope}:${pass?`${pass}:`:""}${event.id}`;
     const display=nativeToolCall(event);
     const seq=session.append('tool/call',{turn:agent?.phase?.turn??0,step:agent?.phase?.step??0,callId,name:display.name,arguments:JSON.stringify(display.arguments??{})}).seq;
     calls.set(event.id,{seq,callId,...display});
    }else if(event.type==='tool-end'){
     const call=calls.get(event.id);if(!call)continue;
     const display=nativeToolResult(call,event);
     session.append('tool/result',{turn:agent?.phase?.turn??0,step:agent?.phase?.step??0,...(display.meta?{meta:display.meta}:{}),message:{id:randomUUID(),role:'user',source:{kind:'tool',callId:call.callId},content:[{type:'tool-result',toolCallId:call.callId,content:[{type:'text',text:display.text}],isError:event.isError===true}]}},{surfaceOp:'append',sourceEventSeqs:[call.seq]});
    }
   }
   } finally {releaseUpdate?.();releaseUpdate=undefined;}
   yield* closeBlock();
   if(task){
    const view=await control.flow.read(task),kind=view.stage==='requirements'?'brief':view.stage==='planning'?'plan':undefined,item=view[kind];
    if(item?.state==='invalid'){const message='\n\n管控文件校验未通过，请在下一轮修正：'+item.error;yield* content('text',message);}
    if(item?.state==='available'&&!item.confirmed&&!item.feedback&&item.value.requestConfirmation&&item.value.questions.length===0&&!item.value.grilling?.questions.some(q=>['pending','disputed'].includes(q.status))){
     const answer=await ask({question:kind==='brief'?'确认以下需求并进入计划？':'确认以下计划与绑定方案？',detail:[item.value.goal,'范围：'+item.value.scope.join('；'),'非目标：'+(item.value.nonGoals.join('；')||'无'),'建议：'+(item.value.assumptions.join('；')||'无'),'验收：'+item.value.acceptance.join('；'),...(kind==='plan'?['步骤：'+item.value.steps.join('；'),'绑定方案：'+item.value.bindings.join('；'),roleBindingsTable(item.value.roleBindings,taskContext.roleBindings)]:[])].join('\n\n'),choices:['确认此版本','需要修改']});
     if(answer==='确认此版本'){await control.flow.confirm(task,kind,item.digest,`session:${session.id}:question:${lastQuestionId}`);const message=kind==='brief'?'\n\n需求已确认，开始编写计划。':(control.execution?.()?'\n\n计划已确认，按该版本检查执行条件。':'\n\n计划已确认。Execution 启动入口尚未接通，当前未开始实施。');yield* content('text',message);if(kind==='brief'||control.execution?.()){advance=true;taskContext=await contextFor();}}
     else if(answer){await control.flow.respond(task,kind,item.digest,answer,`session:${session.id}:question:${lastQuestionId}`);advance=true;taskContext=await contextFor();}
    }
    if(control.requests&&(await control.flow.read(task)).stage==='ready'){
     const receipt=await control.requests.apply(task,agent);
     if(receipt.kind==='accepted'){const message='\n\n管控请求已记录：'+receipt.operation;yield* content('text',message);advance=receipt.operation!=='start-wave'||Object.values((await control.runs.read(task)).current?.nodes??{}).some(n=>n.state==='result-available');}
     if(receipt.kind==='rejected'){const message='\n\n管控请求未生效：'+receipt.error;yield* content('text',message);}
     const decision=await askSelectedGate({task,runs:control.runs,ask,signal:options.signal});
     if(decision?.answer==='确认此版本'){
      await control.runs.confirmGate(task,{...decision,answerId:`session:${session.id}:question:${lastQuestionId}`});
      const message='\n\n已记录当前 Gate 的决定，审核工作台保留本次回执。';yield* content('text',message);advance=true;
     }
     if(decision?.answer&&decision.answer!=='确认此版本'){await control.runs.respondGate(task,{...decision,answerId:`session:${session.id}:question:${lastQuestionId}`});advance=true;}
     taskContext=await contextFor();
    }
   }
   if(!advance)break;
   if(pass===3)agent?.followup?.({id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'crystra'},content:[{type:'text',text:'管控流程已产生新的已持久化状态。请读取当前 Task 状态后继续检查下一步；本通知不代表用户批准，不改变选中的审核问题。'}]});
   }
   yield* closeBlock();
   yield {type:'finish',reason:{type:'stop'}};
   }finally{if(active){publish('interrupted');active=undefined;}}
  }
 }();
}

export function conversationPrompt(messages){
 // Replay only this Crystra Session when starting a fresh native agent session.
 // Provider sessions never attach to an unrelated native chat or a Delivery.
 return 'This is an external Crystra conversation, not a Workflow Role or Delivery. Continue the conversation below. Use your own agent tools as needed within the selected workspace. Ask before operations requiring approval.\n'+JSON.stringify(messages);
}

export function eventQueue(){
 const values=[];let ended=false,failure,wake;
 return {push(v){if(!ended){values.push(v);wake?.();}},end(error){ended=true;failure=error;wake?.();},async *[Symbol.asyncIterator](){while(!ended||values.length){if(values.length){yield values.shift();continue;}await new Promise(r=>{wake=r;});wake=undefined;}if(failure)throw failure;}};
}
