import {consensusDiff,consensusDiffRows,consensusReview} from './consensus-diff.js';
// Readable presentation is derived from the exact host-verified approval input.
const value = field => field && typeof field === 'object' && 'iv' in field ? field.iv : field;
const text = item => item == null ? '（无）' : typeof item === 'object' ? Array.isArray(item) ? item.map(text).join('；') : Object.entries(item).map(([key,v])=>`${key}：${text(v)}`).join('；') : String(item);
const title = doc => text(value(doc.data?.title) ?? '共识');
const body = doc => doc.unavailable ? '（正文暂时无法读取，请先核对后再批准）' : text(value(doc.data?.body) ?? '（无正文）');
export function consensusApprovalPresentation(input,current,detail){
 const sections=[], before=current.documents??[];
 const add=(label,content)=>sections.push({label,text:content});
 const describe=(doc,label)=>{add(label,body(doc));for(const [key,v] of Object.entries(doc.data??{}))if(!['title','body','scope','dependencies'].includes(key))add(key,text(value(v)));};
 const name={publish:'发布共识',switch:'切换生效共识',withdraw:'撤回共识',restore:'从历史版本恢复草稿'}[input.type];
 add('提议理由',input.reason);
 if(input.type==='publish'){
  const old=before.find(d=>d.reference.id===input.id);
  add(old?'修改共识':'新增共识',title(detail));
  if(old)describe(old,'修改前');
  describe(detail,old?'修改后':'正文');
 }else if(input.type==='switch'){
  const after=detail.documents??[];let changed=false;
  for(const old of before)if(!after.some(d=>d.reference.id===old.reference.id)){changed=true;add('卸载',title(old));describe(old,'不再生效的正文');}
  for(const next of after){const old=before.find(d=>d.reference.id===next.reference.id);if(!old){changed=true;add('装载',title(next));describe(next,'即将生效的正文');}else if(old.reference.published_version!==next.reference.published_version){changed=true;add('版本切换',`${title(next)}，第 ${old.reference.published_version} 版 → 第 ${next.reference.published_version} 版`);describe(old,'修改前');describe(next,'修改后');}}
  if(!changed)add('装载顺序','共识正文与版本没有变化，仅确认装载顺序。');
 }else {add('共识',title(detail));describe(detail,input.type==='withdraw'?'将撤回的正文':'将恢复的正文');}
 add('适用范围',current.scope??current.manifest?.scope??value(detail.data?.scope)??'当前项目');
 let effect;
 if(input.type==='switch'||input.type==='publish'&&input.activate)effect='本会话及后续新会话采用此次共识；其他已有会话保持原版本。';
 else if(input.type==='restore')effect='仅建立新草稿，不自动发布，也不改变生效版本。';
 else if(input.type==='withdraw')effect='撤回所选共识，不自动替换任何会话的绑定。';
 else effect='仅发布，本会话和项目默认版本均不切换。';
 add('生效方式',effect);add('拒绝后','不执行此次操作。');
 return withDiffs(`请确认：${name}`,sections);
}
function withDiffs(heading,sections){
 const diffs=[];let previous;
 for(const section of sections){if(section.label==='修改前')previous=section;else if(section.label==='修改后'&&previous){diffs.push({parts:consensusDiff(previous.text,section.text),rows:consensusDiffRows(previous.text,section.text),review:consensusReview(previous.text,section.text)});previous=undefined;}}
 return {heading,sections,...diffs.length?{diffs}:{}};
}
// Continuation lines are indented so document text cannot impersonate section boundaries.
export function consensusApprovalText(input,current,detail){const p=consensusApprovalPresentation(input,current,detail);return [p.heading,...p.sections.map(s=>`${s.label.replace(/\s/g,' ')}：${s.text.replace(/\n/g,'\n ')}`)].join('\n\n');}
export function presentationFromApprovalReason(reason){
 if(typeof reason!=='string'||!reason.startsWith('请确认：'))return null;
 const[heading,...chunks]=reason.split('\n\n');const sections=[];
 for(const chunk of chunks){const at=chunk.indexOf('：');if(at<1)return null;sections.push({label:chunk.slice(0,at),text:chunk.slice(at+1).replace(/\n /g,'\n')});}
 if(!sections.length)return null;return withDiffs(heading,sections);
}
