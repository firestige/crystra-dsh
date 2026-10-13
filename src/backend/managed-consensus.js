import { randomUUID } from 'node:crypto';
import { canonical, digest, plain, publicationReference } from './value.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields={propose:['id','data'],modify:['id','base','data'],draft:['id','base'],submit:['id','base'],returnDraft:['id','base'],publish:['grantId'],withdraw:['id','base'],restore:['id','from','reason']};
export function baseline(value){if(typeof value!=='string'||!/^"(0|[1-9][0-9]*)"$/.test(value)||!Number.isSafeInteger(Number(value.slice(1,-1))))throw new TypeError('Quoted nonnegative safe entity version required');return Number(value.slice(1,-1));}
const id=value=>{if(typeof value!=='string'||!UUID.test(value))throw new TypeError('Content/operation UUID required');return value;};
const reason=value=>{if(typeof value!=='string'||!value.trim())throw new TypeError('Explicit reason required');};

/** Trusted host subjects only; no authentication or CMS lifecycle is reimplemented. */
export class ManagedConsensus {
 #state;#options;#tail=Promise.resolve();#poisoned=false;
 constructor(options,state){this.#options=options;this.#state=state;}
 static async open(options){
  const workerSessionId=`consensus:${options.namespace}`;
  let state=await options.journal.read();
  if(state&&(state.schemaVersion!==1||state.workerSessionId!==workerSessionId))throw Error('Consensus journal identity/schema mismatch');
  if(!state){state={schemaVersion:1,workerSessionId,grants:{},operations:{}};await options.journal.append(state);}
  return new ManagedConsensus({...options,principals:structuredClone(options.principals)},state);
 }
 #run(action){const result=this.#tail.then(()=>{if(this.#poisoned)throw Error('Consensus journal unavailable');return action();});this.#tail=result.catch(()=>{});return result;}
 async #save(next){try{await this.#options.journal.append(next);}catch(error){this.#poisoned=true;throw error;}this.#state=structuredClone(next);}
 #role(subject,allowed){if(!Object.hasOwn(this.#options.principals,subject)||!allowed.includes(this.#options.principals[subject]))throw Error('Trusted subject is not authorized');}
 snapshot(){return structuredClone(this.#state);}
 authorize(subject,candidate){return this.#run(async()=>{
  this.#role(subject,['Publisher']);id(candidate.id);baseline(candidate.base);reason(candidate.reason);
  if(!/^[a-f0-9]{64}$/.test(candidate.dataHash))throw Error('Candidate hash required');
  const content=await this.#options.client.inspect(candidate.id);
  if(content.version!==baseline(candidate.base)||digest(content.data)!==candidate.dataHash||(content.newStatus||content.status)!=='Ready')throw Error('Candidate no longer matches authorization');
  const next=this.snapshot(),grantId=randomUUID();
  next.grants[grantId]={...structuredClone(candidate),subject,revoked:false,usedBy:null};await this.#save(next);return grantId;
 });}
 revoke(subject,grantId,why){return this.#run(async()=>{
  this.#role(subject,['Publisher']);reason(why);const next=this.snapshot(),grant=next.grants[grantId];
  if(!grant||grant.subject!==subject)throw Error('Unknown or wrong-subject grant');
  grant.revoked=true;grant.revocationReason=why;await this.#save(next);
 });}
 #validate(subject,command){
  if(!plain(command)||!Object.hasOwn(fields,command.type))throw Error('Unsupported managed operation');
  this.#role(subject,['publish','withdraw','restore'].includes(command.type)?['Publisher']:['Proposer']);
  id(command.operationId);
  const allowed=['operationId','type',...fields[command.type]];
  if(Object.keys(command).some(key=>!allowed.includes(key))||allowed.some(key=>!Object.hasOwn(command,key)))throw Error('Unknown or missing managed operation fields');
  if(command.id)id(command.id);if('base'in command)baseline(command.base);
  if('data'in command){if(!plain(command.data))throw Error('ContentData required');canonical(command.data);}
  if(command.type==='restore'){id(command.from.id);publicationReference(command.from);reason(command.reason);if(command.id===command.from.id)throw Error('Restore creates a fresh candidate identity');}
 }
 async #publication(record){
  if(record.intent.command.type!=='publish')return;
  const response=record.response.body;
  const ref=await this.#options.client.referenceAt(response.id,response.version);
  const grant=this.#state.grants[record.intent.command.grantId];
  if(ref.id!==grant.id||ref.data_hash!==grant.dataHash||ref.published_version!==response.version)throw Error('Publication receipt identity mismatch');
  record.reference=ref;
 }
 execute(subject,command){return this.#run(async()=>{
  this.#validate(subject,command);
  const intent={subject,command:structuredClone(command)},hash=digest(intent),next=this.snapshot();
  let record=next.operations[command.operationId];
  if(record){if(record.intentHash!==hash)throw Error('Operation ID intent conflict');if(record.state!=='prepared')return structuredClone(record);}
  let mutation=structuredClone(command);
  if(['returnDraft','draft'].includes(command.type)){
   // Owner credentials must not enlarge the trusted Proposer's native transition rights.
   const current=await this.#options.client.inspect(command.id);
   const permitted=command.type==='returnDraft'?(current.newStatus||current.status)==='Ready':current.status==='Published'&&!current.newStatus;
   if(!permitted||current.version!==baseline(command.base))throw Error('Proposer cannot use this draft transition from the current state');
  }
  if(command.type==='publish'){
   const grant=next.grants[command.grantId];
   if(!grant||grant.revoked||grant.subject!==subject||(grant.usedBy&&grant.usedBy!==command.operationId))throw Error('Unknown/revoked/used/wrong-subject grant');
   const current=await this.#options.client.inspect(grant.id);
   if(current.version!==baseline(grant.base)||digest(current.data)!==grant.dataHash||(current.newStatus||current.status)!=='Ready')throw Error('Authorized candidate drifted');
   mutation={type:'publish',id:grant.id,base:grant.base};grant.usedBy=command.operationId;
  }
  if(command.type==='restore'){
   const old=await this.#options.client.historical(command.from);
   mutation={type:'propose',id:command.id,data:{...old.data,reason:{iv:command.reason},supersedes:{iv:command.from.id}}};
  }
  if(!record){record={operationId:command.operationId,intent,intentHash:hash,state:'prepared'};next.operations[command.operationId]=record;await this.#save(next);}
  record.state='pending';await this.#save(next); // Durable uncertainty BEFORE the first mutating byte.
  let response;
  try{response=await this.#options.client.mutate(mutation);}catch{return structuredClone(record);}
  record.response=response;record.status=response.status;
  if(response.status>=200&&response.status<300){
   const expectedStatus={propose:'Draft',modify:'Draft',draft:'Draft',submit:'Ready',returnDraft:'Draft',publish:'Published',withdraw:'Archived'}[mutation.type];
   const body=response.body;
   let matches=false;
   try{matches=body?.id===mutation.id&&Number.isSafeInteger(body.version)&&body.version>=0
    &&(mutation.base===undefined||body.version===baseline(mutation.base)+1)
    &&(body.newStatus||body.status)===expectedStatus
    &&(!mutation.data||digest(body.data)===digest(mutation.data));}catch{}
   if(!matches){await this.#save(next);return structuredClone(record);}
   if(command.type==='publish'){
    // Save the known response first. History projection may lag or become unavailable.
    await this.#save(next);
    try{await this.#publication(record);}catch{await this.#save(next);return structuredClone(record);}
   }
   record.state='confirmed_success';
  }else if([400,401,403,404,409,412,422].includes(response.status))record.state='confirmed_rejected';
  await this.#save(next);return structuredClone(record);
 });}
 async resolve(reference,{requiredOperations=[]}={}){
  // Wait for accepted local management operations before taking a loading snapshot.
  await this.#tail;
  if(this.#poisoned)throw Error('Consensus journal unavailable');
  for(const operation of Object.values(this.#state.operations)){
   if(operation.intent.command.type==='withdraw'&&operation.intent.command.id===reference.id
    &&(operation.state==='pending'||(operation.state==='confirmed_success'&&operation.response.body.version>reference.published_version)))throw Error('Consensus explicitly withdrawn or withdrawal unresolved');
  }
  for(const operationId of requiredOperations){
   const operation=this.#state.operations[operationId];
   if(!operation||operation.state!=='confirmed_success')throw Error('Required consensus operation is unresolved or rejected');
  }
  return this.#options.client.resolve(reference);
 }
 reconcile(subject,operationId){return this.#run(async()=>{
  id(operationId);const next=this.snapshot(),record=next.operations[operationId];
  if(!record||record.intent.subject!==subject)throw Error('Operation not owned by subject');
  if(record.state==='pending'&&record.response?.status>=200&&record.response.status<300&&record.intent.command.type==='publish'){
   try{await this.#publication(record);record.state='confirmed_success';}catch{return structuredClone(record);}
   await this.#save(next);
  }
  return structuredClone(record); // No response: do not infer success from matching current bytes.
 });}
}
