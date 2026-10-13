import {displayLabels,sectionKinds,withDiffs} from './consensus-approval-presentation.js';
// Frozen v0/v1 wire vocabulary. Do not import live display wording for parsing.
const wireLabels=Object.freeze({"reason": "提议理由", "name": "共识", "before": "修改前", "after": "修改后", "body": "正文", "removed-body": "不再生效的正文", "added-body": "即将生效的正文", "withdraw-body": "将撤回的正文", "restore-body": "将恢复的正文", "scope": "适用范围", "effect": "生效方式", "rejection": "拒绝后", "unload": "卸载", "load": "装载", "version-switch": "版本切换", "order": "装载顺序"});
const legacyNames=Object.freeze({...Object.fromEntries(Object.entries(wireLabels).map(([k,v])=>[v,k])),'修改共识':'name','新增共识':'name'});
const familyPrefix='Crystra 共识审批记录 ';
const marker=familyPrefix+'v1';
export const isVersionedApprovalReason=reason=>typeof reason==='string'&&reason.startsWith(familyPrefix);
export function normalizeLegacyPresentation(p){
 if(!p||!Array.isArray(p.sections))return p;
 return {...p,sections:p.sections.map(s=>s&&typeof s==='object'&&!Array.isArray(s)?{...s,kind:s.kind??legacyNames[s.label]??'metadata'}:s)};
}
export function encodeApprovalReason(p){
 if(typeof p?.heading!=='string'||!p.heading||/[\r\n]/.test(p.heading)||!Array.isArray(p.sections)||!p.sections.length)throw new TypeError('Invalid approval presentation');
 const blocks=p.sections.map(s=>{
  if(!sectionKinds.includes(s.kind)||typeof s.label!=='string'||typeof s.text!=='string')throw new TypeError('Invalid approval section');
  const header=s.kind==='metadata'?`附加字段 ${JSON.stringify(s.label)}`:s.kind==='name'&&['修改共识','新增共识'].includes(s.label)?s.label:wireLabels[s.kind];
  return `${header}：\n ${s.text.replace(/\n/g,'\n ')}`;
 });
 return `${marker}\n${p.heading}\n\n${blocks.join('\n\n')}`;
}
function legacy(reason){
 if(!reason.startsWith('请确认：'))return null;
 const[heading,...chunks]=reason.split('\n\n');const sections=[];
 for(const chunk of chunks){const at=chunk.indexOf('：');if(at<1)return null;const label=chunk.slice(0,at);sections.push({kind:legacyNames[label]??'metadata',label,text:chunk.slice(at+1).replace(/\n /g,'\n')});}
 return sections.length?withDiffs(heading,sections):null;
}
export function decodeApprovalReason(reason){
 if(typeof reason!=='string')return null;
 if(!isVersionedApprovalReason(reason))return legacy(reason);
 if(!reason.startsWith(marker+'\n'))return null;
 const [heading,...chunks]=reason.slice(marker.length+1).split('\n\n');
 if(!heading||/[\r\n]/.test(heading)||!chunks.length)return null;
 const sections=[];
 for(const chunk of chunks){
  const at=chunk.indexOf('\n');if(at<1||chunk[at-1]!=='：')return null;
  const header=chunk.slice(0,at-1),lines=chunk.slice(at+1).split('\n');if(!lines.every(line=>line.startsWith(' ')))return null;
  let kind=Object.keys(wireLabels).find(k=>wireLabels[k]===header)??(['修改共识','新增共识'].includes(header)?'name':undefined),label;
  if(kind)label=kind==='name'&&header!==wireLabels.name?header:displayLabels[kind];else if(header.startsWith('附加字段 ')){try{label=JSON.parse(header.slice(5));}catch{return null;}if(typeof label!=='string')return null;kind='metadata';}else return null;
  sections.push({kind,label,text:lines.map(line=>line.slice(1)).join('\n')});
 }
 if(!['reason','scope','effect','rejection'].every(k=>sections.filter(s=>s.kind===k).length===1))return null;
 return withDiffs(heading,sections);
}
