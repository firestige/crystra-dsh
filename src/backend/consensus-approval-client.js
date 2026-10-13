window.__ModuleLoader__.load({id:'dsh-crystra',factory:require=>{
 const React=require('react');
 const {MarkdownText}=require('@deepseek-ai/dsh-client-ui-primitives');
 const h=React.createElement, kind='crystra-consensus';
 const css=`
 /* rc.2 adapter: suppress duplicate plain reason only while our bound card is mounted. */
 [data-approval-scroll]:has([data-crystra-consensus-detail]) > :first-child{display:none}
 [data-crystra-consensus-detail]{font-size:13px;line-height:1.5;overflow-wrap:anywhere}
 [data-crystra-consensus-detail] p{margin:4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 [data-crystra-consensus-detail] button,[data-crystra-consensus-page] button{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,#8885);border-radius:6px;padding:5px 10px;background:transparent;color:inherit}
 [data-crystra-consensus-page]{container-type:inline-size;height:100%;min-height:0;display:flex;flex-direction:column;font-size:14px;line-height:1.65;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
 .crystra-document-toolbar{flex:none;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,#8885);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .crystra-document-toolbar strong{margin-right:auto}.crystra-document-toolbar button[aria-pressed=true]{background:var(--dsw-alias-fill-l2,#8882)}
 .crystra-document-scroll{overflow:auto;flex:1;min-height:0;padding:16px 24px}
 .crystra-document-meta{border-bottom:1px solid var(--dsw-alias-border-l1,#8885);padding-bottom:12px;margin-bottom:16px}
 .crystra-document-meta summary{cursor:pointer}.crystra-document-meta h3{font-size:13px;margin:12px 0 4px}
 .crystra-document-bodies{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
 .crystra-document-bodies article{min-width:0}.crystra-document-bodies article>h3{margin:0 0 12px;font-size:13px;color:var(--dsw-alias-label-secondary)}
 .crystra-aligned-diff{border:1px solid var(--dsw-alias-border-l1,#8885);margin-bottom:24px}
 .crystra-diff-row,.crystra-diff-header{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
 .crystra-diff-header{position:sticky;top:-16px;z-index:1;background:var(--dsw-alias-fill-l1,#202123);font-weight:600}
 .crystra-diff-header>div{padding:8px 12px}
 .crystra-diff-cell{display:flex;min-width:0;white-space:pre-wrap;font:13px/1.7 ui-monospace,SFMono-Regular,monospace}
 .crystra-diff-cell+div,.crystra-diff-header>div+div{border-left:1px solid var(--dsw-alias-border-l1,#8885)}
 .crystra-line-number{flex:none;width:34px;text-align:right;padding:2px 6px;color:var(--dsw-alias-label-secondary);user-select:none;opacity:.65}
 .crystra-line-text{min-width:0;padding:2px 8px;overflow-wrap:anywhere;flex:1}
 .crystra-diff-cell[data-tone=delete]{background:rgba(248,81,73,.16)}
 .crystra-diff-cell[data-tone=add]{background:rgba(46,160,67,.18)}
 .crystra-diff-cell[data-tone=empty]{background:var(--dsw-alias-fill-l2,#8881)}
 .crystra-review-legend{font-size:13px;margin:0 0 12px;color:var(--dsw-alias-label-secondary)}
 .crystra-review-document{max-width:850px;margin:0 auto 24px;padding:24px 32px;border:1px solid var(--dsw-alias-border-l1,#8885);border-radius:4px;white-space:pre-wrap;font:15px/1.9 var(--ds-font-family-sans,system-ui);overflow-wrap:anywhere}
 .crystra-review-document del{background:rgba(248,81,73,.16);color:#ed7771;text-decoration:line-through}
 .crystra-review-document ins{background:rgba(46,160,67,.18);color:#62bd7a;text-decoration:underline}
 @container(max-width:600px){.crystra-review-document{padding:16px}.crystra-document-scroll{padding:12px}}
 `;
 const bodyLabels=['修改前','修改后','正文','不再生效的正文','即将生效的正文','将撤回的正文','将恢复的正文'];
 const markdown=text=>h(MarkdownText,{text,labels:{code:{copyLabel:'复制',copiedLabel:'已复制'},footnotes:{title:'注释',backLabel:'返回正文'}}});
 function shellDetail(callId,useChat){return useChat(snapshot=>{for(const node of snapshot.nodes.values()){const root=node.kind==='tool-call'?node.data.root:undefined;if(root&&root.callId===callId&&!('kind' in root)){try{const args=JSON.parse(root.argsRaw);return typeof args.command==='string'?args.command:null;}catch{return null;}}}return null;})??null;}
 function Comparison({diffs}){
  if(!diffs?.every(doc=>doc.rows))return h('p',null,'这条旧审批记录未生成左右差异，请使用修改前和修改后查看全文。');
  const renderCell=(cell,side,kind)=>h('div',{className:'crystra-diff-cell','data-side':side,'data-line':cell?.number,'data-tone':!cell?'empty':kind==='context'?'context':side==='old'?'delete':'add'},h('span',{className:'crystra-line-number'},cell?.number??''),h('span',{className:'crystra-line-text'},cell?.text.replace(/\n$/,'')??''));
  return h('div',{'data-crystra-side-by-side':''},...diffs.map((doc,d)=>h('section',{key:d,className:'crystra-aligned-diff'},diffs.length>1&&h('h3',null,`共识 ${d+1}`),h('div',{className:'crystra-diff-header'},h('div',null,'修改前'),h('div',null,'修改后')),...doc.rows.map((row,i)=>h('div',{key:i,className:'crystra-diff-row','data-change-kind':row.kind},renderCell(row.old,'old',row.kind),renderCell(row.new,'new',row.kind))))));
 }
 function Review({diffs}){
  if(!diffs?.every(doc=>doc.review))return h('p',null,'这条旧审批记录未生成单页审阅，请使用修改前和修改后查看全文。');
  return h('div',{'data-crystra-review':''},h('p',{className:'crystra-review-legend'},'红色删除线：移除 · 绿色下划线：新增'),...diffs.map((doc,d)=>h('article',{key:d,className:'crystra-review-document'},diffs.length>1&&h('h3',null,`共识 ${d+1}`),...doc.review.map((s,i)=>h(s.kind==='delete'?'del':s.kind==='add'?'ins':'span',{key:i},s.text)))));
 }
 function ConsensusPage({useTabInfo,useProjection}){
  const info=useTabInfo(), detail=useProjection('crystraConsensusApprovalDetail');
  const [view,setView]=React.useState('compare');
  if(!detail||detail.callId!==info.tab.navigation.params?.callId)return h('div',{style:{padding:24}},'此次审批已结束或已变化，请从当前审批卡重新打开。');
  const p=detail.presentation, before=p.sections.find(s=>s.label==='修改前'), after=p.sections.find(s=>s.label==='修改后');
  const bodies=p.sections.filter(s=>bodyLabels.includes(s.label));
  const selected=before&&after?(view==='compare'?bodies:bodies.filter(s=>view==='before'?['修改前','不再生效的正文'].includes(s.label):!['修改前','不再生效的正文'].includes(s.label))):bodies;
  return h('div',{'data-crystra-consensus-page':''},h('style',null,css),
   h('div',{className:'crystra-document-toolbar'},h('strong',null,p.heading),...(before&&after? [['compare','左右对比'],['review','单页审阅'],['before','修改前'],['after','修改后']].map(([value,label])=>h('button',{key:value,'aria-pressed':view===value,onClick:()=>setView(value)},label)):[])),
   h('div',{className:'crystra-document-scroll'},
    h('details',{className:'crystra-document-meta'},h('summary',null,'提议理由、适用范围与生效方式'),...p.sections.filter(s=>!bodyLabels.includes(s.label)).map((s,i)=>h('section',{key:i},h('h3',null,s.label),markdown(s.text)))),
    view==='compare'&&before&&after?h(Comparison,{diffs:p.diffs}):view==='review'&&before&&after?h(Review,{diffs:p.diffs}):h('div',{className:'crystra-document-bodies','data-compare':view==='compare'&&selected.length>1},...selected.map((s,i)=>h('article',{key:i},h('h3',null,s.label),markdown(s.text))))));
 }
 function ApprovalDetail({callId,sessionId,useSessionPendingInteraction,useProjection,useChat,openConsensus}){
  const pending=useSessionPendingInteraction(snapshot=>snapshot.get(sessionId));
  const detail=useProjection('crystraConsensusApprovalDetail');
  const fallback=shellDetail(callId,useChat);
  if(pending?.toolName!=='crystra_consensus_approve')return fallback;
  if(pending.callId!==callId||detail?.callId!==callId)return null;
  const p=detail.presentation, name=p.sections.find(s=>['修改共识','新增共识','共识'].includes(s.label)), reason=p.sections.find(s=>s.label==='提议理由'),scope=p.sections.find(s=>s.label==='适用范围');
  return h('div',{'data-crystra-consensus-detail':''},h('style',null,css),h('strong',null,p.heading),name&&h('p',null,name.text),reason&&h('p',null,reason.text),scope&&h('p',null,'适用范围：',scope.text),h('button',{onClick:()=>openConsensus(sessionId,callId)},'阅读与对比全文'));
 }
 return {inject:['slots','sidebarRight','sidebarRightTabs'],apply(ctx){
  ctx.effect(()=>ctx.sidebarRightTabs.register({id:kind,kind,title:()=> '共识审批'}));
  ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:kind},ConsensusPage));
  ctx.slots.inject('conversation.approval.detail',()=>ctx.slots.register({name:'conversation.approval.detail',priority:-1},props=>h(ApprovalDetail,{...props,openConsensus:(sessionId,callId)=>ctx.sidebarRight.openTabIn(sessionId,kind,{params:{callId}})})));
 }};
}});
