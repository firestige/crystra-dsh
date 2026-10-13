import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConsensus } from '../../src/backend/consensus.js';
import { digest } from '../../src/backend/value.js';
const data = { body: { iv: 'Keep the first version local.' } };
const ref = { id: 'c1', published_version: 3, publication_event_id: 'p1', actor: 'user:owner', data_hash: digest(data) };
const manifest = { scope: 'backend', references: [ref] };
const resolve = async () => ({ reference: ref, data, effective: true });
test('loads exact publication and returns a detached scope-bound snapshot', async () => {
  const loaded = await loadConsensus(manifest, resolve);
  assert.deepEqual(loaded.documents[0], { reference: ref, data });
  loaded.documents[0].data.body.iv = 'tamper';
  assert.equal(data.body.iv, 'Keep the first version local.');
});
test('wrong publication identity, content, withdrawn publication and resolver outage block loading', async () => {
  for (const record of [
    { reference: { ...ref, actor: 'user:other' }, data, effective: true },
    { reference: ref, data: { body: { iv: 'different' } }, effective: true },
    { reference: ref, data, effective: false },
  ]) await assert.rejects(loadConsensus(manifest, async () => record));
  await assert.rejects(loadConsensus(manifest, async () => { throw Error('offline'); }), /offline/);
});
test('ambiguous scope and duplicate publication identities fail before lookup', async () => {
  let calls = 0;
  const lookup = async () => { calls++; return resolve(); };
  for (const bad of [{ ...manifest, scope: '' }, { ...manifest, references: [] }, { ...manifest, references: [ref, ref] }]) {
    await assert.rejects(loadConsensus(bad, lookup));
  }
  assert.equal(calls, 0);
});
test('explicit required set, allowed scopes and exact dependencies cannot be silently omitted',async()=>{
 await assert.rejects(loadConsensus({...manifest,requiredIds:['c1','missing']},resolve));
 await assert.rejects(loadConsensus({...manifest,allowedScopes:['project:P']},resolve));
 const dependency={...ref,id:'dependency'};
 const scopedData={scope:{iv:'project:P'},dependencies:{iv:[dependency]}};
 const scopedRef={...ref,data_hash:digest(scopedData)};
 await assert.rejects(loadConsensus({scope:'task:T',references:[scopedRef],allowedScopes:['project:P']},async()=>({reference:scopedRef,data:scopedData,effective:true})));
});
