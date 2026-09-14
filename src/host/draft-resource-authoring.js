import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createDraftAuthoringStore} from './draft-authoring-store.js';
const fail=code=>{throw new Error(code);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Explicit source catalog -> isolated immutable file drafts. Never writes source files. */
export function createDraftResourceAuthoring({root,resources,getContext}){
 const initial=getContext();
 const identity=value=>JSON.stringify(['environment','draftId','revision','sourceLockDigest','workspaceId'].map(key=>value[key]));
 const binding=Promise.resolve(initial).then(identity).then(value=>({value}),error=>({error}));
 const context=async()=>{const expected=await binding;if(Object.hasOwn(expected,'error'))throw expected.error;const current=await getContext();if(identity(current)!==expected.value)fail('STORE_BINDING_CHANGED');return current;};
 const catalog=structuredClone(resources),keys=new Set();
 for(const source of catalog){const key=JSON.stringify([source.resourceId,source.path]);
  if(keys.has(key)||!['resourceId','path','revision','content'].every(k=>typeof source[k]==='string')||!source.resourceId||!source.path||!source.revision||source.revision.startsWith('draft-sha256:'))fail('INVALID_RESOURCE_CATALOG');keys.add(key);
 }
 function resolve(resourceId,path){const source=catalog.find(item=>item.resourceId===resourceId&&item.path===path);if(!source)fail('RESOURCE_UNAVAILABLE');
  const stream=JSON.stringify([resourceId,path]);
  const store=createDraftAuthoringStore({root:join(root,hash(stream)),isolation:'draft-authoring-only',getContext:async()=>({...await context(),resourceId:stream}),
   validateCandidate:c=>c?.resourceId===resourceId&&c.path===path&&typeof c.content==='string'&&c.content.length<=500000});return {source,store,stream};
 }
 const projection=(source,revision,content)=>({authority:'draft',resourceId:source.resourceId,path:source.path,revision,content});
 return {
  async read(resourceId,path){const {source,store}=resolve(resourceId,path);const state=await store.read();
   const current=state.revisions.find(item=>item.revision===state.currentRevision);
   if(state.currentRevision&&!current)fail('INVALID_STORE');return projection(source,current?.revision??source.revision,current?.candidate.content??source.content);
  },
  async readRevision(resourceId,path,revision){
   const {source,store}=resolve(resourceId,path),state=await store.read();
   if(revision===source.revision)return projection(source,source.revision,source.content);
   const exact=state.revisions.find(item=>item.revision===revision);
   if(!exact)fail('REVISION_UNAVAILABLE');
   return projection(source,exact.revision,exact.candidate.content);
  },
  async save(request){
   if(!request||Object.keys(request).some(key=>!['proposalId','resourceId','path','baseRevision','baseContent','content'].includes(key))||!['proposalId','resourceId','path','baseRevision','baseContent','content'].every(k=>typeof request[k]==='string'))fail('INVALID_RESOURCE_PROPOSAL');
   const {source,store,stream}=resolve(request.resourceId,request.path),state=await store.read();
   const prior=request.baseRevision===source.revision?source:state.revisions.find(item=>item.revision===request.baseRevision)?.candidate;
   if(!prior)fail('REVISION_CONFLICT');if(prior.content!==request.baseContent)fail('CONTENT_CONFLICT');
   const candidate={resourceId:request.resourceId,path:request.path,content:request.content};
   const revision='draft-sha256:'+hash([request.proposalId,request.resourceId,request.path,request.baseRevision,request.baseContent,request.content]);
   await store.commit({proposalId:request.proposalId,workspaceId:(await context()).workspaceId,resourceId:stream,baseRevision:request.baseRevision===source.revision?null:request.baseRevision,candidateRevision:revision,candidate,sourceRefs:[source.revision,source.path]});
   return projection(source,revision,request.content);
  },
 };
}
