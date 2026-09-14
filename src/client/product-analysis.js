import {createProductTraceController} from './product-trace-model.js';

export function createProductAnalysis({React,Core,gateway,controller}) {
  const trace=createProductTraceController({gateway,decode:Core.decodeEvidencePage,load:Core.loadRecordedTrace,compile:Core.compileTraceView});
  function Trace(){
    const state=React.useSyncExternalStore(trace.subscribe,trace.getSnapshot,trace.getSnapshot);
    const [input,setInput]=React.useState(state.traceId);
    return React.createElement(React.Fragment,null,
      React.createElement('form',{className:'crystra-analysis-query',onSubmit:event=>{event.preventDefault();void trace.open(input.trim());}},
        React.createElement(Core.TextInput,{'aria-label':'Trace ID',placeholder:'Trace ID',value:input,onChange:event=>setInput(event.target.value)}),
        React.createElement(Core.Button,{type:'submit'},'读取调用记录')),
      React.createElement(Core.CrystraTraceContent,{...state,onViewChange:trace.setView}));
  }
  function Overview(){
    const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    const [taskId,setTaskId]=React.useState(state.selection?.taskIds?.[0]??'');
    const result=state.result?.mode==='SINGLE'?state.result.result:undefined;
    return React.createElement('div',{className:'obs-scroll'},
      React.createElement('form',{className:'crystra-analysis-query',onSubmit:event=>{event.preventDefault();controller.clearSelection();controller.setSelection({mode:'single',taskIds:[taskId]});void controller.evaluate();}},
        React.createElement('select',{'aria-label':'评估任务',value:taskId,onChange:event=>setTaskId(event.target.value)},
          React.createElement('option',{value:''},'选择任务'),...state.taskList.items.map(task=>React.createElement('option',{key:task.task_id,value:task.task_id},task.display_name??task.task_id))),
        React.createElement(Core.Button,{type:'submit',disabled:!taskId||state.phase==='loading'||state.refreshing},'计算总览')),
      state.error?React.createElement('p',{role:'alert'},state.error.message):null,
      state.phase==='loading'||state.refreshing?React.createElement('p',{role:'status'},'正在计算总览…'):null,
      !result?(state.phase==='loading'?null:React.createElement('p',{role:'status'},'选择任务以读取评估结果。')):React.createElement('div',{className:'crystra-analysis-metrics'},
        ...result.metric_results.map(metric=>React.createElement(Core.DashboardMetricPanel,{key:`${metric.metric_id}@${metric.metric_version}`,result:metric,size:'MEDIUM'}))));
  }
  function Analysis({page,onNavigate}){
    return React.createElement(Core.CrystraAnalysisFrame,{page,onNavigate},
      page==='analysis-traces'?React.createElement(Trace):page==='analysis-overview'?React.createElement(Overview):
        React.createElement('section',{'data-section-id':'comparison-analysis',className:'obs-scroll'},React.createElement('p',{role:'status'},'对比分析的数据接口尚未接入。')));
  }
  return {Analysis,trace};
}
