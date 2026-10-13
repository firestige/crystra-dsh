import {readdir,writeFile} from 'node:fs/promises';
import {join,basename,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {Context} from '@deepseek-ai/cordis';
async function storage(root){const ctx=new Context();for(const name of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,name.endsWith('jsonl')?{root,compression:'zstd'}:{});}return ctx;}
/** Independent read of native persisted records, without creating an agent. */
export async function auditRecords(home,output){
 const root=join(home,'sessions'),ctx=await storage(root),records=[];
 try{
 const files=await readdir(root,{recursive:true});
 for(const path of files.filter(p=>/session\.v3\.jsonl(?:\.zstd)?$/.test(p))){
 const id=basename(dirname(path));const h=await ctx.sessionPersistence.open(id,'read');try{const record=await h.read();records.push({id,events:record.events});}finally{await h.close();}
 }
 const states=records.map(r=>r.events.at(-1)?.data.state).filter(Boolean);
 const commitments=states.filter(s=>s.history?.some(h=>h.verification?.decision==='GO'));
 assert.ok(commitments.length>=3,'Headless, Web, and four-capability commitments must close');
 const reflection=states.find(s=>s.id?.startsWith('crystra-reflection-'));
 assert.equal(reflection?.status,'completed');assert.equal(reflection.experiments[0]?.exitCode,0);
 const crystallization=states.find(s=>s.families);const families=Object.values(crystallization?.families??{});
 assert.ok(families.some(f=>f.jobs.some(j=>j.shadows?.length>=2)&&f.active),'Candidate must pass historical shadows and be admitted');
 assert.ok(Object.values(crystallization.routes??{}).some(r=>r.path==='crystallized'),'Native calls must use admitted Python capability');
 const worker=records.find(r=>r.id==='native-web-worker');assert.ok(worker.events.some(e=>e.type==='user/message'&&JSON.stringify(e).includes('NO_GO')),'Web gate must block early finish');
 assert.ok(records.some(r=>r.events.some(e=>e.type==='tool/call'&&e.data.name==='native_double'&&JSON.parse(e.data.arguments).input.x===-1)),'Out-of-guard case must execute');
 const end=worker.events.filter(e=>e.type==='turn/end').at(-1);assert.equal(end.data.reason.kind,'error');assert.match(end.data.reason.error.message,/binding (?:cannot change implicitly|is not an approved project version)/);
 const observations=(await (await import('node:fs/promises')).readFile(join(output,'observations.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.ok(observations.some(e=>e.type==='original-double'&&e.input.x===-1));assert.ok(!observations.some(e=>e.type==='original-double'&&e.input.x===3));
 for(const call of observations.filter(e=>e.type==='request'&&['reflection-offline','crystallization-offline'].includes(e.model))){assert.equal(call.hasConsensus,false);assert.ok(!call.tools.includes('crystra_declare_step'));}
 const summary={records:records.length,closedCommitments:commitments.length,reflection:reflection.status,reflectionExperimentExitCode:reflection.experiments[0].exitCode,admittedFamilies:families.filter(f=>f.active).length,crystallizedRoutes:Object.keys(crystallization.routes??{}).length,webNO_GO:true,guardFallbackInput:-1};
 await writeFile(join(output,'record-audit.json'),JSON.stringify(summary,null,2));return summary;
 }finally{await ctx.fiber.dispose();}
}
