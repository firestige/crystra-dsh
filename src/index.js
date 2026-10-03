import {registerTaskQueryGateway} from '../modules/execution/src/host/task-query.js';
import {withTaskListMetadata} from './host/task-list-metadata.js';
import {createWorkflowSessions} from "./host/workflow-sessions.js";
import {createTaskControl} from './host/task-control.js';
import {registerNativeTaskControl} from './host/native-task-control.js';
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import {createExternalChatAdapter} from './host/external-chat.js';
import {createCodexChatProvider} from './host/external-chat-codex.js';
import {createCopilotChatProvider} from './host/external-chat-copilot.js';
import {createTaskAdmission} from './host/task-admission.js';
import * as conversationSettings from "@deepseek-ai/dsh-client-ui-conversation";
import { registerCrystraRpc } from "./host/rpc-routes.js";
import path from "node:path";
import {registerWorkflowQueryGateway} from "../modules/studio/src/workflows/gateway.js";
import {randomUUID} from 'node:crypto';
import * as execution from '../modules/execution/src/index.js';
import * as studio from '../modules/studio/src/index.js';
import {normalizePluginConfiguration} from '../modules/initialization/src/configuration.js';
import {initializeHost} from '../modules/initialization/src/host.js';
import {createCommandRouter} from '../modules/initialization/src/command-router.js';

export function createHostPlugin({executionModule=execution,studioModule=studio,initialize=initializeHost}={}) {
 return {
  name:'crystra',inject:[...new Set(['commands',...executionModule.inject,...studioModule.inject])],
  async apply(ctx,input={}) {
   conversationSettings.apply(ctx);
   const configuration=normalizePluginConfiguration(input);
   registerWorkflowQueryGateway(ctx,path.join(configuration.paths.stateRoot,"workflow-directories.json"));
   ctx.inject(['sessionController','workspaceRegistry','agents','sessions'],inner=>{
    const workflowSessions=createWorkflowSessions({stateRoot:configuration.paths.stateRoot,isRunning:id=>inner.agents.roots().some(a=>a.session.id===id&&a.status==='running'),firstMessage:id=>inner.sessions.get(id)?.ownEvents().find(e=>e.type==='user/message'&&e.data?.source?.kind==='user')?.data.content?.filter(p=>p.type==='text').map(p=>p.text).join('\n'),bindingFile:path.join(configuration.paths.stateRoot,'workflow-directories.json'),create:async request=>{const workspace=await inner.workspaceRegistry.create(request.cwd);return inner.sessionController.create({sessionId:request.sessionId,workspaceId:workspace.id});}});
    registerCrystraRpc(inner,'/crystra-workflow-sessions',async(endpoint,payload)=>{try{return {ok:true,value:await (endpoint==='ensure'?workflowSessions.ensure(payload):workflowSessions.topics(endpoint.replace('topics/',''),payload))};}catch(error){return {ok:false,error:{code:'WORKFLOW_SESSION_UNAVAILABLE',message:error.message}};}});
   });
   let host,readGateway,unregister,executionRuntime,taskControl;
   ctx.inject(['sessions','workspaceRegistry','sessionPersistence','sessionController','agents'], async inner=>{
    const admission=await createTaskAdmission({ctx:inner,stateRoot:configuration.paths.stateRoot,owner:()=>executionRuntime?.control});
    const control=createTaskControl({ctx:inner,stateRoot:path.join(configuration.paths.stateRoot,"conversations"),admission,runtime:()=>executionRuntime});
    taskControl=control;
    inner.provide('crystraTaskControl',control);
    registerCrystraRpc(inner,'/crystra-control',control.handle);
    inner.inject(['systemPrompt','agents','userQuestions','tools','crystraTaskControl'],registerNativeTaskControl);
    inner.inject(['llm','agents','userQuestions','tools','crystraTaskControl'],providerCtx=>{
     const providers=[createCodexChatProvider(),createCopilotChatProvider()];
     providerCtx.llm.registerAdapter(providers.map(p=>p.id),createExternalChatAdapter({Base:LlmAdapter,ctx:providerCtx,providers}));
    });
   });
   const unregisterGateway=registerCrystraRpc(ctx, '/crystra-execution',(endpoint,payload)=>readGateway?readGateway.handle(endpoint,payload):({ok:false,error:{code:'DELIVERY_PROJECTION_UNAVAILABLE',message:'Crystra needs configuration. Run /crystra setup.'}}),{authority:'loopback'});
   const unhook=ctx.on?.('agent/pre-step',(payload,next)=>execution.consumeCrystraCommandBeforeModel(payload)?{kind:'reject'}:next());
   ctx.effect(async function*(){yield async()=>{await unregister?.();await unregisterGateway?.();await unhook?.();await host?.dispose();};},'Crystra initialization lifecycle');
   const router=createCommandRouter({operate:async(action,signal,invocation)=>{
     const workspace=invocation.agent?await execution.resolveConversationWorkspace(ctx,invocation.agent):undefined;
     return host.operate(action,signal,workspace?.path);
    },
    beforeAdmin:invocation=>invocation.agent?execution.recordCrystraCommandInput(invocation.agent,invocation.rawInput,invocation.attachments??[]):undefined,
    presentResult:(invocation,result)=>{
     if(!invocation.agent)return;
     const commandId=`crystra-initialization-${randomUUID()}`;
     invocation.agent.session.append('command/run',{commandId,name:'crystra-initialization',source:{kind:'plugin',plugin:'crystra'}});
     invocation.agent.session.append('command/done',{commandId,...result});
    },
   });
   const activateExecution=(profile)=>new Promise((resolve,reject)=>{
    ctx.plugin({name:executionModule.name,inject:executionModule.inject,async apply(inner,config){
     try{await executionModule.apply(inner,config,{registerCommand:router.bindExecution,registerTaskGateway:query=>registerTaskQueryGateway(inner,withTaskListMetadata(query,()=>taskControl)),registerRuntime:runtime=>{executionRuntime=runtime;},registerGateway:async(readModel)=>{
      const gateway=await execution.createDeliveryControlPlaneGateway(readModel);readGateway=gateway;
      inner.effect(async function*(){yield async()=>{if(readGateway===gateway)readGateway=undefined;await gateway.close();};},'Crystra Execution read model');
     }});resolve();}
     catch(error){reject(error);}
    }},profile);
   });
   host=await initialize(configuration,{activateExecution});
   unregister=ctx.commands.register({name:'crystra',description:'Configure Crystra services or operate a Workflow Delivery',recordInput:true,
    input:{hint:'setup | doctor | services start|stop|status | list | create <selector> | recover | status | action finish | abandon',images:true},handler:router.handler});
   ctx.plugin(studioModule,configuration.studio??{evidenceBaseUrl:`http://127.0.0.1:${configuration.services.ports.evidence}`,evolutionBaseUrl:`http://127.0.0.1:${configuration.services.ports.evolution}`});
  },
 };
}
const plugin=createHostPlugin();
export const name=plugin.name;
export const inject=plugin.inject;
export const apply=plugin.apply;
