import assert from 'node:assert/strict';
import test from 'node:test';
import {composeReadiness,serviceNamespace} from '../src/compose-adapter.js';
test('readiness requires the successful migration and every healthy long-lived service',()=>{
 const rows=['database','evidence','evolution'].map(Service=>({Service,State:'running',Health:'healthy'}));
 assert.equal(composeReadiness(JSON.stringify(rows)).ready,false);
 rows.push({Service:'migrate',State:'exited',ExitCode:0});
 assert.equal(composeReadiness(rows.map(row=>JSON.stringify(row)).join('\n')).ready,true);
 rows[0].Health='unhealthy';assert.equal(composeReadiness(JSON.stringify(rows)).ready,false);
 assert.throws(()=>composeReadiness('not JSON'),/CRYSTRA_SERVICES_STATUS_INVALID/);
});
test('every state root has a separate new-brand service and volume namespace',()=>{
 const first=serviceNamespace('/tmp/first');
 assert.match(first.project,/^crystra_services_[0-9a-f]{12}$/);
 assert.match(first.volume,/^crystra-evidence-[0-9a-f]{12}$/);
 assert.notDeepEqual(first,serviceNamespace('/tmp/second'));
 assert.deepEqual(first,serviceNamespace('/tmp/first'));
});
import {mkdtemp,mkdir,realpath,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createComposeAdapter} from '../src/compose-adapter.js';
test('compose adapter bounds commands to its prepared bundle and never deletes volumes on stop',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-compose-'));
 try {
  const bundle=path.join(root,'managed','bundle');await mkdir(bundle,{recursive:true});
  await writeFile(path.join(bundle,'crystra-compose'),'fixture');
  const calls=[];
  const awaitRoot=await realpath(root);
  const adapter=createComposeAdapter({stateRoot:root,ports:{evidence:24318,evolution:28000},descriptor:{sha256:'a'.repeat(64)},
   prepareBundle:async()=>bundle,
   run:async(command,args,options)=>{calls.push({command,args,options});return {stdout:args[0]==='status'?JSON.stringify(['database','evidence','evolution'].map(Service=>({Service,State:'running',Health:'healthy'})).concat([{Service:'migrate',State:'exited',ExitCode:0}])):'',stderr:''};},
   fetchImpl:async(url)=>new Response(url.includes('24318')?'{"status":"ok"}':'ok'),
  });
  await adapter.preflight();
  assert.ok(calls.some(call=>call.args.includes(`label=com.docker.compose.project=${serviceNamespace(awaitRoot).project}`)));
  await adapter.prepare();await adapter.start();
  assert.equal((await adapter.inspect()).ready,true);
  await adapter.stop();
  const canonicalBundle=await realpath(bundle);
  assert.ok(calls.some(call=>call.command===path.join(canonicalBundle,'crystra-compose')&&call.args.join(' ')==='stop'));
  assert.equal(calls.some(call=>call.args.includes('--volumes')||call.args.includes('-v')),false);
  assert.equal(calls.find(call=>call.args[0]==='start').options.env.CRYSTRA_EVIDENCE_PORT,'24318');
 }finally{await rm(root,{recursive:true,force:true});}
});
