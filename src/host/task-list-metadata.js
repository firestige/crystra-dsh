import {createHash} from 'node:crypto';

/** Discussion status is a display projection, never a terminal Task lifecycle claim. */
export function taskListMetadata({view,events=[]}) {
 const boundary=events.findLast(e=>e.type==='turn/start'||e.type==='turn/end');
 if(boundary?.type==='turn/end'){
  if(boundary.data?.reason?.kind==='error')return {status:'对话失败',attention:1};
  if(['aborted','interrupted'].includes(boundary.data?.reason?.kind))return {status:'对话已停止',attention:0};
 }
 const kind=view.stage==='requirements'?'brief':view.stage==='planning'?'plan':undefined;
 if(kind){
  const item=view[kind];
  if(item?.state==='invalid')return {status:kind==='brief'?'需求待修正':'计划待修正',attention:1};
  if(item?.state==='available'&&!item.confirmed&&!item.feedback&&item.value.requestConfirmation&&item.value.questions.length===0&&!item.value.grilling?.questions.some(q=>['pending','disputed'].includes(q.status)))return {status:kind==='brief'?'待需求确认':'待计划确认',attention:1};
  return {status:kind==='brief'?'需求澄清':'计划编写',attention:0};
 }
 const nodes=Object.values(view.run?.current?.nodes??{});
 if(nodes.some(n=>n.state==='awaiting-decision'))return {status:'待审核',attention:1};
 if(nodes.some(n=>['needs-attention','start-uncertain'].includes(n.state)))return {status:'执行待处理',attention:1};
 if(view.stage==='ready')return {status:'执行阶段',attention:0};
 return {};
}
export function withTaskListMetadata(query,control){
 return {
  updatePresentation:typeof query.updatePresentation==='function'?input=>query.updatePresentation(input):undefined,
  async snapshot(){
   const snapshot=await query.snapshot(),owner=control();if(!owner)return snapshot;
   const metadata=await owner.listMetadata(snapshot.items.map(t=>t.id));
   const items=snapshot.items.map(t=>({...t,...metadata[t.id]}));
   return {...snapshot,items,revision:createHash('sha256').update(JSON.stringify([snapshot.revision,items])).digest('hex')};
  },
 };
}
