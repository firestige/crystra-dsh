import {createHash,randomUUID} from 'node:crypto';
import {lstat,readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
const operations={'check-entry':{method:'checkEntry',fields:['nodeId','reason','sourceIdentities']},'assess-node':{method:'assessNode',fields:['nodeId','reason','sourceIdentities','conclusion']},'recover-wave':{method:'recoverWave',fields:['waveId']},'revise-gate':{method:'reviseGate',fields:['gateId','reason','resultIdentities']},'start-wave':{method:'start',fields:['waveId']},'assess-wave':{method:'assessWave',fields:['waveId','resultIdentity','conclusion','reason']},'trigger-gate':{method:'triggerGate',fields:['gateId','reason','sourceIdentities']},'assess-delivery':{method:'assessDelivery',fields:['conclusion','summary','resultIdentities','decisionIds','criteria','conditions','candidates']}};
/** Agent-authored proposals never contain an accepted user decision. */
export function createTaskControlRequests({stateRoot,flow,runs}){
 const file=task=>{if(!/^task-[a-zA-Z0-9-]+$/.test(task.taskId))throw Error('TASK_ID_INVALID');return join(stateRoot,'control-receipts',`${task.taskId}.json`);};
 async function receipts(task){try{return JSON.parse(await readFile(file(task),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function apply(task,agent){
  try{
   const context=await flow.read(task),path=join(context.artifactRoot,'control.json');let stat;try{stat=await lstat(path);}catch(e){if(e.code==='ENOENT')return {kind:'none'};throw e;}
   if(!stat.isFile()||stat.size>131072)throw Error('CONTROL_REQUEST_FILE_INVALID');
   const bytes=await readFile(path,'utf8'),request=JSON.parse(bytes),definition=operations[request?.operation];
   if(request?.schema!=='crystra.control-request@1'||typeof request.id!=='string'||!request.id.trim()||request.id.length>128||!definition||typeof request.planDigest!=='string'||Object.keys(request).some(k=>!['schema','id','operation','planDigest',...definition.fields].includes(k)))throw Error('CONTROL_REQUEST_INVALID');
   const digest=createHash('sha256').update(bytes).digest('hex'),rows=await receipts(task),previous=rows.find(r=>r.id===request.id);
   if(previous){if(previous.digest!==digest)throw Error('CONTROL_REQUEST_ID_REUSED');return {...previous,kind:'already-applied'};}
   await runs[definition.method](task,request,agent);
   const receipt={kind:'accepted',id:request.id,operation:request.operation,digest,recordedAt:new Date().toISOString()};rows.push(receipt);
   await mkdir(join(stateRoot,'control-receipts'),{recursive:true,mode:0o700});const target=file(task),temp=`${target}.${randomUUID()}.new`;await writeFile(temp,JSON.stringify(rows),{mode:0o600});await rename(temp,target);return receipt;
  }catch(e){return {kind:'rejected',error:e.message};}
 }
 return {apply,receipts};
}
