/** Pinned-host outer rectangle bridge. Never reparents or edits native Input descendants. */
export function attachWorkflowInputGeometry({document,window,ResizeObserver}){
 const target=document.querySelector('.crystra-product-overlay .crystra-workflow-layout > [data-section-id="input-stream"]');
 const frame=document.querySelector('.pI_x6G_frame');
 if(!target||!frame||!ResizeObserver)return ()=>{};
 const fields={left:'left',top:'top',width:'width',height:'height'};
 const update=()=>{const rect=target.getBoundingClientRect();for(const [key,field] of Object.entries(fields))frame.style.setProperty(`--crystra-workflow-input-${key}`,`${rect[field]}px`);};
 const observer=new ResizeObserver(update);observer.observe(target);if(target.parentElement)observer.observe(target.parentElement);update();
 window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
 return ()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);for(const key of Object.keys(fields))frame.style.removeProperty(`--crystra-workflow-input-${key}`);};
}
