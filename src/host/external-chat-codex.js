import {validateGrillingBatch,validateGrillingQuestion} from './grilling-policy.js';
import {taskInstructions} from './task-flow.js';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline';
import {conversationPrompt,eventQueue} from './external-chat.js';

/** Dedicated app-server transport; never connects to a desktop chat or existing thread. */
export function createCodexRpc({spawnProcess=spawn,executable=createRequire(import.meta.url).resolve('@openai/codex/bin/codex.js')}={}){
 const process=spawnProcess(globalThis.process.execPath,[executable,'app-server','--listen','stdio://'],{stdio:['pipe','pipe','pipe']});
 const pending=new Map(),listeners=new Set();let id=0,closed=false;let requestHandler;
 const fail=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();for(const fn of listeners)fn({method:'transport/closed',error});};
 process.stderr.on('data',()=>{}); // Native diagnostics must not disclose credentials in the browser.
 process.on('error',e=>fail(e));process.on('exit',()=>{closed=true;fail(Error('CODEX_AGENT_DISCONNECTED'));});
 const send=value=>process.stdin.write(JSON.stringify(value)+'\n');
 const reader=createInterface({input:process.stdout});
 reader.on('line',line=>{
  let m;try{m=JSON.parse(line)}catch{return;}
  if(m.method&&m.id!==undefined){Promise.resolve().then(()=>requestHandler?.(m)).then(result=>send({id:m.id,result:result??{}}),error=>send({id:m.id,error:{code:-32000,message:error?.message?.startsWith('GRILLING_')?error.message:'Request declined or cancelled'}})).catch(()=>{});}
  else if(m.id!==undefined){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
  else for(const fn of listeners)fn(m);
 });
 return {async call(method,params={}){if(closed)throw Error('CODEX_AGENT_DISCONNECTED');const requestId=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error(`CODEX_REQUEST_TIMEOUT: ${method}`));},30000);pending.set(requestId,{resolve,reject,timer});send({id:requestId,method,params});});},notify:(method,params)=>send({method,params}),on(fn){listeners.add(fn);return()=>listeners.delete(fn)},requests(fn){requestHandler=fn},async init(){await this.call('initialize',{clientInfo:{name:'crystra-external-chat',version:'0.1.0'},capabilities:{experimentalApi:true}});this.notify('initialized');},async close(){if(closed)return;closed=true;reader.close();process.stdin.end();process.kill('SIGTERM');fail(Error('CODEX_AGENT_CLOSED'));}};
}

export function createCodexChatProvider({rpcFactory=createCodexRpc}={}){
 return {id:'crystra-codex',name:'Codex',async models(){const rpc=rpcFactory();try{await rpc.init();const auth=await rpc.call('account/read',{});if(auth.requiresOpenaiAuth&&!auth.account)throw Error('Codex 尚未登录，请先在 Codex 中登录');const models=[];let cursor;do{const result=await rpc.call('model/list',{...(cursor?{cursor}:{}),limit:100});models.push(...result.data.filter(m=>!m.hidden).map(m=>({id:m.model,name:m.displayName??m.model})));cursor=result.nextCursor;}while(cursor);return models;}finally{await rpc.close();}},
 async *run({model,cwd,messages,signal,ask,taskContext}){
  signal?.throwIfAborted();const rpc=rpcFactory(),queue=eventQueue();let threadId,turnId;const emitted=new Set(),reasoningEmitted=new Set();
  const off=rpc.on(m=>{
   if(m.method==='transport/closed'){queue.end(m.error);return;}
   const p=m.params??{};if(p.threadId!==threadId)return;
   if(m.method==='item/agentMessage/delta'){emitted.add(p.itemId);queue.push({type:'text',text:p.delta,messageId:p.itemId});}
   if(m.method==='item/reasoning/summaryTextDelta'){reasoningEmitted.add(p.itemId);queue.push({type:'reasoning',text:p.delta,messageId:`${p.itemId}:${p.summaryIndex}`});}
   if(m.method==='item/started'&&['commandExecution','fileChange','mcpToolCall','webSearch'].includes(p.item?.type))queue.push({type:'tool-start',id:p.item.id,name:`Codex ${p.item.type}`,arguments:p.item});
   if(m.method==='item/completed'){
    const item=p.item;
    if(item?.type==='reasoning'&&!reasoningEmitted.has(item.id)){const text=(item.summary??[]).join('\n\n');if(text)queue.push({type:'reasoning',text,messageId:item.id});}
    if(item?.type==='plan'&&item.text)queue.push({type:'text',text:item.text,messageId:item.id});
    if(item?.type==='agentMessage'&&!emitted.has(item.id))queue.push({type:'text',text:item.text,messageId:item.id});
    if(['commandExecution','fileChange','mcpToolCall','webSearch'].includes(item?.type))queue.push({type:'tool-end',id:item.id,text:JSON.stringify(item),isError:item.status==='failed'||(typeof item.exitCode==='number'&&item.exitCode!==0)});
   }
   if(m.method==='turn/completed')queue.end(p.turn?.status==='completed'?undefined:Error(p.turn?.error?.message??`Codex turn ${p.turn?.status}`));
   if(m.method==='error'&&!p.willRetry)queue.end(Error(p.error?.message??'CODEX_TURN_FAILED'));
  });
  rpc.requests(async({method,params})=>{
   if(params.threadId!==threadId)throw Error('CODEX_REQUEST_WRONG_THREAD');
   if(method==='item/commandExecution/requestApproval'||method==='item/fileChange/requestApproval'){
    if(taskContext)return {decision:'decline'};
    const answer=await ask({question:'允许 Codex 执行此操作？',detail:JSON.stringify(params,null,2),choices:['允许这次','拒绝']});return {decision:answer==='允许这次'?'accept':'decline'};
   }
   if(method==='item/tool/requestUserInput'){if(taskContext?.stage==='requirements'){validateGrillingBatch(params.questions);for(const q of params.questions)validateGrillingQuestion({question:q.question,choices:q.options?.map(o=>o.label)});}const answers={};for(const q of params.questions){const answer=await ask({question:q.question,choices:q.options?.map(o=>o.label)});answers[q.id]={answers:[answer]};}return {answers};}
   throw Error('Unsupported Codex request');
  });
  const cancel=()=>{if(threadId&&turnId)void rpc.call('turn/interrupt',{threadId,turnId}).catch(()=>{});queue.end(signal.reason??Error('CANCELLED'));};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   await rpc.init();signal?.throwIfAborted();
   const started=await rpc.call('thread/start',{model,cwd:taskContext?.artifactRoot??cwd,ephemeral:true,sandbox:'workspace-write',approvalPolicy:taskContext?'never':'on-request',developerInstructions:taskContext?taskInstructions(taskContext):'This session belongs only to Crystra external chat. Do not search or import other agent conversation histories.',config:{'features.memory_tool':false,...(taskContext?{web_search:'live'}:{})}});
   threadId=started.thread.id;signal?.throwIfAborted();
   const response=await rpc.call('turn/start',{threadId,model,cwd:taskContext?.artifactRoot??cwd,...(taskContext?{sandboxPolicy:{type:'workspaceWrite',writableRoots:[taskContext.artifactRoot],networkAccess:false,excludeTmpdirEnvVar:true,excludeSlashTmp:true}}:{}),input:[{type:'text',text:conversationPrompt(messages),text_elements:[]}]});turnId=response.turn.id;
   yield*queue;
  }finally{signal?.removeEventListener('abort',cancel);off();await rpc.close();}
 }};
}
