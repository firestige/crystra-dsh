import React from 'react';
import * as Core from 'crystra-ui-core';
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
 const controller=createEvaluateController({catalogCoordinates:Core.CATALOG_COORDINATES,gateway,storage});
 const {Analysis}=createProductAnalysis({React,Core,gateway,controller});
 const surface=createProductSurface({React,Core,controller,storage,sharedStyles,renderAnalysis:(page,onNavigate)=>React.createElement(Analysis,{page,onNavigate})});
 return surface.apply(ctx);
}
