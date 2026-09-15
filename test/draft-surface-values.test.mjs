import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDraftSurfaceValue} from '../src/client/draft-surface-values.js';
const values={
 grilling:{heading:'h',summary:'s',briefSummary:'b',topics:[],fields:[],changes:[]},
 plan:{identity:'p',status:'s',question:'q',goal:'g',completion:'c',nonGoals:'n',readiness:[],attention:[],changes:[]},
 execution:{title:'t',summary:'s',frontier:'f',metrics:[],waves:[]},
 gate:{gates:[]},
 delivery:{readiness:{title:'t',description:'d',coverage:'unknown',tone:'neutral'},recalculation:'r',artifacts:[],acceptance:[],risk:'unknown',economics:[]},
};
test('accepts explicit readonly UI shapes but rejects absent fields and non-JSON payloads',()=>{
 for(const [name,value] of Object.entries(values)){
  assert.equal(validateDraftSurfaceValue(name,value),true,name);
  assert.equal(validateDraftSurfaceValue(name,{}),false,name);
  assert.equal(validateDraftSurfaceValue(name,{...value,command:'approve'}),false,name);
 }
});
test('rejects duplicate semantic identities, malformed nested metrics and incomplete run bindings',()=>{
 assert.equal(validateDraftSurfaceValue('grilling',{...values.grilling,topics:[{id:'a',title:'t',progress:'p',tone:'neutral'},{id:'a',title:'t',progress:'p',tone:'neutral'}]}),false);
 assert.equal(validateDraftSurfaceValue('delivery',{...values.delivery,economics:[{label:'cost',value:12}]}),false);
 assert.equal(validateDraftSurfaceValue('execution',{...values.execution,waves:[{id:'w',title:'t',status:'s',identity:{planRun:'p',wave:'w'},progress:'p',output:'o',boundary:'b'}]}),false);
 assert.equal(validateDraftSurfaceValue('plan',{...values.plan,readiness:[{id:'a',title:'t',status:'s',items:null}]}),false);
});
