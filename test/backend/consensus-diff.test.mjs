import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {consensusDiff} from '../../src/backend/consensus-diff.js';
const reconstruct=(parts,side)=>parts.map(p=>p.kind==='context'?p.text:p[side]??'').join('');
test('insertions, deletions and replacements preserve exact source and target',()=>{
 for(const [oldText,newText,kind] of [['相同\n','相同\n新增\n','add'],['相同\n删除\n','相同\n','delete'],['相同\n旧条款\n末尾','相同\n新条款\n末尾','modify']]){const parts=consensusDiff(oldText,newText);assert.ok(parts.some(p=>p.kind===kind));assert.equal(reconstruct(parts,'oldText'),oldText);assert.equal(reconstruct(parts,'newText'),newText);}
});
test('unchanged, empty, repeated lines and absent final newline are handled without false changes',()=>{
 for(const [a,b] of [['',''],['same','same'],['','新增'],['删除',''],['相同\n相同\n末尾','相同\n新增\n相同\n末尾'],['末尾\n','末尾']]){const parts=consensusDiff(a,b);assert.equal(reconstruct(parts,'oldText'),a);assert.equal(reconstruct(parts,'newText'),b);if(a===b)assert.ok(parts.every(p=>p.kind==='context'));}
});
test('complete real consensus and long amendment round trip without losing unchanged scope or final changes',()=>{
 const a=readFileSync(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8'),b=readFileSync(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');const parts=consensusDiff(a,b);assert.equal(reconstruct(parts,'oldText'),a);assert.equal(reconstruct(parts,'newText'),b);assert.ok(parts.some(p=>p.kind==='context'&&p.text.includes('scope：crystra-backend-rebuild')));assert.ok(parts.some(p=>p.kind!=='context'&&p.newText.includes('文末核对')));
});
test('list-to-heading restructuring does not mark an unchanged agreement sentence as deleted',()=>{const sentence='共识管理保障身份、效力、版本、范围及操作可靠性。';const parts=consensusDiff('2. '+sentence+'\n','## 2. 共识管理\n\n'+sentence+'\n');assert.ok(parts.some(p=>p.kind==='context'&&p.text.includes(sentence)));assert.equal(reconstruct(parts,'oldText'),'2. '+sentence+'\n');});

test('side-by-side rows preserve full versions and align insertions, deletions and unchanged anchors',async()=>{
 const {consensusDiffRows}=await import('../../src/backend/consensus-diff.js');
 for(const [a,b] of [['头\n旧内容\n尾\n','头\n新内容\n新增\n尾\n'],['头\n删除\n尾','头\n尾'],['','新\n'],['旧','']]){
 const rows=consensusDiffRows(a,b);assert.equal(rows.map(r=>r.old?.text??'').join(''),a);assert.equal(rows.map(r=>r.new?.text??'').join(''),b);
 assert.deepEqual(rows.filter(r=>r.old).map(r=>r.old.number),a===''?[]:a.split('\n').filter((_,i,all)=>i<all.length-1||all[i]!=='').map((_,i)=>i+1));
 for(const r of rows.filter(r=>r.kind==='context'))assert.equal(r.old.text,r.new.text);
 }
 const rows=consensusDiffRows('相同前缀旧值相同后缀\n','相同前缀新值相同后缀\n');assert.deepEqual(rows[0].old.segments.filter(s=>s.changed).map(s=>s.text),['旧']);assert.deepEqual(rows[0].new.segments.filter(s=>s.changed).map(s=>s.text),['新']);
});
test('aligned full consensus rows reconstruct both exact documents and align the unchanged scope',async()=>{
 const {consensusDiffRows}=await import('../../src/backend/consensus-diff.js');const a=readFileSync(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8'),b=readFileSync(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');const rows=consensusDiffRows(a,b);assert.equal(rows.map(r=>r.old?.text??'').join(''),a);assert.equal(rows.map(r=>r.new?.text??'').join(''),b);assert.ok(rows.some(r=>r.kind==='context'&&r.old.text.includes('scope：crystra-backend-rebuild')));assert.ok(rows.at(-1).new.text.includes('文末核对'));
});

test('single-page review preserves both full versions, empty documents and newline changes',async()=>{
 const {consensusReview}=await import('../../src/backend/consensus-diff.js');
 const before=readFileSync(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8');
 const after=readFileSync(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');
 for(const [a,b] of [[before,after],['',''],['','新增'],['删除',''],['同文\n','同文'],['完整相同','完整相同']]){
  const changes=consensusReview(a,b);
  assert.equal(changes.filter(s=>s.kind!=='add').map(s=>s.text).join(''),a);
  assert.equal(changes.filter(s=>s.kind!=='delete').map(s=>s.text).join(''),b);
 }
});

test('review removes title parenthesis as a whole and adds the new paragraph independently',async()=>{
 const {consensusReview}=await import('../../src/backend/consensus-diff.js');
 const old='首批项目共识（待用户批准）\n\n';
 const title='首批项目共识——阅读对比验收修改稿\n\n';
 const paragraph='此稿仅用于隔离环境的界面验收，不是新需求。\n';
 const review=consensusReview(old,title+paragraph);
 assert.ok(review.some(s=>s.kind==='delete'&&s.text==='（待用户批准）'));
 assert.ok(review.some(s=>s.kind==='add'&&s.text==='——阅读对比验收修改稿'));
 assert.ok(review.some(s=>s.kind==='add'&&s.text.includes(paragraph)));
 assert.ok(!review.some(s=>s.kind==='context'&&s.text==='用'));
});
test('review never borrows characters from a removed title to match an inserted body',async()=>{
 const {consensusReview}=await import('../../src/backend/consensus-diff.js');
 const a='# 首批项目共识（待用户批准）\n\n范围：本项目\n';
 const b='# 首批项目共识——阅读对比验收修改稿\n\n> 此稿仅用于展示，不会发布。\n\n范围：本项目\n';
 const review=consensusReview(a,b);
 assert.ok(review.some(s=>s.kind==='delete'&&s.text==='（待用户批准）'));
 assert.ok(review.some(s=>s.kind==='add'&&s.text.includes('> 此稿仅用于展示，不会发布。\n')));
 assert.equal(review.filter(s=>s.kind!=='add').map(s=>s.text).join(''),a);
 assert.equal(review.filter(s=>s.kind!=='delete').map(s=>s.text).join(''),b);
});
