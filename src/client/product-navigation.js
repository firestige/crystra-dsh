const KEY='crystra.product-navigation@1';
const PAGES=new Set(['tasks','task','workflows','workflow','analysis-overview','analysis-traces','analysis-reports']);
const CONTEXT=new Set(['workbench','scrollTop','query','view','selectedId']);
function route(page,id,revision){
 if(!PAGES.has(page))throw new Error('CRYSTRA_ROUTE_INVALID');
 if(['task','workflow'].includes(page) && (typeof id!=='string'||!id.trim()||id.length>512))throw new Error('CRYSTRA_ROUTE_IDENTITY_REQUIRED');
 if(page==='workflow'&&(typeof revision!=='string'||!revision.trim()||revision.length>512))throw new Error('CRYSTRA_ROUTE_REVISION_REQUIRED');
 return Object.freeze({page,...(['task','workflow'].includes(page)?{id}:{}),...(page==='workflow'?{revision}:{})});
}
function context(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([key,item])=>!CONTEXT.has(key)||(typeof item!=='string'&&typeof item!=='number')||(typeof item==='string'&&item.length>2048)||(typeof item==='number'&&!Number.isFinite(item))))throw new Error('CRYSTRA_ROUTE_CONTEXT_INVALID');
 return Object.freeze({...value});
}
const key=route=>JSON.stringify(route);
export function createProductNavigation(storage){
 let current=route('tasks'),surface='crystra',history=[],contexts={};
 try{
  const saved=JSON.parse(storage?.getItem(KEY)??'null');
  if(saved){
   const restored=route(saved.route.page,saved.route.id,saved.route.revision);
   if(!['crystra','harness'].includes(saved.surface)||!Array.isArray(saved.history)||saved.history.length>50)throw new Error('invalid');
   const entries=Object.entries(saved.contexts??{}).map(([k,v])=>[k,context(v)]);
   history=saved.history.map(r=>route(r.page,r.id,r.revision));contexts=Object.fromEntries(entries);current=restored;surface=saved.surface;
  }
 }catch{current=route('tasks');surface='crystra';history=[];contexts={};}
 const listeners=new Set();
 let snapshot;
 function publish(){
  snapshot=Object.freeze({surface,route:current,context:contexts[key(current)]??Object.freeze({})});
  try{storage?.setItem(KEY,JSON.stringify({surface,route:current,history,contexts}));}catch{/* Navigation remains usable when storage is unavailable. */}
  for(const listener of listeners)listener();
 }
 publish();
 return Object.freeze({
  getSnapshot:()=>snapshot,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  navigate(page,id,revision){const next=route(page,id,revision);if(key(next)!==key(current)){history=[...history,current].slice(-50);current=next;}surface='crystra';publish();},
  saveContext(value){contexts={...contexts,[key(current)]:context(value)};publish();},
  back(){if(history.length){current=history.at(-1);history=history.slice(0,-1);}publish();},
  openHarness(){surface='harness';publish();},
  openCrystra(){surface='crystra';publish();},
 });
}
