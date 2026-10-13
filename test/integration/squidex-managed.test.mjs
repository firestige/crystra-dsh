import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fixture,command,content,publish,settle } from './squidex-fixture.mjs';
import { digest } from '../../src/backend/value.js';
const root=await mkdtemp(join(tmpdir(),'crystra-managed-live-'));
const f=await fixture(join(root,'records'));
const outcomes=[];
const composeProject=process.env.CRYSTRA_SQUIDEX_COMPOSE_PROJECT??'crystra-squidex-trial';
if(!['crystra-squidex-trial','crystra-native-runtime'].includes(composeProject))throw Error('Use a dedicated known integration fixture compose project');
const scenario=(name,fn)=>test(name,{timeout:60000},async()=>{await fn();outcomes.push(name);});
test.after(async()=>{await f.close();await mkdir('artifacts/backend-rebuild',{recursive:true});await writeFile(process.env.CRYSTRA_SQUIDEX_REPORT??'artifacts/backend-rebuild/squidex-live.json',JSON.stringify({app:f.app,schemaId:f.schemaId,passed:outcomes,state:f.manager.snapshot()},null,2));await rm(root,{recursive:true,force:true});});
scenario('Q1/Q4 exact published reference survives a new draft and ordinary publication',async()=>{
 const first=await publish(f,content('v1: no tenants'));const ref=first.reference;
 let current=await f.client.inspect(ref.id);
 let draft=await f.manager.execute('A1',command('draft',{id:ref.id,base:`"${current.version}"`}));
 draft=await f.manager.execute('A1',command('modify',{id:ref.id,base:`"${draft.response.body.version}"`,data:content('v2: multiple local projects')}));
 assert.equal((await f.client.resolve(ref)).data.body.iv,'v1: no tenants');
 draft=await f.manager.execute('A1',command('submit',{id:ref.id,base:`"${draft.response.body.version}"`}));
 const grantId=await f.manager.authorize('U1',{id:ref.id,base:`"${draft.response.body.version}"`,dataHash:digest(draft.response.body.data),reason:'Approve v2'});
 const second=await settle(f.manager,'U1',await f.manager.execute('U1',command('publish',{grantId})));
 assert.notEqual(second.reference.published_version,ref.published_version);
 assert.equal((await f.client.resolve(ref)).data.body.iv,'v1: no tenants');
 assert.equal((await f.client.resolve(second.reference)).data.body.iv,'v2: multiple local projects');
 await assert.rejects(f.client.resolve({...ref,publication_event_id:'fake'}));
});
scenario('Q2 concurrent CAS admits one writer and never refreshes stale baseline',async()=>{
 const id=randomUUID();const created=await f.manager.execute('A1',command('propose',{id,data:content('original')}));const base=`"${created.response.body.version}"`;
 const results=await Promise.all([f.client.mutate({type:'modify',id,base,data:content('first')}),f.client.mutate({type:'modify',id,base,data:content('second')})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,412]);
 const stale=await f.manager.execute('A1',command('modify',{id,base,data:content('stale overwriter')}));
 assert.equal(stale.state,'confirmed_rejected');assert.equal(stale.status,412);
 assert.notEqual((await f.client.inspect(id)).data.body.iv,'stale overwriter');
});
scenario('Q2 changed candidate, wrong subject and revoked authorization do not publish',async()=>{
 const id=randomUUID();let r=await f.manager.execute('A1',command('propose',{id,data:content('candidate A')}));
 r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));
 const grantId=await f.manager.authorize('U1',{id,base:`"${r.response.body.version}"`,dataHash:digest(r.response.body.data),reason:'Approve A'});
 await assert.rejects(f.manager.execute('U2',command('publish',{grantId})));
 const blocked=await f.manager.execute('A1',command('modify',{id,base:`"${r.response.body.version}"`,data:content('illegal Ready edit')}));assert.equal(blocked.state,'confirmed_rejected');
 r=await f.manager.execute('A1',command('returnDraft',{id,base:`"${r.response.body.version}"`}));
 r=await f.manager.execute('A1',command('modify',{id,base:`"${r.response.body.version}"`,data:content('candidate B')}));
 r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));
 await assert.rejects(f.manager.execute('U1',command('publish',{grantId})));
 const fresh=await f.manager.authorize('U1',{id,base:`"${r.response.body.version}"`,dataHash:digest(r.response.body.data),reason:'Approve B'});
 await f.manager.revoke('U1',fresh,'Approval withdrawn');await f.reopen();
 await assert.rejects(f.manager.execute('U1',command('publish',{grantId:fresh})));
 assert.equal((await f.client.inspect(id)).status,'Ready');
});
scenario('Q2/Q3 publish receipt and grant survive cold host; same operation replays without new version',async()=>{
 const id=randomUUID();let r=await f.manager.execute('A1',command('propose',{id,data:content('restart')}));
 r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));
 const grantId=await f.manager.authorize('U1',{id,base:`"${r.response.body.version}"`,dataHash:digest(r.response.body.data),reason:'Durable approval'});
 await f.reopen();const cmd=command('publish',{grantId});
 const published=await settle(f.manager,'U1',await f.manager.execute('U1',cmd));await f.reopen();
 assert.deepEqual(await f.manager.execute('U1',cmd),published);
 assert.equal((await f.client.inspect(id)).version,published.response.body.version);
 await assert.rejects(f.manager.execute('U1',{...cmd,operationId:randomUUID()}));
});
scenario('Q1/Q2 withdrawal blocks old binding; restore is a fresh unapproved candidate',async()=>{
 const first=await publish(f,content('old approved body'));const current=await f.client.inspect(first.reference.id);
 const withdrawn=await f.manager.execute('U1',command('withdraw',{id:current.id,base:`"${current.version}"`}));assert.equal(withdrawn.state,'confirmed_success');
 await assert.rejects(f.client.resolve(first.reference));
 for(const type of ['returnDraft','draft'])await assert.rejects(f.manager.execute('A1',command(type,{id:current.id,base:`"${withdrawn.response.body.version}"` })),/Proposer cannot/);
 assert.equal((await f.client.inspect(current.id)).status,'Archived');
 const restoredId=randomUUID();const restored=await f.manager.execute('U1',command('restore',{id:restoredId,from:first.reference,reason:'Restore old body as a new proposal'}));
 assert.equal(restored.state,'confirmed_success');assert.equal(restored.response.body.status,'Draft');assert.equal(restored.response.body.data.body.iv,'old approved body');
 assert.equal(restored.response.body.data.supersedes.iv,first.reference.id);
 await assert.rejects(f.client.resolve({...first.reference,id:restoredId}));
});
scenario('Q4 DSH loads exact CMS data, trusted agent can propose, and unload blocks the next model call',async()=>{
 const {Context}=await import('@deepseek-ai/cordis');
 const {LlmAdapter,createUserMessage}=await import('@deepseek-ai/dsh-llm');
 const backend=await import('../../src/backend/index.js');
 const first=await publish(f,content('DSH exact local consensus'));
 const ctx=new Context();let worker,attachment,calls=0;
 const load=async(name,options={})=>{const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,options);};
 try{
  for(const name of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(name);
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root:join(root,'dsh'),compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  await ctx.plugin(backend,{consensus:{namespace:f.app,client:f.client,principals:{A1:'Proposer',U1:'Publisher'},identifyAgent:agent=>agent.session.id==='managed-worker'?'A1':null}});
  const service=await ctx.crystraConsensus.ready;
  const pendingId=randomUUID();
  // Bad binding must be rejected before the adapter is called, including missing required IDs and draft references.
  const id=randomUUID();const draft=await service.execute('A1',command('propose',{id,data:content('not effective')}));
  assert.equal(draft.state,'confirmed_success');
  class Adapter extends LlmAdapter{async *stream(options){calls++;assert.match(JSON.stringify(options.messages),/DSH exact local consensus/);const block={type:'text',text:'One fixed observable request.'};yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:'stop'}};}}
  ctx.llm.registerAdapter(['fixture'],new Adapter());
  const spawn=async(sessionId,manifest)=>{worker=await ctx.agents.create({sessionId,agentOptions:{provider:'fixture',model:'offline'},setup:(ac,agent)=>{attachment=ctx.crystraBackend.attach(ac,agent,manifest);}});return attachment.ready;};
  await assert.rejects(spawn('missing-worker',{scope:'project:P',references:[first.reference],requiredIds:[first.reference.id,pendingId]}));assert.equal(calls,0);await worker.dispose();await attachment.close();
  await assert.rejects(spawn('wrong-scope-worker',{scope:'project:Other',references:[first.reference],allowedScopes:['project:Other']}));assert.equal(calls,0);await worker.dispose();await attachment.close();
  await assert.rejects(spawn('draft-worker',{scope:'project:P',references:[{...first.reference,id,published_version:draft.response.body.version}]}));assert.equal(calls,0);await worker.dispose();await attachment.close();
  await spawn('managed-worker',{scope:'project:P',references:[first.reference],allowedScopes:['project:P']});
  const op=command('propose',{id:randomUUID(),data:content('agent proposed candidate')});
  let sequence=0;
  class Proposer extends LlmAdapter{async *stream(options){calls++;sequence++;assert.match(JSON.stringify(options.messages),/DSH exact local consensus/);const block=sequence===1?{type:'tool-call',id:'managed-proposal',name:'crystra_consensus_command',arguments:JSON.stringify(op)}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:sequence===1?'tool-calls':'stop'}};}}
  // Avoid an undeclared finish loop: stop after the managed tool result is observed.
  ctx.llm.registerAdapter(['proposer-fixture'],new Proposer());
  await ctx.sessions.flush(worker.agent.session);await worker.dispose();await attachment.close();
  worker=await ctx.agents.resume({resumeSessionId:'managed-worker',agentOptions:{provider:'proposer-fixture',model:'offline'},setup:(ac,agent)=>{attachment=ctx.crystraBackend.attach(ac,agent);ac.on('agent/turn-stopping',()=>agent.cancel({kind:'hook',reason:'Fixed observer after proposal'}));}});
  await attachment.ready;
  worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Execute the fixed managed proposal.'}]}));
  const until=Date.now()+5000;while(worker.agent.status!=='idle'){if(Date.now()>until)throw Error('DSH proposal did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal((await f.client.inspect(op.id)).data.body.iv,'agent proposed candidate');
  assert.equal(service.snapshot().operations[op.operationId].intent.subject,'A1');
  const previousCalls=calls;
  // The restored controller is authoritative after reattachment.
  await (await attachment.ready).setManifest(null,{expectedRevision:0,reason:'Explicit unload'});
  worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'This request must not reach the model.'}]}));
  const deadline=Date.now()+5000;while(worker.agent.status!=='idle'){if(Date.now()>deadline)throw Error('Unload did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(calls,previousCalls);
 }finally{await worker?.dispose();await attachment?.close();await ctx.fiber.dispose();}
});
scenario('Q3 SIGKILL at named send/response/receipt boundaries restores truthful Pending or confirmed result',async()=>{
 const {fork}=await import('node:child_process');
 const {once}=await import('node:events');
 const {storage,principals}=await import('./squidex-fixture.mjs');
 const {ManagedConsensus}=await import('../../src/backend/managed-consensus.js');
 const {openJournal}=await import('../../src/backend/dsh-journal.js');
 for(const boundary of ['prepared','before-send','after-response','after-receipt']){
  const namespace=f.app+'-'+boundary,storeRoot=join(root,boundary),id=randomUUID();
  let r=await f.manager.execute('A1',command('propose',{id,data:content('crash '+boundary)}));
  r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));const initialVersion=r.response.body.version;
  let ctx=await storage(storeRoot),journal=await openJournal(ctx.sessionPersistence,'consensus:'+namespace);
  let manager=await ManagedConsensus.open({namespace,journal,client:f.client,principals});
  const grantId=await manager.authorize('U1',{id,base:`"${initialVersion}"`,dataHash:digest(r.response.body.data),reason:'Approval persisted before worker starts'});
  await journal.close();await ctx.fiber.dispose();
  const cmd=command('publish',{grantId});
  const child=fork(new URL('../fixtures/consensus-crash-worker.mjs',import.meta.url),[],{execArgv:[],stdio:['ignore','ignore','pipe','ipc']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const checkpoint=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Checkpoint timeout: '+stderr));},15000);
   child.once('message',message=>{clearTimeout(timer);message.kind==='checkpoint'?resolve(message):reject(Error(message.message));});
   child.once('error',reject);
  });
  child.send({root:storeRoot,namespace,app:f.app,baseUrl:f.baseUrl,management:f.management,consumer:f.consumer,command:cmd,boundary});
  let observed;
  try{observed=await checkpoint;}finally{const exited=once(child,'exit');child.kill('SIGKILL');await exited;}
  if(boundary==='after-response')assert.equal(observed.status,200);
  ctx=await storage(storeRoot);journal=await openJournal(ctx.sessionPersistence,'consensus:'+namespace);
  try{
   manager=await ManagedConsensus.open({namespace,journal,client:f.client,principals});
   const versionBefore=(await f.client.inspect(id)).version;
   const restored=await manager.execute('U1',cmd);
   if(boundary==='prepared'){
    assert.equal(versionBefore,initialVersion);await settle(manager,'U1',restored);assert.equal((await f.client.inspect(id)).version,initialVersion+1);
   }else{
    assert.equal(restored.state,boundary==='after-receipt'?'confirmed_success':'pending');
    assert.equal((await f.client.inspect(id)).version,versionBefore);
    if(boundary==='before-send')assert.equal(versionBefore,initialVersion);else assert.equal(versionBefore,initialVersion+1);
   }
   // A same-body published object cannot convert an unacknowledged operation into confirmed success.
   if(boundary==='after-response')assert.equal((await manager.reconcile('U1',cmd.operationId)).state,'pending');
  }finally{await journal.close();await ctx.fiber.dispose();}
 }
});
scenario('Q3 HTTP relay drops successful publication response; restored operation stays Pending without another write',async()=>{
 const {createServer}=await import('node:http');const {once}=await import('node:events');
 const {SquidexClient}=await import('../../src/backend/squidex-client.js');
 const {ManagedConsensus}=await import('../../src/backend/managed-consensus.js');
 const {openJournal}=await import('../../src/backend/dsh-journal.js');
 const {storage,principals}=await import('./squidex-fixture.mjs');
 const id=randomUUID();let r=await f.manager.execute('A1',command('propose',{id,data:content('lost HTTP response')}));
 r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));
 let dropped=0;
 const relay=createServer(async(req,res)=>{
  try{const buffers=[];for await(const chunk of req)buffers.push(chunk);const body=Buffer.concat(buffers);
   const upstream=await fetch(f.baseUrl+req.url,{method:req.method,headers:{Authorization:req.headers.authorization,'Content-Type':'application/json',...(req.headers['if-match']?{'If-Match':req.headers['if-match']}:{}),...(req.headers['x-unpublished']?{'X-Unpublished':req.headers['x-unpublished']}: {})},body:body.length?body:undefined});
   const response=await upstream.text();
   if(req.method==='PUT'&&req.url.endsWith('/status')&&body.toString().includes('Published')&&upstream.status===200){dropped++;res.destroy();return;}
   res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(response);
  }catch{res.destroy();}
 });
 relay.listen(0,'127.0.0.1');await once(relay,'listening');
 const client=new SquidexClient({baseUrl:`http://127.0.0.1:${relay.address().port}`,app:f.app,schema:'agreements',managementToken:async()=>f.management,consumerToken:async()=>f.consumer});
 const namespace=f.app+'-relay',ctx=await storage(join(root,'relay')),journal=await openJournal(ctx.sessionPersistence,'consensus:'+namespace);
 try{
  let manager=await ManagedConsensus.open({namespace,journal,client,principals});
  const grantId=await manager.authorize('U1',{id,base:`"${r.response.body.version}"`,dataHash:digest(r.response.body.data),reason:'Exact candidate before relay loss'});
  const cmd=command('publish',{grantId});assert.equal((await manager.execute('U1',cmd)).state,'pending');assert.equal(dropped,1);
  manager=await ManagedConsensus.open({namespace,journal,client,principals});assert.equal((await manager.execute('U1',cmd)).state,'pending');assert.equal(dropped,1);
  assert.equal((await f.client.inspect(id)).status,'Published');
  const knownRef={...(await publish(f,content('independent binding'))).reference};
  await assert.rejects(manager.resolve(knownRef,{requiredOperations:[cmd.operationId]}));
 }finally{await journal.close();await ctx.fiber.dispose();relay.closeAllConnections();await new Promise(resolve=>relay.close(resolve));}
});
scenario('Q2 read-only CMS credentials cannot use native bulk bypass; malformed baselines are rejected locally',async()=>{
 const {SquidexClient}=await import('../../src/backend/squidex-client.js');
 const reader=new SquidexClient({baseUrl:f.baseUrl,app:f.app,schema:'agreements',managementToken:async()=>f.consumer,consumerToken:async()=>f.consumer});
 const id=randomUUID();let r=await f.manager.execute('A1',command('propose',{id,data:content('read-only boundary')}));
 const before=await f.client.inspect(id);
 const forbidden=await reader.mutate({type:'modify',id,base:`"${before.version}"`,data:content('forbidden')});assert.equal(forbidden.status,403);
 const response=await fetch(`${f.baseUrl}/api/content/${f.app}/agreements/bulk`,{method:'POST',headers:{Authorization:'Bearer '+f.consumer,'Content-Type':'application/json'},body:JSON.stringify({jobs:[{id,type:'ChangeStatus',status:'Published',expectedVersion:before.version}],doNotValidateWorkflow:true})});
 const body=await response.json();
 assert.ok(response.status===403||(response.status===200&&Array.isArray(body)&&body.every(job=>job.error?.statusCode===403)), 'Read-only bulk job must be denied');
 await assert.rejects(f.manager.execute('A1',command('modify',{id,base:'W/"not-a-version"',data:content('forbidden')})));
 assert.deepEqual((await f.client.inspect(id)).data,before.data);assert.equal((await f.client.inspect(id)).version,before.version);
});
scenario('Q1/Q4 CMS outage blocks reads, then recovers exact publication with database continuously running',async()=>{
 const {promisify}=await import('node:util');const {execFile}=await import('node:child_process');const exec=promisify(execFile);
 const first=await publish(f,content('survives CMS restart'));
 const db=(await exec('docker',['inspect','--format','{{.State.StartedAt}}',`${composeProject}-database-1`])).stdout;
 await exec('docker',['stop','-t','1',`${composeProject}-squidex-1`]);
 try{await assert.rejects(f.client.resolve(first.reference));}finally{await exec('docker',['start',`${composeProject}-squidex-1`]);}
 const until=Date.now()+45000;let loaded;
 while(Date.now()<until){try{loaded=await f.client.resolve(first.reference);break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}}
 assert.equal(loaded?.data.body.iv,'survives CMS restart');
 assert.equal((await exec('docker',['inspect','--format','{{.State.StartedAt}}',`${composeProject}-database-1`])).stdout,db);
});
scenario('Q4 SIGKILL of complete DSH loop restores manifest and original commitment in a new process',async()=>{
 const {fork}=await import('node:child_process');const {once}=await import('node:events');
 const published=await publish(f,content('FULL-PROCESS-CONSENSUS: no tenants'));
 const config={root:join(root,'full-dsh'),app:f.app,baseUrl:f.baseUrl,management:f.management,consumer:f.consumer,manifest:{scope:'project:P',references:[published.reference],allowedScopes:['project:P']}};
 const start=mode=>{
  const child=fork(new URL('../fixtures/consensus-dsh-worker.mjs',import.meta.url),[],{execArgv:[],stdio:['ignore','ignore','pipe','ipc']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('DSH child timeout '+stderr));},15000);child.once('error',reject);child.once('message',message=>{clearTimeout(timer);message.kind==='error'?reject(Error(message.message)):resolve(message);});});
  child.send({...config,mode});return {child,result};
 };
 const seed=start('seed');let checkpoint;
 try{checkpoint=await seed.result;}finally{const exited=once(seed.child,'exit');seed.child.kill('SIGKILL');await exited;}
 assert.equal(checkpoint.kind,'checkpoint');assert.match(JSON.stringify(checkpoint.captured),/FULL-PROCESS-CONSENSUS/);assert.ok(checkpoint.state.active);
 const resumed=start('resume');const exited=once(resumed.child,'exit');let result;
 try{result=await resumed.result;await exited;}finally{if(resumed.child.exitCode===null&&resumed.child.signalCode===null)resumed.child.kill('SIGKILL');}
 assert.equal(result.kind,'done');assert.equal(result.end.reason.kind,'completed');
 assert.match(JSON.stringify(result.captured),/FULL-PROCESS-CONSENSUS/);
 assert.deepEqual(result.state.manifest,checkpoint.state.manifest);
 assert.equal(result.state.history[0].id,checkpoint.state.active.id);
 assert.equal(result.state.history[0].verification.decision,'GO');
 assert.equal(result.toolCalls.filter(name=>name==='crystra_declare_step').length,1);
 assert.equal(result.toolCalls.filter(name=>name==='fixture_noop').length,1);
});
scenario('Q4 simultaneous one-shot agents load disjoint consensus scopes without cross-task mixing',async()=>{
 const {Context}=await import('@deepseek-ai/cordis');const {LlmAdapter,createUserMessage}=await import('@deepseek-ai/dsh-llm');const backend=await import('../../src/backend/index.js');
 const first=await publish(f,content('SCOPE-P-ONLY','project:P')),second=await publish(f,content('SCOPE-OTHER-ONLY','project:Other'));
 const ctx=new Context(),workers=[],attachments=[],captures=new Map();
 try{
  const load=async(name,config={})=>{const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,config);};
  for(const name of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(name);
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root:join(root,'parallel'),compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  await ctx.plugin(backend,{consensus:{namespace:f.app,client:f.client,principals:{U1:'Publisher'}}});await ctx.crystraConsensus.ready;
  class Capture extends LlmAdapter{async *stream(options){captures.set(options.sessionId,JSON.stringify(options.messages.find(m=>m.role==='system')));const block={type:'text',text:'Captured one decision input.'};yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:'stop'}};}}
  ctx.llm.registerAdapter(['capture'],new Capture());
  for(const [sessionId,publication,scope] of [['scope-p',first,'project:P'],['scope-other',second,'project:Other']]){
   const handle=await ctx.agents.create({sessionId,agentOptions:{provider:'capture',model:'offline'},setup:(ac,agent)=>{attachments.push(ctx.crystraBackend.attach(ac,agent,{scope,references:[publication.reference],allowedScopes:[scope]}));ac.on('agent/turn-stopping',()=>agent.cancel({kind:'hook',reason:'Stop after one input observation'}));}});workers.push(handle);
  }
  await Promise.all(attachments.map(a=>a.ready));for(const worker of workers)worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Capture input.'}]}));
  const until=Date.now()+5000;while(workers.some(w=>w.agent.status!=='idle')){if(Date.now()>until)throw Error('Parallel captures did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(captures.size,2);assert.match(captures.get('scope-p'),/SCOPE-P-ONLY/);assert.doesNotMatch(captures.get('scope-p'),/SCOPE-OTHER-ONLY/);
  assert.match(captures.get('scope-other'),/SCOPE-OTHER-ONLY/);assert.doesNotMatch(captures.get('scope-other'),/SCOPE-P-ONLY/);
 }finally{for(const worker of workers)await worker.dispose();for(const attachment of attachments)await attachment.close();await ctx.fiber.dispose();}
});
