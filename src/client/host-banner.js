/** Adapter for the pinned DSH 0.1.1-rc.2 SidebarRoot. The public brand slot
 * owns the marker, but DSH keeps the button and its collapse/new-session actions.
 * Only the expanded brand click is intercepted, before React's delegated click.
 */
export function bindHostBanner(button, openCrystra) {
 if(button?.matches('button.hHd-Xa_toggle'))return()=>{};
 if(!button?.matches('button.hHd-Xa_brand'))throw new Error('CRYSTRA_HOST_BANNER_LAYOUT_UNSUPPORTED');
 const oldLabel=button.getAttribute('aria-label');
 const click=event=>{event.preventDefault();event.stopImmediatePropagation();openCrystra();};
 button.setAttribute('aria-label','进入 Crystra');
 button.addEventListener('click',click,{capture:true});
 return()=>{
  button.removeEventListener('click',click,{capture:true});
  if(button.getAttribute('aria-label')==='进入 Crystra'){
   if(oldLabel===null)button.removeAttribute('aria-label');else button.setAttribute('aria-label',oldLabel);
  }
 };
}
export function createHostBanner({React,renderHostBrand,openCrystra}) {
 return function HostBrand({size=24}){
  const marker=React.useRef(null);
  React.useLayoutEffect(()=>bindHostBanner(marker.current?.closest('button'),openCrystra),[]);
  return React.createElement('span',{ref:marker,'data-crystra-host-brand':true,style:{display:'inline-flex'}},renderHostBrand?.(size));
 };
}
