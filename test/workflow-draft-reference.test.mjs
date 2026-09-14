import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkflowDraftReference} from '../src/client/workflow-draft-reference.js';
function fixture(){let state={draft:'Keep original',phase:'plain'},binding={kind:'active',definitionId:'d',revision:'r1',workspaceId:'w',sessionId:'s'},focus=0;const scope={};const sessions={list:{getSnapshot:()=>({current:'s'})},scope:()=>scope,scopeOf:()=> 's'};const bridge=createWorkflowDraftReference({input:{getSnapshot:()=>binding},sessions,conversation:{input:{for:()=>({state:{getSnapshot:()=>state},setDraft:text=>{state={...state,draft:text};},submit:()=>assert.fail('must not send')})}},focusInput:()=>focus++});return {bridge,get:()=>state,bind:v=>binding=v,set:v=>state=v,focus:()=>focus};}
test('appends an exact object reference to the native draft without sending or replacing existing text',()=>{
 const f=fixture();assert.equal(f.bridge({definitionId:'d',revision:'r1',kind:'resource',resourceId:'res-1',resourceRevision:'file-r1',path:'roles/a.md'}),true);
 assert.match(f.get().draft,/^Keep original\n\n/);assert.match(f.get().draft,/"resourceId":"res-1"/);assert.match(f.get().draft,/"revision":"r1"/);assert.equal(f.focus(),1);
});
test('rejects a stale workflow revision and busy Input before writing',()=>{
 const f=fixture();assert.equal(f.bridge({definitionId:'d',revision:'r2',kind:'activity',objectId:'a'}),false);assert.equal(f.get().draft,'Keep original');
 f.set({draft:'Keep original',phase:'submitting'});assert.equal(f.bridge({definitionId:'d',revision:'r1',kind:'activity',objectId:'a'}),false);assert.equal(f.focus(),0);
});
