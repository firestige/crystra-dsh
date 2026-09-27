import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTaskAdmission} from '../src/host/task-admission.js';
test('admission requires persisted nonblank input, retries one owner identity, and rejects stale workspace membership',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-admit-'));
 try {
  const events=[];
  const session={id:'s',header:{cwd:'/workspace',createdAt:12},ownEvents:()=>events};
  let members=['s'],persisted=true,calls=[],loaded=true;
  const ctx={sessions:{get:id=>loaded&&id==='s'?session:undefined,flush:async()=>persisted},workspaceRegistry:{list:()=>[{id:'w',path:'/workspace',sessionIds:members}]}};
  const admitTask=async h=>{calls.push(h);return h};
  const open=()=>createTaskAdmission({ctx,stateRoot:root,owner:()=>({admitTask})});
  const api=await open();
  await assert.rejects(api.admit('crystra-workflow-test'),/WORKFLOW_SESSION_CANNOT_ADMIT_TASK/);
  assert.equal(await api.admit('s'),null);
  events.push({type:'user/message',timestamp:42,data:{id:'m',source:{kind:'user'},content:[{type:'text',text:'  '}]}});
  assert.equal(await api.admit('s'),null);
  events[0].data.content[0].text='New task';persisted=false;
  await assert.rejects(api.admit('s'),/PERSISTENCE/);assert.equal(calls.length,0);
  persisted=true;
  const [a,b]=await Promise.all([api.admit('s'),api.admit('s')]);
  assert.equal(a.taskId,b.taskId);assert.equal((await (await open()).admit('s')).taskId,a.taskId);
  assert.equal(new Set(calls.map(x=>x.id)).size,1);
  assert.equal((await api.bindings())[0].sessionId,'s');
  loaded=false;assert.equal((await api.bindings())[0].sessionId,'s');loaded=true;
  members=[];await assert.rejects(api.admit('s'),/SESSION/);assert.deepEqual(await api.bindings(),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
import {Session,SESSION_FORMAT_VERSION} from '@deepseek-ai/dsh-session';
test('admits the actual DSH 0.1.5 Session through its public event API',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-real-session-'));
 try{
  const session=Session.create('real-session',[],{id:'real-session',version:SESSION_FORMAT_VERSION,createdAt:123,cwd:'/workspace',isSeeded:false});
  session.append('user/message',{id:'first-input',role:'user',source:{kind:'user'},content:[{type:'text',text:'Create the new workbench'}]},{surfaceOp:'append'});
  assert.equal(session.events,undefined);
  let header;
  const admission=await createTaskAdmission({stateRoot:root,ctx:{sessions:{get:()=>session,flush:async()=>true},workspaceRegistry:{list:()=>[{id:'w',path:'/workspace',sessionIds:[session.id]}]}},owner:()=>({admitTask:async value=>{header=value;return value;}})});
  const binding=await admission.admit(session.id);
  assert.equal(binding.initialMessageId,'first-input');
  assert.equal(header.title,'Create the new workbench');
  assert.equal(header.id,binding.taskId);
 }finally{await rm(root,{recursive:true,force:true});}
});
