import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { removeRunDirectory, stopChildProcess } from "./stop-child-process.mjs";

const root = resolve(import.meta.dirname, "../../..");
const chromeBinary = process.env.CRYSTRA_CHROME_BINARY ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function freePort() {
  const server = createNetServer();
  await new Promise((accept, reject) => server.once("error", reject).listen(0, "127.0.0.1", accept));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("STUDIO_BROWSER_PORT_UNAVAILABLE");
  await new Promise((accept, reject) => server.close((error) => error === undefined ? accept() : reject(error)));
  return address.port;
}

async function waitFor(predicate, label, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      const value = await predicate();
      if (value !== undefined && value !== false) return value;
    } catch (error) { last = error; }
    await new Promise((accept) => setTimeout(accept, 100));
  }
  throw new Error(`${label}: ${last?.message ?? "timed out"}`);
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((accept, reject) => {
      this.socket.addEventListener("open", accept, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const request = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error === undefined) request?.resolve(message.result);
      else request?.reject(new Error(`${message.error.code}: ${message.error.message}`));
    });
  }

  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const answer = await this.command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (answer.exceptionDetails !== undefined) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text);
    return answer.result.value;
  }

  close() { this.socket.close(); }
}

test("real Chrome follows Dashboard to exact Evidence and Trace while preserving semantic styles and renderer hierarchy", { timeout: 60_000 }, async () => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const temporary = await mkdtemp(join(tmpdir(), "crystra-studio-browser-"));
  let server;
  let chrome;
  let cdp;
  try {
    let serverLog = "";
    server = spawn(process.execPath, ["scripts/serve-studio-dev-harness.mjs"], {
      cwd: root,
      env: { ...process.env, CRYSTRA_STUDIO_DEV_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => { serverLog += chunk; });
    server.stderr.on("data", (chunk) => { serverLog += chunk; });
    await waitFor(async () => {
      if (server.exitCode !== null) throw new Error(serverLog);
      const response = await fetch(origin);
      return response.ok;
    }, "STUDIO_DEV_SERVER_UNAVAILABLE");

    let chromeLog = "";
    chrome = spawn(chromeBinary, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "chrome")}`, origin,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.on("data", (chunk) => { chromeLog += chunk; });
    const browserSocket = await waitFor(() => chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/u)?.[1], "CHROME_DEVTOOLS_UNAVAILABLE");
    const debugOrigin = new URL(browserSocket);
    const target = await waitFor(async () => {
      const pages = await (await fetch(`http://${debugOrigin.host}/json/list`)).json();
      return pages.find((page) => page.type === "page" && page.url.startsWith(origin));
    }, "STUDIO_BROWSER_PAGE_UNAVAILABLE");
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await Promise.all([cdp.command("Runtime.enable"), cdp.command("Page.enable")]);

    await waitFor(() => cdp.evaluate(`document.querySelector('[data-crystra-selection-browser]') !== null`), "STUDIO_SELECT_UNAVAILABLE");
    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Load tasks').click(); })()`);
    await waitFor(() => cdp.evaluate(`document.querySelector('[data-crystra-task-id="task-example"] input') !== null`), "STUDIO_TASK_UNAVAILABLE");
    await cdp.evaluate(`document.querySelector('[data-crystra-task-id="task-example"] input').click()`);
    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Evaluate selection').click(); })()`);
    await waitFor(() => cdp.evaluate(`document.querySelector('[data-crystra-dashboard-panel]') !== null`), "STUDIO_DASHBOARD_UNAVAILABLE");

    const theme = await cdp.evaluate(`(() => {
      const root = document.querySelector('.studio-theme-root');
      const section = document.querySelector('.crystra-surface[data-level="section"]');
      return {
        semantic: getComputedStyle(root).getPropertyValue('--crystra-surface-section').trim(),
        sidebar: getComputedStyle(root).getPropertyValue('--dsw-specific-sidebar-fill').trim(),
        background: getComputedStyle(section).backgroundColor,
      };
    })()`);
    assert.notEqual(theme.sidebar, "");
    assert.equal(theme.semantic, theme.sidebar);
    assert.equal(theme.background, theme.sidebar);

    await cdp.evaluate(`(() => { const buttons = [...document.querySelectorAll('[data-crystra-dashboard-panel] button')]; const button = buttons.find((node) => /evidence/i.test(node.textContent + ' ' + (node.getAttribute('aria-label') ?? ''))); if (!button) throw new Error('Dashboard Evidence action missing: ' + JSON.stringify(buttons.map((node) => [node.textContent, node.getAttribute('aria-label')]))); button.click(); })()`);
    await waitFor(() => cdp.evaluate(`document.body.innerText.includes('fact-1')`), "STUDIO_EXACT_EVIDENCE_UNAVAILABLE");
    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.includes('${"a".repeat(32)}')).click(); })()`);
    await waitFor(() => cdp.evaluate(`document.querySelector('[data-trace-renderer="waterfall"]') !== null`), "STUDIO_EXACT_TRACE_UNAVAILABLE");

    const hierarchyFor = async (view) => {
      await cdp.evaluate(`(() => { [...document.querySelectorAll('[aria-label="Trace renderer views"] button')].find((node) => node.textContent.trim() === ${JSON.stringify(view)}).click(); })()`);
      return waitFor(() => cdp.evaluate(`(() => {
        const frame = document.querySelector('[data-studio-trace-hierarchy]');
        const renderer = frame?.querySelector('[data-trace-renderer]');
        const navigation = frame?.querySelector('[aria-label="Trace renderer navigation"]');
        const header = renderer;
        if (renderer?.querySelector('.trace-summary-strip')) throw new Error('Duplicate Trace summary');
        if (!renderer || renderer.dataset.traceRenderer !== ${JSON.stringify(view.toLowerCase())}) return undefined;
        return { navigationBeforeHeader: Boolean(navigation && header && (navigation.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING)) };
      })()`), `STUDIO_${view.toUpperCase()}_HIERARCHY_UNAVAILABLE`);
    };
    for (const view of ["Waterfall", "Tree"]) {
      assert.deepEqual(await hierarchyFor(view), { navigationBeforeHeader: true });
    }

    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Dashboard').click(); })()`);
    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Evidence').click(); })()`);
    assert.equal(await waitFor(() => cdp.evaluate(`document.body.innerText.includes('fact-1')`), "STUDIO_TOP_EVIDENCE_RESTORE_FAILED"), true);
    await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Recorded Trace').click(); })()`);
    assert.equal(await waitFor(() => cdp.evaluate(`document.querySelector('[data-trace-renderer]') !== null`), "STUDIO_TOP_TRACE_RESTORE_FAILED"), true);
  } finally {
    cdp?.close();
    await stopChildProcess(chrome);
    await stopChildProcess(server);
    await removeRunDirectory(temporary);
  }
});
