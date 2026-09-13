import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const builder=new URL('../services/build-bundle.py',import.meta.url).pathname;
const input=()=>({schemaVersion:'crystra.compose-release@1.0.0',version:'0.1.0',supportedPlatforms:['linux/amd64','linux/arm64'],schemaCompatibility:{evidenceRevision:'1',reads:['1']},hostIntegration:{schemaVersion:'crystra.loopback-host@1.0.0',evidenceQueryRevision:'0.1.0',evidenceTaskQueryRevision:'1.0.0',evolutionComputeRevision:'1'},images:Object.fromEntries(['postgres','evidence','evolution'].map(name=>[name,{coordinate:`example/${name}:0.1.0@sha256:${'a'.repeat(64)}`,source:'https://example.invalid/source',provenance:'https://example.invalid/provenance'}]))});
for(const mutable of [true,false])test(`service builder ${mutable?'rejects mutable images':'preserves new namespaces and excludes purge/old-brand entry points'}`,async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-builder-'));
 try{
  const manifest=input();if(mutable)manifest.images.evidence.coordinate='example/evidence:latest';
  const source=path.join(root,'input.json');await writeFile(source,JSON.stringify(manifest));
  const output=path.join(root,'output');const result=spawnSync('python3',[builder,source,output],{encoding:'utf8'});
  if(mutable){assert.notEqual(result.status,0);assert.match(result.stderr,/immutable sha256/);}
  else {assert.equal(result.status,0,result.stderr);const launcher=await readFile(path.join(output,'crystra-compose'),'utf8');assert.doesNotMatch(launcher,/WSR|wsr|purge\)|upgrade \| rollback/);assert.match(launcher,/CRYSTRA_EVIDENCE_VOLUME/);assert.match(await readFile(path.join(output,'compose.yaml'),'utf8'),/crystra_evidence/);}
 }finally{await rm(root,{recursive:true,force:true});}
});
