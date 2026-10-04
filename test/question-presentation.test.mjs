import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QuestionHistory} from '../src/client/questions/history.js';
const argsRaw=JSON.stringify({questions:[{id:'focus',question:'你选哪种？\n背景说明',options:[{label:'A. 床头钟',description:'横屏显示'},{label:'B. 专注钟'}]}]});
const render=block=>renderToStaticMarkup(React.createElement(QuestionHistory,{block}));
test('durable interrupted tool outcomes retain question and options without raw JSON or old controls',()=>{
 const html=render({kind:'tool-result',call:{argsRaw},error:{code:'TOOL_OUTCOME_UNKNOWN'},isError:true,content:[{type:'text',text:'outcome unknown'}]});
 assert.match(html,/提问已中断，尚未回答/);assert.match(html,/A\. 床头钟/);assert.match(html,/横屏显示/);assert.match(html,/你选哪种？\n背景说明/);
 assert.doesNotMatch(html,/button|radio|argsRaw|outcome unknown/);
});
test('answered history preserves selection and custom answer while remaining read only',()=>{
 const html=render({kind:'tool-result',call:{argsRaw},content:[{type:'text',text:JSON.stringify({answers:[{id:'focus',selected:['B. 专注钟'],custom:'加日期'}]})}]});
 assert.match(html,/已选择：B\. 专注钟/);assert.match(html,/加日期/);assert.doesNotMatch(html,/button/);
});
test('pending, cancelled, failed and malformed calls never invent answers',()=>{
 assert.match(render({argsRaw}),/等待回答/);
 assert.match(render({kind:'tool-result',call:{argsRaw},error:{code:'ASK_CANCELLED'},content:[]}),/提问已取消/);
 assert.match(render({kind:'tool-result',call:{argsRaw},isError:true,content:[]}),/提问失败/);
 assert.match(render({argsRaw:'{'}),/问题内容尚不可用/);
});
