import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {verifyPublishedInputs} from '../scripts/lib/published-inputs.mjs';

test('release input verification rejects old coordinates, altered bytes and absent service binding',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-published-inputs-'));
 const bytes=Buffer.from('component fixture');
 const input={repository:'firestige/crystra-execution',package:'crystra-execution',version:'0.1.0',artifact:'crystra-execution-0.1.0.tgz',sha256:createHash('sha256').update(bytes).digest('hex')};
 const coordinate='https://github.com/firestige/crystra-execution/releases/download/crystra-execution-v0.1.0-rc.1/crystra-execution-0.1.0.tgz';
 const manifest=url=>JSON.stringify({dependencies:{'crystra-execution':url}});
 try {
  await mkdir(join(root,'config'));
  await writeFile(join(root,'config/development-inputs.json'),JSON.stringify({inputs:{execution:input}}));
  await writeFile(join(root,'package.json'),manifest(coordinate.replace('/crystra-execution/','/wsr-execution/')));
  await assert.rejects(verifyPublishedInputs(root,{fetchImpl:()=>{throw new Error('unexpected network')}}),/COORDINATE_INVALID/);
  await writeFile(join(root,'package.json'),manifest(coordinate));
  await assert.rejects(verifyPublishedInputs(root,{fetchImpl:async()=>new Response('swapped')}),/DIGEST_MISMATCH/);
  await assert.rejects(verifyPublishedInputs(root,{fetchImpl:async()=>new Response(bytes)}),/SERVICE_DESCRIPTOR_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
