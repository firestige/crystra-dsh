import {createHash} from 'node:crypto';
import {defineTool} from '@deepseek-ai/dsh-tools';
/** Explicit reads only; reference text never authorizes execution or changes a source package. */
export function createWorkflowDraftReadTool({gateway,resolveWorkspace}){
 return defineTool({
  name:'crystra_workflow_draft_read',
  description:'Read an exact conditional Workflow resource referenced in this session. Requires the configured Workflow revision, resource ID, path and resourceRevision. Returns draft data, never formal authority; does not edit, adopt or publish. Only the explicitly bound local session may read. Use nextOffset to continue the same exact version.',
  parameters:{...Object.fromEntries(['definitionId','definitionRevision','resourceId','path','resourceRevision'].map(key=>[key,{type:'string',required:true}])),offset:{type:'integer'}},
  output:{schema:{type:'object',additionalProperties:true,properties:{content:{type:'string',required:true},revision:{type:'string',required:true},sha256:{type:'string',required:true},offset:{type:'integer',required:true},totalCharacters:{type:'integer',required:true},nextOffset:{oneOf:[{type:'integer'},{type:'null'}],required:true}}},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
  async execute(args,execution){
   if(!execution.agent)throw new Error('DRAFT_SESSION_UNAVAILABLE');execution.signal?.throwIfAborted();
   const offset=args.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>500000)throw new Error('INVALID_OFFSET');
   if(Object.keys(args).some(k=>!['definitionId','definitionRevision','resourceId','path','resourceRevision','offset'].includes(k)))throw new Error('INVALID_REQUEST');
   const request=Object.fromEntries(['definitionId','definitionRevision','resourceId','path','resourceRevision'].map(key=>[key,args[key]]));
   const authority=await resolveWorkspace(execution.agent),result=await gateway.readForSession(request,authority);
   execution.signal?.throwIfAborted();if(!result.ok)throw new Error(result.error.message);
   const value=result.value;if(offset>value.content.length)throw new Error('INVALID_OFFSET');
   const end=Math.min(offset+10000,value.content.length);
   return {...value,content:value.content.slice(offset,end),sha256:createHash('sha256').update(value.content).digest('hex'),offset,totalCharacters:value.content.length,nextOffset:end<value.content.length?end:null};
  },
 });
}
