import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('product profile replaces the native sidebar instead of rendering Workspace and Delivery', async()=>{
 const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
 assert.match(patch, /id: ui-sidebar\n\s+name: ['"]@deepseek-ai\/dsh-client-ui-sidebar['"]\n\s+disabled: true/);
});
import {resolveTaskSession} from '../src/client/shell/session-binding.js';
test('task chat requires one exact, existing session and refuses stale or ambiguous correlations',()=>{
 const snapshot=(...items)=>({kind:'ready',snapshot:{deliveries:items.map(([task,session])=>({task:{identity:task},navigation:{sessionCorrelation:session}}))}});
 assert.equal(resolveTaskSession('t',snapshot(['other','s']),{s:{}}),undefined);
 assert.equal(resolveTaskSession('t',snapshot(['t','stale']),{s:{}}),undefined);
 assert.equal(resolveTaskSession('t',snapshot(['t','s'],['t','s']),{s:{}}),'s');
 assert.equal(resolveTaskSession('t',snapshot(['t','s'],['t','s2']),{s:{},s2:{}}),undefined);
});
test('dev and product compose the same formal pages; product has no legacy sidebar fallback',async()=>{
 const source=await readFile(new URL('../src/client/shell/register.tsx',import.meta.url),'utf8');
 const entry=await readFile(new URL('../modules/execution/src/client/browser-entry.js',import.meta.url),'utf8');
 assert.match(source,/import.*ProductPages.*from.*product-pages/);
 assert.doesNotMatch(entry,/applyDeliverySidebar/);
 assert.doesNotMatch(source,/crystra-product-list/);
});
test('a Task without a Delivery resolves its explicit admission binding, including after host restart',()=>{
 assert.equal(resolveTaskSession('t',{kind:'unavailable'},{s:{}},[{taskId:'t',sessionId:'s'}]),'s');
 assert.equal(resolveTaskSession('t',{kind:'unavailable'},{other:{}},[{taskId:'t',sessionId:'s'}]),undefined);
});
import {composeConversationSurface} from '../scripts/lib/conversation-surface-fork.mjs';
test('pinned hero composition keeps native mode as default and rejects source drift',async()=>{
 const original=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',import.meta.url),'utf8');
 const result=composeConversationSurface(original);
 assert.match(result,/crystraSurface = false/);
 assert.match(result,/hero && !crystraSurface &&/);
 assert.throws(()=>composeConversationSurface(original.replace('function ConversationRoot','function RenamedRoot')),/UPSTREAM_DRIFT/);
});
