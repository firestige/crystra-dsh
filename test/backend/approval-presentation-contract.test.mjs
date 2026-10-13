import test from 'node:test';import assert from 'node:assert/strict';
import {consensusApprovalPresentation,presentationFromApprovalReason} from '../../src/backend/consensus-approval-display.js';
import {encodeApprovalReason} from '../../src/backend/consensus-approval-codec.js';
import {approvalDetailProjection} from '../../src/backend/consensus-approval-projection.js';
const make=()=>consensusApprovalPresentation({type:'publish',id:'a',reason:'Reason',activate:true},{scope:'P',documents:[{reference:{id:'a'},data:{body:{iv:'old'}}}]},{data:{body:{iv:'new'}}});
test('versioned readable codec preserves semantic roles independently of display label changes',()=>{
 const p=make();assert.equal(p.sections.find(s=>s.kind==='before').text,'old');
 const renamed={...p,heading:'Please approve',sections:p.sections.map(s=>({...s,label:'translated-'+s.kind}))};
 const reason=encodeApprovalReason(renamed);assert.match(reason,/v1/);assert.match(reason,/old/);assert.match(reason,/new/);assert.doesNotMatch(reason,/"sections"|"kind"/);
 const decoded=presentationFromApprovalReason(reason);assert.equal(decoded.heading,renamed.heading);assert.deepEqual(decoded.sections.map(({kind,text})=>({kind,text})),p.sections.map(({kind,text})=>({kind,text})));assert.deepEqual(decoded.diffs,p.diffs);
});
test('unknown or malformed formats cannot leak an earlier presentation into the next approval',()=>{
 const old=approvalDetailProjection.apply(null,{type:'approval/asked',data:{id:'old',callId:'old',toolName:'crystra_consensus_approve',reason:encodeApprovalReason(make())}});
 for(const reason of ['Crystra 共识审批记录 v99\nPlease approve','Crystra 共识审批记录 v1\nbroken','unrecognized readable reason']){
  const state=approvalDetailProjection.apply(old,{type:'approval/asked',data:{id:'new',callId:'new',toolName:'crystra_consensus_approve',reason}});assert.equal(state,null);
 }
});
test('legacy text decoding retains exact bodies and adds semantic identities',()=>{
 const p=presentationFromApprovalReason('请确认：发布共识\n\n修改前：旧正文\n 保留缩进\n\n修改后：新正文\n\n适用范围：P');assert.equal(p.sections.find(s=>s.kind==='before').text,'旧正文\n保留缩进');assert.equal(p.sections.find(s=>s.kind==='scope').text,'P');assert.equal(p.diffs.length,1);
});
test('new codec preserves long bodies, section-looking text, CRLF, metadata labels and exact differences',async()=>{
 const {readFile}=await import('node:fs/promises');const before=await readFile(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8'),after=await readFile(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');
 const tricky='\r\n  原有缩进\r\n\r\n适用范围：只是正文\nCrystra 共识审批记录 v99\n\n尾行\n';
 const p=consensusApprovalPresentation({type:'publish',id:'a',reason:'Reason',activate:true},{scope:'P',documents:[{reference:{id:'a'},data:{body:{iv:before+tricky}}}]},{data:{body:{iv:after+tricky},['修改前\n："附加字段"']:{iv:'metadata'}}});
 const decoded=presentationFromApprovalReason(encodeApprovalReason(p));assert.deepEqual(decoded,p);
 const malformed=encodeApprovalReason(p).replace(/拒绝后：[\s\S]*$/,'');assert.equal(presentationFromApprovalReason(malformed),null);
});
test('native approval persists the readable codec, ignores unsupported metadata and restores on a clean JSONL host',async()=>{
 const {Context}=await import('@deepseek-ai/cordis'),{Session,KNOWN_SESSION_EVENT_TYPES}=await import('@deepseek-ai/dsh-session'),{default:ApprovalService}=await import('@deepseek-ai/dsh-user-approval'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'approval-codec-')),p=make(),reason=encodeApprovalReason(p);let ctx;
 const host=async()=>{const c=new Context();for(const name of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+name);await c.plugin(m.default??m,name.endsWith('jsonl')?{root,compression:'none'}:{});}return c;};
 try{
  ctx=await host();await ctx.plugin(ApprovalService,{policy:'ask'});ctx.on('approval/request',()=> 'rejected');
  const session=Session.create('codec-native');session.append('turn/start',{turn:1});
  assert.equal(await ctx.approval.request({agent:{session,ctx},callId:'c',toolName:'crystra_consensus_approve',reason,presentation:p}),'rejected');session.append('turn/end',{turn:1,reason:{kind:'completed'}});
  const events=session.snapshotEvents(),asked=events.find(e=>e.type==='approval/asked');assert.equal(asked.data.presentation,undefined);assert.equal(asked.data.reason,reason);assert.ok(events.every(e=>KNOWN_SESSION_EVENT_TYPES.has(e.type)));
  let handle=await ctx.sessionPersistence.create(session.header);await handle.append(events);await handle.flush();await handle.close();await ctx.fiber.dispose();ctx=await host();
  handle=await ctx.sessionPersistence.open(session.id,'read');const restored=await handle.read();await handle.close();const replay=Session.create('codec-replay',restored.events);
  let state=null;for(const e of replay.snapshotEvents()){state=approvalDetailProjection.apply(state,e);if(e.type==='approval/asked'){assert.equal(state.requestId,asked.data.id);assert.deepEqual(state.presentation,p);}}assert.equal(state,null);
 }finally{await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
test('malformed legacy payloads are ignored without crashing projection, and cannot mask an unsupported new format',()=>{
 for(const data of [null,{}, {callId:'c',presentation:{heading:'bad',sections:[null]}}])assert.doesNotThrow(()=>{assert.equal(approvalDetailProjection.apply(null,{type:'crystra/consensus-approval-detail',data}),null);});
 const pending=approvalDetailProjection.apply(null,{type:'crystra/consensus-approval-detail',data:{callId:'c',presentation:make()}});
 assert.ok(pending);assert.equal(approvalDetailProjection.apply(pending,{type:'approval/asked',data:{id:'new',callId:'c',toolName:'crystra_consensus_approve',reason:'Crystra 共识审批记录 v99\nunsupported'}}),null);
});
test('legacy native approval reason survives a fresh JSONL host and semantic projection',async()=>{
 const {Context}=await import('@deepseek-ai/cordis'),{Session}=await import('@deepseek-ai/dsh-session'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'legacy-approval-replay-'));let ctx;
 const host=async()=>{const c=new Context();for(const name of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+name);await c.plugin(m.default??m,name.endsWith('jsonl')?{root,compression:'none'}:{});}return c;};
 try{
  ctx=await host();const session=Session.create('legacy-native');session.append('turn/start',{turn:1});
  session.append('approval/asked',{id:'old',callId:'c',toolName:'crystra_consensus_approve',reason:'请确认：修改共识\n\n修改前：旧版正文\n\n修改后：新版正文\n\n适用范围：P'});
  session.append('approval/decided',{id:'old',outcome:'rejected'});session.append('turn/end',{turn:1,reason:{kind:'completed'}});
  let h=await ctx.sessionPersistence.create(session.header);await h.append(session.snapshotEvents());await h.flush();await h.close();await ctx.fiber.dispose();ctx=await host();
  h=await ctx.sessionPersistence.open(session.id,'read');const restored=await h.read();await h.close();let state=null;
  for(const e of restored.events){state=approvalDetailProjection.apply(state,e);if(e.type==='approval/asked'){assert.equal(state.presentation.sections.find(s=>s.kind==='before').text,'旧版正文');assert.equal(state.presentation.sections.find(s=>s.kind==='after').text,'新版正文');}}assert.equal(state,null);
 }finally{await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
