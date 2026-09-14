import React from 'react';
import * as Core from 'crystra-ui-core';
import sharedStyles from 'crystra-ui-core/styles.css';
import * as Primitives from '@deepseek-ai/dsh-client-ui-primitives';
import {createEvaluateController} from '../../modules/studio/src/client/evaluate-model.js';
import {createStudioGatewayPort,StudioView} from '../../modules/studio/src/client/studio.js';
import {createProductSurface} from './product-surface.js';
export const name='crystra-product-client';
export const inject=['slots','connection','workspaces'];
export function apply(ctx){
 const storage=typeof window==='undefined'?undefined:window.sessionStorage;
 const controller=createEvaluateController({catalogCoordinates:Core.CATALOG_COORDINATES,gateway:createStudioGatewayPort(ctx),storage});
 const Analysis=StudioView(React,Primitives,Core,sharedStyles,controller,undefined,storage);
 const surface=createProductSurface({React,Core,controller,storage,sharedStyles,renderAnalysis:()=>React.createElement(Analysis)});
 return surface.apply(ctx);
}
