import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Read-only host qualification after a real conversation has confirmed its Brief.
const { chromium } = await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE || 'playwright');
const { CRYSTRA_HOST_LOG: logPath, CRYSTRA_TEST_TASK_ID: taskId,
  CRYSTRA_BROWSER_STATE: storageState } = process.env;
if (!logPath || !taskId) throw Error('Set CRYSTRA_HOST_LOG and CRYSTRA_TEST_TASK_ID');
const launch = (await readFile(logPath, 'utf8')).match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)[0];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ storageState, viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const projectionResponse = () => page.waitForResponse(response => response.url().endsWith('/crystra-control/tasks/projection'));
  let pending = projectionResponse();
  await page.goto(`${launch}#/tasks/${encodeURIComponent(taskId)}`);
  for (let iteration = 0; iteration < 2; iteration++) {
    const envelope = await (await pending).json();
    assert.equal(envelope.result.ok, true, JSON.stringify(envelope));
    const projection = envelope.result.value;
    assert.equal(projection.taskId, taskId);
    assert.equal(projection.brief.confirmed, true);
    assert.equal(projection.plan.state, 'available');
    await page.getByRole('tab', { name: /^计划/ }).click();
    await page.locator('.crystra-page-bench').getByText(projection.plan.value.goal, { exact: true }).first().waitFor();
    for (const tab of ['需求', '计划', '执行', '审核', '交付'])
      assert.equal(await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).count(), 1);
    const chat = await page.locator('.crystra-page-chat').boundingBox();
    const bench = await page.locator('.crystra-page-bench').boundingBox();
    assert.ok(chat && bench && chat.width > 200 && bench.width > 200);
    assert.equal(chat.y, bench.y);
    if (!iteration) { pending = projectionResponse(); await page.reload(); }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: exact Task projection, confirmed Brief, live Plan, five tabs, split layout and reload');
} finally {
  await browser.close();
}
