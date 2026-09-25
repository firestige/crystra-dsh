import {validateGrillingQuestion} from './grilling-policy.js';
import {taskInstructions} from './task-flow.js';
import {lstat,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {conversationPrompt,eventQueue} from './external-chat.js';

async function clientFactory(){
 const require=createRequire(import.meta.url),wrapper=dirname(require.resolve('@github/copilot/npm-loader.js'));
 const platform=dirname(createRequire(join(wrapper,'package.json')).resolve(`@github/copilot-${process.platform}-${process.arch}`));
 const {CopilotClient}=await import(pathToFileURL(join(platform,'copilot-sdk/index.js')).href);
 // Provider-owned login is reused; no DSH credentials, Sessions or Role bindings.
 return new CopilotClient({mode:'copilot-cli',useLoggedInUser:true,logLevel:'error'});
}
async function close(client){try{if((await client.stop()).length)await client.forceStop();}catch{await client.forceStop().catch(()=>{});}}
export function createCopilotChatProvider({createClient=clientFactory}={}){
 return {id:'crystra-copilot',name:'Copilot',async models(){const c=await createClient();try{await c.start();if(!(await c.getAuthStatus()).isAuthenticated)throw Error('Copilot 尚未登录，请先在 Copilot 中登录');return (await c.listModels()).map(m=>({id:m.id,name:m.name??m.id}));}finally{await close(c);}},
 async *run({model,cwd,messages,signal,ask,taskContext}){
  signal?.throwIfAborted();const client=await createClient(),queue=eventQueue(),seen=new Set(),reasoningSeen=new Set();let session;
  const cancel=()=>{void session?.abort().catch(()=>{});queue.end(signal.reason??Error('CANCELLED'));};signal?.addEventListener('abort',cancel,{once:true});
  const id=`crystra-chat-${randomUUID()}`;
  try{
   await client.start();signal?.throwIfAborted();
   session=await client.createSession({sessionId:id,clientName:'crystra',model,workingDirectory:taskContext?.artifactRoot??cwd,streaming:true,
    ...(taskContext?{availableTools:['view','create','edit','glob','grep','web_search','web_fetch'],hooks:{onPreToolUse:async({toolName,toolArgs})=>{if(['view','glob','grep','web_search','web_fetch'].includes(toolName))return {};if(typeof toolArgs==='string'){try{toolArgs=JSON.parse(toolArgs);}catch{return {permissionDecision:'deny'};}}return {permissionDecision:await artifactWriteAllowed(taskContext.artifactRoot,toolArgs?.path)?'allow':'deny',permissionDecisionReason:'当前阶段只允许写本 Task 的管控产物'};}}}:{}),
    systemMessage:{mode:'append',content:taskContext?taskInstructions(taskContext):'This is an external Crystra conversation, not a Workflow Role. Do not read other agent session histories.'},
    enableConfigDiscovery:false,enableSessionStore:false,remoteSession:'off',memory:{enabled:false},
    onPermissionRequest:async request=>{if(taskContext){if(request.managedApprovalRequired)return {kind:'reject'};return {kind:request.kind==='read'||request.kind==='url'||(request.kind==='write'&&await artifactWriteAllowed(taskContext.artifactRoot,request.fileName))?'approve-once':'reject'};}return {kind:(await ask({question:'允许 Copilot 执行此操作？',detail:JSON.stringify(request,null,2),choices:['允许这次','拒绝']}))==='允许这次'?'approve-once':'reject'};},
    onUserInputRequest:async request=>{if(taskContext?.stage==='requirements')validateGrillingQuestion(request);return {answer:await ask(request),wasFreeform:true};},
    onEvent:e=>{
     if(e.type==='assistant.reasoning_delta'){reasoningSeen.add(e.data.reasoningId);queue.push({type:'reasoning',text:e.data.deltaContent,messageId:e.data.reasoningId});}
     if(e.type==='assistant.reasoning'&&!reasoningSeen.has(e.data.reasoningId))queue.push({type:'reasoning',text:e.data.content,messageId:e.data.reasoningId});
     if(e.type==='assistant.message_delta'){seen.add(e.data.messageId);queue.push({type:'text',text:e.data.deltaContent,messageId:e.data.messageId});}
     if(e.type==='assistant.message'&&!seen.has(e.data.messageId))queue.push({type:'text',text:e.data.content,messageId:e.data.messageId});
     if(e.type==='tool.execution_start')queue.push({type:'tool-start',id:e.data.toolCallId,name:'Crystra provider tool',arguments:{toolName:e.data.toolName,arguments:e.data.arguments}});
     if(e.type==='tool.execution_complete')queue.push({type:'tool-end',id:e.data.toolCallId,text:JSON.stringify(e.data.result??e.data.error??{}),isError:e.data.success===false});
     if(e.type==='session.error')queue.end(Error(e.data.message??'COPILOT_TURN_FAILED'));
    }});
   signal?.throwIfAborted();
   const sending=session.sendAndWait({prompt:conversationPrompt(messages)},7_200_000).then(()=>queue.end(),e=>queue.end(e));
   yield*queue;await sending;
  }finally{signal?.removeEventListener('abort',cancel);await session?.disconnect().catch(()=>{});if(session)await client.deleteSession(id).catch(()=>{});await close(client);}
 }};
}

async function artifactWriteAllowed(root,path){
 if(typeof path!=='string'||!['brief.json','plan.json'].some(name=>resolve(root,path)===join(root,name)))return false;
 try{if(await realpath(root)!==root)return false;const s=await lstat(resolve(root,path));return s.isFile()&&!s.isSymbolicLink();}catch(e){return e.code==='ENOENT';}
}
