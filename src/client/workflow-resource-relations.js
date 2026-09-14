const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=4096;
/** Relations belong to the supplied source snapshot, never to a later saved candidate. */
export function admitResourceRelations(source,current,snapshotRevision){
 if(!object(source)||!object(current)||source.root!==current.root||source.version!==current.version||!Array.isArray(source.files)||source.files.length>200||!Array.isArray(current.files)||current.files.length!==source.files.length||!Array.isArray(source.nodes)||source.nodes.length>400||!Array.isArray(source.edges)||source.edges.length>1000)return false;
 const files=new Map(source.files.map(f=>[f?.path,f]));if(files.size!==source.files.length||new Set(current.files.map(f=>f?.path)).size!==current.files.length)return false;
 for(const f of source.files){
  if(!object(f)||typeof f.internal!=='boolean'||typeof f.truncated!=='boolean'||(f.displayName!==undefined&&!text(f.displayName)))return false;
  if(f.presentation!==undefined){const p=f.presentation;if(!object(p)||!text(p.id)||p.type!=='cli'||p.renderer!=='markdown'||!text(p.name)||!Array.isArray(p.members)||p.members.length>200||!p.members.every(path=>files.has(path))||!Array.isArray(p.aliases)||p.aliases.length>1000||!p.aliases.every(text))return false;}
 }
 for(const f of current.files){const base=files.get(f?.path);if(!base||!text(f.path)||typeof f.content!=='string'||f.content!==base.content||(f.revision??snapshotRevision)!==(base.revision??snapshotRevision)||f.internal!==base.internal||f.truncated!==base.truncated)return false;}
 const nodes=new Map();
 for(const n of source.nodes){if(!object(n)||!text(n.id)||!text(n.label)||(n.typeLabel!==undefined&&!text(n.typeLabel))||nodes.has(n.id)||!['file','resource','action','activity','artifact','route','role','external'].includes(n.kind)||(n.file!==undefined&&(!text(n.file)||!files.has(n.file)))||(n.kind==='file'&&(n.id!=='file:'+n.file||!files.has(n.file))))return false;nodes.set(n.id,n);}
 const adjacent=new Map();
 for(const e of source.edges){if(!object(e)||!nodes.has(e.from)||!nodes.has(e.to)||typeof e.label!=='string'||e.label.length>4096||!(e.kind===undefined||['call','reference'].includes(e.kind)))return false;const row=adjacent.get(e.from)??[];row.push(e.to);adjacent.set(e.from,row);}
 // Bound invisible intermediary traversal before the public graph projects paths.
 const hidden=id=>['resource','action','route'].includes(nodes.get(id)?.kind);let budget=20000;
 for(const id of nodes.keys()){
  const stack=[{id,seen:new Set([id])}];
  while(stack.length){if(--budget<0)return false;const row=stack.pop();for(const target of adjacent.get(row.id)??[]){if(!hidden(target))continue;if(row.seen.has(target))return false;stack.push({id:target,seen:new Set([...row.seen,target])});}}
 }
 return true;
}
export function createResourceRelationsRenderer({React,Core,source,workspace,getWorkspace=()=>workspace,snapshotRevision,isCurrent,catalog}){
 const available=()=>isCurrent()&&admitResourceRelations(source,getWorkspace(),snapshotRevision);
 const declared=path=>catalog.some(r=>r.files.some(f=>f.path===path))&&source.files.some(f=>f.path===path&&!f.internal&&!f.truncated);
 return ({selection,onOpenFile})=>{
  if(!available()||!catalog.some(r=>r.id===selection.resourceId&&r.files.some(f=>f.path===selection.path))||!declared(selection.path))return React.createElement('p',{role:'status'},'关系投影不可用：当前资源与来源快照不一致。');
  return React.createElement(Core.ResourceRelationGraph,{source,file:selection.path,onOpenFile:path=>{if(available()&&declared(path))onOpenFile(path);}});
 };
}
