import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {readQualificationReceipts,sha256} from '../scripts/lib/qualification-receipts.mjs';
import {releaseGateNames} from '../scripts/lib/release-policy.mjs';

test('execution receipts bind every gate, candidate metadata and retained log bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-receipts-'));
 const metadata=Buffer.from(JSON.stringify({commit:'a'.repeat(40),candidateTag:'crystra-dsh-v0.1.0-rc.1'}));
 const log=Buffer.from('real process output\n');
 const receipts={};
 try {
  for(const gate of releaseGateNames){
   const receipt={schemaVersion:'crystra.dsh.gate-receipt@1.0.0',gate,status:'PASS',exitCode:0,commit:'a'.repeat(40),candidateTag:'crystra-dsh-v0.1.0-rc.1',artifactMetadataSha256:sha256(metadata),command:['node','qualification.mjs'],log:`${gate}.log`,logSha256:sha256(log)};
   receipts[gate]=receipt;
   await writeFile(join(dir,receipt.log),log);
   await writeFile(join(dir,`${gate}.receipt.json`),JSON.stringify(receipt));
  }
  assert.equal(Object.keys(await readQualificationReceipts(dir,metadata)).length,releaseGateNames.length);
  await assert.rejects(readQualificationReceipts(dir,Buffer.from(metadata.toString().replace('rc.1','rc.2'))),/RECEIPT_INVALID/);
  await writeFile(join(dir,'cleanProfile.log'),'substituted');
  await assert.rejects(readQualificationReceipts(dir,metadata),/LOG_DIGEST_MISMATCH/);
  await writeFile(join(dir,'cleanProfile.log'),log);
  await writeFile(join(dir,'cleanProfile.receipt.json'),JSON.stringify({...receipts.cleanProfile,exitCode:1}));
  await assert.rejects(readQualificationReceipts(dir,metadata),/RECEIPT_INVALID/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
