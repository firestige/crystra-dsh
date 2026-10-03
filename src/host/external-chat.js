import {registerExternalChatPresenters,nativeToolCall,nativeToolResult} from './external-chat-presentation.js';
import {advanceTaskControl,taskContextFor} from './task-chat-control.js';
import {randomUUID} from 'node:crypto';
import {validateGrillingQuestion} from './grilling-policy.js';

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
   const contextFor=()=>taskContextFor(control,task,session);
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
   const transition=await advanceTaskControl({control,task,taskContext,agent,ask,answerId:()=>`session:${session.id}:question:${lastQuestionId}`,signal:options.signal});
   advance=transition.advance;
   for(const message of transition.messages)yield* content('text',message);
   if(advance)taskContext=await contextFor();
   if(!advance)break;
   if(pass===3)agent?.followup?.({id:randomUUID(),role:'user',source:{kind:'plugin',plugin:'crystra'},content:[{type:'text',text:'管控流程已产生新的已持久化状态。请读取当前 Task 状态后继续检查下一步；本通知不代表用户批准，不改变选中的审核问题。'}]});
   }
   yield* closeBlock();
   yield {type:'finish',reason:{type:'stop'}};
   }finally{releaseUpdate?.();active=undefined;}
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
