import { Context } from '@deepseek-ai/cordis';
import { LlmAdapter,createUserMessage } from '@deepseek-ai/dsh-llm';
import * as backend from '../../src/backend/index.js';
process.once('message',async config=>{
 let ctx,worker,attachment;
 try{
  ctx=new Context();const load=async(name,options={})=>{const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,options);};
  for(const name of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(name);
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root:config.root,compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  const client=new backend.SquidexClient({baseUrl:config.baseUrl,app:config.app,schema:'agreements',managementToken:async()=>config.management,consumerToken:async()=>config.consumer});
  await ctx.plugin(backend,{consensus:{namespace:config.app,client,principals:{A1:'Proposer',U1:'Publisher'}}});
  await ctx.crystraConsensus.ready;
  let calls=0,captured;
  const action={id:'noop',kind:'tool-completed',tool:'fixture_noop',match:{tag:'checkpoint'}};
  class Adapter extends LlmAdapter{async *stream(options){
   calls++;captured=options.messages.find(message=>message.role==='system')?.content;
   if(config.mode==='seed'&&calls===2){await ctx.sessions.flush(worker.agent.session);process.send({kind:'checkpoint',captured,state:(await attachment.ready).snapshot()});await new Promise(()=>{});}
   const block=config.mode==='seed'?{type:'tool-call',id:'declare-original',name:'crystra_declare_step',arguments:JSON.stringify({label:'Preserve this responsibility across process exit',actions:[action]})}:calls===1?{type:'tool-call',id:'execute-after-resume',name:'fixture_noop',arguments:JSON.stringify({tag:'checkpoint'})}:{type:'text',text:'The promised observable action completed.'};
   yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
  }}
  ctx.llm.registerAdapter(['offline'],new Adapter());
  const options={agentOptions:{provider:'offline',model:'fixture'},setup:(ac,agent)=>{
   attachment=ctx.crystraBackend.attach(ac,agent,config.mode==='seed'?config.manifest:undefined);
   ac.tools.register({name:'fixture_noop',description:'Deterministic observable action',parameters:{type:'object',properties:{tag:{type:'string'}},required:['tag']},output:{schema:{type:'object'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async args=>({tag:args.tag,executed:true})});
  }};
  worker=config.mode==='seed'?await ctx.agents.create({...options,sessionId:'crash-worker'}):await ctx.agents.resume({...options,resumeSessionId:'crash-worker'});
  await attachment.ready;
  worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:config.mode==='seed'?'Begin fixed task':'Resume the original responsibility.'}]}));
  const until=Date.now()+10000;while(worker.agent.status!=='idle'){if(Date.now()>until)throw Error('Fixed worker did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  await ctx.sessions.flush(worker.agent.session);
  const events=worker.agent.session.snapshotEvents();
  const result={kind:'done',captured,state:(await attachment.ready).snapshot(),toolCalls:events.filter(e=>e.type==='tool/call').map(e=>e.data.name),end:events.findLast(e=>e.type==='turn/end')?.data};
  await worker.dispose();await attachment.close();await ctx.fiber.dispose();process.send(result);process.disconnect();
 }catch(error){await worker?.dispose();await attachment?.close();await ctx?.fiber.dispose();process.send({kind:'error',message:error.message});process.exitCode=1;process.disconnect();}
});
