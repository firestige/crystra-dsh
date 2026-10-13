import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileCommitment, verifyCommitment, splitCommitment } from '../../src/backend/barrier.js';

const out = new URL('../../artifacts/backend-rebuild/payload-split-fix/split/', import.meta.url);
mkdirSync(out, {recursive:true});
const anchor = {sessionId:'split-spike',stepId:'split-step',seq:10};
const action = (id, match={suite:'public'}) => ({id,kind:'tool-completed',tool:'run_test',match});
const compile = actions => compileCommitment({label:'Observe allocation',actions},anchor,[]);
const evidence = specs => ({sessionId:anchor.sessionId,seq:30,events:specs.flatMap((spec,i)=>{
  const seq=11+2*i, id=spec.id??`call-${i}`;
  return [{seq,type:'tool/call',data:{callId:id,name:'run_test',arguments:JSON.stringify(spec.args)}},
    {seq:seq+1,type:'tool/result',sourceEventSeqs:[seq],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,isError:false,content:[{type:'text',text:'{}'}]}]}}}];
})});
const proposal = (retain,defer) => ({baseVersion:1,retain,defer,reason:'Preserve completed work and carry the remaining exact responsibility.'});
const stable = value => JSON.stringify(value);
const permutations = xs => xs.length ? xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest])) : [[]];
function observe(goal,facts,p) {
  const before=stable({goal,facts,p});
  const verdict=verifyCommitment(goal,facts,[]);
  let split, error;
  try { split=splitCommitment(goal,p,facts,[]); } catch(e) {error={name:e.name,message:e.message};}
  assert.equal(stable({goal,facts,p}),before,'verification/split must not mutate source state');
  if(split) {
    assert.equal(split.commitment.version,2);
    assert.deepEqual(split.commitment.versions,[goal]);
    assert.deepEqual(split.commitment.revision.anchor,{sessionId:facts.sessionId,seq:facts.seq});
    assert.deepEqual(split.commitment.revision.basis.map(m=>m.actionId).sort(),[...p.retain].sort());
    assert.equal(new Set(split.commitment.revision.basis.map(m=>m.callSeq)).size,p.retain.length);
    for(const m of split.commitment.revision.basis){
      const a=goal.actions.find(a=>a.id===m.actionId),c=facts.events.find(e=>e.seq===m.callSeq),r=facts.events.find(e=>e.seq===m.resultSeq);
      assert.equal(c.data.name,a.tool);for(const [key,value]of Object.entries(a.match))assert.deepEqual(JSON.parse(c.data.arguments)[key],value);
      assert.deepEqual(r.sourceEventSeqs,[c.seq]);assert.equal(r.data.message.source.callId,c.data.callId);
    }
    const kept=split.commitment.actions, pending=split.pending.map(item=>item.action);
    assert.equal(new Set([...kept,...pending].map(a=>a.id)).size,goal.actions.length);
    for(const original of goal.actions) assert.deepEqual([...kept,...pending].find(a=>a.id===original.id),original);
    for(const item of split.pending) {
      assert.equal(item.originStepId,goal.id);assert.equal(item.originVersion,1);
      assert.equal(item.id,`${goal.id}:v1:${item.action.id}`);
    }
    assert.equal(verifyCommitment(split.commitment,facts,[]).decision,'GO');
  }
  return {verdict,accepted:!!split,split,error};
}
// Independent exhaustive partial-assignment oracle. No production matcher or
// split is consulted: each edge maps an action index to a real execution index.
function enumerate(edges, executionCount) {
  const assignments=[];
  function visit(i,used,current) {
    if(i===edges.length){assignments.push([...current]);return;}
    current.push(-1);visit(i+1,used,current);current.pop();
    for(let j=0;j<executionCount;j++)if(edges[i][j]&&!used.has(j)){
      used.add(j);current.push(j);visit(i+1,used,current);current.pop();used.delete(j);
    }
  }
  visit(0,new Set(),[]);
  const max=Math.max(...assignments.map(a=>a.filter(j=>j>=0).length));
  return {max,maximumAssignments:assignments.filter(a=>a.filter(j=>j>=0).length===max)};
}
const save=(name,value)=>writeFileSync(new URL(name,out),JSON.stringify(value,null,2)+'\n');
save('environment.json',{node:process.version,platform:process.platform,arch:process.arch,sourceSha256:createHash('sha256').update(readFileSync(new URL('../../src/backend/barrier.js',import.meta.url))).digest('hex'),inputOrigin:'Synthetic native-shaped events; no claim about model proposal frequency or upstream persistence.'});

test('four-cell equivalent-action split matrix with twenty deterministic repeats',()=>{
  const rows=[];
  for(const ids of [['A','B'],['B','A']])for(const retained of ['A','B']){
    const goal=compile(ids.map(id=>action(id))),facts=evidence([{args:{suite:'public'}}]),p=proposal([retained],ids.filter(id=>id!==retained));
    const actual=observe(goal,facts,p);
    for(let repeat=1;repeat<20;repeat++)assert.deepEqual(observe(goal,facts,p),actual);
    assert.equal(actual.accepted,true);
    rows.push({declaration:ids,input:{goal,facts,proposal:p},actual,proposalConstrainedOracle:{max:1,retainFeasible:true}});
  }
  save('matrix.json',rows);
});

test('non-equivalent and fully-completed controls retain responsibility and execution identity',()=>{
  const rows=[];
  const cases=[
    {name:'different-parameters-only-A',actions:[action('A',{suite:'A'}),action('B',{suite:'B'})],specs:[{args:{suite:'A'}}],acceptRetainA:true,acceptRetainB:false},
    {name:'two-independent-executions',actions:[action('A'),action('B')],specs:[{args:{suite:'public'}},{args:{suite:'public'}}],acceptRetainA:false,acceptRetainB:false},
    {name:'two-executions-reuse-text-ID',actions:[action('A'),action('B')],specs:[{id:'same-id',args:{suite:'public'}},{id:'same-id',args:{suite:'public'}}],acceptRetainA:false,acceptRetainB:false},
  ];
  for(const c of cases)for(const actions of permutations(c.actions))for(const retained of ['A','B']){
    const goal=compile(actions),facts=evidence(c.specs),p=proposal([retained],actions.map(a=>a.id).filter(id=>id!==retained));
    const actual=observe(goal,facts,p);
    assert.equal(actual.accepted,c[`acceptRetain${retained}`]);
    assert.equal(new Set(actual.verdict.matches.map(m=>m.callSeq)).size,actual.verdict.matches.length);
    rows.push({name:c.name,input:{goal,facts,proposal:p},actual});
  }
  save('controls.json',rows);
});

test('all three-action two-execution graphs require proposal feasibility within maximum assignments',()=>{
  const rows=[];let accepted=0,alternativeFeasibleRejected=0,unsafeAccepted=0;
  for(let mask=0;mask<64;mask++){
    const edges=Array.from({length:3},(_,i)=>Array.from({length:2},(_,j)=>!!(mask&(1<<(i*2+j)))));
    const oracle=enumerate(edges,2);
    const specs=Array.from({length:2},(_,j)=>({args:Object.fromEntries(['A','B','C'].filter((_,i)=>edges[i][j]).map(id=>[id,true]))}));
    for(const ids of permutations(['A','B','C']))for(let retainMask=1;retainMask<7;retainMask++){
      const retain=['A','B','C'].filter((_,i)=>retainMask&(1<<i)),defer=['A','B','C'].filter(id=>!retain.includes(id));
      const goal=compile(ids.map(id=>action(id,{[id]:true}))),facts=evidence(specs),p=proposal(retain,defer);
      const actual=observe(goal,facts,p);
      assert.equal(actual.verdict.matches.length,oracle.max);
      for(const witness of actual.verdict.matches){
        const actionIndex=['A','B','C'].indexOf(witness.actionId),executionIndex=(witness.callSeq-11)/2;
        assert.ok(Number.isInteger(executionIndex)&&executionIndex>=0&&executionIndex<2);
        assert.equal(edges[actionIndex][executionIndex],true);
        assert.equal(witness.resultSeq,witness.callSeq+1);
      }
      assert.equal(new Set(actual.verdict.matches.map(m=>m.callSeq)).size,oracle.max);
      const feasible=oracle.maximumAssignments.some(a=>['A','B','C'].every((id,i)=>retain.includes(id)===(a[i]>=0)));
      assert.equal(actual.accepted,feasible);
      if(actual.accepted){accepted++;if(!feasible)unsafeAccepted++;assert.equal(feasible,true);}
      if(!actual.accepted&&feasible)alternativeFeasibleRejected++;
      rows.push({mask,declaration:ids,retain,defer,oracle:{max:oracle.max,proposalFeasible:feasible},actual});
    }
  }
  assert.equal(unsafeAccepted,0);assert.equal(alternativeFeasibleRejected,0);
  save('enumeration.json',{summary:{graphs:64,orders:6,partitions:6,total:rows.length,accepted,alternativeFeasibleRejected,unsafeAccepted},inputs:{actions:['A','B','C'],tool:'run_test',edgeEncoding:'bit actionIndex*2+executionIndex; action matches own true flag',anchor},rows});
});
