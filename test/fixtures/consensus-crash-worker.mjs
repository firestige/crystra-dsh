import { SquidexClient } from '../../src/backend/squidex-client.js';
import { ManagedConsensus } from '../../src/backend/managed-consensus.js';
import { openJournal } from '../../src/backend/dsh-journal.js';
import { storage,principals,settle } from '../integration/squidex-fixture.mjs';
process.once('message',async config=>{
 try{
  const ctx=await storage(config.root);
  const client=new SquidexClient({baseUrl:config.baseUrl,app:config.app,schema:'agreements',managementToken:async()=>config.management,consumerToken:async()=>config.consumer});
  const journal=await openJournal(ctx.sessionPersistence,`consensus:${config.namespace}`);
  const append=journal.append.bind(journal);
  journal.append=async state=>{await append(state);if(config.boundary==='prepared'&&state.operations[config.command.operationId]?.state==='prepared'){process.send({kind:'checkpoint',boundary:'prepared'});await new Promise(()=>{});}};
  const manager=await ManagedConsensus.open({namespace:config.namespace,journal,client,principals});
  const mutate=client.mutate.bind(client);
  const checkpoint=async fields=>{process.send({kind:'checkpoint',...fields});await new Promise(()=>{});};
  client.mutate=async command=>{
   if(config.boundary==='before-send')await checkpoint({boundary:config.boundary});
   const response=await mutate(command);
   if(config.boundary==='after-response')await checkpoint({boundary:config.boundary,status:response.status,version:response.body.version});
   return response;
  };
  const result=await settle(manager,'U1',await manager.execute('U1',config.command));
  await checkpoint({boundary:'after-receipt',state:result.state});
 }catch(error){process.send({kind:'error',message:error.message});process.exitCode=1;process.disconnect();}
});
