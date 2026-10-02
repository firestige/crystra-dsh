/** Native provider events retain lossless logs; DSH owns cards and disclosure UI. */
const installed=new WeakSet();
const parse=value=>{if(typeof value!=='string')return value??{};try{return JSON.parse(value);}catch{return value;}};
const blocks=text=>[{type:'text',text}];
function resultValue(result){return parse(result.content?.filter(b=>b.type==='text').map(b=>b.text).join('\n')??'');}
function readable(value){
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.map(readable).filter(Boolean).join('\n');
 if(value&&typeof value==='object'){
  for(const key of ['aggregatedOutput','content','text','output','message'])if(value[key]!==undefined)return readable(value[key]);
 }
 return JSON.stringify(value,null,2)??'';
}
function callView(type,value){
 const args=parse(value),name=type==='provider'?args.toolName:type,body=type==='provider'?parse(args.arguments):args;
 if(name==='commandExecution'||['bash','shell','powershell'].includes(name))return {card:'terminal',title:body.command??body.cmd??name,...(body.cwd?{cwd:body.cwd}:{})};
 const paths=name==='fileChange'?(body.changes??[]).map(c=>c.path).filter(Boolean):[body.path??body.file_path].filter(Boolean);
 const kind=name==='fileChange'||['create','edit','write'].includes(name)?'edit':['view','read'].includes(name)?'read':['webSearch','grep','glob'].includes(name)?'search':'other';
 const action={edit:'修改',read:'读取',search:'搜索',other:name==='mcpToolCall'?`${body.server??'MCP'} · ${body.tool??'调用工具'}`:name};
 const detail=paths.join(', ')||body.query||body.pattern||body.url||body.description||'';
 return {card:'generic',kind,title:[action[kind],detail].filter(Boolean).join(' '),...(paths.length?{locations:paths.map(path=>({path}))}:{}),...(name==='mcpToolCall'?{rawInput:body.arguments}:{})};
}
function resultView(type,args,result){
 const call=callView(type,args),value=resultValue(result);
 if(call.card==='terminal')return {card:'terminal',output:readable(value),...(typeof value?.exitCode==='number'?{exitCode:value.exitCode}:{})};
 if(type==='fileChange')return {card:'generic',content:blocks((value.changes??args.changes??[]).map(c=>`${c.path}\n\n\`\`\`diff\n${c.diff??''}\n\`\`\``).join('\n\n')||readable(value))};
 if(type==='mcpToolCall')return {card:'generic',content:blocks(readable(value.error??value.result??value))};
 return {card:'generic',content:blocks(readable(value))};
}
export function registerExternalChatPresenters(ctx){
 if(!ctx.tools||installed.has(ctx.tools))return;installed.add(ctx.tools);
 ctx.tools.register({name:'Crystra native command',description:'Display-only native command.',parameters:{type:'object'},output:{schema:{},render:()=>[]},async execute(){throw Error('CRYSTRA_PRESENTATION_ONLY');},presentCall:args=>callView('commandExecution',args),presentResult:(args,result)=>{const value=result.meta?.nativeResult;return {card:'terminal',output:result.content?.map(b=>b.text??'').join('\n')??'',...(typeof value?.exitCode==='number'?{exitCode:value.exitCode}:{})};}});
 for(const type of ['commandExecution','fileChange','mcpToolCall','webSearch','provider'])ctx.tools.register({
  name:type==='provider'?'Crystra provider tool':`Codex ${type}`,
  description:'Display-only native Provider event; execution belongs to its Provider.',
  parameters:{type:'object',additionalProperties:true},
  output:{schema:{},render:()=>[]},
  async execute(){throw Error('CRYSTRA_PRESENTATION_ONLY');},
  presentCall:args=>callView(type,args),presentResult:(args,result)=>resultView(type,args,result)
 });
}

export function nativeToolCall(event){
 const type=event.name.startsWith('Codex ')?event.name.slice(6):event.name==='Crystra provider tool'?'provider':null;
 if(!type)return {...event};
 const outer=parse(event.arguments),args=type==='provider'?parse(outer.arguments):outer,tool=type==='provider'?outer.toolName:type;
 const view=callView(type,outer);
 const name=view.card==='terminal'?'Crystra native command':view.kind==='read'?'read':view.kind==='edit'?(tool==='create'?'write':'edit'):view.kind==='search'?(tool==='webSearch'?'web_search':tool==='glob'?'glob':'grep'):view.title;
 const display=view.card==='terminal'?{command:view.title,...(view.cwd?{cwd:view.cwd}:{})}:view.locations?.length===1?{path:view.locations[0].path}:view.kind==='search'?{query:args.query??args.pattern??view.title}:{description:view.title};
 return {name,arguments:display,nativeType:type,nativeArguments:outer};
}
export function nativeToolResult(call,event){
 if(!call.nativeType)return {text:event.text??''};
 const nativeResult=parse(event.text??''),view=resultView(call.nativeType,call.nativeArguments,{content:blocks(event.text??'')});
 return {text:view.card==='terminal'?view.output:readable(view.content),meta:{nativeCall:call.nativeArguments,nativeResult}};
}
