const SLOT='conversation.session.header';
/** Pinned native header composition through the public shadowing/store seats.
 * The original entry and its children remain registered; no Conversation body,
 * draft mirror, composer, or approval carrier is replaced.
 */
export function installNativeSessionHeader({React,slots,target}){
 return slots.inject(SLOT,()=>{
  let release,baseline,disposed=false;
  function Header({sessionId,useStore,actions}){
   const view=useStore(s=>s.view);
   React.useLayoutEffect(()=>{
    if(target.getSnapshot()===sessionId)actions.setView('chat');
   },[sessionId,actions]);
   if(target.getSnapshot()!==sessionId||view===null||view==='chat')return null;
   return React.createElement('button',{type:'button',className:'crystra-input-return',onClick:()=>actions.setView('chat')},'返回对话');
  }
  function sync(){
   if(disposed)return;
   const entries=slots.entries(SLOT);
   if(release&&(!target.getSnapshot()||!entries.includes(baseline))){release();release=undefined;baseline=undefined;}
   if(release||!target.getSnapshot())return;
   const original=[...slots.entries(SLOT)].sort((a,b)=>(a.options.priority??0)-(b.options.priority??0))[0];
   // Missing/shared-store-incompatible hosts retain their own header visibly.
   if(!original?.store||typeof original.store==='function')return;
   baseline=original;
   release=slots.register({name:SLOT,priority:(original.options.priority??0)-1,store:original.store},Header);
  }
  const stops=[slots.subscribe(SLOT,sync),target.subscribe(sync)];sync();
  return()=>{disposed=true;for(const stop of stops)stop();release?.();};
 });
}
