import React from 'react';
const h=React.createElement;
const parse=value=>{try{return JSON.parse(value);}catch{return null;}};
const text=value=>typeof value==='string'?value:'';
/** Read-only projection of the frozen tool call; never revives a settled RPC. */
export function QuestionHistory({block,inspect}) {
 const settled='kind' in block;
 const args=parse((settled?block.call?.argsRaw:block.argsRaw)??'');
 const questions=Array.isArray(args?.questions)?args.questions.filter(q=>q&&typeof q.question==='string'):[];
 const code=block.error?.code;
 const interrupted=['ASK_ABORTED','TOOL_OUTCOME_UNKNOWN'].includes(code);
 const failed=!!block.error||block.isError===true;
 const result=settled&&!failed&&block.content?.length===1&&block.content[0]?.type==='text'?parse(block.content[0].text):null;
 const answers=Array.isArray(result?.answers)?result.answers:[];
 const status=!settled?'等待回答':code==='ASK_CANCELLED'?'提问已取消，尚未回答':interrupted?'提问已中断，尚未回答':failed?'提问失败，尚未回答':answers.length?'回答已记录':'未找到有效回答记录';
 return h('section',{className:'crystra-question-history','aria-label':'提问记录'},
  h('div',{className:'crystra-question-status'},status),
  questions.length?questions.map((q,index)=>{
   const answer=answers.find(a=>a&&a.id===q.id);
   return h('div',{key:index},q.header&&h('strong',null,text(q.header)),
    h('p',{className:'crystra-question-copy'},q.question),
    q.detail&&h('p',{className:'crystra-question-copy'},text(q.detail)),
    h('ul',null,(Array.isArray(q.options)?q.options:[]).map((o,i)=>h('li',{key:i},h('span',null,text(o?.label)),o?.description&&h('p',{className:'crystra-question-copy'},text(o.description))))),
    answer&&h('p',null,Array.isArray(answer.selected)&&answer.selected.length?`已选择：${answer.selected.filter(v=>typeof v==='string').join('、')}`:answer.skipped?'已跳过':'',answer.custom&&h('span',{className:'crystra-question-copy'},` 自定义回答：${text(answer.custom)}`)));
  }):h('p',null,'问题内容尚不可用'),
  interrupted&&h('p',null,'继续对话后重新提问；此前已确认的答案保留。'),
  inspect&&h('button',{type:'button',onClick:inspect},'查看调用详情'));
}
export function registerQuestionHistory(ctx){
 ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:'ask_user_question',priority:-10},QuestionHistory));
}
