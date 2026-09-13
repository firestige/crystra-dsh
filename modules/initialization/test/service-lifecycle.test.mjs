import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createServiceLifecycle} from '../src/service-lifecycle.js';
const descriptor={schemaVersion:'crystra.services@1.0.0',sha256:'a'.repeat(64)};
async function fixture(run) {
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-services-'));
 try{await run(root);}finally{await rm(root,{recursive:true,force:true});}
}
function adapter(overrides={}) {
 return {preflight:async()=>{},prepare:async()=>{},start:async()=>{},stop:async()=>{},inspect:async()=>({ready:true}),...overrides};
}
test('setup writes applied identity only after actual service readiness, and doctor rechecks it',async()=>fixture(async(root)=>{
 let healthy=true;
 const lifecycle=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter({inspect:async()=>({ready:healthy})})});
 assert.equal((await lifecycle.setup()).status,'READY');
 const applied=JSON.parse(await readFile(path.join(root,'services-applied.json'),'utf8'));
 assert.equal(applied.descriptorSha256,descriptor.sha256);
 healthy=false;
 assert.equal((await lifecycle.doctor()).status,'DEGRADED');
}));
test('failed preparation records a bounded code, no applied identity, and permits retry',async()=>fixture(async(root)=>{
 let fail=true;
 const lifecycle=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter({prepare:async()=>{if(fail)throw new Error('password=do-not-record');}})});
 assert.deepEqual(await lifecycle.setup(),{status:'FAILED',code:'CRYSTRA_SERVICES_FAILED',retry:'setup'});
 await assert.rejects(readFile(path.join(root,'services-applied.json')), {code:'ENOENT'});
 assert.doesNotMatch(await readFile(path.join(root,'services-status.json'),'utf8'),/do-not-record/);
 fail=false;
 assert.equal((await lifecycle.setup()).status,'READY');
}));
test('a shared root serializes setup across instances without changing the requested descriptor',async()=>fixture(async(root)=>{
 let release,entered;
 const wait=new Promise(resolve=>{release=resolve;});
 const started=new Promise(resolve=>{entered=resolve;});
 const first=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter({prepare:async()=>{entered();await wait;}})});
 const second=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter()});
 const pending=first.setup();await started;
 assert.equal((await second.setup()).code,'CRYSTRA_SERVICES_BUSY');
 release();assert.equal((await pending).status,'READY');
}));
test('different service identity is rejected without implicit migration, and dispose does not stop services',async()=>fixture(async(root)=>{
 let stops=0;
 const first=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter({stop:async()=>{stops++;}})});
 await first.setup();await first.dispose();assert.equal(stops,0);
 const second=createServiceLifecycle({stateRoot:root,descriptor:{...descriptor,sha256:'b'.repeat(64)},adapter:adapter()});
 assert.equal((await second.setup()).code,'CRYSTRA_SERVICE_IDENTITY_MISMATCH');
 assert.equal((await first.stop()).status,'STOPPED');assert.equal(stops,1);
 assert.equal(JSON.parse(await readFile(path.join(root,'services-applied.json'),'utf8')).descriptorSha256,descriptor.sha256);
}));
test('an unrelated healthy endpoint cannot make an unprepared installation ready',async()=>fixture(async(root)=>{
 const lifecycle=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter()});
 assert.equal((await lifecycle.doctor()).status,'NEEDS_CONFIGURATION');
}));
test('cancelled setup does not start services or write applied state',async()=>fixture(async(root)=>{
 const controller=new AbortController();let starts=0;
 const lifecycle=createServiceLifecycle({stateRoot:root,descriptor,adapter:adapter({prepare:async()=>controller.abort(),start:async()=>{starts++;}})});
 assert.equal((await lifecycle.setup({signal:controller.signal})).status,'FAILED');
 assert.equal(starts,0);
 await assert.rejects(readFile(path.join(root,'services-applied.json')),{code:'ENOENT'});
}));
