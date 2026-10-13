import {clientToken} from './squidex-auth.js';
import z from '@deepseek-ai/schemastery';
import {realpathSync} from 'node:fs';
import {isAbsolute,relative,join} from 'node:path';
import {resolveDshHome} from '@deepseek-ai/dsh-home-paths';
import {publicationReference,digest} from './value.js';
import {SquidexClient} from './squidex-client.js';
const text=z.string();
const model={enabled:z.boolean().default(false),provider:text,model:text,reasoningEffort:text,timeoutMs:z.number()};
export const Config=z.object({
 enabled:z.boolean().default(false),
 project:z.object({root:text,scope:text,initializing:z.boolean().default(false),references:z.array(z.object({id:text,published_version:z.number(),publication_event_id:text,actor:text,data_hash:text}))}),
 squidex:z.object({baseUrl:text,app:text,schema:text,managementTokenRef:text,consumerTokenRef:text,managementClientId:text,managementSecretRef:text,consumerClientId:text,consumerSecretRef:text,timeoutMs:z.number()}),
 reflection:z.object({...model,files:z.array(text),experiments:z.array(z.object({id:text,command:text,args:z.array(text),timeoutMs:z.number()}))}),
 crystallization:z.object({...model,python:text,executionTimeoutMs:z.number()}),
});
export function selectedProject(agent,root){
 if(agent.session.id.startsWith('crystra-reflection-')||agent.session.id.startsWith('crystra-crystallization-eval-'))return false;
 const cwd=agent.session.header.cwd;if(typeof cwd!=='string')return false;
 let path;try{path=realpathSync(cwd);}catch{return false;}
 const rel=relative(root,path);return rel===''||(!rel.startsWith('..'+ '/')&&rel!=='..'&&!isAbsolute(rel));
}
function options(value){
 if(!value.provider?.trim()||!value.model?.trim())throw Error('Explicit evaluation provider/model required');
 return {provider:value.provider,model:value.model,...value.reasoningEffort?{reasoningEffort:value.reasoningEffort}:{}};
}
/** Translate only serializable user settings into trusted host ports. */
export function nativeConfig(ctx,input){
 const config=Config(input);if(!config.enabled)return null;
 const project=config.project;
 if(!project||!isAbsolute(project.root??'')||!project.scope?.trim()||(!project.references?.length&&!project.initializing))throw Error('Enabled Crystra requires an absolute project root, scope and consensus publications');
 const projectRoot=realpathSync(project.root),references=(project.references??[]).map(publicationReference);
 const cms=config.squidex;if(!cms||!['management','consumer'].every(role=>cms[role+'TokenRef']||cms[role+'ClientId']&&cms[role+'SecretRef']))throw Error('Squidex host credential references required');
 const credential=ref=>async()=>{const credentials=typeof ctx.get==='function'?ctx.get('credentials'):ctx.credentials;const hit=await credentials?.resolve(ref);if(typeof hit?.value!=='string'||!hit.value)throw Error('Squidex host credential unavailable');return hit.value;};
 const token=role=>cms[role+'TokenRef']?credential(cms[role+'TokenRef']):clientToken({baseUrl:cms.baseUrl,clientId:cms[role+'ClientId'],secret:credential(cms[role+'SecretRef']),timeoutMs:cms.timeoutMs});
 const squidex={...cms,managementToken:token('management'),consumerToken:token('consumer')};
 new SquidexClient(squidex); // Reject unsupported origins before any I/O.
 const namespace=`native-${digest({projectRoot,scope:project.scope}).slice(0,24)}`;
 const manifest={scope:project.scope,references};
 const core={initializing:project.initializing===true,consensus:{namespace,principals:{'agent:worker':'Proposer','host:dsh-user':'Publisher'},approval:{publisher:'host:dsh-user',manifest},squidex,identifyAgent:async()=> 'agent:worker'}};
 if(config.reflection?.enabled){
  const r=config.reflection;if(!r.files?.length)throw Error('Reflection requires explicit core files');
  for(const file of r.files)if(isAbsolute(file)||relative('.',file).startsWith('..'))throw Error('Reflection file must be inside project');
  for(const e of r.experiments??[])if(!e.id||!isAbsolute(e.command??'')||!Array.isArray(e.args))throw Error('Reflection check must have an absolute executable and argument list');
  core.reflection={agentOptions:options(r),timeoutMs:r.timeoutMs??300000,requestFor:async(_agent,goal)=>({root:projectRoot,goal,files:r.files,experiments:r.experiments??[]})};
 }
 if(config.crystallization?.enabled){
  const c=config.crystallization;if(!isAbsolute(c.python??''))throw Error('Absolute Python executable required');
  core.crystallization={namespace,agentOptions:options(c),cwd:projectRoot,timeoutMs:c.timeoutMs??300000,
   code:{root:join(resolveDshHome(),'crystra','code',namespace),python:c.python,timeoutMs:c.executionTimeoutMs??2000},
   auto:{select:exec=>selectedProject(exec.agent,projectRoot)?{scope:project.scope,boundary:exec.name,input:exec.arguments.input}:null},
   context:async()=>{const service=await ctx.crystraConsensus.ready;const current=ctx.crystraConsensusApproval? (await ctx.crystraConsensusApproval.ready).manifest().references:references;if(!current.length)throw Error('First consensus approval required before crystallization');for(const ref of current)await service.resolve(ref);return {projectRoot,references:current,configuration:digest(config)};},
  };
 }
 return {projectRoot,manifest,core,config};
}
