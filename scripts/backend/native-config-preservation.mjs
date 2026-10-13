import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
export async function verifyPreservation({home,output,run,tarball}){
 const actual=join(homedir(),'.dsh');
 const paths=['settings.yaml','profiles/web/package.json','profiles/web/cordis.patch.yml'];
 const before=await Promise.all(paths.map(p=>readFile(join(actual,p))));
 const isolated=join(home,'profiles','preserve-web');await mkdir(isolated,{recursive:true});
 const pkg=JSON.parse(before[1]);await writeFile(join(isolated,'package.json'),JSON.stringify(pkg,null,2));await writeFile(join(isolated,'cordis.patch.yml'),before[2]);await writeFile(join(home,'settings.yaml'),before[0]);
 const installed=await run('preserve-web-install',['dsh','plugin','--profile','preserve-web','add','dsh-crystra@file:'+tarball,'--ignore-scripts'],{timeout:60000});assert.equal(installed.code,0,installed.stderr);
 assert.deepEqual(await readFile(join(home,'settings.yaml')),before[0]);assert.deepEqual(await readFile(join(isolated,'cordis.patch.yml')),before[2]);
 const after=JSON.parse(await readFile(join(isolated,'package.json'),'utf8'));assert.deepEqual(after.dsh.profile,pkg.dsh.profile);
 const dump=await run('preserve-web-composed',['dsh','--profile','preserve-web','--dump-config']);assert.equal(dump.code,0);assert.match(dump.stdout,/192\.168\.50\.175:8080/);assert.match(dump.stdout,/id: ui-workspace/);
 for(let i=0;i<paths.length;i++)assert.deepEqual(await readFile(join(actual,paths[i])),before[i]);
 const hash=b=>createHash('sha256').update(b).digest('hex');await writeFile(join(output,'preservation.json'),JSON.stringify({existingHomeUnchanged:true,clonedSettingsUnchanged:true,clonedProfilePatchUnchanged:true,bundlesUnchanged:true,UIWorkspacePresent:true,LANTrustPresent:true,hashes:Object.fromEntries(paths.map((p,i)=>[p,hash(before[i])]))},null,2));
}
