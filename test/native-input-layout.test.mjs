import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('native Input outer-layout adapter is qualified only against its exact DSH baseline',async()=>{
 const bytes=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'16f001f89a9bc19c54cfa90e37cf52e191113af0abe5efd593e57d7ab30060ad','Host layout changed: requalify geometry, focus and Input continuity before release');
 const conversation=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',import.meta.url));
 assert.equal(createHash('sha256').update(conversation).digest('hex'),'fe448ef7e0b1f3e7713dadfc7eff56b9f80d103a2111dfe69c1735ffd0196d61','Conversation changed: requalify header store, draft continuity and native drilldown before release');
 const pkg=JSON.parse(await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-layout/package.json',import.meta.url)));
 assert.equal(pkg.version,'0.1.1-rc.2');
});

test('native banner event adapter is qualified against its exact SidebarRoot implementation',async()=>{
 const bytes=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'719693c401e7175e73f50e8021d918b2829a602fbd09761a6ef39d055c53460a','Host sidebar changed: requalify brand click, keyboard, collapse and disposal');
});
