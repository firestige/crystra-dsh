import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCommitment, verifyCommitment, splitCommitment } from '../../src/backend/barrier.js';

const ref = { id: 'agreement-1', published_version: 2, publication_event_id: 'publish-1', actor: 'user:owner', data_hash: 'a'.repeat(64) };
const anchor = { sessionId: 'worker-1', seq: 10, stepId: 'step-1' };
const action = { id: 'test', kind: 'tool-completed', tool: 'run_test', match: { suite: 'public' } };
const goal = (actions = [action]) => compileCommitment({ label: 'Run public tests', actions }, anchor, [ref]);
const call = (seq, id, name, args) => ({ seq, type: 'tool/call', data: { callId: id, name, arguments: JSON.stringify(args) } });
const result = (seq, id, value, isError = false) => ({ seq, sourceEventSeqs: [seq - 1], type: 'tool/result', data: { message: { source: { callId: id }, content: [{ type: 'tool-result', toolCallId: id, isError, content: [{ type: 'text', text: JSON.stringify(value) }] }] } } });
const evidence = (events, seq = 30, sessionId = 'worker-1') => ({ sessionId, seq, events });

test('an intention without an actual tool result cannot close', () => {
  assert.equal(verifyCommitment(goal(), evidence([call(11, 'a', 'run_test', { suite: 'public' })]), [ref]).decision, 'NO_GO');
});
test('native call/result association needs no agent-supplied receipt', () => {
  const verdict = verifyCommitment(goal(), evidence([call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'a', { exitCode: 1 })]), [ref]);
  assert.equal(verdict.decision, 'GO');
  assert.equal(verdict.matches[0].callId, 'a');
});
test('running a test and passing it are different commitments', () => {
  const events = [call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'a', { exitCode: 1 })];
  const passing = goal([{ ...action, kind: 'result-equals', path: ['exitCode'], equals: 0 }]);
  assert.equal(verifyCommitment(passing, evidence(events), [ref]).decision, 'NO_GO');
  events[1] = result(12, 'a', { exitCode: 0 });
  assert.equal(verifyCommitment(passing, evidence(events), [ref]).decision, 'GO');
});
test('pre-declaration work, future results, wrong sessions and unrelated results do not fulfill', () => {
  for (const [events, seq, session] of [
    [[call(8, 'a', 'run_test', { suite: 'public' }), result(9, 'a', {})], 30, 'worker-1'],
    [[call(11, 'a', 'run_test', { suite: 'public' }), result(31, 'a', {})], 30, 'worker-1'],
    [[call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'a', {})], 30, 'another-worker'],
    [[call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'other', {})], 30, 'worker-1'],
  ]) assert.equal(verifyCommitment(goal(), evidence(events, seq, session), [ref]).decision, 'NO_GO');
});
test('changed relevant publication blocks old fulfillment; unrelated references do not', () => {
  const facts = evidence([call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'a', {})]);
  assert.equal(verifyCommitment(goal(), facts, [ref, { ...ref, id: 'unrelated' }]).decision, 'GO');
  assert.equal(verifyCommitment(goal(), facts, [{ ...ref, published_version: 3, publication_event_id: 'publish-2' }]).decision, 'NO_GO');
});
test('unsupported and empty assertions cannot be compiled as verified commitments', () => {
  for (const actions of [[], [{ ...action, kind: 'semantic-proof' }], [{ ...action, match: {} }], [action, action]]) {
    assert.throws(() => goal(actions), /commitment/);
  }
});
test('one execution cannot discharge two separately promised actions', () => {
  const g = goal([action, { ...action, id: 'test-again' }]);
  assert.equal(verifyCommitment(g, evidence([call(11, 'a', 'run_test', { suite: 'public' }), result(12, 'a', {})]), [ref]).decision, 'NO_GO');
});
test('split retains actual completed work and carries exact unfinished responsibility', () => {
  const write = { id: 'write', kind: 'tool-completed', tool: 'write_file', match: { path: 'cart.js' } };
  const original = goal([write, action]);
  const facts = evidence([call(11, 'w', 'write_file', { path: 'cart.js' }), result(12, 'w', {})]);
  const proposal = { baseVersion: 1, retain: ['write'], defer: ['test'], reason: 'Write completed; preserve the unexecuted test for a successor.' };
  const revised = splitCommitment(original, proposal, facts, [ref]);
  assert.equal(revised.commitment.version, 2);
  assert.deepEqual(revised.pending[0].action, action);
  assert.deepEqual(revised.commitment.versions[0], original);
  assert.equal(revised.commitment.revision.basis[0].callId, 'w');
  for (const bad of [{ ...proposal, defer: [] }, { ...proposal, baseVersion: 0 }, { ...proposal, reason: '' }]) {
    assert.throws(() => splitCommitment(original, bad, facts, [ref]));
  }
  assert.throws(() => splitCommitment(original, proposal, evidence([]), [ref]));
});

const permutations = values => values.length ? values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])) : [[]];
function executions(cases) {
  return cases.flatMap((entry,i)=>[call(11+i*2,entry.id,'run_test',entry.args),result(12+i*2,entry.id,entry.value??{})]);
}
test('overlapping actions find a distinct-call assignment regardless of declaration or execution order',()=>{
  const actions=[action,{...action,id:'fast',match:{suite:'public',mode:'fast'}}];
  const calls=[{id:'fast-call',args:{suite:'public',mode:'fast'}},{id:'slow-call',args:{suite:'public',mode:'slow'}}];
  for(const declared of permutations(actions))for(const executed of permutations(calls)) {
    const verdict=verifyCommitment(goal(declared),evidence(executions(executed)),[ref]);
    assert.equal(verdict.decision,'GO');assert.equal(new Set(verdict.matches.map(m=>m.callId)).size,2);
    assert.equal(verdict.matches.find(m=>m.actionId==='fast').callId,'fast-call');
  }
});
test('equally specific overlapping actions require reassignment, not specificity sorting',()=>{
  const actions=['x','y','z'].map(key=>({...action,id:key,match:{[key]:1}}));
  const calls=[{id:'xy',args:{x:1,y:1}},{id:'xz',args:{x:1,z:1}},{id:'x-only',args:{x:1}}];
  for(const declared of permutations(actions))for(const executed of permutations(calls)) {
    const verdict=verifyCommitment(goal(declared),evidence(executions(executed)),[ref]);
    assert.equal(verdict.decision,'GO');assert.equal(verdict.matches.find(m=>m.actionId==='x').callId,'x-only');
    assert.equal(new Set(verdict.matches.map(m=>m.callId)).size,3);
  }
});
test('mixed completion and result assertions allocate successful result to the constrained action',()=>{
  const actions=[action,{...action,id:'passing',kind:'result-equals',path:['exitCode'],equals:0}];
  const calls=[{id:'passed',args:{suite:'public'},value:{exitCode:0}},{id:'failed',args:{suite:'public'},value:{exitCode:1}}];
  for(const declared of permutations(actions))for(const executed of permutations(calls)) {
    const verdict=verifyCommitment(goal(declared),evidence(executions(executed)),[ref]);
    assert.equal(verdict.decision,'GO');assert.equal(verdict.matches.find(m=>m.actionId==='passing').callId,'passed');
  }
});
test('split uses globally matched completed facts rather than a greedy missing classification',()=>{
  const actions=[action,{...action,id:'fast',match:{suite:'public',mode:'fast'}},{...action,id:'absent',match:{suite:'other'}}];
  const facts=evidence(executions([{id:'fast',args:{suite:'public',mode:'fast'}},{id:'slow',args:{suite:'public',mode:'slow'}}]));
  const revised=splitCommitment(goal(actions),{baseVersion:1,reason:'Both public checks done; keep other suite pending',retain:['test','fast'],defer:['absent']},facts,[ref]);
  assert.deepEqual(revised.pending.map(p=>p.action.id),['absent']);
  assert.equal(verifyCommitment(revised.commitment,facts,[ref]).decision,'GO');
});

test('exact sequence boundaries and unsuccessful associations do not create evidence',()=>{
  const cases=[
    {name:'call at declaration',events:[call(10,'c','run_test',{suite:'public'}),result(11,'c',{})],decision:'NO_GO'},
    {name:'result at cutoff',events:[call(11,'c','run_test',{suite:'public'}),{...result(30,'c',{}),sourceEventSeqs:[11]}],decision:'GO'},
    {name:'result before call',events:[result(11,'c',{}),call(12,'c','run_test',{suite:'public'})],decision:'NO_GO'},
    {name:'result at call sequence',events:[call(11,'c','run_test',{suite:'public'}),result(11,'c',{})],decision:'NO_GO'},
    {name:'error result',events:[call(11,'c','run_test',{suite:'public'}),result(12,'c',{},true)],decision:'NO_GO'},
  ];
  const mismatched=result(12,'c',{});mismatched.data.message.content[0].toolCallId='other';
  cases.push({name:'block association differs from source',events:[call(11,'c','run_test',{suite:'public'}),mismatched],decision:'NO_GO'});
  for(const c of cases){const verdict=verifyCommitment(goal(),evidence(c.events),[ref]);assert.equal(verdict.decision,c.decision,c.name);if(c.decision==='GO')assert.deepEqual(verdict.matches,[{actionId:'test',callId:'c',callSeq:11,resultSeq:30}]);else assert.deepEqual(verdict.missing,['test']);}
});
test('structured results distinguish missing and null, nested array values, and fragmented JSON',()=>{
  const check=(value,path,equals)=>verifyCommitment(goal([{...action,kind:'result-equals',path,equals}]),evidence([call(11,'c','run_test',{suite:'public'}),result(12,'c',value)]),[ref]).decision;
  assert.equal(check({},['value'],null),'NO_GO');assert.equal(check({value:null},['value'],null),'GO');
  assert.equal(check({items:[{answer:0}]},['items',0,'answer'],0),'GO');
  assert.equal(check({items:[]},['items',0,'answer'],0),'NO_GO');
  const fragmented=result(12,'c',{});fragmented.data.message.content[0].content=[{type:'text',text:'{"exit'},{type:'text',text:'Code":0}'}];
  const g=goal([{...action,kind:'result-equals',path:['exitCode'],equals:0}]);
  assert.equal(verifyCommitment(g,evidence([call(11,'c','run_test',{suite:'public'}),fragmented]),[ref]).decision,'GO');
  for(const content of [[{type:'text',text:'not JSON'}],[{type:'text',text:'Status: '},{type:'text',text:'{"exitCode":0}'}]]) {
    const invalid=result(12,'c',{});invalid.data.message.content[0].content=content;
    assert.equal(verifyCommitment(g,evidence([call(11,'c','run_test',{suite:'public'}),invalid]),[ref]).decision,'NO_GO');
  }
});
test('argument matching allows extra top-level fields and ignores nested key order, but requires exact nested values',()=>{
  const g=goal([{...action,match:{suite:'public',options:{a:1,b:2}}}]);
  const check=args=>verifyCommitment(g,evidence([call(11,'c','run_test',args),result(12,'c',{})]),[ref]).decision;
  assert.equal(check({suite:'public',options:{b:2,a:1},extra:true}),'GO');
  assert.equal(check({suite:'public',options:{a:1,b:2,c:3}}),'NO_GO');
  assert.equal(check({suite:'public'}),'NO_GO');
});
test('each publication identity field independently prevents old closure',()=>{
  const facts=evidence([call(11,'c','run_test',{suite:'public'}),result(12,'c',{})]);
  for(const change of [{id:'other'},{published_version:3},{publication_event_id:'p3'},{actor:'other'},{data_hash:'b'.repeat(64)}])assert.equal(verifyCommitment(goal(),facts,[{...ref,...change}]).reason,'consensus-version-changed');
});
test('split rejects invalid partitions, reversed completion facts, and stale anchors independently',()=>{
  const a={...action,id:'a',match:{case:'a'}},b={...action,id:'b',match:{case:'b'}};
  const g=goal([a,b]),facts=evidence([call(11,'c','run_test',{case:'a'}),result(12,'c',{})]);
  const proposal={baseVersion:1,reason:'Keep a; defer b',retain:['a'],defer:['b']};
  for(const change of [{retain:['a','a']},{defer:['unknown']},{retain:['b'],defer:['a']}])assert.throws(()=>splitCommitment(g,{...proposal,...change},facts,[ref]),/responsibility loss|actual completed/);
  assert.throws(()=>splitCommitment(g,proposal,{...facts,sessionId:'wrong'},[ref]),/wrong-evidence-anchor/);
  assert.throws(()=>splitCommitment(g,proposal,facts,[{...ref,actor:'changed'}]),/consensus-version-changed/);
});
test('valid split retains completed actions, preventing repeated splitting of stable facts',()=>{
  const actions=['a','b','c'].map(id=>({...action,id,match:{case:id}}));
  const facts=evidence(executions([{id:'a',args:{case:'a'}},{id:'b',args:{case:'b'}}]));
  const first=splitCommitment(goal(actions),{baseVersion:1,reason:'a and b done',retain:['a','b'],defer:['c']},facts,[ref]);
  for(const [retain,defer] of [[['a'],['b']],[['b'],['a']]])assert.throws(()=>splitCommitment(first.commitment,{baseVersion:2,reason:'try again',retain,defer},facts,[ref]),/revision history/);
  assert.equal(first.commitment.versions.length,1);assert.deepEqual(first.commitment.versions[0].versions,[]);
});
test('matching agrees with exhaustive assignment oracle for all 512 three-by-three eligibility graphs',()=>{
  function maximum(edges,index=0,used=new Set()) {
    if(index===edges.length)return 0;
    let best=maximum(edges,index+1,used);
    for(const callIndex of edges[index])if(!used.has(callIndex))best=Math.max(best,1+maximum(edges,index+1,new Set([...used,callIndex])));
    return best;
  }
  for(let mask=0;mask<512;mask++) {
    const actions=[0,1,2].map(i=>({...action,id:`a${i}`,match:{[`key${i}`]:true}}));
    const calls=[0,1,2].map(j=>({id:`c${j}`,args:Object.fromEntries([0,1,2].filter(i=>mask&(1<<(i*3+j))).map(i=>[`key${i}`,true]))}));
    const edges=[0,1,2].map(i=>[0,1,2].filter(j=>mask&(1<<(i*3+j))));
    const expected=maximum(edges);
    for(const declared of permutations(actions)) {
      const verdict=verifyCommitment(goal(declared),evidence(executions(calls)),[ref]);
      assert.equal(verdict.matches.length,expected,`graph ${mask}`);
      assert.equal(verdict.decision,expected===3?'GO':'NO_GO',`graph ${mask}`);
      assert.equal(new Set(verdict.matches.map(m=>m.callId)).size,expected);
      for(const m of verdict.matches)assert(edges[Number(m.actionId.slice(1))].includes(Number(m.callId.slice(1))));
    }
  }
});

test('native source sequence is mandatory and must identify the exact call',()=>{
  const c=call(11,'same','run_test',{suite:'public'});
  for(const sources of [undefined,[],[99],[11,99]]) {
    const r={...result(12,'same',{}),sourceEventSeqs:sources};
    assert.equal(verifyCommitment(goal(),evidence([c,r]),[ref]).decision,'NO_GO');
  }
  const r=result(12,'same',{});
  assert.equal(verifyCommitment(goal(),evidence([c,r]),[ref]).decision,'GO');
});
test('two executions with one textual ID can discharge two actions without borrowing results',()=>{
  const actions=['first','second'].map(id=>({...action,id,match:{suite:'public',case:id},kind:'result-equals',path:['exitCode'],equals:0}));
  const events=[call(11,'reused','run_test',{suite:'public',case:'first'}),result(12,'reused',{exitCode:0}),call(13,'reused','run_test',{suite:'public',case:'second'}),result(14,'reused',{exitCode:0})];
  const verdict=verifyCommitment(goal(actions),evidence(events),[ref]);
  assert.equal(verdict.decision,'GO');assert.deepEqual(verdict.matches.map(m=>m.callSeq),[11,13]);
});
test('ambiguous multiple native outcomes for one execution cannot close a promise',()=>{
  const events=[call(11,'c','run_test',{suite:'public'}),result(12,'c',{exitCode:1}),{...result(13,'c',{exitCode:0}),sourceEventSeqs:[11]}];
  assert.equal(verifyCommitment(goal(),evidence(events),[ref]).decision,'NO_GO');
});
test('split refuses existing or malformed history before copying nested snapshots',()=>{
  const actions=['a','b'].map(id=>({...action,id,match:{case:id}}));
  const facts=evidence(executions([{id:'a',args:{case:'a'}}]));
  for(const versions of [undefined,{},[{}],[{versions:[{versions:[]}]}]]) {
    const g={...goal(actions),versions};
    assert.throws(()=>splitCommitment(g,{baseVersion:1,reason:'a completed',retain:['a'],defer:['b']},facts,[ref]),/revision history/);
  }
  const g={...goal(actions),version:2};
  assert.throws(()=>splitCommitment(g,{baseVersion:2,reason:'unexpected previous revision',retain:['a'],defer:['b']},facts,[ref]),/revision history/);
});
