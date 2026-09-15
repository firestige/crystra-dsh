import {createTraceDirectoryController} from './trace-directory.js';
import {createProductTraceController} from './product-trace-model.js';

export function createProductAnalysis({React,Core,gateway,controller,inventory}) {
  const trace=createProductTraceController({gateway,decode:Core.decodeEvidencePage,load:Core.loadRecordedTrace,compile:Core.compileTraceView});
  const directory=createTraceDirectoryController({inventory,gateway,decode:Core.decodeEvidencePage});
  const fields=Object.freeze([
    {key:'taskName',label:'任务名称',placeholder:'搜索任务名称',match:'contains'},
    {key:'taskId',label:'Task ID',placeholder:'精确 Task ID',match:'exact'},
    {key:'deliveryId',label:'Delivery ID',placeholder:'精确 Delivery ID',match:'exact'},
    {key:'workflowRef',label:'Workflow',placeholder:'名称或名称@版本',match:'workflow'},
  ]);
  function Trace(){
    const state=React.useSyncExternalStore(trace.subscribe,trace.getSnapshot,trace.getSnapshot);
    const index=React.useSyncExternalStore(directory.subscribe,directory.getSnapshot,directory.getSnapshot);
    const [input,setInput]=React.useState(state.traceId);
    const [selected,setSelected]=React.useState(null);
    const [open,setOpen]=React.useState(true);
    const selectedRef=React.useRef(selected);selectedRef.current=selected;
    React.useEffect(()=>{void directory.refresh();},[]);
    React.useLayoutEffect(()=>{
      if(selected&&!index.records.some(row=>row.deliveryId===selected.deliveryId&&row.traceId===selected.traceId)){
        setSelected(null);trace.clear();
      }
    },[index,selected]);
    const select=React.useCallback(row=>{
      if(row?.deliveryId===selectedRef.current?.deliveryId&&row?.traceId===selectedRef.current?.traceId)return;
      selectedRef.current=row;setSelected(row);
      if(row){setInput(row.traceId);void trace.open(row.traceId);}else trace.clear();
    },[]);
    const range=React.useMemo(()=>{
      const times=index.records.map(row=>Date.parse(row.startedAt));
      return times.length?[new Date(Math.min(...times)).toISOString(),new Date(Math.max(...times)).toISOString()]:['1970-01-01T00:00:00.000Z','1970-01-01T00:00:00.000Z'];
    },[index.records]);
    const panel=React.createElement(React.Fragment,null,
      React.createElement('p',{role:'status'},index.phase==='loading'?'正在读取当前实例调用目录…':index.phase==='error'||index.phase==='unavailable'?'当前实例调用目录不可用。':index.records.length?'当前实例全部可关联调用':'当前实例没有可关联的调用记录。'),
      index.unavailable.length?React.createElement('p',{role:'status'},`${index.unavailable.length} 个 Delivery 缺少唯一有效根关联或完整所属信息。`):null,
      React.createElement(Core.DeliveryDirectory,{records:index.records,range,selectedId:selected?.deliveryId??null,onSelectionChange:select,searchFields:fields}));
    return React.createElement(React.Fragment,null,
      React.createElement('form',{className:'crystra-analysis-query',onSubmit:event=>{event.preventDefault();setSelected(null);selectedRef.current=null;setOpen(false);void trace.open(input.trim());}},
        React.createElement(Core.Button,{type:'button',onClick:()=>setOpen(value=>!value),'aria-expanded':open},'调用目录'),
        React.createElement(Core.Button,{type:'button',onClick:()=>{void directory.refresh();},disabled:index.phase==='loading'},'刷新目录'),
        React.createElement(Core.TextInput,{'aria-label':'Trace ID',placeholder:'精确 Trace ID',value:input,onChange:event=>setInput(event.target.value)}),
        React.createElement(Core.Button,{type:'submit'},'读取调用记录')),
      React.createElement(Core.CrystraTraceContent,{...state,onViewChange:trace.setView,directory:open?panel:undefined}));
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
  return {Analysis,trace,dispose(){directory.dispose();trace.clear();}};
}
