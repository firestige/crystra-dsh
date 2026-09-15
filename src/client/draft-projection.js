import {validateTaskAssets} from './draft-task-assets.js';
import {validateDraftSurfaceValue} from "./draft-surface-values.js";
/** Exploration-only envelope admission. This does not validate domain claims or authorize effects.
 * context must come from the trusted adapter selection, never from response.binding.
 * Consumers must re-admit on context changes and expiry before displaying the projection.
 */
export function admitDraftProjection(response,context,now=Date.now()) {
 const invalid=reason=>({state:'invalid',authority:'draft',reason});
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const text=value=>typeof value==='string'&&value.trim().length>0;
 if(!object(context)||context.environment!=='exploration')return invalid('EXPLORATION_REQUIRED');
 if(context.draftId!=='crystra-ui-exploration'||context.revision!=='draft.1')return invalid('UNSUPPORTED_DRAFT');
 if(context.accessAllowed!==true)return invalid('ACCESS_REQUIRED');
 if(!/^[a-f0-9]{64}$/.test(context.sourceLockDigest??'')||
    !['taskId','goalRevision','adapterId'].every(key=>text(context[key]))||
    !(context.planRevision===null||text(context.planRevision)))return invalid('INVALID_CONTEXT');
 if(!object(response)||!object(response.binding))return invalid('INVALID_ENVELOPE');
 for(const key of ['draftId','revision','sourceLockDigest','environment','taskId','goalRevision','planRevision','adapterId']){
  if(response.binding[key]!==context[key])return invalid('BINDING_CHANGED');
 }
 if(response.provenance!=='service'&&response.provenance!=='fixture')return invalid('INVALID_PROVENANCE');
 if(response.provenance==='fixture'&&context.allowFixtures!==true)return invalid('FIXTURE_NOT_ENABLED');
 const expiry=Date.parse(response.expiresAt);
 if(!text(response.expiresAt)||!Number.isFinite(expiry)||new Date(expiry).toISOString()!==response.expiresAt||!Number.isFinite(now))return invalid('INVALID_EXPIRY');
 if(expiry<=now)return invalid('SNAPSHOT_EXPIRED');
 if(!text(response.snapshotRevision)||!object(response.surfaces))return invalid('INVALID_SNAPSHOT');
 const names=['grilling','plan','execution','gate','delivery'];
 if(Object.keys(response.surfaces).length!==names.length)return invalid('INVALID_SURFACES');
 for(const name of names){
  const surface=response.surfaces[name];
  if(!object(surface))return invalid('INVALID_SURFACES');
  if(surface.state==='unavailable'){
   if(!text(surface.reason)||Object.keys(surface).some(key=>!['state','reason'].includes(key)))return invalid('INVALID_SURFACES');
  }else if(surface.state==='available'){
   if(!object(surface.value)||Object.keys(surface).some(key=>!['state','value'].includes(key)))return invalid('INVALID_SURFACES');
   if(!validateDraftSurfaceValue(name,surface.value))return invalid('INVALID_SURFACE_VALUE');
  }else return invalid('INVALID_SURFACES');
 }
 if(response.inputBinding!==undefined){
  const b=response.inputBinding;
  if(!object(b)||Object.keys(b).length!==3||!['workspaceId','packageRoot','sessionId'].every(k=>text(b[k])&&b[k].length<=4096)||!b.packageRoot.startsWith('/')||b.packageRoot.includes('\\')||b.packageRoot.split('/').some(v=>v==='.'||v==='..'))return invalid('INVALID_INPUT_BINDING');
 }
 if(!validateTaskAssets(response.assets,response.surfaces))return invalid('INVALID_TASK_ASSETS');
 return {state:'valid',authority:'draft',projection:response};
}
