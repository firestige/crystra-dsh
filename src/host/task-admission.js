import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,readdir,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
/** DSH stores only exact Session bindings. Task identity metadata is owned by Execution. */
export async function createTaskAdmission({ctx,stateRoot,owner}) {
 const root=join(stateRoot,'task-session-bindings');
 const present=row=>{
  const session=ctx.sessions.get(row.sessionId);
  const workspaces=ctx.workspaceRegistry.list().filter(w=>w.sessionIds.includes(row.sessionId));
  return workspaces.length===1&&workspaces[0].id===row.workspaceId&&workspaces[0].path===row.workspacePath&&(!session||session.header.cwd===row.workspacePath);
 };
 async function read(file){
  const row=JSON.parse(await readFile(join(root,file),'utf8'));
  if(row.schemaVersion!=='crystra.task-session@1'||!['taskId','sessionId','workspaceId','workspacePath','initialMessageId'].every(k=>typeof row[k]==='string'&&row[k])||file!==hash(row.sessionId)+'.json')throw Error('TASK_BINDING_INVALID');
  return row;
 }
 async function admit(sessionId){
  if(typeof sessionId==='string'&&sessionId.startsWith('crystra-task-topic-'))throw Error('TOPIC_CANNOT_CREATE_TASK');
  if(typeof sessionId==='string'&&sessionId.startsWith('crystra-workflow-'))throw Error('WORKFLOW_SESSION_CANNOT_ADMIT_TASK');
  if(typeof sessionId!=='string'||!sessionId||sessionId.length>512)throw Error('TASK_SESSION_INVALID');
  const s=ctx.sessions.get(sessionId),owners=ctx.workspaceRegistry.list().filter(w=>w.sessionIds.includes(sessionId));
  if(!s)return null; // A DSH draft is not yet a persisted Session.
  if(owners.length!==1||s.header.cwd!==owners[0].path)throw Error('TASK_SESSION_UNAVAILABLE');
  const initial=s.ownEvents().find(e=>e.type==='user/message'&&e.data?.source?.kind==='user'&&e.data.content?.some(b=>b.type==='text'&&b.text?.trim()));
  if(!initial)return null;
  if(typeof initial.data.id!=='string'||!initial.data.id)throw Error('TASK_INITIAL_MESSAGE_INVALID');
  const control=owner();if(!control?.admitTask)throw Error('EXECUTION_TASK_ADMISSION_UNAVAILABLE');
  if(await ctx.sessions.flush(s)!==true)throw Error('TASK_PERSISTENCE_UNAVAILABLE');
  const row={schemaVersion:'crystra.task-session@1',taskId:'task-'+hash(sessionId),sessionId,workspaceId:owners[0].id,workspacePath:owners[0].path,initialMessageId:initial.data.id};
  if(!present(row))throw Error('TASK_SESSION_UNAVAILABLE');
  const file=hash(sessionId)+'.json';
  // Stable owner command survives a crash between Task publication and binding publication.
  const createdAt=typeof s.header.createdAt==='number'?s.header.createdAt:Date.parse(s.header.createdAt);
  if(!Number.isSafeInteger(createdAt)||createdAt<0)throw Error('TASK_SESSION_TIMESTAMP_INVALID');
  const title=Array.from(initial.data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim()).slice(0,160).join('');
  await control.admitTask({id:row.taskId,title,createdAt});
  await mkdir(root,{recursive:true,mode:0o700});
  const temporary=join(root,file+'.'+randomUUID()+'.candidate');
  const handle=await open(temporary,'wx',0o600);
  try{
   await handle.writeFile(JSON.stringify(row)+'\n');await handle.sync();await handle.close();
   try{await link(temporary,join(root,file));}catch(error){if(error.code!=='EEXIST')throw error;if(JSON.stringify(await read(file))!==JSON.stringify(row))throw Error('TASK_BINDING_CONFLICT');}
   const dir=await open(root,'r');try{await dir.sync();}finally{await dir.close();}
  }finally{await handle.close();await unlink(temporary).catch(()=>{});}
  return row;
 }
 let tail=Promise.resolve();
 return {admit(id){const result=tail.then(()=>admit(id));tail=result.catch(()=>{});return result;},async bindings(){let files;try{files=await readdir(root);}catch(e){if(e.code==='ENOENT')return [];throw e;}return (await Promise.all(files.filter(f=>f.endsWith('.json')).map(read))).filter(present);}};
}
