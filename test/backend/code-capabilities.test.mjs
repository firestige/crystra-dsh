import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createCodeCapabilities} from '../../src/backend/code-capabilities.js';
import {candidate} from '../fixtures/code-candidate.mjs';
test('real code runs from the registered snapshot, survives a new service and records actual processes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-'));try{
  const registry=createCodeCapabilities({root,python:'/usr/bin/python3'}),entry=await registry.register(candidate()),cap=await registry.resolve(entry.reference);
  assert.equal(await cap.guard({x:3},{}),true);assert.equal(await cap.guard({x:-1},{}),false);const info={mode:'shadow',context:{v:1}};
  assert.equal(await cap.run({x:3},info),6);assert.equal(await cap.check(6,{input:{x:3},context:{}}),true);assert.equal(await cap.check(9,{input:{x:3},context:{}}),false);
  const receipt=await registry.readReceipt(info.receipt.id);assert.equal(receipt.stages.execute.exitCode,0);assert(receipt.stages.execute.elapsedMs>=0);
  await writeFile(join(root,'execute.py'),"raise RuntimeError('draft changed')");const restored=createCodeCapabilities({root,python:'/usr/bin/python3'});assert.equal(await(await restored.resolve(entry.reference)).run({x:4},{mode:'live',context:{}}),8);
 }finally{await rm(root,{recursive:true,force:true});}
});
for(const [name,source] of [['exit',"raise RuntimeError('boom')"],['missing','pass'],['invalid',"import sys\nopen(sys.argv[2],'w').write('not json')"],['check',"import sys,json\njson.dump(999,open(sys.argv[2],'w'))"],['timeout','import time\ntime.sleep(3)']])test(`actual candidate rejects ${name}`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-fail-'));try{const r=createCodeCapabilities({root,python:'/usr/bin/python3',timeoutMs:name==='timeout'?150:2000}),e=await r.register(candidate(source)),c=await r.resolve(e.reference);await assert.rejects(c.run({x:1},{mode:'shadow',context:{}}),/execution|output|check|timeout/i);}finally{await rm(root,{recursive:true,force:true});}
});
test('snapshot modification and broken validation never resolve as executable candidates',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-change-'));try{const r=createCodeCapabilities({root,python:'/usr/bin/python3'}),e=await r.register(candidate());await writeFile(join(root,e.snapshot,'execute.py'),'pass');await assert.rejects(r.resolve(e.reference),/changed|hash/i);
 const p=candidate();p.files['validate.py']="raise RuntimeError('invalid candidate')";const bad=await r.register(p);assert.equal(bad.active,false);await assert.rejects(r.resolve(bad.reference),/inactive/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('shadow execution cannot write outside its workspace or modify registered assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-write-')),outside=join(root,'sentinel');try{await writeFile(outside,'unchanged');const r=createCodeCapabilities({root,python:'/usr/bin/python3'}),e=await r.register(candidate(`open(${JSON.stringify(outside)},'w').write('changed')`)),c=await r.resolve(e.reference);await assert.rejects(c.run({x:1},{mode:'shadow',context:{}}));assert.equal(await readFile(outside,'utf8'),'unchanged');}finally{await rm(root,{recursive:true,force:true});}
});
test('material changed after resolution is rejected before invoking a different stage',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-manifest-'));try{
  const r=createCodeCapabilities({root,python:'/usr/bin/python3'}),p=candidate();p.files['other.py']="import json,sys\njson.dump(999,open(sys.argv[2],'w'))";
  const e=await r.register(p),cap=await r.resolve(e.reference),path=join(root,'.managed/index.json'),index=JSON.parse(await readFile(path,'utf8'));index.double[0].execute=['other.py'];await writeFile(path,JSON.stringify(index));
  await assert.rejects(cap.run({x:1},{mode:'shadow',context:{}}),/changed candidate material/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('oversized actual output and escaping source paths are rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-code-limits-'));try{
  const r=createCodeCapabilities({root,python:'/usr/bin/python3'}),p=candidate("import json,sys\njson.dump('x'*300000,open(sys.argv[2],'w'))");p.files['check.py']='print("true")';const e=await r.register(p),cap=await r.resolve(e.reference);
  await assert.rejects(cap.run({x:1},{mode:'shadow',context:{}}),/output.*size limit/);
  const bad=candidate();bad.files['../escape.py']='pass';await assert.rejects(r.register(bad),/invalid source|workspace/);
 }finally{await rm(root,{recursive:true,force:true});}
});
