import { Context } from '@deepseek-ai/cordis';
import { randomUUID } from 'node:crypto';
import { SquidexClient } from '../../src/backend/squidex-client.js';
import { openJournal } from '../../src/backend/dsh-journal.js';
import { ManagedConsensus } from '../../src/backend/managed-consensus.js';
export const principals={A1:'Proposer',U1:'Publisher',U2:'Publisher',R1:'Reader'};
export async function storage(root){const ctx=new Context();for(const n of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,n.endsWith('jsonl')?{root,compression:'none'}:{});}return ctx;}
export async function fixture(root){
 const baseUrl=process.env.CRYSTRA_SQUIDEX_URL??'http://127.0.0.1:1946';
 async function request(method,path,data,token){
  const response=await fetch(baseUrl+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(data instanceof URLSearchParams?{'Content-Type':'application/x-www-form-urlencoded'}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof URLSearchParams?data:JSON.stringify(data)});
  const body=await response.json();if(!response.ok)throw Error(`Fixture setup ${method} ${path}: ${response.status}`);return body;
 }
 const token=async(client_id,client_secret)=>(await request('POST','/identity-server/connect/token',new URLSearchParams({grant_type:'client_credentials',client_id,client_secret,scope:'squidex-api'}))).access_token;
 const admin=await token('crystra-admin','crystra-local-admin-fixture-only');
 const app='crystra-backend-'+randomUUID().slice(0,8);
 await request('POST','/api/apps',{name:app},admin);
 const schema=await request('POST',`/api/apps/${app}/schemas`,{name:'agreements',isPublished:true,fields:[['body','String',true],['scope','String',true],['dependencies','Json',false],['reason','String',false],['supersedes','String',false]].map(([name,fieldType,isRequired])=>({name,partitioning:'invariant',properties:{fieldType,isRequired}}))},admin);
 const workflow=await request('POST',`/api/apps/${app}/workflows`,{name:'consensus'},admin);
 const workflowId=workflow.items.find(item=>item.name==='consensus')?.id??workflow.items.at(-1).id;
 await request('PUT',`/api/apps/${app}/workflows/${workflowId}`,{initial:'Draft',steps:{Draft:{transitions:{Ready:{}}},Ready:{noUpdate:true,transitions:{Draft:{},Published:{roles:['Owner']}}},Published:{noUpdate:true,transitions:{Archived:{roles:['Owner']}}},Archived:{noUpdate:true,transitions:{Draft:{roles:['Owner']}}}}},admin);
 const clients=await request('GET',`/api/apps/${app}/clients`,undefined,admin);
 const management=await token(app+':default',clients.items.find(c=>c.id==='default').secret);
 const readers=await request('POST',`/api/apps/${app}/clients`,{id:'consumer'},admin);
 await request('PUT',`/api/apps/${app}/clients/consumer`,{role:'Reader'},admin);
 const consumer=await token(app+':consumer',readers.items.find(c=>c.id==='consumer').secret);
 const client=new SquidexClient({baseUrl,app,schema:'agreements',managementToken:async()=>management,consumerToken:async()=>consumer});
 let ctx=await storage(root),journal=await openJournal(ctx.sessionPersistence,'consensus:'+app);
 let manager=await ManagedConsensus.open({namespace:app,journal,client,principals});
 const service={managementClientId:app+':default',managementSecret:clients.items.find(c=>c.id==='default').secret,consumerClientId:app+':consumer',consumerSecret:readers.items.find(c=>c.id==='consumer').secret,app,schemaId:schema.id,client,baseUrl,management,consumer,root,get ctx(){return ctx;},get manager(){return manager;},async reopen(){await journal.close();await ctx.fiber.dispose();ctx=await storage(root);journal=await openJournal(ctx.sessionPersistence,'consensus:'+app);manager=await ManagedConsensus.open({namespace:app,journal,client,principals});return manager;},async close(){await journal.close();await ctx.fiber.dispose();}};
 return service;
}
export const command=(type,fields)=>({operationId:randomUUID(),type,...fields});
export const content=(body,scope='project:P')=>({body:{iv:body},scope:{iv:scope}});
export async function settle(manager,subject,receipt){const until=Date.now()+20000;while(receipt.state==='pending'&&receipt.response&&Date.now()<until){await new Promise(resolve=>setTimeout(resolve,100));receipt=await manager.reconcile(subject,receipt.operationId);}if(receipt.state!=='confirmed_success')throw Error(`Expected confirmed success, got ${receipt.state}`);return receipt;}
export async function publish(f,data){
 const id=randomUUID();let r=await f.manager.execute('A1',command('propose',{id,data}));
 if(r.state!=='confirmed_success')throw Error('Creation failed');
 r=await f.manager.execute('A1',command('submit',{id,base:`"${r.response.body.version}"`}));
 const {digest}=await import('../../src/backend/value.js');
 const grantId=await f.manager.authorize('U1',{id,base:`"${r.response.body.version}"`,dataHash:digest(r.response.body.data),reason:'Fixture approves this candidate'});
 return settle(f.manager,'U1',await f.manager.execute('U1',command('publish',{grantId})));
}
