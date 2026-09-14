import {createDraftTaskIntegration} from './draft-task-integration.js';
import React from 'react';
import {getSharedDeliveryControlPlaneClient} from '../../modules/execution/src/client/delivery/control-plane-port.js';
import {createTaskInputController} from './task-input-controller.js';
import {BiSurface,Button,CATALOG_COORDINATES,CrystraAnalysisFrame,CrystraTraceContent,CrystraShell,DashboardMetricPanel,DeliveryDirectory,Surface,TaskBrowser,TaskWorkbench,TaskRequirementsPanel,TaskPlanPanel,TaskExecutionPanel,TaskGatePanel,TaskDeliveryPanel,TextInput,Typography,WorkflowExplorer,WorkflowWorkbench,compileTraceView,decodeEvidencePage,loadRecordedTrace} from 'crystra-ui-core';
const Core=Object.freeze({BiSurface,Button,CATALOG_COORDINATES,CrystraAnalysisFrame,CrystraTraceContent,CrystraShell,DashboardMetricPanel,DeliveryDirectory,Surface,TaskBrowser,TaskWorkbench,TaskRequirementsPanel,TaskPlanPanel,TaskExecutionPanel,TaskGatePanel,TaskDeliveryPanel,TextInput,Typography,WorkflowExplorer,WorkflowWorkbench,compileTraceView,decodeEvidencePage,loadRecordedTrace});
import sharedStyles from 'crystra-ui-core/styles.css';
import {createEvaluateController} from '../../modules/studio/src/client/evaluate-model.js';
import {createStudioGatewayPort} from '../../modules/studio/src/client/studio.js';
import {createProductSurface} from './product-surface.js';
import {createProductAnalysis} from './product-analysis.js';
export const name='crystra-product-client';
export const inject=['slots','connection','workspaces','sessions'];
export function apply(ctx){
 const storage=typeof window==='undefined'?undefined:window.sessionStorage;
 const gateway=createStudioGatewayPort(ctx);
 const evaluation=createEvaluateController({catalogCoordinates:Core.CATALOG_COORDINATES,gateway,storage});
 const drafts=createDraftTaskIntegration({React,Core,source:evaluation,gateway:{call:(endpoint,payload)=>ctx.connection.rpc.call('/crystra-exploration',endpoint,payload)}});
 const controller=drafts.controller;
 const controlPlane=getSharedDeliveryControlPlaneClient(ctx.connection.rpc);
 const {Analysis,dispose:disposeAnalysis}=createProductAnalysis({React,Core,gateway,controller,inventory:controlPlane.inventory});
 const taskInput=createTaskInputController({inventory:controlPlane.inventory,sessions:ctx.sessions});
 const surface=createProductSurface({React,Core,controller,storage,sharedStyles,taskInput,renderTaskPanels:drafts.renderTaskPanels,renderAnalysis:(page,onNavigate)=>React.createElement(Analysis,{page,onNavigate})});
 const syncTask=()=>{const nav=surface.navigation.getSnapshot();taskInput.setTask(nav.surface==='crystra'&&nav.route.page==='task'?nav.route.id:undefined);};
 const stop=surface.navigation.subscribe(syncTask);syncTask();
 ctx.effect(()=>()=>{stop();taskInput.dispose();disposeAnalysis();drafts.dispose();},'crystra-product: task input binding');
 void drafts.start();
 return surface.apply(ctx);
}
