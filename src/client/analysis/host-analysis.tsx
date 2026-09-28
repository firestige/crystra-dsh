import {useContext,useMemo,useSyncExternalStore,useState} from 'react';
import {AnalysisSurface, AnalysisDataProvider, Button, useRecordedAnalysis, useRecordedDeliveries,useDeliveryTrace,type AnalysisPage, type DeliverySearchCondition,type DeliverySearchRecord} from 'crystra-ui-core';
import {analysisLocation,analysisViewPath,analysisPeriodPath} from './navigation.js';
import {analysisConfiguration} from './configuration-store';
import {HostRpcContext} from '../host/host-rpc-context';
import {createAnalysisTransport} from './transport';
/** DSH supplies routing and transport; shared UI hooks own requests and business projections. */
export function HostAnalysis({view,onNavigate}:{view:AnalysisPage;onNavigate:(path:string)=>void}) {
 const config=useSyncExternalStore(analysisConfiguration.subscribe,analysisConfiguration.getSnapshot);
 const location=analysisLocation(window.location.href);
 const rpc=useContext(HostRpcContext);
 const [comparisonSubset,setComparisonSubset]=useState<string[]|null>(null);
 const [selectedDelivery,setSelectedDelivery]=useState<DeliverySearchRecord|null>(null);
 const transport=useMemo(()=>createAnalysisTransport(rpc??{call:async()=>{throw Error('分析宿主尚未连接');}}),[rpc]);
 const [conditions,setConditions]=useState<DeliverySearchCondition[]>([]);
 const directory=useRecordedDeliveries(transport,location.period,view!=='dashboard',view==='traces'?conditions:[]);
 const metrics=useRecordedAnalysis(transport,location.period,()=>{if(view!=='dashboard')directory.refresh();},view==='reports'?comparisonSubset:null,view!=='traces');
 const selected=useDeliveryTrace(transport,view==='traces'?(selectedDelivery?.traceId??null):null,location.period,metrics.refreshCount);
 const data=useMemo(()=>({...metrics.data,...directory.data,trace:()=>selected.trace}),[metrics.data,directory.data,selected.trace]);
 const error=(view!=='traces'?metrics.state.error:null)??(view!=='dashboard'?directory.state.error:null);
 const loading=(view!=='traces'&&metrics.state.phase==='loading')||(view!=='dashboard'&&directory.state.phase==='loading');
 const notice=error?`数据查询失败：${error.message}`:loading?'正在读取所选落库时间范围的数据…':view==='dashboard'?'数据范围按 Evidence 落库时间；缺少供给的指标显示不可用。':`已加载 ${directory.data.deliveries?.length??0} 个 Delivery${directory.state.hasMore?'；向下滚动继续加载':'。'}`;
 const traceNotice=selected.state.error?`轨迹查询失败：${selected.state.error.message}`:selected.state.phase==='loading'?'正在读取所选 Delivery 的轨迹…':selected.state.hasMore?`已加载 ${selected.state.rows.length} 条轨迹记录，仍有后续数据。`:undefined;
 return <AnalysisDataProvider value={data}><AnalysisSurface
  view={view}
  onViewChange={(next)=>onNavigate(analysisViewPath(window.location.href,next))}
  period={location.period} initialScope={location.scope}
  onPeriodChange={(period)=>{setSelectedDelivery(null);onNavigate(analysisPeriodPath(window.location.href,period));}}
  sourceContext={view==='traces'?location.sourceContext:{}}
  selectedDelivery={selectedDelivery} onDeliveryChange={setSelectedDelivery}
  onDirectorySearchChange={setConditions}
  directoryPaging={{total:directory.state.meta?.total,hasMore:directory.state.hasMore&&!directory.state.error,loading:directory.state.phase==='loading',onLoadMore:()=>void directory.loadMore()}}
  traceNotice={traceNotice}
  comparisonSubset={comparisonSubset} onComparisonSubsetChange={setComparisonSubset}
  dataNotice={[config.storageError,notice].filter(Boolean).join(' ')}
  dataActions={<>{view==='reports'&&directory.state.hasMore?<Button disabled={directory.state.phase==='loading'} onClick={()=>void directory.loadMore()}>加载更多 Delivery</Button>:null}{view==='traces'&&selected.state.hasMore?<Button disabled={selected.state.phase==='loading'} onClick={()=>void selected.loadMore()}>加载更多轨迹</Button>:null}</>}
  onRefresh={metrics.refresh}
  refreshCount={metrics.refreshCount} refreshCadence={metrics.cadence} onRefreshCadenceChange={metrics.setCadence}
  settings={config.settings} onSettingsChange={analysisConfiguration.setSettings}
  layout={config.layout} onLayoutChange={analysisConfiguration.setLayout}
 /></AnalysisDataProvider>;
}
