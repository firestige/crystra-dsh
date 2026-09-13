import React from 'react';
export function InitializationView({node}) {
 let result;
 try{result=JSON.parse(node.outcome?.text??'{}');}catch{result={status:'FAILED',code:node.outcome?.text};}
 return React.createElement('section',{'data-crystra-initialization':'true',role:'status',style:{padding:'12px',border:'1px solid currentColor',borderRadius:'8px'}},
  React.createElement('strong',null,'Crystra'),
  React.createElement('div',null,result.status??'PREPARING'),
  result.code?React.createElement('div',null,result.code):null,
  ...(result.diagnostics??[]).map((item,index)=>React.createElement('div',{key:index},`${item.code}${item.path?': '+item.path:''}`)),
  result.retry?React.createElement('div',null,`Retry: /crystra ${result.retry}`):null,
  result.status==='NEEDS_CONFIGURATION'?React.createElement('div',null,'Run /crystra setup to prepare this installation.'):null,
 );
}
export const name='crystra-initialization-client';
export const inject=['slots'];
export function apply(ctx) {
 ctx.slots.inject('conversation.chat.commandview',()=>{
  ctx.slots.register({name:'conversation.chat.commandview',key:'crystra-initialization'},InitializationView);
 });
}
