import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consensusReview} from '../../src/backend/consensus-diff.js';
const scenarios=JSON.parse(readFileSync(new URL('../fixtures/consensus-review-scenarios.json',import.meta.url),'utf8'));
for(const s of scenarios)test(`full-document review: ${s.label}`,()=>{
 const review=consensusReview(s.before,s.after);
 for(const paragraph of s.before.split(/\n\s*\n/).filter(p=>p.trim())){
  if(s.after.includes(paragraph)&&!s.deleted.some(p=>p.includes(paragraph)))assert.ok(review.some(p=>p.kind==='context'&&p.text.includes(paragraph)),`unchanged paragraph must remain whole: ${paragraph}`);
 }
 assert.ok(!review.some((p,i)=>p.kind==='context'&&/^[\p{Script=Han}]{1,4}$/u.test(p.text)&&review[i-1]?.kind!=='context'&&review[i+1]?.kind!=='context'),'short isolated shared characters should not divide an edit');
 const anchor='范围：/Users/firestige/Projects/crystra-backend-rebuild；scope：crystra-backend-rebuild。';
 assert.ok(review.some(p=>p.kind==='context'&&p.text.includes(anchor)),'unchanged scope must not be rewritten');
 assert.ok(review.some(p=>p.kind==='context'&&p.text.includes('**文末核对：此长修改稿仅供阅读对比验收，不改变正式项目共识。**')),'unchanged ending must not be rewritten');
 assert.equal(review.filter(p=>p.kind!=='add').map(p=>p.text).join(''),s.before,'old document must remain exact');
 assert.equal(review.filter(p=>p.kind!=='delete').map(p=>p.text).join(''),s.after,'new document must remain exact');
 for(const [kind,expected] of [['delete',s.deleted],['add',s.added],['context',s.context]])for(const text of expected){
  assert.ok(review.some(p=>p.kind===kind&&p.text.includes(text)),`${kind} should keep complete phrase: ${text}`);
 }
});

test('original long expansion preserves unchanged clauses instead of calling the entire body a rewrite',()=>{
 const before=readFileSync(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8');
 const after=readFileSync(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');
 const review=consensusReview(before,after);
 for(const text of ['当前不开发工作台、JSONIR、远端服务或新的 harness。','共识管理保障身份、效力、版本、范围及操作可靠性，不保证共识正文正确；内容由用户和 agent 判断。','它不是 reviewer，不承诺拦截所有幻觉或设计错误。'])assert.ok(review.some(p=>p.kind==='context'&&p.text.includes(text)),text);
});
