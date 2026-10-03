import {askSelectedGate} from './task-gate-question.js';
import {roleBindingsTable} from './plan-confirmation.js';

/** One control authority for native and external Chat; only host questions confirm. */
export async function advanceTaskControl({control,task,taskContext,agent,ask,answerId,signal}) {
 let advance=false;const messages=[];
   if(task){
    const view=await control.flow.read(task),kind=view.stage==='requirements'?'brief':view.stage==='planning'?'plan':undefined,item=view[kind];
    if(item?.state==='invalid'){const message='\n\n管控文件校验未通过，请在下一轮修正：'+item.error;messages.push(message);}
    if(item?.state==='available'&&!item.confirmed&&!item.feedback&&item.value.requestConfirmation&&item.value.questions.length===0&&!item.value.grilling?.questions.some(q=>['pending','disputed'].includes(q.status))){
     const answer=await ask({question:kind==='brief'?'确认以下需求并进入计划？':'确认以下计划与绑定方案？',detail:[item.value.goal,'范围：'+item.value.scope.join('；'),'非目标：'+(item.value.nonGoals.join('；')||'无'),'建议：'+(item.value.assumptions.join('；')||'无'),'验收：'+item.value.acceptance.join('；'),...(kind==='plan'?['步骤：'+item.value.steps.join('；'),'绑定方案：'+item.value.bindings.join('；'),roleBindingsTable(item.value.roleBindings,taskContext.roleBindings)]:[])].join('\n\n'),choices:['确认此版本','需要修改']});
     if(answer==='确认此版本'){await control.flow.confirm(task,kind,item.digest,answerId());const message=kind==='brief'?'\n\n需求已确认，开始编写计划。':(control.execution?.()?'\n\n计划已确认，按该版本检查执行条件。':'\n\n计划已确认。Execution 启动入口尚未接通，当前未开始实施。');messages.push(message);if(kind==='brief'||control.execution?.()){advance=true;}}
     else if(answer){await control.flow.respond(task,kind,item.digest,answer,answerId());advance=true;}
    }
    if(control.requests&&(await control.flow.read(task)).stage==='ready'){
     const receipt=await control.requests.apply(task,agent);
     if(receipt.kind==='accepted'){const message='\n\n管控请求已记录：'+receipt.operation;messages.push(message);advance=receipt.operation!=='start-wave'||Object.values((await control.runs.read(task)).current?.nodes??{}).some(n=>n.state==='result-available');}
     if(receipt.kind==='rejected'){const message='\n\n管控请求未生效：'+receipt.error;messages.push(message);}
     const decision=await askSelectedGate({task,runs:control.runs,ask,signal});
     if(decision?.answer==='确认此版本'){
      await control.runs.confirmGate(task,{...decision,answerId:answerId()});
      const message='\n\n已记录当前 Gate 的决定，审核工作台保留本次回执。';messages.push(message);advance=true;
     }
     if(decision?.answer&&decision.answer!=='确认此版本'){await control.runs.respondGate(task,{...decision,answerId:answerId()});advance=true;}
     
    }
   }
 return {advance,messages};
}

export async function taskContextFor(control,task,session) {
 if(!task)return;
 const sourceMessages=session.ownEvents().filter(e=>e.type==='user/message'&&e.data?.source?.kind==='user').map(e=>({id:e.data.id,text:e.data.content?.filter(p=>p.type==='text').map(p=>p.text).join('\n')}));
 return {...await control.flow.prepare(task),discussion:task.discussion,sourceMessages,executionReady:!!control.execution?.(),run:await control.runs?.read(task),planningCapabilities:await control.execution?.()?.control?.planningCapabilities?.(),roleBindings:await control.execution?.()?.readRepositoryBindings?.(task.workspacePath),controlReceipts:(await control.requests?.receipts(task))?.slice(-5)};
}
