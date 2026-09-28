import {useSyncExternalStore} from 'react';
import {AnalysisSurface, AnalysisDataProvider, type AnalysisPage} from 'crystra-ui-core';
import {analysisLocation,analysisViewPath,analysisPeriodPath} from './navigation.js';
import {analysisConfiguration} from './configuration-store';
const emptyData = {unavailableReason:'按全局时间范围的数据服务尚未接入；刷新暂不可用。'};
/** DSH coordinates routing and host configuration; query limitations never redefine a page. */
export function HostAnalysis({view,onNavigate}:{view:AnalysisPage;onNavigate:(path:string)=>void}) {
 const config=useSyncExternalStore(analysisConfiguration.subscribe,analysisConfiguration.getSnapshot);
 const location=analysisLocation(window.location.href);
 return <AnalysisDataProvider value={emptyData}><AnalysisSurface
  view={view}
  onViewChange={(next)=>onNavigate(analysisViewPath(window.location.href,next))}
  period={location.period} initialScope={location.scope}
  onPeriodChange={(period)=>onNavigate(analysisPeriodPath(window.location.href,period))}
  sourceContext={view==='traces'?location.sourceContext:{}}
  dataNotice="按全局时间范围的数据服务尚未接入；当前不展示样本数据，刷新暂不可用。"
  settings={config.settings} onSettingsChange={analysisConfiguration.setSettings}
  layout={config.layout} onLayoutChange={analysisConfiguration.setLayout}
 /></AnalysisDataProvider>;
}
