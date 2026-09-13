#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {candidateArchive} from './lib/qualification-artifacts.mjs';
import {sha256} from './lib/qualification-receipts.mjs';
const root=resolve(import.meta.dirname,'..');
const directory=resolve(process.argv[2]??'artifacts/candidate');
try {
 const {metadata,metadataBytes}=await candidateArchive(directory);
 const evidence=resolve(directory,'qualification-evidence');
 await mkdir(evidence); // An old receipt set must never survive a retry.
 const jobs=[
  {gates:['remoteArtifacts'],script:'verify-candidate-inputs.mjs'},
  {gates:['cleanProfile'],script:'qualify-clean-profile.mjs'},
  {gates:['lifecycle'],script:'qualify-lifecycle.mjs'},
  {gates:['providerRouting'],script:'qualify-provider-routing.mjs'},
  {gates:['realHarness','loopbackOutage'],script:'qualify-real-harness.mjs'},
 ];
 for(const job of jobs){
  const command=['node',`scripts/${job.script}`];
  const result=spawnSync(process.execPath,[resolve(root,'scripts',job.script)],{cwd:root,env:{...process.env,CRYSTRA_QUALIFICATION_DIRECTORY:directory},encoding:'utf8',maxBuffer:32*1024*1024,timeout:600000});
  const log=Buffer.from(`${result.stdout??''}\n${result.stderr??''}\n${result.error?.message??''}`);
  for(const gate of job.gates)await writeFile(resolve(evidence,`${gate}.log`),log,{flag:'wx'});
  if(result.error||result.status!==0)throw new Error(`QUALIFICATION_GATE_FAILED: ${job.gates.join(',')}; see ${evidence}`);
  const current=await candidateArchive(directory);
  if(!current.metadataBytes.equals(metadataBytes))throw new Error('QUALIFICATION_METADATA_CHANGED');
  for(const gate of job.gates){
   const receipt={schemaVersion:'crystra.dsh.gate-receipt@1.0.0',gate,status:'PASS',exitCode:0,commit:metadata.commit,candidateTag:metadata.candidateTag,artifactMetadataSha256:sha256(metadataBytes),command,log:`${gate}.log`,logSha256:sha256(log)};
   await writeFile(resolve(evidence,`${gate}.receipt.json`),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  }
  console.log(`PASS ${job.gates.join(',')}`);
 }
 const writer=spawnSync(process.execPath,[resolve(root,'scripts/write-release-qualification.mjs'),directory],{stdio:'inherit'});
 if(writer.status!==0)throw new Error('QUALIFICATION_ASSEMBLY_FAILED');
} catch(error){console.error(error.message);process.exitCode=1;}
