import {isInternalAgent} from './internal-agents.js';
import {nativeConfig,Config,selectedProject} from './native-config.js';
import {initializeProject,projectDiagnostic,inspectRoutes} from './project-initialization.js';
import {inspectComponents} from './install/components.js';
import {apply as lifecycle} from './dsh-pi-ai-lifecycle.js';
/** Native DSH settings and lifecycle glue; no agent creation or scheduling. */
export function applyNative(ctx,entry,applyCore,{check=inspectComponents}={}){
 let settingsService=null;let runtime=null,activeConfig=null,source=()=>entry,stopped=false;
 const attached=new Map(),gates=new Map();
 const status={state:'awaiting-settings',restartRequired:false,error:null,components:null,action:'请运行 crystra doctor；未初始化时运行 crystra install。'};
 ctx.provide('crystraNative',{status:()=>({...status,managed:[...attached.keys()]})});
 const failure=new Set();
 ctx.tools?.register({name:'crystra_initialize_project',description:'Initialize the first Crystra project through native DSH user approval. Requires an absolute existing directory and a scope; never publishes consensus. Restart DSH afterwards.',parameters:{type:'object',properties:{root:{type:'string'},scope:{type:'string'}},required:['root','scope'],additionalProperties:false},output:{schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:(args,exec)=>initializeProject({settings:settingsService,approval:ctx.get?.('approval')??ctx.approval},args,exec,check)});
 ctx.tools?.register({name:'crystra_installation_status',description:'Check Crystra installation prerequisites and show how to complete setup. Does not install anything.',parameters:{type:'object',properties:{},additionalProperties:false},output:{schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async()=>{status.components=await check(source());let manifest,consensus={state:'inactive'};if(runtime){try{const approvals=await ctx.crystraConsensusApproval.ready;manifest=approvals.manifest();if(manifest.references.length){for(const ref of manifest.references)await (await ctx.crystraConsensus.ready).resolve(ref);consensus={state:'effective'};}else consensus={state:'awaiting-first-approval'};}catch{consensus={state:'unavailable',message:'共识服务、凭据或精确绑定无法核验。'};}}const project=projectDiagnostic(source(),manifest),routes=await inspectRoutes({llm:ctx.get?.('llm')??ctx.llm},source());const managed=[];for(const[id,a]of attached){try{if(!(await a.ready).snapshot().initializing)managed.push(id);}catch{}}return {...status,nativeState:status.state,state:status.state==='invalid'?'invalid':project.state,project,consensus,routes,attached:[...attached.keys()],managed,ready:!status.restartRequired&&status.components.ready&&project.state==='managed'&&consensus.state==='effective'&&!Object.values(routes).some(r=>r.state==='unavailable')};}});
 function watch(agent){
  if(stopped||gates.has(agent.session.id)||isInternalAgent(agent))return;
  if(status.state==='disabled')return;
  if(runtime&&!selectedProject(agent,runtime.projectRoot))return;
  // Installed synchronously at creation. Prompt assembly waits for readiness;
  // the core's own hook/sections are registered now, before the first request.
  if(runtime){const a=ctx.crystraBackend.attach(agent.ctx,agent,runtime.manifest);attached.set(agent.session.id,a);}
  else failure.add(agent.session.id);
  const off=agent.ctx.on('system-prompt/assemble',async(_assembly,_context,next)=>{
   if(failure.has(agent.session.id))throw Error(`Crystra unavailable: ${status.error??'configuration not ready'}。${status.action}`);
   status.components=await check(source());
   if(!status.components.ready)throw Error(`Crystra 部件尚未就绪：${status.components.missing.join('；')}。${status.action}`);
   return next();
  });gates.set(agent.session.id,off);
 }
 function initialize(){
  if(activeConfig!==null){status.restartRequired=JSON.stringify(source())!==activeConfig;return;}
  activeConfig=JSON.stringify(source());
  // Temporary startup guards must not survive the first settings resolution.
  for(const off of gates.values())off();gates.clear();failure.clear();
  try{runtime=nativeConfig(ctx,source());if(!runtime){status.state='disabled';status.components={ready:false,missing:source()?.squidex?.baseUrl?[]:['尚未配置共识库'],warnings:['Crystra 已安装但未启用'],action:status.action};ctx.logger.warn(`Crystra 已安装但未启用。${status.action}`);return;}
   applyCore(ctx,runtime.core);lifecycle(ctx);status.state='enabled';
  }catch(error){status.state='invalid';status.error=String(error.message);runtime=null;ctx.logger.warn('Crystra configuration invalid; selected work cannot start: '+status.error+'。'+status.action);}
  for(const agent of ctx.agents.list())watch(agent);
 }
 ctx.inject(['settings'],settingsCtx=>{
  settingsService=settingsCtx.settings;settingsCtx.settings.installSection(ctx,'crystra',Config,entry,{setSource:current=>{source=current;},onChange:initialize});
 });
 ctx.on('agent/created',({agent})=>watch(agent));
 ctx.on('agent/disposed',({agent})=>{
  gates.get(agent.session.id)?.();gates.delete(agent.session.id);failure.delete(agent.session.id);
  const a=attached.get(agent.session.id);attached.delete(agent.session.id);
  if(a)a.close().catch(error=>ctx.logger.warn('Crystra close failed: '+error.message));
 });
 ctx.effect(()=>async()=>{stopped=true;for(const off of gates.values())off();gates.clear();for(const a of attached.values())await a.close();attached.clear();});
}
