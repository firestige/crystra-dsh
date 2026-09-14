const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=100000;
const optional=(v,check)=>v===undefined||check(v);
const array=(v,check,max=1000)=>Array.isArray(v)&&v.length<=max&&v.every(check);
const strings=v=>array(v,text);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e7;
const box=v=>object(v)&&['x','y','width','height'].every(k=>number(v[k]));
const unique=values=>new Set(values).size===values.length;
export function validWorkflowMap(ir){
 if(!object(ir)||ir.version!=='0.2'||!text(ir.title)||!optional(ir.description,v=>typeof v==='string')||!array(ir.nodes,n=>object(n)&&text(n.id)&&text(n.title)&&['start','end','activity','decision','fork','join','group'].includes(n.kind)&&optional(n.parent,text)&&optional(n.description,v=>typeof v==='string')&&['inputs','outputs','resources'].every(k=>optional(n[k],strings)),400)||!array(ir.edges,e=>object(e)&&['id','from','to'].every(k=>text(e[k]))&&['label','summaryLabel','trigger'].every(k=>optional(e[k],v=>typeof v==='string')),1000))return false;
 const ids=new Map(ir.nodes.map(n=>[n.id,n]));if(ids.size!==ir.nodes.length||!unique(ir.edges.map(e=>e.id))||ir.edges.some(e=>!ids.has(e.from)||!ids.has(e.to)))return false;
 for(const n of ir.nodes){const seen=new Set([n.id]);let parent=n.parent;while(parent){if(seen.has(parent)||ids.get(parent)?.kind!=='group')return false;seen.add(parent);parent=ids.get(parent).parent;}}
 return true;
}
export function validWorkflowLayout(layout,ir,raw=false){
 if(!object(layout)||![layout.width,layout.height].every(v=>number(v)&&v>0)||!array(layout.nodes,n=>object(n)&&ir.nodes.some(x=>x.id===n.id)&&['x','y','width','height'].every(k=>number(n[k]))&&n.width>0&&n.height>0&&typeof n.expanded==='boolean'&&optional(n.caption,c=>box(c)&&number(c.baseline)))||!unique(layout.nodes.map(n=>n.id)))return false;
 return array(layout.edges,e=>object(e)&&ir.edges.some(x=>x.id===(raw?e.originalId:e.id))&&array(e.points,p=>object(p)&&number(p.x)&&number(p.y),2000)&&e.points.length>=2&&(raw||typeof e.path==='string')&&optional(e.label,l=>box(l)&&typeof l.text==='string'))&&optional(layout.boundaries,v=>array(v,b=>object(b)&&['id','group','edgeId','external','target','direction','side'].every(k=>typeof b[k]==='string')&&number(b.x)&&number(b.y)))&&['ports','interfaces','branchBlocks'].every(k=>optional(layout[k],v=>array(v,object)));
}
function resourceValue(v){
 if(!object(v)||!object(v.workspace)||!array(v.catalog,object))return false;
 const w=v.workspace;if(!['title','root','version'].every(k=>text(w[k]))||!array(w.files,f=>object(f)&&text(f.path)&&typeof f.content==='string'&&f.content.length<=500000&&typeof f.internal==='boolean'&&typeof f.truncated==='boolean'&&optional(f.revision,text))||!unique(w.files.map(f=>f.path))||!array(w.nodes,n=>object(n)&&['id','label','kind'].every(k=>text(n[k])))||!array(w.edges,e=>object(e)&&['from','to','label'].every(k=>typeof e[k]==='string')))return false;
 const files=new Map(w.files.map(f=>[f.path,f]));
 return unique(v.catalog.map(r=>r.id))&&v.catalog.every(r=>['id','name','path','group'].every(k=>text(r[k]))&&typeof r.purpose==='string'&&strings(r.aliases)&&array(r.files,f=>object(f)&&files.has(f.path)&&files.get(f.path).content===f.content&&typeof f.internal==='boolean'));
}
function crystalValue(v){
 if(!object(v)||!['id','baselineRevision','candidateRevision','title','scope','notice'].every(k=>text(v[k]))||!validWorkflowMap(v.before)||!validWorkflowMap(v.after)||!object(v.layouts)||!object(v.details)||!strings(v.validation))return false;
 if(!['before','after'].every(k=>v.layouts[k]===null||(object(v.layouts[k])&&JSON.stringify(v.layouts[k].ir)===JSON.stringify(v[k])&&validWorkflowLayout(v.layouts[k].layout,v[k]))))return false;
 if(!Object.values(v.details).every(d=>object(d)&&['new','adjusted','retained'].includes(d.kind)&&['change','body','input','output'].every(k=>typeof d[k]==='string')&&optional(d.beforeBody,v=>typeof v==='string')))return false;
 return ['beforeSummary','afterSummary'].every(k=>optional(v[k],x=>typeof x==='string'))&&optional(v.history,h=>object(h)&&['sampleLabel','costShare','criticalPathShare','summary'].every(k=>typeof h[k]==='string'))&&optional(v.forecast,f=>object(f)&&['costChange','latencyChange','summary'].every(k=>typeof f[k]==='string')&&strings(f.assumptions))&&optional(v.measured,m=>object(m)&&typeof m.scope==='string'&&typeof m.summary==='string'&&array(m.metrics,x=>object(x)&&typeof x.label==='string'&&typeof x.value==='string'));
}
export function admitWorkflowDraft(projection,context,now=Date.now()){
 const invalid=reason=>({state:'invalid',reason,authority:'draft'});
 if(context?.environment!=='exploration'||context.draftId!=='crystra-ui-exploration'||context.revision!=='draft.1'||context.adapterId!=='crystra-workflow-file@1'||context.accessAllowed!==true)return invalid('DRAFT_CONTEXT_INVALID');
 if(!['definitionId','definitionRevision','workspaceId'].every(k=>text(context[k]))||!/^[a-f0-9]{64}$/.test(context.sourceLockDigest))return invalid('DRAFT_CONTEXT_INVALID');
 if(!object(projection)||!object(projection.binding))return invalid('DRAFT_INVALID');
 for(const key of ['environment','draftId','revision','adapterId','definitionId','definitionRevision','workspaceId','sourceLockDigest'])if(projection.binding[key]!==context[key])return invalid('DRAFT_BINDING_CHANGED');
 if(!['service','fixture'].includes(projection.provenance)||(projection.provenance==='fixture'&&context.allowFixtures!==true))return invalid('FIXTURE_NOT_ENABLED');
 if(!text(projection.snapshotRevision)||!Number.isFinite(Date.parse(projection.expiresAt))||new Date(projection.expiresAt).toISOString()!==projection.expiresAt||Date.parse(projection.expiresAt)<=now)return invalid('SNAPSHOT_EXPIRED');
 if(!['resourceStoreAvailable','resourceWriteAllowed'].every(k=>optional(projection[k],v=>typeof v==='boolean'))||(projection.resourceWriteAllowed===true&&projection.resourceStoreAvailable!==true))return invalid('RESOURCE_AUTHORITY_INVALID');
 if(!optional(projection.inputBinding,b=>object(b)&&['workspaceId','packageRoot','sessionId'].every(k=>text(b[k])&&b[k].length<=4096)&&(/^(?:\/|[A-Za-z]:[\\/])/.test(b.packageRoot))))return invalid('INPUT_BINDING_INVALID');
 const entry=projection.entry;if(!object(entry)||entry.definitionId!==context.definitionId||entry.revision!==context.definitionRevision||!text(entry.title)||entry.status!=='DRAFT'||typeof entry.isLatest!=='boolean'||!['purpose','packageName','createdAt','updatedAt','thumbnail'].every(k=>optional(entry[k],v=>typeof v==='string'))||!optional(entry.pinned,v=>typeof v==='boolean')||!optional(entry.nodeCount,v=>Number.isInteger(v)&&v>=0))return invalid('DIRECTORY_IDENTITY_INVALID');
 for(const key of ['studio','resources','crystallization']){
  const surface=projection[key];if(!object(surface))return invalid('SURFACE_INVALID');
  if(surface.state==='unavailable'){if(!text(surface.reason))return invalid('SURFACE_INVALID');continue;}
  if(surface.state!=='available')return invalid('SURFACE_INVALID');
  const v=surface.value;
  if(key==='studio'&&(!object(v)||!validWorkflowMap(v.ir)||!strings(v.groups)||!unique(v.groups)||v.groups.some(id=>!v.ir.nodes.some(n=>n.id===id&&n.kind==='group'))||!object(v.layouts)||Object.entries(v.layouts).some(([name,layout])=>!(/^(RIGHT|DOWN)[0-9]+$/.test(name))||!validWorkflowLayout(layout,v.ir,true))))return invalid('MAP_INVALID');
  if(key==='resources'&&!resourceValue(v))return invalid('RESOURCES_INVALID');
  if(key==='crystallization'&&!crystalValue(v))return invalid('CRYSTALLIZATION_INVALID');
 }
 return {state:'valid',authority:'draft',projection};
}
/** Use coordinates only for the exact supplied definition and expansion state. */
export function workflowDraftLayout(source,ir,expanded,direction){
 if(JSON.stringify(source.ir)!==JSON.stringify(ir))throw new Error('DEFINITION_LAYOUT_MISMATCH');
 const mask=source.groups.reduce((value,id,i)=>value+(expanded.has(id)?2**i:0),0),layout=source.layouts[direction+mask];
 if(!layout)throw new Error('LAYOUT_UNAVAILABLE');
 return {...layout,edges:layout.edges.map((edge,i)=>{
  const semantic=ir.edges.find(e=>e.id===edge.originalId),last=edge.points.at(-1);let id=semantic.to;
  while(id&&!layout.nodes.some(n=>n.id===id))id=ir.nodes.find(n=>n.id===id)?.parent;
  const target=layout.nodes.find(n=>n.id===id&&!n.expanded);
  return {...edge,id:edge.originalId,segmentKey:edge.originalId+':'+i,path:edge.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),arrow:!!target&&last.x>=target.x-.1&&last.x<=target.x+target.width+.1&&last.y>=target.y-.1&&last.y<=target.y+target.height+.1};
 })};
}
