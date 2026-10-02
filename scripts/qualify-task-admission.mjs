import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE||'playwright');
const log=await readFile(process.env.CRYSTRA_HOST_LOG,'utf8');
const launchUrl=log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)[0];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(launchUrl);
 for(const name of ['Continue','Configure later']){
  const button=page.getByRole('button',{name,exact:true});
  if(await button.isVisible())await button.click();
 }
 await page.getByRole('button',{name:'新建任务',exact:true}).click();
 await page.getByRole('button',{name:'Choose workspace',exact:true}).click();
 await page.getByText(process.env.CRYSTRA_TEST_WORKSPACE||'Projects',{exact:true}).last().click();
 await page.locator('[data-slot="conversation.input.model"] button').first().click();
 await page.getByRole('menuitem',{name:/Model/}).click();
 const model=process.env.CRYSTRA_TEST_MODEL||'GPT-5.6-Sol';
 await page.getByText(model,{exact:true}).last().waitFor();
 const current=(await page.locator('[data-slot="conversation.input.model"] button').first().innerText()).trim();
 const selection=current===model?null:page.waitForResponse(r=>r.url().endsWith('/session/selectModel'));
 await page.getByText(model,{exact:true}).last().click();
 if(selection)assert.equal((await (await selection).json()).result.ok,true,'native model selection must succeed');
 await page.keyboard.press('Escape');
 const prompt='UI 布局验收：请只回复“验收通过”，不要读取或修改文件，也不要调用工具。';
 const input=page.locator('[contenteditable=true]');
 await input.fill(prompt);await input.press('Enter');
 await page.waitForURL(/#\/tasks\/task-/,{timeout:30000});
 const route=new URL(page.url()).hash;
 async function assertLayout(){
  await page.locator('.crystra-page-bench').waitFor();
  const header=await page.locator('[data-section-id="workspace-header"]').boundingBox();
  const chat=await page.locator('.crystra-page-chat').boundingBox();
  const bench=await page.locator('.crystra-page-bench').boundingBox();
  assert.equal(header.height,88);
  assert.equal(chat.y,header.y+header.height);
  assert.equal(bench.y,chat.y);
  assert.ok(bench.x>=chat.x+chat.width);
  assert.ok(bench.width>=680);
  assert.equal(await page.locator('.crystra-sidebar').count(),1);
  assert.equal(await page.getByRole('alert').count(),0);
  assert.ok(!(await page.locator('body').innerText()).includes("reading 'find'"));
  return {header,chat,bench};
 }
 const geometry=await assertLayout();
 for(const name of ['计划','执行','审核','交付','需求']){
  await page.locator('[data-section-id="workspace-header"]').getByRole('tab',{name,exact:true}).click();
  await assertLayout();
 }
 const response=await page.reload();assert.equal(response.status(),200);
 await assertLayout();assert.equal(new URL(page.url()).hash,route);
 await page.locator('.crystra-page-chat').getByText(prompt,{exact:true}).first().waitFor();
 assert.deepEqual(errors,[]);
 if(process.env.CRYSTRA_TEST_SCREENSHOT)await page.screenshot({path:process.env.CRYSTRA_TEST_SCREENSHOT});
 console.log(JSON.stringify({route,geometry,reload:true,tabs:5,errors}));
}finally{await browser.close();}
