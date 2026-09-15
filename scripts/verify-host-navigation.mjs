#!/usr/bin/env node
// Optional browser acceptance: CRYSTRA_PLAYWRIGHT_MODULE points at an installed
// Playwright module when it is not on this checkout's module resolution path.
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const overlay=page.locator('[data-crystra-product-overlay]');
const visible=async locator=>{await locator.waitFor({state:'visible'});};
try {
 const origin=process.argv[2]??'http://127.0.0.1:3086';
 const workspace=await mkdtemp(join(tmpdir(),'crystra-banner-test-'));
 const response=await fetch(new URL('/api/workspace.create',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'banner-test-workspace',method:'workspace.create',payload:{path:workspace}})});
 assert.equal((await response.json()).result?.ok,true);
 await page.goto(origin);
 await page.waitForTimeout(1500);
 for(const label of ['Continue','继续','Configure later','稍后配置']){
  const button=page.getByRole('button',{name:label,exact:true});
  if(await button.isVisible()){await button.click();await page.waitForTimeout(300);}
 }
 await visible(overlay);
 await page.getByRole('button',{name:'切换到 DeepSeek Harness',exact:true}).click();
 await overlay.waitFor({state:'detached'});
 assert.equal(await page.locator('[data-crystra-sidebar-resources]').count(),0);
 assert.equal(await page.locator('.hHd-Xa_footerActions button').count(),0);
 const brand=page.getByRole('button',{name:'进入 Crystra',exact:true});await visible(brand);
 await page.getByRole('button',{name:'Choose workspace',exact:true}).click();
 await page.getByRole('menuitem',{name:basename(workspace),exact:true}).click();
 const editor=page.locator('textarea:not([readonly])').first();await visible(editor);
 const draft='Unsent native Harness draft - banner regression';await editor.fill(draft);
 for(const action of ['click','Enter','Space']){
  if(action==='click')await brand.click();else await brand.press(action);
  await visible(overlay);
  await page.getByRole('button',{name:'切换到 DeepSeek Harness',exact:true}).click();
  await overlay.waitFor({state:'detached'});
  assert.equal(await editor.inputValue(),draft,`${action} must not create or clear a native session`);
 }
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 const expand=page.getByRole('button',{name:/^(Open|Expand) sidebar$/});await visible(expand);await page.waitForTimeout(250);
 await expand.press('Enter');await visible(brand);assert.equal(await overlay.count(),0);
 assert.equal(await editor.inputValue(),draft);
 await brand.click();await visible(overlay);
 await page.getByRole('button',{name:'收起侧边栏',exact:true}).click();
 await page.getByRole('button',{name:'展开侧边栏',exact:true}).click();
 await visible(overlay);
 await page.getByRole('button',{name:'切换到 DeepSeek Harness',exact:true}).click();
 await overlay.waitFor({state:'detached'});assert.equal(await editor.inputValue(),draft);
 // The independent native action must retain its unprevented bubbling click.
 await page.evaluate(()=>{document.addEventListener('click',event=>{if(event.target.closest('button.hHd-Xa_newSession'))document.documentElement.dataset.nativeNewSessionClick=String(!event.defaultPrevented);},{once:true});});
 await page.getByRole('button',{name:'New session',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-native-new-session-click'),'true');
 await brand.click();await visible(overlay);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',checks:['native workspace restored','legacy delivery and footer entry absent','mouse/Enter/Space banner round trips preserve unsent draft','native collapsed banner only expands','Crystra collapsed banner only expands','separate new-session action retained','no browser page errors'],modelRequests:0}));
} finally {await browser.close();}
