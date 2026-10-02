import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE||'playwright');
const {CRYSTRA_HOST_LOG:hostLog,CRYSTRA_TEST_TASK_ID:task,CRYSTRA_BROWSER_STATE:storageState}=process.env;
if(!hostLog||!task)throw Error('Set CRYSTRA_HOST_LOG and CRYSTRA_TEST_TASK_ID to an existing Task with a long Brief');
const launch=(await readFile(hostLog,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)[0];
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({storageState,viewport:{width:1600,height:850}});
 const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(launch+'#/tasks/'+task);await page.getByRole('tab',{name:/^需求/}).click();
 const preview=page.locator('[data-section-id="grilling-live-brief"] .crystra-viewer-preview');await preview.locator('.crystra-grilling-field').first().waitFor();
 const measure=await preview.evaluate(el=>({height:el.clientHeight,total:el.scrollHeight,overflow:getComputedStyle(el).overflowY,fields:el.querySelectorAll('.crystra-grilling-field').length}));
 console.log('BRIEF',measure);assert.ok(measure.height>0&&measure.total>measure.height);assert.equal(measure.overflow,'auto');
 await preview.evaluate(el=>{el.scrollTop=el.scrollHeight;});assert.ok(await preview.evaluate(el=>el.scrollTop>0 && Math.abs(el.scrollTop+el.clientHeight-el.scrollHeight)<2));
 if(process.env.CRYSTRA_SCREENSHOT)await page.screenshot({path:process.env.CRYSTRA_SCREENSHOT});
 assert.deepEqual(errors,[]);
 const empty=await context.newPage();
 await empty.route('**/crystra-control/tasks/projection',async route=>{const response=await route.fetch();const body=await response.json();body.result={ok:true,value:{taskId:task,stage:'requirements',brief:{state:'missing'},plan:{state:'missing'},run:{current:null},updating:true}};await route.fulfill({response,json:body});});
 await empty.goto(launch+'#/tasks/'+task);await empty.getByRole('tab',{name:/^需求/}).waitFor();await empty.waitForTimeout(1800);
 console.log('TABS',await empty.getByRole('tablist').innerText());console.log('BADGE_CANDIDATES',await empty.getByRole('tablist').locator('[class*="badge"]').count());
 assert.equal(await empty.getByRole('tablist').locator('[class*="badge"]').count(),0);
 console.log('PASS live scroll and fresh skeleton without badges');
}finally{await browser.close();}
