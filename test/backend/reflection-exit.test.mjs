import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The server lives in the parent: it cannot keep the worker's event loop alive.
async function run(cleanup) {
  const root=await mkdtemp(join(tmpdir(),'crystra-reflection-exit-'));
  const server=createServer();const ws=new WebSocketServer({server});let requests=0,connections=0;const connectionRequests=[];
  ws.on('connection',socket=>{const connection=connections++;connectionRequests.push(0);socket.on('message',()=>{
    requests++;const sequence=++connectionRequests[connection];
    if(cleanup==='timeout'&&sequence===2)return;
    if(cleanup==='failed'&&sequence===2) {
      socket.send(JSON.stringify({type:'response.created',response:{id:'fixture_failure'}}));
      socket.send(JSON.stringify({type:'response.failed',response:{id:'fixture_failure',status:'failed',error:{code:'invalid_request',message:'Explicit localhost fixture model failure'}}}));
      return;
    }
    const report={summary:'Source inspected; no regression or benchmark was supplied.',assessments:{correctness:'Source only; no independent execution proof.',robustness:'Unverified.',performance:'Unmeasured.'},findings:[]};
    const item=cleanup==='isolation'&&connection===0?{type:'message',id:`other_${sequence}`,role:'assistant',content:[{type:'output_text',text:'Other session remains available.'}]}:sequence===1?{type:'function_call',id:'fc_read',call_id:'read',name:'crystra_reflection_read',arguments:JSON.stringify({file:'core.mjs'})}:sequence===2?{type:'function_call',id:'fc_report',call_id:'report',name:'crystra_reflection_report',arguments:JSON.stringify(report)}:{type:'message',id:'msg_end',role:'assistant',content:[{type:'output_text',text:'Done.'}]};
    const response={id:`response_${requests}`,status:'completed',output:[item],usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
    for(const event of [{type:'response.created',response:{id:response.id}},{type:'response.output_item.added',output_index:0,item},{type:'response.output_item.done',output_index:0,item},{type:'response.completed',response}])socket.send(JSON.stringify(event));
  });});
  let child,watchdog;
  try {
    await writeFile(join(root,'core.mjs'),'export const answer=42;\n');
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    child=spawn(process.execPath,[new URL('../fixtures/reflection-exit-worker.mjs',import.meta.url).pathname,root,`http://127.0.0.1:${server.address().port}`,cleanup],{stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_TEST_CONTEXT:undefined}});
    let stdout='',stderr='',killed=false;
    child.stdout.on('data',data=>{stdout+=data;if(stdout.includes('"checkpoint":"disposed"')&&!watchdog)watchdog=setTimeout(()=>{killed=true;child.kill('SIGKILL');},1000);});
    child.stderr.on('data',data=>{stderr+=data;});
    const safety=setTimeout(()=>{killed=true;child.kill('SIGKILL');},12000);
    const [code,signal]=await new Promise(resolve=>child.on('exit',(code,signal)=>resolve([code,signal])));
    clearTimeout(safety);clearTimeout(watchdog);
    return {code,signal,killed,stdout,stderr,requests,connections,connectionRequests};
  } finally {
    clearTimeout(watchdog);child?.kill('SIGKILL');for(const socket of ws.clients)socket.terminate();await new Promise(resolve=>ws.close(resolve));await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});
  }
}
test('native pi-ai reflection naturally exits after report and DSH disposal',{timeout:15000},async()=>{
  const result=await run('plugin');
  assert.match(result.stdout,/"status":"completed"/,JSON.stringify(result));
  assert.equal(result.requests,3,JSON.stringify(result));
  assert.equal(result.connections,1,'Codex transport reused its session socket');
  assert.equal(result.killed,false,`Report completed and host disposed, but resources remained: ${JSON.stringify(result)}`);
  assert.equal(result.code,0,result.stderr);
});
test('session-scoped provider cleanup releases the cached transport and naturally exits',{timeout:15000},async()=>{
  const result=await run('explicit');
  assert.match(result.stdout,/"status":"completed"/,JSON.stringify(result));
  assert.equal(result.requests,3,JSON.stringify(result));
  assert.equal(result.killed,false,JSON.stringify(result));
  assert.equal(result.code,0,result.stderr);
});

test('disposing reflection preserves another live DSH session and its reusable pi-ai socket',{timeout:15000},async()=>{
  const result=await run('isolation');
  assert.match(result.stdout,/"status":"completed"/,JSON.stringify(result));
  assert.match(result.stdout,/"checkpoint":"other-session","turns":\["completed","completed"\]/,JSON.stringify(result));
  assert.equal(result.connections,2,'Disposing reflection must not force the other session to reconnect');
  assert.deepEqual(result.connectionRequests,[2,3],'Other session reused its original socket after reflection was disposed');
  assert.equal(result.killed,false,JSON.stringify(result));
  assert.equal(result.code,0,result.stderr);
});

for(const [mode,status] of [['failed','failed'],['timeout','timed_out']])test(`pi-ai reflection ${status} ends with a recorded outcome and naturally exits`,{timeout:15000},async()=>{
  const result=await run(mode);
  const record=result.stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(record=>record.checkpoint==='report');
  assert.equal(record?.status,status,JSON.stringify(result));
  assert.deepEqual(record.reads,['core.mjs'],'The source read completed before the simulated failure or stall');
  assert.equal(result.requests,2,JSON.stringify(result));
  assert.equal(result.connections,1,JSON.stringify(result));
  assert.equal(result.killed,false,'Expected lifecycle cleanup, never watchdog termination');
  assert.equal(result.signal,null,JSON.stringify(result));
  assert.equal(result.code,1,'Unsuccessful reflection preserves the script failure exit code');
  if(mode==='failed')assert.match(JSON.stringify(record.end),/Explicit localhost fixture model failure/);
});
