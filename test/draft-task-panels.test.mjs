import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDraftTaskPanel} from '../src/client/draft-task-panels.js';
const Core={TaskRequirementsPanel:({data})=>React.createElement('h2',null,data.heading)};
test('renders only current admitted task and removes content after invalidation',()=>{
 let state={state:'valid',projection:{binding:{taskId:'a'},provenance:'fixture',snapshotRevision:'s1',surfaces:{grilling:{state:'available',value:{heading:'Draft content'}}}}};
 const source={subscribe(){return ()=>{};},getSnapshot:()=>state};
 const Panel=createDraftTaskPanel({React,Core,source});
 const render=id=>renderToStaticMarkup(React.createElement(Panel,{taskId:id,surface:'grilling'}));
 assert.match(render('a'),/Draft content/);assert.match(render('a'),/草案探索/);
 assert.doesNotMatch(render('b'),/Draft content/);
 state={state:'invalid',reason:'SNAPSHOT_EXPIRED'};assert.doesNotMatch(render('a'),/Draft content/);assert.match(render('a'),/SNAPSHOT_EXPIRED/);
});
test('unavailable surface does not invoke a renderer or synthesize empty domain data',()=>{
 const source={subscribe(){return ()=>{};},getSnapshot:()=>({state:'valid',projection:{binding:{taskId:'a'},surfaces:{grilling:{state:'unavailable',reason:'OWNER_MISSING'}}}})};
 const Panel=createDraftTaskPanel({React,Core,source});
 assert.match(renderToStaticMarkup(React.createElement(Panel,{taskId:'a',surface:'grilling'})),/OWNER_MISSING/);
});
