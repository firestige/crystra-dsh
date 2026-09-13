import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateRepository} from './foundation-policy.mjs';

export const repository=resolve(import.meta.dirname,'../..');
export function dsh(args, env) {
  const binary=env.CRYSTRA_DSH_BINARY ?? 'dsh';
  const result=spawnSync(binary,args,{env,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.error || result.status!==0) throw new Error(`DSH command failed: ${args.join(' ')}\n${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
export async function prepareProfile(home) {
  await validateRepository(repository);
  const env={...process.env,DSH_HOME:home};
  if(dsh(['--version'],env).trim()!=='0.1.1-rc.2') throw new Error('DSH_VERSION_MISMATCH: use the pinned binary via CRYSTRA_DSH_BINARY');
  const inputs=JSON.parse(await readFile(resolve(repository,'config/development-inputs.json'),'utf8')).inputs;
  const overrides=Object.fromEntries(Object.values(inputs).map(input=>[input.package,`file:${resolve(repository,'.crystra-inputs',input.artifact)}`]));
  dsh(['plugin','--profile','web','config','set','--location=project','--json','overrides',JSON.stringify(overrides)],env);
  dsh(['plugin','--profile','web','config','set','--location=project','--json','allowBuilds',JSON.stringify({'better-sqlite3':true})],env);
  return env;
}
export async function assertSinglePlugin(home,env) {
  const manifest=JSON.parse(await readFile(resolve(home,'profiles/web/package.json'),'utf8'));
  const plugins=manifest.dsh.profile.bundles.filter(name=>name.startsWith('dsh-crystra')||name.startsWith('dsh-wsr'));
  if(JSON.stringify(plugins)!==JSON.stringify(['dsh-crystra'])) throw new Error(`PLUGIN_LAYER_SET_INVALID: ${JSON.stringify(plugins)}`);
  const dump=dsh(['--profile','web','--dump-config'],env);
  if([...dump.matchAll(/\bid:\s*['"]?crystra['"]?\s*$/gmu)].length!==1) throw new Error('CRYSTRA_ACTIVATION_COUNT_INVALID');
  if(/name:\s*['"]?dsh-(?:wsr|crystra-)/u.test(dump)) throw new Error('LEGACY_PLUGIN_ACTIVATION');
  return manifest;
}
