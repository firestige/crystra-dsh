import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,rm,lstat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
const fail=code=>{throw new Error(code);};
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=4096;
function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 fail('INVALID_JSON');
}
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
/** Isolated conditional authoring only. One root is one exact resource stream; no runtime effects. */
export function createDraftAuthoringStore({root,isolation,getContext,validateCandidate}){
 if(!isAbsolute(root)||isolation!=='draft-authoring-only'||typeof getContext!=='function'||typeof validateCandidate!=='function')fail('ISOLATED_STORE_REQUIRED');
 const file=join(root,'draft-state.json'),lock=join(root,'.commit-lock');
 async function context(write=false){
  const value=await getContext();
  if(value?.environment!=='exploration'||value.draftId!=='crystra-ui-exploration'||value.revision!=='draft.1')fail('EXPLORATION_REQUIRED');
  if(value.accessAllowed!==true)fail('ACCESS_REQUIRED');
  if(write&&value.writeAllowed!==true)fail('WRITE_NOT_ALLOWED');
  if(!/^[a-f0-9]{64}$/.test(value.sourceLockDigest)||!text(value.workspaceId)||!text(value.resourceId))fail('INVALID_CONTEXT');
  return Object.fromEntries(['environment','draftId','revision','sourceLockDigest','workspaceId','resourceId'].map(key=>[key,value[key]]));
 }
 async function load(binding){
  let data;
  try{const stat=await lstat(file);if(!stat.isFile()||stat.size>2_000_000)fail('INVALID_STORE');data=JSON.parse(await readFile(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return {format:'crystra-draft-authoring@1',binding,currentRevision:null,revisions:[],events:[],proposals:{}};throw error;}
  if(data.format!=='crystra-draft-authoring@1'||!Array.isArray(data.revisions)||!Array.isArray(data.events)||!data.proposals)fail('INVALID_STORE');
  if(digest(data.binding)!==digest(binding))fail('STORE_BINDING_CHANGED');
  return data;
 }
 return {
  async read(){const binding=await context();const data=await load(binding);if(digest(await context())!==digest(binding))fail('STORE_BINDING_CHANGED');return data;},
  async commit(input){
   const proposal=JSON.parse(canonical(input));
   if(!proposal||Object.keys(proposal).some(key=>!['proposalId','workspaceId','resourceId','baseRevision','candidateRevision','candidate','sourceRefs'].includes(key))||
      !['proposalId','workspaceId','resourceId','candidateRevision'].every(key=>text(proposal[key]))||
      !(proposal.baseRevision===null||text(proposal.baseRevision))||!Object.hasOwn(proposal,'candidate')||
      !Array.isArray(proposal.sourceRefs)||!proposal.sourceRefs.length||!proposal.sourceRefs.every(text))fail('INVALID_PROPOSAL');
   const binding=await context(true);
   if(proposal.workspaceId!==binding.workspaceId||proposal.resourceId!==binding.resourceId)fail('PROPOSAL_BINDING_CHANGED');
   if(Buffer.byteLength(canonical(proposal),'utf8')>1_000_000)fail('PROPOSAL_TOO_LARGE');
   await mkdir(root,{recursive:true,mode:0o700});
   try{await mkdir(lock,{mode:0o700});}catch(error){if(error.code==='EEXIST')fail('STORE_BUSY');throw error;}
   let temporary;
   try{
    const current=await load(binding),hash=digest(proposal);
    const previous=Object.hasOwn(current.proposals,proposal.proposalId)?current.proposals[proposal.proposalId]:undefined;
    if(previous){if(previous.hash!==hash)fail('PROPOSAL_CONFLICT');if(digest(await context(true))!==digest(binding))fail('STORE_BINDING_CHANGED');return previous.result;}
    if(proposal.baseRevision!==current.currentRevision)fail('REVISION_CONFLICT');
    if(current.revisions.some(revision=>revision.revision===proposal.candidateRevision))fail('IMMUTABLE_REVISION');
    if(await validateCandidate(JSON.parse(canonical(proposal.candidate)),{...binding})!==true)fail('CANDIDATE_INVALID');
    const eventId=randomUUID();const result={state:'committed',authority:'draft',revision:proposal.candidateRevision,eventId};
    const next={...current,currentRevision:proposal.candidateRevision,
     revisions:[...current.revisions,{revision:proposal.candidateRevision,baseRevision:proposal.baseRevision,candidate:proposal.candidate,sourceRefs:proposal.sourceRefs}],
     events:[...current.events,{eventId,workspaceId:binding.workspaceId,resourceId:binding.resourceId,beforeRevision:proposal.baseRevision,afterRevision:proposal.candidateRevision,status:'pending'}],
     proposals:{...current.proposals,[proposal.proposalId]:{hash,result}}};
    const bytes=canonical(next);if(Buffer.byteLength(bytes,'utf8')>2_000_000)fail('STORE_FULL');
    temporary=join(root,`.draft-${randomUUID()}.tmp`);const handle=await open(temporary,'wx',0o600);
    try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    if(digest(await context(true))!==digest(binding))fail('STORE_BINDING_CHANGED');
    await rename(temporary,file);temporary=undefined;
    return result;
   }finally{if(temporary)await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
  },
 };
}
