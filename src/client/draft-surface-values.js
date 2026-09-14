/** Conditional draft UI shapes only. Passing does not verify claims, confirmation, or authority. */
const text=v=>typeof v==='string'&&v.length<=100000;
const id=v=>text(v)&&v.trim().length>0;
const tone=v=>['neutral','primary','success','warning','danger'].includes(v);
const list=check=>v=>Array.isArray(v)&&v.length<=10000&&v.every(check);
const rows=check=>v=>list(check)(v)&&new Set(v.map(row=>row.id)).size===v.length;
const shape=(required,optional={})=>v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).every(key=>Object.hasOwn(required,key)||Object.hasOwn(optional,key))&&
 Object.entries(required).every(([key,check])=>Object.hasOwn(v,key)&&check(v[key]))&&
 Object.entries(optional).every(([key,check])=>!Object.hasOwn(v,key)||check(v[key]));
const strings=list(text);
const metric=shape({label:text,value:text});
const gate=shape({id,question:text,trigger:text,location:text,status:text,impact:text,decisions:strings,
 interpretation:text,interpretationStatus:text,deltas:list(shape({mark:text,text,tone:text})),
 previewTitle:text,previewStatus:text,steps:list(v=>Array.isArray(v)&&v.length===2&&v.every(text)),preserved:text,
 evidence:rows(shape({id,title:text,detail:text,action:text,tone:text}))});
const schemas={
 grilling:shape({heading:text,summary:text,briefSummary:text,
  topics:rows(shape({id,title:text,progress:text,tone})),fields:rows(shape({id,title:text,status:text,body:text,tone})),
  changes:rows(shape({id,kind:v=>v==='added'||v==='removed',text}))},{remaining:text,budget:text,reason:text}),
 plan:shape({identity:id,status:text,question:text,goal:text,completion:text,nonGoals:text,
  readiness:rows(shape({id,title:text,status:text,items:list(metric)})),attention:strings,changes:strings}),
 execution:shape({title:text,summary:text,metrics:list(metric),frontier:text,waves:rows(shape({id,title:text,status:text,
  identity:shape({planRun:id,wave:id,workflow:id,workflowRun:id,traceRoot:id}),progress:text,output:text,boundary:text}))}),
 gate:shape({gates:rows(gate)}),
 delivery:shape({readiness:shape({title:text,description:text,coverage:text,tone}),recalculation:text,
  artifacts:rows(shape({id,name:text,detail:text,status:text})),acceptance:rows(shape({id,label:text,status:text})),risk:text,economics:list(metric)}),
};
export function validateDraftSurfaceValue(name,value){return Object.hasOwn(schemas,name)&&schemas[name](value);}
