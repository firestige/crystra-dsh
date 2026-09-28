import type { ComponentProps } from 'react';
import type { AnalysisSurface } from 'crystra-ui-core';
type SurfaceProps = ComponentProps<typeof AnalysisSurface>;
export interface AnalysisConfiguration {
 settings: NonNullable<SurfaceProps['settings']>;
 layout: SurfaceProps['layout'];
}
/** Host-session configuration only; no Evidence loading or persistence contract. */
export function createAnalysisConfigurationStore() {
 let snapshot:AnalysisConfiguration={settings:[],layout:undefined};
 const listeners=new Set<()=>void>();
 return {
  getSnapshot:()=>snapshot,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
  setSettings:(settings:AnalysisConfiguration['settings'])=>{
   snapshot={...snapshot,settings:structuredClone(settings)};listeners.forEach(listener=>listener());
  },
  setLayout:(layout:AnalysisConfiguration['layout'])=>{
   snapshot={...snapshot,layout:structuredClone(layout)};listeners.forEach(listener=>listener());
  },
 };
}
export const analysisConfiguration = createAnalysisConfigurationStore();
