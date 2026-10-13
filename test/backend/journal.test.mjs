import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { openJournal } from '../../src/backend/dsh-journal.js';
async function host(root) {
  const ctx=new Context();
  for(const name of ['dsh-session','dsh-session-persistence-jsonl']) {
    const mod=await import('@deepseek-ai/'+name);
    await ctx.plugin(mod.default??mod,name.endsWith('jsonl')?{root,compression:'none'}:{});
  }
  return ctx;
}
test('official JSONL journal survives a fresh host and refuses a competing writer',async()=>{
  const root=await mkdtemp(join(tmpdir(),'crystra-journal-'));
  let ctx=await host(root);
  try {
    const journal=await openJournal(ctx.sessionPersistence,'worker');
    assert.equal(await journal.read(),null);
    const state={schemaVersion:1,workerSessionId:'worker',active:{id:'step-1'}};
    await journal.append(state);
    await assert.rejects(openJournal(ctx.sessionPersistence,'worker'),/owned|ownership/i);
    await journal.close(); await ctx.fiber.dispose(); ctx=await host(root);
    const resumed=await openJournal(ctx.sessionPersistence,'worker');
    assert.deepEqual(await resumed.read(),state);
    await resumed.close();
  } finally { await ctx.fiber.dispose(); await rm(root,{recursive:true,force:true}); }
});
test('separate installed persistence copies recognize only matching native missing-session identity',async()=>{
 // A separately installed DSH package has its own constructor identity.
 class OtherCopyNotFound extends Error {constructor(id){super('missing');this.name='SessionPersistenceNotFoundError';this.sessionId=id;}}
 let created=0;const persistence={async open(id){throw new OtherCopyNotFound(id);},async create(){created++;return {read:async()=>({events:[]}),close:async()=>{}};}};
 const journal=await openJournal(persistence,'native-worker');assert.equal(created,1);await journal.close();
 for(const error of [Object.assign(new Error('disk failure'),{sessionId:'wrong'}),new OtherCopyNotFound('wrong')]){
 await assert.rejects(openJournal({...persistence,open:async()=>{throw error;}},'native-worker'),e=>e===error);
 }
 assert.equal(created,1);
});
