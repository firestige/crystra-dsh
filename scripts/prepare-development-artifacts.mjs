#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,mkdir,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'.crystra-inputs');
const {inputs}=JSON.parse(await readFile(resolve(root,'config/development-inputs.json'),'utf8'));
function run(command,args,cwd,env=process.env) {
 const result=spawnSync(command,args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:16*1024*1024});
 if(result.error||result.status!==0)throw new Error(`DEVELOPMENT_BUILD_FAILED: ${command} ${args.join(' ')} ${result.error?.message??''}`);
 return result.stdout.trim();
}
await mkdir(output,{recursive:true});
for(const [id,input] of Object.entries(inputs)) {
 const source=resolve(output,'sources',id);
 if(run('git',['rev-parse','HEAD'],source)!==input.revision)throw new Error(`DEVELOPMENT_SOURCE_REVISION: ${id}`);
 if(run('git',['diff','--name-only','HEAD'],source))throw new Error(`DEVELOPMENT_SOURCE_DIRTY: ${id}`);
 if(id==='execution') {
  run('pnpm',['install','--frozen-lockfile','--ignore-scripts'],source);
  run('pnpm',['build'],source);
  // npm consumers execute declared bins; normalize fresh tsc output before hashing.
  const manifest=JSON.parse(await readFile(resolve(source,'package.json'),'utf8'));
  const bins=typeof manifest.bin==='string'?[manifest.bin]:Object.values(manifest.bin??{});
  for(const bin of bins)await chmod(resolve(source,bin),0o755);
  run('npm',['pack','--silent','--pack-destination',output],source,{...process.env,CRYSTRA_RELEASE_PACK_MODE:'verified-builder'});
 } else if(id==='ui') {
  run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
  run('npm',['run','build'],source);
  run('npm',['pack','--silent','--workspace','crystra-ui-core','--pack-destination',output],source);
 } else throw new Error(`DEVELOPMENT_INPUT_UNKNOWN: ${id}`);
 const digest=createHash('sha256').update(await readFile(resolve(output,input.artifact))).digest('hex');
 if(digest!==input.sha256)throw new Error(`DEVELOPMENT_ARTIFACT_DIGEST: ${id}; expected ${input.sha256}; actual ${digest}`);
 console.log(`PASS ${id} ${input.revision} ${digest}`);
}
