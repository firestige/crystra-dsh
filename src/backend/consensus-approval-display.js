import {withDiffs,displayLabels} from './consensus-approval-presentation.js';
import {encodeApprovalReason} from './consensus-approval-codec.js';
export {decodeApprovalReason as presentationFromApprovalReason} from './consensus-approval-codec.js';
// Readable presentation is derived from the exact host-verified approval input.
const value = field => field && typeof field === 'object' && 'iv' in field ? field.iv : field;
const text = item => item == null ? '（无）' : typeof item === 'object' ? Array.isArray(item) ? item.map(text).join('；') : Object.entries(item).map(([key,v])=>`${key}：${text(v)}`).join('；') : String(item);
const title = doc => text(value(doc.data?.title) ?? '共识');
const body = doc => doc.unavailable ? '（正文暂时无法读取，请先核对后再批准）' : text(value(doc.data?.body) ?? '（无正文）');
export function consensusApprovalPresentation(input,current,detail){
 const sections=[], before=current.documents??[];
 const add=(kind,content,label=displayLabels[kind])=>sections.push({kind,label,text:content});
 const describe=(doc,kind)=>{add(kind,body(doc));for(const [key,v] of Object.entries(doc.data??{}))if(!['title','body','scope','dependencies'].includes(key))add('metadata',text(value(v)),key);};
 const name={publish:'发布共识',switch:'切换生效共识',withdraw:'撤回共识',restore:'从历史版本恢复草稿'}[input.type];
 add('reason',input.reason);
 if(input.type==='publish'){
  const old=before.find(d=>d.reference.id===input.id);
  add('name',title(detail),old?'修改共识':'新增共识');
  if(old)describe(old,'before');
  describe(detail,old?'after':'body');
 }else if(input.type==='switch'){
  const after=detail.documents??[];let changed=false;
  for(const old of before)if(!after.some(d=>d.reference.id===old.reference.id)){changed=true;add('unload',title(old));describe(old,'removed-body');}
  for(const next of after){const old=before.find(d=>d.reference.id===next.reference.id);if(!old){changed=true;add('load',title(next));describe(next,'added-body');}else if(old.reference.published_version!==next.reference.published_version){changed=true;add('version-switch',`${title(next)}，第 ${old.reference.published_version} 版 → 第 ${next.reference.published_version} 版`);describe(old,'before');describe(next,'after');}}
  if(!changed)add('order','共识正文与版本没有变化，仅确认装载顺序。');
 }else {add('name',title(detail));describe(detail,input.type==='withdraw'?'withdraw-body':'restore-body');}
 add('scope',current.scope??current.manifest?.scope??value(detail.data?.scope)??'当前项目');
 let effect;
 if(input.type==='switch'||input.type==='publish'&&input.activate)effect='本会话及后续新会话采用此次共识；其他已有会话保持原版本。';
 else if(input.type==='restore')effect='仅建立新草稿，不自动发布，也不改变生效版本。';
 else if(input.type==='withdraw')effect='撤回所选共识，不自动替换任何会话的绑定。';
 else effect='仅发布，本会话和项目默认版本均不切换。';
 add('effect',effect);add('rejection','不执行此次操作。');
 return withDiffs(`请确认：${name}`,sections);
}
// Only this codec owns the persisted readable format.
export function consensusApprovalText(input,current,detail){return encodeApprovalReason(consensusApprovalPresentation(input,current,detail));}
