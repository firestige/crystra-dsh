import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {consensusApprovalPresentation} from '../../src/backend/consensus-approval-display.js';
import {approvalDetailProjection} from '../../src/backend/consensus-approval-projection.js';
const input={type:'publish',id:'a',reason:'补充验收，不扩大 MVP',activate:true};
const current={scope:'P',documents:[{reference:{id:'a',published_version:1},data:{body:{iv:'旧正文'}}}]};
const detail={data:{body:{iv:'新正文\n\n- 四项能力必须有验收记录'}}};
test('presentation preserves full before and after bodies as separate sections and separates scope from effect',()=>{const p=consensusApprovalPresentation(input,current,detail);assert.equal(p.sections.find(s=>s.label==='修改前').text,'旧正文');assert.equal(p.sections.find(s=>s.label==='修改后').text,detail.data.body.iv);assert.equal(p.sections.find(s=>s.label==='适用范围').text,'P');assert.match(p.sections.find(s=>s.label==='生效方式').text,/本会话/);});
test('native session projection recovers detail and clears only on the matching native decision',async()=>{const {Session}=await import('@deepseek-ai/dsh-session');const {Context}=await import('@deepseek-ai/cordis');const {SessionProjectionRegistry}=await import('@deepseek-ai/dsh-session-projection');const ctx=new Context();try{await ctx.plugin(SessionProjectionRegistry);ctx.sessionProjections.register(approvalDetailProjection);const s=Session.create('detail-projection');s.append('turn/start',{turn:1});const presentation=consensusApprovalPresentation(input,current,detail);s.append('crystra/consensus-approval-detail',{callId:'c',presentation});s.append('approval/asked',{id:'a',callId:'c',toolName:'crystra_consensus_approve',reason:'review'});assert.equal(ctx.sessionProjections.stateOf(s,approvalDetailProjection.key).presentation.sections[2].text,'旧正文');const replay=Session.create('detail-replay',s.snapshotEvents());assert.deepEqual(ctx.sessionProjections.stateOf(replay,approvalDetailProjection.key),ctx.sessionProjections.stateOf(s,approvalDetailProjection.key));s.append('approval/decided',{id:'other',outcome:'rejected'});assert.ok(ctx.sessionProjections.stateOf(s,approvalDetailProjection.key));s.append('approval/decided',{id:'a',outcome:'rejected'});assert.equal(ctx.sessionProjections.stateOf(s,approvalDetailProjection.key),null);}finally{await ctx.fiber.dispose();}});
function client(initialView='after',overrides={}){let component,definition,pane,opened;const React={useState:v=>[initialView??v,()=>{}],createElement:(type,props,...children)=>({type,props:{...props,children}})};let plugin;const sandbox={window:{__ModuleLoader__:{load:entry=>{plugin=entry.factory(id=>id==='react'?React:{MarkdownText:'native-markdown',DiffBlock:'native-diff'});}}}};vm.runInNewContext(readFileSync(new URL('../../src/backend/consensus-approval-client.js',import.meta.url),'utf8'),sandbox);plugin.apply({effect:fn=>fn(),sidebarRightTabs:{register:()=>()=>{}},sidebarRight:{openTabIn:(...args)=>{opened=args;}},slots:{inject:(_n,fn)=>fn(),register:(d,c)=>{if(d.name==='conversation.approval.detail'){definition=d;component=props=>{const el=c(props);return typeof el?.type==='function'?el.type(el.props):el;};}else pane=c;return()=>{};}},...overrides});return {component,definition,pane,getOpened:()=>opened};}
const props=(pending,projection,raw='{"command":"echo hello"}')=>({sessionId:'s',callId:'c',useSessionPendingInteraction:fn=>fn(new Map([['s',pending]])),useProjection:()=>projection,useChat:fn=>fn({nodes:new Map([['node',{kind:'tool-call',data:{root:{callId:'c',argsRaw:raw}}}]])})});
test('compact card keeps full bodies in native sidebar and preserves ordinary shell detail',()=>{const {component,pane,getOpened}=client();const presentation=consensusApprovalPresentation(input,current,detail);const own={toolName:'crystra_consensus_approve',callId:'c'};const result=component(props(own,{callId:'c',presentation}));assert.equal(result.props['data-crystra-consensus-detail'],'');assert.ok(!JSON.stringify(result).includes('旧正文'));const buttons=result.props.children.flat().filter(x=>x?.type==='button');assert.equal(buttons.length,1);buttons[0].props.onClick();assert.deepEqual(JSON.parse(JSON.stringify(getOpened())),['s','crystra-consensus',{params:{callId:'c'}}]);const page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});assert.match(JSON.stringify(page),/新正文/);assert.match(JSON.stringify(page),/native-markdown/);assert.equal(component(props({toolName:'shell',callId:'c'},null)),'echo hello');assert.equal(component(props({toolName:'shell',callId:'c'},null,'bad json')),null);});
test('an old sidebar cannot show a subsequent approval body',()=>{const {pane}=client();const result=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'old'}}}}),useProjection:()=>({callId:'new',presentation:consensusApprovalPresentation(input,current,detail)})});assert.match(JSON.stringify(result),/已结束/);assert.ok(!JSON.stringify(result).includes('新正文'));});
test('stale or missing projection cannot present a different call as the current approval',()=>{const {component}=client();const pending={toolName:'crystra_consensus_approve',callId:'c'};assert.equal(component(props(pending,undefined)),null);assert.equal(component(props(pending,{callId:'other',presentation:consensusApprovalPresentation(input,current,detail)})),null);});
test('complete initial consensus and long amendment remain intact in presentation and default reading mode',()=>{
 const before=readFileSync(new URL('../../docs/backend-rebuild/initial-project-consensus.md',import.meta.url),'utf8');
 const after=readFileSync(new URL('../fixtures/consensus-long-amendment.md',import.meta.url),'utf8');
 assert.ok(after.length>2000);
 const presentation=consensusApprovalPresentation(input,{scope:'crystra-backend-rebuild',documents:[{reference:{id:'a'},data:{body:{iv:before}}}]},{data:{body:{iv:after}}});
 assert.equal(presentation.sections.find(s=>s.label==='修改前').text,before);
 assert.equal(presentation.sections.find(s=>s.label==='修改后').text,after);
 const {pane}=client();const result=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});
 assert.ok(JSON.stringify(result).includes(JSON.stringify(after).slice(1,-1)));
});
test('new, switch, withdraw and restore bodies are rendered as documents rather than hidden metadata',()=>{
 const {pane}=client();for(const label of ['正文','不再生效的正文','即将生效的正文','将撤回的正文','将恢复的正文']){
 const result=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation:{heading:'审批',sections:[{kind:({'正文':'body','不再生效的正文':'removed-body','即将生效的正文':'added-body','将撤回的正文':'withdraw-body','将恢复的正文':'restore-body'})[label],label,text:'完整正文-'+label}]}})});
 const bodies=result.props.children[2].props.children[1];assert.match(JSON.stringify(bodies),new RegExp('完整正文-'+label));}
});
test('switching several agreements never drops the second document from default reading',()=>{
 const {pane}=client();const result=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation:{heading:'切换',sections:[{kind:'before',label:'修改前',text:'旧甲'},{kind:'after',label:'修改后',text:'新甲'},{kind:'before',label:'修改前',text:'旧乙'},{kind:'after',label:'修改后',text:'新乙'}]}})});
 assert.match(JSON.stringify(result),/新甲/);assert.match(JSON.stringify(result),/新乙/);
});

test('comparison renders full aligned rows with removal and addition colors',()=>{const {pane}=client('compare');const presentation=consensusApprovalPresentation(input,current,detail);const page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});const nested=page.props.children[2].props.children[1];const rendered=typeof nested.type==='function'?nested.type(nested.props):nested;assert.match(JSON.stringify(rendered),/crystra-diff-row/);const rows=rendered.props.children[0].props.children.slice(2);const text=n=>n==null?'':typeof n==='string'?n:typeof n==='number'?'':(Array.isArray(n)?n:n.props?.children??[]).map(text).join('');assert.equal(text(rows[0].props.children[0]),'旧正文');assert.equal(text(rows[0].props.children[1]),'新正文');assert.match(JSON.stringify(rendered),/data-tone.*delete/);assert.match(JSON.stringify(rendered),/data-tone.*add/);});
test('old recorded approvals keep full reading available and do not invent a computed difference',()=>{
 const {pane}=client('compare');const presentation=consensusApprovalPresentation(input,current,detail);delete presentation.diffs;
 const page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});const node=page.props.children[2].props.children[1];assert.match(JSON.stringify(node.type(node.props)),/旧审批记录未生成左右差异/);
});
test('native projection retains computed differences without discarding later agreements',()=>{
 const presentation=consensusApprovalPresentation({type:'switch',reason:'核对两份共识'}, {scope:'P',documents:[{reference:{id:'a',published_version:1},data:{body:{iv:'旧甲'}}},{reference:{id:'b',published_version:1},data:{body:{iv:'旧乙'}}}]},{documents:[{reference:{id:'a',published_version:2},data:{body:{iv:'新甲'}}},{reference:{id:'b',published_version:2},data:{body:{iv:'新乙'}}}]});
 const state=approvalDetailProjection.apply(null,{type:'crystra/consensus-approval-detail',data:{callId:'c',presentation}});assert.equal(state.presentation.diffs.length,2);assert.equal(state.presentation.diffs[1].parts[0].newText,'新乙');
});

test('Git mode highlights whole lines without inline review marks',()=>{
 const {pane}=client('compare');const presentation=consensusApprovalPresentation(input,current,detail);
 const page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});
 const n=page.props.children[2].props.children[1], rendered=n.type(n.props);
 assert.ok(!JSON.stringify(rendered).includes('"type":"mark"'));
 assert.match(JSON.stringify(rendered),/旧正文/);
});
test('single page review uses deletions and insertions and reconstructs both exact versions',()=>{
 const presentation=consensusApprovalPresentation(input,current,detail);
 const review=presentation.diffs[0].review;
 assert.ok(review);
 assert.equal(review.filter(s=>s.kind!=='add').map(s=>s.text).join(''),'旧正文');
 assert.equal(review.filter(s=>s.kind!=='delete').map(s=>s.text).join(''),detail.data.body.iv);
 const {pane}=client('review'), page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation})});
 const n=page.props.children[2].props.children[1], rendered=n.type(n.props);
 assert.match(JSON.stringify(rendered),/"type":"del"/);assert.match(JSON.stringify(rendered),/"type":"ins"/);
 assert.ok(!JSON.stringify(rendered).includes('crystra-diff-cell'));
 const state=approvalDetailProjection.apply(null,{type:'crystra/consensus-approval-detail',data:{callId:'c',presentation}});
 assert.deepEqual(state.presentation.diffs[0].review,review);
});

test('approval detail replays from the native approval event with exact multiline bodies and section-like content',async()=>{
 const{consensusApprovalText}=await import('../../src/backend/consensus-approval-display.js');const{Session,KNOWN_SESSION_EVENT_TYPES}=await import('@deepseek-ai/dsh-session');
 const tricky={data:{body:{iv:'完整正文\n\n适用范围：这只是正文中的一句话\n  保留缩进\n\n末尾。'}}};
 const reason=consensusApprovalText(input,current,tricky),s=Session.create('native-detail');s.append('turn/start',{turn:1});const event=s.append('approval/asked',{id:'native-approval',callId:'c',toolName:'crystra_consensus_approve',reason});
 assert.ok(s.snapshotEvents().every(e=>KNOWN_SESSION_EVENT_TYPES.has(e.type)));
 const state=approvalDetailProjection.apply(null,event);assert.ok(state);assert.equal(state.requestId,'native-approval');assert.equal(state.presentation.sections.find(x=>x.label==='修改后').text,tricky.data.body.iv);assert.equal(state.presentation.sections.find(x=>x.label==='适用范围').text,'P');assert.ok(state.presentation.diffs.length);
});
test('sidebar and compact card select semantic roles when every human label changes',()=>{
 const p=consensusApprovalPresentation(input,current,detail);p.sections=p.sections.map(s=>({...s,label:'文案变化-'+s.kind}));
 const {pane,component}=client('after'),page=pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>({callId:'c',presentation:p})});
 assert.match(JSON.stringify(page),/新正文/);assert.doesNotMatch(JSON.stringify(page),/旧正文/);
 const card=component(props({toolName:'crystra_consensus_approve',callId:'c'},{callId:'c',presentation:p}));assert.match(JSON.stringify(card),/补充验收/);assert.match(JSON.stringify(card),/适用范围/);
});
test('UI adapter failure returns native fallback without throwing or hiding arbitrary host elements',()=>{
 const {component,pane}=client();const pending={toolName:'crystra_consensus_approve',callId:'c'};
 assert.doesNotThrow(()=>assert.equal(component({...props(pending,null),useProjection:()=>{throw Error('projection gone');}}),null));
 assert.doesNotThrow(()=>pane({useTabInfo:()=>{throw Error('tab contract changed');},useProjection:()=>null}));
 const source=readFileSync(new URL('../../src/backend/consensus-approval-client.js',import.meta.url),'utf8');assert.doesNotMatch(source,/:has\([^\n]+first-child/);
});
function nativeReasonDom(reason){
 let display='block';const first={tagName:'DIV',textContent:reason,querySelector:()=>null,style:{getPropertyValue:()=>display,getPropertyPriority:()=>'',setProperty:(_k,v)=>{display=v;},removeProperty:()=>{display='';}}};
 const node={closest:()=>scroll},scroll={children:[first,{contains:n=>n===node}]};
 return {node,scroll,first,display:()=>display};
}
test('UI adapter restores native full reason on sidebar failure and component disposal',async()=>{
 const {encodeApprovalReason}=await import('../../src/backend/consensus-approval-codec.js'),presentation=consensusApprovalPresentation(input,current,detail),reason=encodeApprovalReason(presentation);
 for(const openTabIn of [()=>{throw Error('sidebar gone');},()=>Promise.reject(Error('sidebar rejected'))]){
  const {component}=client('after',{sidebarRight:{openTabIn}}),tree=component(props({toolName:'crystra_consensus_approve',callId:'c',reason},{callId:'c',presentation})),dom=nativeReasonDom(reason);
  const dispose=tree.props.ref(dom.node);assert.equal(dom.display(),'none');
  tree.props.children.find(x=>x?.type==='button').props.onClick();await Promise.resolve();assert.equal(dom.display(),'block');dispose();assert.equal(dom.display(),'block');
 }
 const {component}=client(),tree=component(props({toolName:'crystra_consensus_approve',callId:'c',reason},{callId:'c',presentation})),dom=nativeReasonDom(reason);
 const dispose=tree.props.ref(dom.node);assert.equal(dom.display(),'none');dispose();assert.equal(dom.display(),'block');
 dom.first.textContent='Other approval';tree.props.ref(dom.node);assert.equal(dom.display(),'block');
});
test('missing sidebar or failing slot registration leaves native approval untouched',()=>{
 assert.doesNotThrow(()=>client('after',{slots:{inject:()=>{throw Error('slot unavailable');},register:()=>{}}}));
 const {component}=client('after',{sidebarRight:{}});assert.equal(component,undefined);
});
test('sidebar projection failure restores an already mounted native approval body',async()=>{
 const {encodeApprovalReason}=await import('../../src/backend/consensus-approval-codec.js'),presentation=consensusApprovalPresentation(input,current,detail),reason=encodeApprovalReason(presentation),{component,pane}=client();
 const card=component(props({toolName:'crystra_consensus_approve',callId:'c',reason},{callId:'c',presentation})),dom=nativeReasonDom(reason),dispose=card.props.ref(dom.node);assert.equal(dom.display(),'none');
 pane({useTabInfo:()=>({tab:{navigation:{params:{callId:'c'}}}}),useProjection:()=>{throw Error('projection adapter changed');}});
 assert.equal(dom.display(),'block');dispose();
});
