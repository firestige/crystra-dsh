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
   const configuration=normalizePluginConfiguration(input);
   let host,readGateway,unregister;
   const unregisterGateway=ctx.connection?.rpc?.handle('/crystra-execution',(endpoint,payload)=>readGateway?readGateway.handle(endpoint,payload):({ok:false,error:{code:'DELIVERY_PROJECTION_UNAVAILABLE',message:'Crystra needs configuration. Run /crystra setup.'}}),{authority:'loopback'});
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
     try{await executionModule.apply(inner,config,{registerCommand:router.bindExecution,registerGateway:async(readModel)=>{
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
