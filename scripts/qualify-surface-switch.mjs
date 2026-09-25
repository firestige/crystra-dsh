import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
// Browser driver is a qualification tool, never a shipped runtime dependency.
const { chromium } = await import(
  process.env.CRYSTRA_PLAYWRIGHT_MODULE || "playwright"
);
const hostLog = process.env.CRYSTRA_HOST_LOG;
const taskId = process.env.CRYSTRA_TEST_TASK_ID;
if (!hostLog || !taskId)
  throw Error(
    "Set CRYSTRA_HOST_LOG and CRYSTRA_TEST_TASK_ID for an existing local instance",
  );
const log = await readFile(hostLog, "utf8");
const url = log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)[0];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  let createdSessions = 0;
  page.on("request", request => {if(request.method()==="POST" && new URL(request.url()).pathname === "/api/session/create")createdSessions++;});
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForTimeout(2000);
  for (const name of ["Continue", "Configure later"])
    if (await page.getByRole("button", { name, exact: true }).count())
      await page.getByRole("button", { name, exact: true }).click();
  const brand = page.getByRole("button", {
    name: "切换到 DeepSeek Harness",
    exact: true,
  });
  await brand.waitFor();
  assert.equal(
    await brand.isEnabled(),
    true,
    "Crystra brand must be connected to the host switch",
  );
  await page
    .locator(".crystra-sidebar a")
    .filter({ hasText: taskId })
    .first()
    .click();
  await page.getByRole("tab", { name: "计划", exact: true }).click();
  const previous = page.url();
  await brand.click();
  await page
    .getByRole("button", { name: "返回 Crystra", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".crystra-sidebar").count(),
    0,
    "Native mode must show native sidebar",
  );
  assert.equal(
    await page.locator(".crystra-product-main").count(),
    0,
    "Native mode must show native conversation",
  );
  for (const name of ["Continue", "Configure later"])
    if (await page.getByRole("button", { name, exact: true }).count())
      await page.getByRole("button", { name, exact: true }).click();
  if (process.env.CRYSTRA_SCREENSHOT)
    await page.screenshot({ path: process.env.CRYSTRA_SCREENSHOT });
  const editor = page.locator('[contenteditable=true]').first();
  if(await editor.count())await editor.fill('Crystra surface draft probe');
  const hasDraft=await editor.count()>0;
  const nativeBanner = page.getByRole("button", { name: "返回 Crystra", exact: true });
  assert.equal(await nativeBanner.getAttribute("data-section-id"),"surface-banner");
  await nativeBanner.click();
  await brand.waitFor();
  assert.equal(page.url(), previous);
  assert.equal(
    await page
      .getByRole("tab", { name: "计划", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  if(hasDraft) {
    await brand.click();
    await page.getByRole('button',{name:'返回 Crystra',exact:true}).waitFor();
    await page.waitForTimeout(300);
    for(const name of ['Continue','Configure later'])if(await page.getByRole('button',{name,exact:true}).count())await page.getByRole('button',{name,exact:true}).click();
    assert.ok((await page.locator('[contenteditable=true]').first().innerText()).includes('Crystra surface draft probe'),'Native draft must survive the round trip');
    await page.locator('[contenteditable=true]').first().fill('');
    await page.getByRole('button',{name:'返回 Crystra',exact:true}).click();
  }
  assert.equal(createdSessions,0,"Banner switching must not create a Session");
  assert.equal(await page.locator(".crystra-return").count(),0,"No extra return button");
  assert.deepEqual(errors, []);
  console.log(
    "PASS Crystra -> native DSH -> same Task/Plan; zero browser errors",
  );
} finally {
  await browser.close();
}
