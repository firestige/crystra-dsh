/** Semantic input accepted from Agent-authored files; never accepts rendered HTML or runtime facts. */
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=30000;
const strings=v=>Array.isArray(v)&&v.length<=1000&&v.every(text);
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000;
const unique=rows=>new Set(rows.map(r=>r.id)).size===rows.length;
export function validGrilling(g){
 if(!obj(g)||!count(g.round)||!obj(g.budget)||!count(g.budget.initial)||!count(g.budget.remaining)||!Array.isArray(g.topics)||g.topics.length>100||!g.topics.every(t=>obj(t)&&text(t.id)&&text(t.title)&&count(t.estimatedQuestions))||!unique(g.topics)||!Array.isArray(g.questions)||g.questions.length>1000||!unique(g.questions))return false;
 return g.questions.every(q=>obj(q)&&text(q.id)&&g.topics.some(t=>t.id===q.topicId)&&text(q.text)&&['pending','answered','excluded','disputed','conditional'].includes(q.status)&&['initial','added'].includes(q.origin)&&strings(q.sourceMessageIds)&&typeof q.reason==='string'&&(typeof q.answer==='string'||q.answer===null)&&(q.origin!=='added'||text(q.reason))&&(!['answered','excluded'].includes(q.status)||text(q.answer)));
}
export function validPlanGraph(g){
 if(!obj(g)||!Array.isArray(g.nodes)||g.nodes.length===0||g.nodes.length>500||!unique(g.nodes)||!Array.isArray(g.edges)||g.edges.length>2000||!unique(g.edges))return false;
 if(!g.nodes.every(n=>obj(n)&&text(n.id)&&['wave','gate','milestone','action'].includes(n.kind)&&text(n.title)&&(!Object.hasOwn(n,'workflowSelector')||text(n.workflowSelector))&&(!Object.hasOwn(n,'parallelGroup')||text(n.parallelGroup))&&typeof n.goal==='string'&&strings(n.entryConditions)&&strings(n.exitConditions)&&strings(n.risks)&&strings(n.evidence)))return false;
 const ids=new Set(g.nodes.map(n=>n.id));if(!g.edges.every(e=>obj(e)&&text(e.id)&&ids.has(e.source)&&ids.has(e.target)&&(e.source!==e.target||e.kind==='recovery')&&['normal','recovery'].includes(e.kind)&&typeof e.label==='string'))return false;
 // Recovery relationships are retained separately; ordinary plan dependencies form a DAG.
 const next=new Map(g.nodes.map(n=>[n.id,[]]));for(const e of g.edges)if(e.kind==='normal')next.get(e.source).push(e.target);
 const visited=new Set(),active=new Set();function visit(id){if(active.has(id))return false;if(visited.has(id))return true;active.add(id);for(const to of next.get(id))if(!visit(to))return false;active.delete(id);visited.add(id);return true;}
 return [...ids].every(visit);
}
export function validReadiness(r){return obj(r)&&['control','proof','context'].every(k=>obj(r[k])&&text(r[k].status)&&strings(r[k].items));}
export function compatibleQuestionHistory(previous,current){
 if(!previous)return true;if(!current)return false;
 return previous.topics.every(t=>current.topics.some(n=>n.id===t.id))&&previous.questions.every(q=>current.questions.some(n=>n.id===q.id&&n.topicId===q.topicId&&n.origin===q.origin));
}
