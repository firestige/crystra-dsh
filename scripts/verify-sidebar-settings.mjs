const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{await p.goto(process.argv[2]??'http://127.0.0.1:3086/');await p.waitForTimeout(1000);for(const name of ['Continue','Configure later','继续','稍后配置']){const btn=p.getByRole('button',{name,exact:true});if(await btn.isVisible()){await btn.click();await p.waitForTimeout(200);}}
await p.getByRole('button',{name:'任务视图',exact:true}).waitFor();
await p.locator('[data-section-id="host-settings"]').click();
await p.getByRole('dialog').waitFor();
assert.equal(await p.locator('[data-crystra-product-overlay]').isVisible(),true);
const dialog=p.getByRole('dialog');const box=await dialog.boundingBox();const hit=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+40));});
console.log(JSON.stringify({dialog:box,dialogReceivesPointer:hit,errors}));
await p.screenshot({path:'/tmp/crystra-six-settings.png'});
assert.equal(hit,true,'settings modal must receive pointer above Crystra');
await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
await p.locator('[data-section-id="task-section-header"] .crystra-sidebar-title').hover();await p.screenshot({path:'/tmp/crystra-six-sidebar.png'});
assert.deepEqual(errors,[]);console.log('PASS: settings opens and closes without leaving Crystra');
}finally{await b.close();}
