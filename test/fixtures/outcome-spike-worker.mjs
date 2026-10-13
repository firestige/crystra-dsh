import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Controller} from '../../src/backend/controller.js';
import {openJournal} from '../../src/backend/dsh-journal.js';
import {digest} from '../../src/backend/value.js';

export async function observeNativeOutcomes(){
 const root=await mkdtemp(join(tmpdir(),'outcome-spike-'));const sessionId='outcomes-native';let ctx,handle,journal;
 class Calls extends LlmAdapter{index=0;async *stream(){const name=['normal','throws'][this.index++];const block=name?{type:'tool-call',id:`call-${name}`,name,arguments:'{"case":"public"}'}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:name?'tool-calls':'stop'}};}}
 const setup=ac=>{for(const name of ['normal','throws'])ac.tools.register({name,description:'Native outcome observation',parameters:{type:'object'},output:{schema:{type:'object'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:()=>{if(name==='throws')throw Error('deliberate outcome fixture');return {exitCode:0};}});};
 const boot=async()=>{ctx=new Context();for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm','dsh-system-prompt','dsh-tools','dsh-session-persistence-jsonl','dsh-agent-loop']){const m=await import('@deepseek-ai/'+n);const configs={'dsh-system-prompt':{includeHarnessIdentity:false,includeRuntimeContext:false},'dsh-tools':{mode:'native'},'dsh-session-persistence-jsonl':{root,compression:'none'},'dsh-agent-loop':{agents:[],maxParallelToolCalls:1}};await ctx.plugin(m.default??m,configs[n]??{});}ctx.llm.registerAdapter(['outcome-fixture'],new Calls());};
 const files=async()=>{const result={};async function visit(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await visit(p);else if(e.name.endsWith('.jsonl'))result[p.slice(root.length)]=await readFile(p,'utf8');}}await visit(root);return result;};
 const data={body:'outcome fixture'},ref={id:'c',published_version:1,publication_event_id:'p',actor:'user:owner',data_hash:digest(data)},manifest={scope:'fixture',references:[ref]};
 const options=events=>({workerSessionId:sessionId,journal,resolve:async()=>({reference:ref,data,effective:true}),evidence:async()=>({sessionId,seq:events().at(-1)?.seq??0,events:events()})});
 try{
 await boot();handle=await ctx.agents.create({sessionId,agentOptions:{provider:'outcome-fixture',model:'offline'},setup});journal=await openJournal(ctx.sessionPersistence,sessionId);
 const controller=await Controller.open(options(()=>handle.agent.session.snapshotEvents()),manifest);
 await controller.declare({label:'Run normal and throwing tools',actions:['normal','throws'].map(tool=>({id:tool,kind:'tool-completed',tool,match:{case:'public'}}))});
 const declared=controller.snapshot();handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run both tools'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);
 const events=handle.agent.session.snapshotEvents(),decision=await controller.finish(),state=controller.snapshot();await journal.close();journal=null;await handle.dispose();handle=null;await ctx.fiber.dispose();ctx=null;
 const before=await files(),restores=[],readOnly=[];
 await boot();for(let i=0;i<2;i++){const reader=await ctx.sessionPersistence.open(sessionId,'read');readOnly.push((await reader.read()).events);await reader.close();}await ctx.fiber.dispose();ctx=null;const afterReadOnly=await files();
 for(let i=0;i<2;i++){
 await boot();handle=await ctx.agents.resume({resumeSessionId:sessionId,agentOptions:{provider:'outcome-fixture',model:'offline'},setup});const restoredEvents=handle.agent.session.snapshotEvents();journal=await openJournal(ctx.sessionPersistence,sessionId);const restoredController=await Controller.open(options(()=>restoredEvents));restores.push({events:restoredEvents,state:restoredController.snapshot()});await journal.close();journal=null;await handle.dispose();handle=null;await ctx.fiber.dispose();ctx=null;
 }
 return {source:'real DSH tools and JSONL persistence; deterministic offline model',events,declared,decision,state,restores,filesBefore:before,readOnly,filesAfterReadOnly:afterReadOnly,filesAfter:await files()};
 }finally{await journal?.close();await handle?.dispose();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
}
