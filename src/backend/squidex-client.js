import { baseline } from './managed-consensus.js';
import { digest, publicationReference, same } from './value.js';
const segment=value=>{if(typeof value!=='string'||!value||!/^[-a-zA-Z0-9]+$/.test(value))throw Error('Invalid Squidex path identity');return encodeURIComponent(value);};
export class SquidexClient {
 #config;#path;
 constructor(config){
  const url=new URL(config.baseUrl);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Local Squidex origin required');
  this.#config={...config,baseUrl:url.origin};this.#path=`/api/content/${segment(config.app)}/${segment(config.schema)}`;
 }
 async #request(method,path,data,headers={},consumer=false){
  const token=await (consumer?this.#config.consumerToken:this.#config.managementToken)();
  if(typeof token!=='string'||!token)throw Error('Squidex host credential unavailable');
  const response=await fetch(this.#config.baseUrl+path,{method,redirect:'error',headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(this.#config.timeoutMs??10000)});
  const text=await response.text();let body;
  try{body=JSON.parse(text);}catch{body=null;}
  return {status:response.status,body};
 }
 async #get(path,consumer=false){const response=await this.#request('GET',path,undefined,consumer?{}:{'X-Unpublished':'1'},consumer);if(response.status!==200||!response.body)throw Error(`Squidex read unavailable (${response.status})`);return response.body;}
 inspect(id){return this.#get(`${this.#path}/${segment(id)}`);}
 async #events(content){
  const channel=`schemas.${content.schemaId}.contents.${content.id}`;
  const events=await this.#get(`/api/apps/${segment(this.#config.app)}/history?${new URLSearchParams({channel})}`);
  if(!Array.isArray(events))throw Error('Squidex history unavailable');return events;
 }
 async referenceAt(id,version){
  if(!Number.isSafeInteger(version)||version<0)throw Error('Historical version required');
  const snapshot=await this.#get(`${this.#path}/${segment(id)}?version=${version}`);
  if(snapshot.id!==id||snapshot.version!==version||snapshot.status!=='Published'||snapshot.newStatus)throw Error('Not an exact published snapshot');
  const events=await this.#events(snapshot);
  const matching=events.filter(e=>e.eventType==='ContentStatusChangedEventV2'&&e.version===version);
  if(matching.length!==1)throw Error('Exact publication event unavailable');
  return publicationReference({id,published_version:version,publication_event_id:matching[0].eventId,actor:matching[0].actor,data_hash:digest(snapshot.data)});
 }
 async historical(reference){
  const ref=publicationReference(reference);
  const reconstructed=await this.referenceAt(ref.id,ref.published_version);
  if(!same(ref,reconstructed))throw Error('Publication identity/hash mismatch');
  const snapshot=await this.#get(`${this.#path}/${segment(ref.id)}?version=${ref.published_version}`);
  if(digest(snapshot.data)!==ref.data_hash)throw Error('Historical content changed');return snapshot;
 }
 async resolve(reference){
  const ref=publicationReference(reference);
  await this.#get(`${this.#path}/${segment(ref.id)}`,true); // Explicit online efficacy check, never use cache as proof.
  const snapshot=await this.historical(ref);
  // A later withdrawal permanently invalidates an old binding, including after republication.
  const later=(await this.#events(snapshot)).filter(event=>event.eventType==='ContentStatusChangedEventV2'&&event.version>ref.published_version);
  for(const event of later){
   const state=await this.#get(`${this.#path}/${segment(ref.id)}?version=${event.version}`);
   if(state.status==='Archived'&&!state.newStatus)throw Error('Publication was explicitly withdrawn');
  }
  return {reference:ref,data:snapshot.data,effective:true};
 }
 async mutate(command){
  const item=`${this.#path}/${segment(command.id)}`;
  if(command.type==='propose')return this.#request('POST',`${this.#path}?${new URLSearchParams({id:command.id})}`,command.data);
  baseline(command.base);
  const headers={'If-Match':command.base};
  if(command.type==='modify')return this.#request('PUT',item,command.data,headers);
  if(command.type==='draft')return this.#request('POST',item+'/draft',undefined,headers);
  const statuses={submit:'Ready',publish:'Published',withdraw:'Archived',returnDraft:'Draft'};
  if(!Object.hasOwn(statuses,command.type))throw Error('Unsupported Squidex mutation');
  return this.#request('PUT',item+'/status',{status:statuses[command.type]},headers);
 }
}
