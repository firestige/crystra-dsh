import {realpath,stat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {nativeConfig} from './native-config.js';
import {inspectComponents} from './install/components.js';
export function projectDiagnostic(config={},manifest){
 const project=config.project,refs=manifest?.references??project?.references??[];
 const state=!config.enabled?'disabled':!project?.root||!project?.scope?'invalid':refs.length?'managed':project.initializing?'initializing':'invalid';
 return {state,configured:!!project?.root,root:project?.root??null,scope:project?.scope??null,publicationCount:refs.length,publicationAuthority:manifest?'runtime-journal':'configuration-seed',action:state==='disabled'?'在 DSH 会话请求初始化 Crystra 项目。':state==='initializing'?'提交首份共识并通过 DSH 审批；此时尚未受管。':state==='managed'?'使用原生诊断工具核验当前共识效力和模型路由。':'修复项目配置后重启 DSH。',features:{barrier:state==='managed'?'configured':'inactive',reflection:config.reflection?.enabled?'configured':'disabled',crystallization:config.crystallization?.enabled?'configured':'disabled'}};
}
/** Only initial project identity is changed. DSH owns approval, CAS and persistence. */
export async function initializeProject(ctx,input,execution,check=inspectComponents){
 if(!input||Object.keys(input).some(k=>!['root','scope'].includes(k))||!isAbsolute(input.root??'')||typeof input.scope!=='string'||!input.scope.trim())throw Error('项目目录必须是绝对路径，并提供明确 scope');
 if(execution.agent?.session?.id?.startsWith('crystra-reflection-')||execution.agent?.session?.id?.startsWith('crystra-crystallization-eval-'))throw Error('Internal evaluator cannot initialize a project');
 const settings=ctx.settings,descriptor=settings?.describe({redactSecrets:true}).find(d=>d.ns==='crystra');
 if(!descriptor)throw Error('DSH settings 尚未就绪');
 const current=descriptor.value;
 if(current.enabled||current.project?.references?.length)throw Error('项目已配置，不能通过初始化覆盖；使用已有受管切换机制');
 const root=await realpath(input.root);if(!(await stat(root)).isDirectory())throw Error('项目目录必须是文件夹');const scope=input.scope.trim(),project={root,scope,references:[],initializing:true};
 const next={...current,enabled:true,project};nativeConfig(ctx,next);
 const components=await check(next);if(!components.ready)throw Error('部件未就绪：'+components.missing.join('；'));
 const outcome=await ctx.approval?.request({agent:execution.agent,toolName:'crystra_initialize_project',callId:execution.callId,signal:execution.signal,reason:`初始化 Crystra 项目\n\n项目目录：${root}\n\n适用范围：${scope}\n\n确认后进入首份共识准备阶段，尚不启用受管任务；不会发布共识，不改变模型、UI、网络或凭据。保存后需要重新启动 DSH。`});
 if(outcome!=='allowed-once'||execution.signal?.aborted)return {state:'rejected',published:false};
 await settings.update('crystra',{enabled:true,project},descriptor.revision);
 return {state:'restart-required',project:{root,scope},published:false,message:'项目已初始化。重启 DSH 后，在项目会话中整理首份共识并请求原生审批；不需要手填引用。'};
}
export async function inspectRoutes(ctx,config){
 const routes={};for(const key of ['reflection','crystallization']){const c=config[key];if(!c?.enabled){routes[key]={state:'disabled'};continue;}
 try{if(!c.provider||!c.model||!ctx.llm?.resolveModelInfo)throw Error('unavailable');await ctx.llm.resolveModelInfo(c.provider,c.model,AbortSignal.timeout(5000));routes[key]={state:'ready',provider:c.provider,model:c.model};}catch{routes[key]={state:'unavailable',provider:c.provider??null,model:c.model??null,message:'DSH 无法解析此模型路由，请检查原生模型配置及认证。'};}}
 return routes;
}
