import {decodeAnalysisPreferences} from 'crystra-ui-core';
import type { ComponentProps } from 'react';
import type { AnalysisSurface } from 'crystra-ui-core';
type SurfaceProps = ComponentProps<typeof AnalysisSurface>;
export interface AnalysisConfiguration {
 settings: NonNullable<SurfaceProps['settings']>;
 layout: SurfaceProps['layout'];
 storageError?: string;
}
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'>;
const storageKey='crystra.analysis.configuration.v1';
function browserStorage(): Storage | undefined {
 try { return globalThis.localStorage; } catch { return undefined; }
}
/** DSH owns browser persistence; Observation data and transient selections are never saved. */
export function createAnalysisConfigurationStore(storage:Storage|undefined=browserStorage()) {
 let snapshot:AnalysisConfiguration={settings:[],layout:undefined};
 try {
  const raw=storage?.getItem(storageKey);
  if(raw){const saved=JSON.parse(raw);const restored=saved?.version===1?decodeAnalysisPreferences(saved.configuration):undefined;if(!restored)throw Error('invalid configuration');snapshot={...restored,layout:restored.layout};}
 } catch { snapshot={...snapshot,storageError:'分析配置无法读取，当前使用默认设置。'}; }
 const listeners=new Set<()=>void>();
 const update=(next:AnalysisConfiguration)=>{
  snapshot=structuredClone(next);
  try {
   if(!storage)throw Error('localStorage unavailable');
   storage.setItem(storageKey,JSON.stringify({version:1,configuration:{settings:snapshot.settings,layout:snapshot.layout}}));
   delete snapshot.storageError;
  } catch { snapshot={...snapshot,storageError:'分析配置未能保存到此浏览器，当前页面的修改仍保留。'}; }
  listeners.forEach(listener=>listener());
 };
 return {
  getSnapshot:()=>snapshot,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
  setSettings:(settings:AnalysisConfiguration['settings'])=>update({...snapshot,settings}),
  setLayout:(layout:AnalysisConfiguration['layout'])=>update({...snapshot,layout}),
 };
}
export const analysisConfiguration = createAnalysisConfigurationStore();
