import {consensusDiff,consensusDiffRows,consensusReview} from './consensus-diff.js';
// Display wording can evolve independently of the frozen wire labels in codec.
export const displayLabels=Object.freeze({"reason": "提议理由", "name": "共识", "before": "修改前", "after": "修改后", "body": "正文", "removed-body": "不再生效的正文", "added-body": "即将生效的正文", "withdraw-body": "将撤回的正文", "restore-body": "将恢复的正文", "scope": "适用范围", "effect": "生效方式", "rejection": "拒绝后", "unload": "卸载", "load": "装载", "version-switch": "版本切换", "order": "装载顺序"});
export const sectionKinds=Object.freeze([...Object.keys(displayLabels),'metadata']);
export function withDiffs(heading,sections){
 const diffs=[];let previous;
 for(const section of sections){if(section.kind==='before')previous=section;else if(section.kind==='after'&&previous){diffs.push({parts:consensusDiff(previous.text,section.text),rows:consensusDiffRows(previous.text,section.text),review:consensusReview(previous.text,section.text)});previous=undefined;}}
 return {heading,sections,...diffs.length?{diffs}:{}};
}
