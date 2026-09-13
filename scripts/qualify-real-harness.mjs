#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { qualificationArchives } from "./lib/qualification-artifacts.mjs";
import {prepareProfile,assertSinglePlugin} from "./lib/crystra-profile.mjs";
import { resolveQualificationExecutionAsset } from "./lib/qualification-execution-asset.mjs";

const root = resolve(new URL("../", import.meta.url).pathname);
const chromeBinary = process.env.CRYSTRA_CHROME_BINARY ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const compatibility = JSON.parse(await readFile(resolve(root, "config/dsh-compatibility.json"), "utf8"));
const executionAsset = await resolveQualificationExecutionAsset({ compatibility });
const ownerAsset = executionAsset.coordinate;
const initializationFixture = process.env.CRYSTRA_QUALIFY_INITIALIZATION === "1";
const terminalFixture = process.env.CRYSTRA_QUALIFY_TERMINAL === "1";
const screenshotDirectory = process.env.CRYSTRA_QUALIFY_SCREENSHOT_DIR;

function run(command, args, options = {}) {
  const answer = spawnSync(command === "dsh" ? (process.env.CRYSTRA_DSH_BINARY ?? command) : command, args, { encoding: "utf8", ...options });
  if (answer.error !== undefined || answer.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${answer.stdout ?? ""}\n${answer.stderr ?? ""}`.trim());
  }
  return answer.stdout;
}

async function freePort() {
  const server = createNetServer();
  await new Promise((accept, reject) => server.once("error", reject).listen(0, "127.0.0.1", accept));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("HARNESS_PORT_UNAVAILABLE");
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

async function callApi(origin, method, payload) {
  const rpcId = randomUUID();
  const response = await fetch(`${origin}/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "client-request", rpcId, method, payload }),
  });
  if (!response.ok) throw new Error(`HARNESS_API_TRANSPORT_FAILED: ${method} HTTP ${response.status}`);
  const envelope = await response.json();
  if (envelope.rpcId !== rpcId || envelope.result?.ok !== true) {
    throw new Error(`HARNESS_API_FAILED: ${method} ${JSON.stringify(envelope.result?.error)}`);
  }
  return envelope.result.value;
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((accept, reject) => {
      this.socket.addEventListener("open", accept, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error === undefined) request?.resolve(message.result);
        else request?.reject(new Error(`${message.error.code}: ${message.error.message}`));
      } else this.events.push(message);
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
    if (answer.exceptionDetails !== undefined) throw new Error(answer.exceptionDetails.text);
    return answer.result.value;
  }

  close() { this.socket.close(); }
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((accept) => child.once("exit", accept)),
    new Promise((accept) => setTimeout(accept, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function captureScreenshot(cdp, name) {
  const screenshot = await cdp.command("Page.captureScreenshot", { format: "png", fromSurface: true });
  const bytes = Buffer.from(screenshot.data, "base64");
  if (screenshotDirectory !== undefined) {
    await mkdir(screenshotDirectory, { recursive: true });
    await writeFile(join(screenshotDirectory, `${name}.png`), bytes);
  }
  return createHash("sha256").update(bytes).digest("hex");
}

async function waitForStableDeliveryLayout(cdp, label) {
  let previous;
  let stableSamples = 0;
  return waitFor(async () => {
    const bounds = await cdp.evaluate(`(() => {
      const view = document.querySelector('[data-crystra-delivery-id]');
      const composer = document.querySelector('textarea:not(:disabled)')?.closest('form');
      if (!view) return undefined;
      const sample = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return [rect.x, rect.width].map((value) => Math.round(value));
      };
      return { view: sample(view), composer: sample(composer) };
    })()`);
    if (bounds === undefined) return undefined;
    const serialized = JSON.stringify(bounds);
    stableSamples = serialized === previous ? stableSamples + 1 : 0;
    previous = serialized;
    return stableSamples >= 2 ? bounds : undefined;
  }, label);
}

const temporary = await mkdtemp(join(tmpdir(), "crystra-dsh-real-harness-"));
let harness;
let chrome;
let cdp;
let fixtureServer;
let harnessLog = "";
try {
  const packages = join(temporary, "packages");
  const archives = await qualificationArchives({ root, output: packages });
  const pluginArchive = archives[0];
  if (archives.length !== 1) throw new Error("HARNESS_ARCHIVE_COUNT");

  const home = join(temporary, "home");
  const repository = join(temporary, "repository");
  const state = join(temporary, "state");
  await Promise.all([mkdir(repository), mkdir(state)]);
  await mkdir(join(repository, ".crystra"));
  run("git", ["init", "--quiet", repository]);
  await writeFile(join(repository, ".crystra", "role-provider-bindings.json"), `${JSON.stringify({
    schemaVersion: "execution.repository-role-provider-bindings@1.0.0",
    bindings: {
      "role.greeter": { agentProvider: { identity: "provider.copilot", version: "1.0.78" }, model: { provider: "github-copilot", model: "gpt-5.3-codex" } },
      "role.reviewer": { agentProvider: { identity: "provider.codex", version: "0.144.5" }, model: { provider: "openai", model: "gpt-5.6-sol" } },
    },
  }, null, 2)}\n`, { mode: 0o600 });
  const configFile = join(temporary, "execution.json");
  await writeFile(configFile, `${JSON.stringify({
    schemaVersion: "execution.config@2.0.0",
    paths: {
      repositoryRoot: repository,
      workspaceRoot: repository,
      allowedWorktreeRoots: [repository],
      stateRoot: state,
    },
    workflowSource: {
      kind: "github",
      repository: "firestige/crystra-workflow-package",
      releasesBaseUrl: "https://api.github.com/repos/firestige/crystra-workflow-package/releases",
      assetPattern: "workflow-package-{name}-{version}.tar.gz",
    },
    runner: {
      implementationKey: "runner.v2",
      host: { engine: "langgraph" },
      maxParallelToolCalls: 2,
    },
    observation: {
      enabled: false, timeoutMs: 1000, maxBatchRecords: 8, maxBatchBytes: 65_536,
      flushIntervalMs: 1000, shutdownFlushMs: 1000, serviceName: "crystra-dsh-qualification",
    },
    controls: {
      startupTimeoutMs: 30_000, executionTimeoutMs: 60_000, shutdownTimeoutMs: 10_000,
      maxConcurrentDeliveries: 1, allowExplicitRefresh: false, diagnosticMaxBytes: 4096,
    },
    intake: { maxCorrelationBytes: 256, maxOutputBytes: 8192 },
  }, null, 2)}\n`);

  const bindings = join(temporary, "bindings.json");
  const fixturePort = await freePort();
  const traceId = "a".repeat(32);
  let fixtureAvailable = true;
  fixtureServer = createHttpServer((request, response) => {
    const json = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (!fixtureAvailable) { json(503, { error: { code: "QUALIFICATION_DOWN" } }); return; }
    if (request.url === "/healthz") {
      if (request.headers.accept === "text/plain") { response.writeHead(200, { "content-type": "text/plain" }); response.end("ok"); }
      else json(200, { status: "ok" });
      return;
    }
    if (request.url === "/openapi.json") { json(200, { paths: { "/v1/evidence/tasks": {}, "/v1/evidence/facts": {}, "/v1/evidence/traces": {} } }); return; }
    if (request.url?.startsWith("/v1/evidence/tasks")) { json(200, {
      contract: { name: "evidence.query", revision: "1.0.0" }, observation_profile: "2.0.0",
      read_model_revision: "2.0.0", snapshot: "qualification", items: [
        { task_id: "task-a", display_name: "Writer quality pass" },
        { task_id: "task-b", display_name: "Reviewer convergence" },
        { task_id: "task-c", display_name: "Release verification" },
      ], next_cursor: null,
    }); return; }
    if (request.url?.startsWith("/v1/evidence/facts")) { json(200, { items: [{
      id: "fact-1", kind: "EVENT_CONTRIBUTION", recorded_at: "2026-09-01T00:00:00Z",
      provenance: { accepted_digest: "digest-fact-1", profile_version: "1.0.0", family_schema: null, owner_key: [] },
      compatibility: { family_schema: null, event_name: "qualification", completeness: "FINAL", dimensions: [] },
      truth: { completeness: "FINAL", availability: "AVAILABLE", expiry: "ACTIVE", expires_at: null },
      source: { kind: "SPAN", trace_id: traceId, span_id: "b".repeat(16) }, fields: [], relationships: [],
    }] }); return; }
    if (request.url?.startsWith("/v1/evidence/traces")) {
      const truth = { completeness: "FINAL", availability: "AVAILABLE", expiry: "ACTIVE", expires_at: null };
      const spans = [
        ["b", "Qualification evaluate", "INTERNAL", "1000000000", "2000000000", "OK", []],
        ["c", "role.writer", "CLIENT", "1080000000", "1620000000", "UNSET", [{ field: "agentops.role.id", value: "writer" }]],
        ["d", "model.generate", "CLIENT", "1120000000", "1520000000", "OK", [{ field: "gen_ai.provider.name", value: "deepseek" }]],
        ["e", "tool.workspace_write", "CLIENT", "1550000000", "1610000000", "OK", [{ field: "tool.name", value: "workspace_write" }]],
        ["f", "role.reviewer", "CLIENT", "1650000000", "1950000000", "ERROR", [{ field: "agentops.role.id", value: "reviewer" }]],
        ["1", "model.review", "CLIENT", "1680000000", "1890000000", "OK", [{ field: "gen_ai.provider.name", value: "deepseek" }]],
        ["2", "finding.persist", "INTERNAL", "1900000000", "1930000000", "OK", [{ field: "finding.kind", value: "qualification" }]],
      ].map(([identity, name, kind, start, end, status, fields], index) => {
        const spanId = identity.repeat(16);
        return {
          id: `trace-node-${index + 1}`, kind: "NODE", trace_id: traceId,
          recorded_at: `2026-09-01T00:00:0${index}Z`,
          source: { kind: "SPAN", trace_id: traceId, span_id: spanId }, truth,
          node: { span_id: spanId, span_name: name, span_kind: kind,
            start_time_unix_nano: start, end_time_unix_nano: end, span_status: status,
            span_flags: kind === "CLIENT" ? 257 : 1, trace_state: null, fields }, edge: null,
        };
      });
      const parentPairs = [["c", "b"], ["f", "b"], ["d", "c"], ["e", "c"], ["1", "f"], ["2", "f"]];
      const parents = parentPairs.map(([child, parent], index) => ({
        id: `trace-parent-${index + 1}`, kind: "PARENT_EDGE", trace_id: traceId,
        recorded_at: `2026-09-01T00:00:1${index}Z`,
        source: { kind: "SPAN", trace_id: traceId, span_id: child.repeat(16) }, truth, node: null,
        edge: { from: { trace_id: traceId, span_id: child.repeat(16) }, to: { trace_id: traceId, span_id: parent.repeat(16) } },
      }));
      const link = {
        id: "trace-link-writer-reviewer", kind: "LINK", trace_id: traceId,
        recorded_at: "2026-09-01T00:00:20Z",
        source: { kind: "SPAN", trace_id: traceId, span_id: "c".repeat(16) }, truth, node: null,
        edge: { from: { trace_id: traceId, span_id: "c".repeat(16) }, to: { trace_id: traceId, span_id: "f".repeat(16) }, flags: 1, trace_state: "qualification=linked" },
      };
      json(200, { items: [...spans, ...parents, link] }); return;
    }
    if (request.url === "/api/evolution/v1/evaluations:compute") {
      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        if (body === "{}") { json(400, { error: { code: "INVALID_REQUEST", retryable: false } }); return; }
        const input = JSON.parse(body);
        const available = (value, extra = {}) => ({
          slice_key: {}, state: "AVAILABLE", value,
          measures: {}, coverage: { numerator: "1", denominator: "1", raw_ratio: "1", state: "FULL", alert: null },
          compatibility: {}, exclusions: [], missing_inputs: [], provenance_refs: ["digest-fact-1"], ...extra,
        });
        const metricResults = [
          ["role-template-rework-rate", [available({ kind: "RATIO", value: "17/25", unit: "ratio" }, { numerator: "17", denominator: "25" })]],
          ["role-template-trajectory-partial-cost", [available({ kind: "MONEY", value: "4.50", unit: "USD" })]],
          ["role-model-task-outcome-rate", [available({ kind: "RATIO", value: "10/24", unit: "ratio" }, { numerator: "10", denominator: "24" })]],
          ["operational-latency-ms", [available({ kind: "DURATION_MS", value: "842", unit: "ms" })]],
          ["trajectory-partial-cost", [available({ kind: "MONEY", value: "7.25", unit: "USD" })]],
          ["task-cohort-comparison-eligibility", [available({ kind: "BOOLEAN", value: true, unit: "boolean" })]],
          ["delivery-stage-reach", ["accepted", "executed", "verified"].map((stage, index) => available(
            { kind: "RATIO", value: `${3 - index}/3`, unit: "ratio" },
            { slice_key: { stage }, numerator: String(3 - index), denominator: "3" },
          ))],
          ["delivery-terminal-outcome-rate", ["succeeded", "failed"].map((outcome, index) => available(
            { kind: "RATIO", value: index === 0 ? "2/3" : "1/3", unit: "ratio" },
            { slice_key: { outcome }, numerator: index === 0 ? "2" : "1", denominator: "3" },
          ))],
          ["delivery-cycle-time-ms", [available({ kind: "DURATION_MS", value: "27900", unit: "ms" })]],
          ["operational-token-usage", [
            available({ kind: "QUANTITY", value: "1240", unit: "tokens" }, { slice_key: { kind: "input" } }),
            available({ kind: "QUANTITY", value: "380", unit: "tokens" }, { slice_key: { kind: "output" } }),
          ]],
          ["operational-attributable-cost", [available({ kind: "MONEY", value: "0.018", unit: "USD" })]],
          ["operational-usage-availability", [{
            slice_key: {}, state: "NOT_APPLICABLE", withholding_reason: "NO_APPLICABLE_POPULATION",
            measures: {}, coverage: { numerator: "0", denominator: "0", raw_ratio: null, state: "NO_POPULATION", alert: null },
            compatibility: {}, exclusions: [], missing_inputs: [], provenance_refs: ["digest-fact-1"],
          }]],
        ].map(([metric_id, slices]) => ({ metric_id, metric_version: "2.0.0", slices }));
        const side = (selection) => ({ tag: "SIDE_RESULT", receipt: {
          context_version: 1, selection, as_of: "2026-09-01T00:00:00Z", resolved_at: "2026-09-01T00:00:01Z",
          population_state: "COMPLETE", catalog: { catalog_id: "agentops.evaluation.metric-catalog", version: "2.0.0",
            semantic_digest: "sha256:catalog", observation_profile: "1.0.0" },
          evidence_bindings: [{ route: "/v1/evidence/facts", canonical_filter: { delivery_id: "delivery-a" },
            contract_revision: "0.1.0", observation_profile: "1.0.0", read_model_revision: "1.0.0",
            route_snapshot: "qualification", completion_state: "COMPLETE" }],
          task_population: selection.task_ids.map((task_id) => ({ task_id, cohort_coordinates: {}, exclusions: [], memberships: [{
            delivery_id: "delivery-a", manifest_digest: "sha256:manifest", accepted_digest: "sha256:accepted",
            profile_version: "2.0.0", source_identity: "qualification", recorded_at: "2026-09-01T00:00:00Z",
          }] })), input_refs: [{ kind: "FACT", identity: "fact-1", provenance_ref: "digest-fact-1" }], workflow_resolutions: [],
        }, metric_results: metricResults });
        json(200, input.mode === "SINGLE" ? { api_version: 1, mode: "SINGLE", result: side(input.selection) } : {
          api_version: 1, mode: "COMPARE", status: "FULL_COMPARE", left: side(input.left), right: side(input.right), deltas: [],
        });
      });
      return;
    }
    json(404, { error: { code: "NOT_FOUND" } });
  });
  await new Promise((accept, reject) => fixtureServer.once("error", reject).listen(fixturePort, "127.0.0.1", accept));
  const hostConfigFile = join(temporary, "crystra-loopback-host.json");
  await writeFile(hostConfigFile, `${JSON.stringify({
    schemaVersion: "crystra.loopback-host@1.0.0",
    services: {
      evidence: { baseUrl: `http://127.0.0.1:${fixturePort}`, healthPath: "/healthz", healthKind: "json-status-ok", contracts: [
        { name: "evidence.query", revision: "0.1.0", operations: ["facts/read", "traces/read"] },
        { name: "evidence.query", revision: "1.0.0", operations: ["tasks/list"] },
      ] },
      evolution: { baseUrl: `http://127.0.0.1:${fixturePort}`, healthPath: "/healthz", healthKind: "plain-ok", contracts: [
        { name: "evolution.compute", revision: "1", operations: ["evaluations/compute"] },
      ] },
    }, observation: { baseUrl: `http://127.0.0.1:${fixturePort}` },
  }, null, 2)}\n`);
  const overlay = join(temporary, "qualification.patch.yml");
  await writeFile(overlay, [
    "- id: ui-settings-models",
    "  name: '@deepseek-ai/dsh-client-ui-settings-models'",
    "  disabled: true",
    "- id: crystra",
    "  config:",
    `    stateRoot: ${JSON.stringify(join(temporary,"crystra-state"))}`,
    ...(initializationFixture ? [] : ["    execution:",
    `      configFile: ${JSON.stringify(configFile)}`,
    `      bindingFile: ${JSON.stringify(bindings)}`]),
    "    studio:",
    `      hostConfigFile: ${JSON.stringify(hostConfigFile)}`,
    "",
  ].join("\n"));

  const env = {...await prepareProfile(home), DSH_TELEMETRY_DISABLED: "1"};
  run("dsh", ["plugin", "--profile", "web", "add", pluginArchive, "--ignore-scripts"], {env});
  run("pnpm", ["rebuild","better-sqlite3"],{env,cwd:join(home,"profiles/web")});
  await assertSinglePlugin(home,env);
  const dump = run("dsh", ["web", "--patch", overlay, "--dump-config"], {env});
  if ([...dump.matchAll(/\bid:\s*['"]?crystra['"]?\s*$/gmu)].length !== 1) throw new Error("HARNESS_ACTIVATION_COUNT");

  const port = await freePort();
  const startHarness = () => {
    const child = spawn(process.env.CRYSTRA_DSH_BINARY ?? "dsh", ["web", "--patch", overlay, "--no-open", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: repository, env, stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { harnessLog += chunk; });
    return child;
  };
  harness = startHarness();
  const origin = `http://127.0.0.1:${port}`;
  let response = await waitFor(async () => {
    if (harness.exitCode !== null) throw new Error(`Harness exited ${harness.exitCode}\n${harnessLog}`);
    const candidate = await fetch(origin);
    return candidate.ok ? candidate : undefined;
  }, "HARNESS_HTTP_UNAVAILABLE", 60_000);
  const csp = response.headers.get("content-security-policy") ?? "";
  if (/unsafe-eval/iu.test(csp)) throw new Error(`HARNESS_CSP_INVALID: ${csp}`);
  const workspace = await waitFor(() => callApi(origin, "workspace.create", { path: repository }), "HARNESS_WORKSPACE_API_UNAVAILABLE");
  if (typeof workspace.workspace.workspaceId !== "string" || workspace.workspace.workspaceId.length === 0) {
    throw new Error("HARNESS_WORKSPACE_CREATE_FAILED");
  }
  let fixtureSessions = [];
  if (terminalFixture) {
    fixtureSessions = await Promise.all([
      callApi(origin, "session.create", { workspaceId: workspace.workspace.workspaceId, sessionId: "session-terminal-a" }),
      callApi(origin, "session.create", { workspaceId: workspace.workspace.workspaceId, sessionId: "session-terminal-b" }),
      callApi(origin, "session.create", { workspaceId: workspace.workspace.workspaceId, sessionId: "session-terminal-c" }),
    ]);
    await Promise.all([
      callApi(origin, "session.rename", { sessionId: fixtureSessions[0].sessionId, title: "Terminal A" }),
      callApi(origin, "session.rename", { sessionId: fixtureSessions[1].sessionId, title: "Terminal B" }),
      callApi(origin, "session.rename", { sessionId: fixtureSessions[2].sessionId, title: "Terminal C" }),
    ]);
    await stop(harness);
    harness = undefined;
    const terminalRows = [
      { sessionKey: fixtureSessions[2].sessionId, deliveryId: "delivery-completed", correlation: "intake-completed", outcome: "SUCCEEDED", updatedAt: 180, identity: "d" },
      { sessionKey: fixtureSessions[0].sessionId, deliveryId: "delivery-failed", correlation: "intake-failed", outcome: "FAILED", updatedAt: 190, identity: "e" },
      { sessionKey: fixtureSessions[1].sessionId, deliveryId: "delivery-cancelled", correlation: "intake-cancelled", outcome: "CANCELLED", updatedAt: 200, identity: "f" },
    ];
    const completedRoot = join(state, "control-plane", "completed");
    await mkdir(completedRoot, { recursive: true });
    for (const row of terminalRows) {
      const bindingIdentity = `sha256:${row.identity.repeat(64)}`;
      const fact = {
        schemaVersion: "execution.delivery-completed@1.0.0",
        manifest: {
          deliveryId: row.deliveryId,
          taskId: `task-${row.deliveryId}`,
          taskDisplayName: row.deliveryId,
          createdAt: 100,
          canonicalWorktree: repository,
          deliveryBindingIdentity: bindingIdentity,
          workflow: {
            identity: "workflow.qualification", packageName: "terminal-fixture", exactPackageVersion: "1.0.0",
            packageDigest: `sha256:${"a".repeat(64)}`, snapshotIdentity: "snapshot-terminal-fixture", snapshotDigest: `sha256:${"b".repeat(64)}`,
          },
        },
        updatedAt: row.updatedAt,
        terminal: { outcome: row.outcome, finishedAt: row.updatedAt },
        error: row.outcome === "FAILED" ? { code: "QUALIFICATION_FAILED" } : null,
        sessionCorrelation: row.correlation,
      };
      const filename = `${createHash("sha256").update(row.deliveryId).digest("hex")}.json`;
      await writeFile(join(completedRoot, filename), `${JSON.stringify(fact)}\n`, { mode: 0o600 });
    }
    await writeFile(bindings, `${JSON.stringify({
      schemaVersion: "execution.intake-bindings@3.0.0",
      activeBindings: [],
      historicalAssociations: terminalRows.map((row) => ({
        sessionKey: row.sessionKey,
        correlation: row.correlation,
        deliveryId: row.deliveryId,
        deliveryBindingIdentity: `sha256:${row.identity.repeat(64)}`,
        worktree: repository,
      })),
    })}\n`, { mode: 0o600 });
    harnessLog = "";
    harness = startHarness();
    response = await waitFor(async () => {
      if (harness.exitCode !== null) throw new Error(`Harness exited ${harness.exitCode}\n${harnessLog}`);
      const candidate = await fetch(origin);
      return candidate.ok ? candidate : undefined;
    }, "HARNESS_TERMINAL_RESTART_UNAVAILABLE", 60_000);
  }

  let chromeLog = "";
  chrome = spawn(chromeBinary, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "chrome")}`, origin,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (chunk) => { chromeLog += chunk; });
  const browserSocket = await waitFor(() => chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/u)?.[1], "CHROME_DEVTOOLS_UNAVAILABLE");
  const debugOrigin = new URL(browserSocket);
  const targets = await waitFor(async () => {
    const pages = await (await fetch(`http://${debugOrigin.host}/json/list`)).json();
    return pages.find((page) => page.type === "page" && page.url.startsWith(origin));
  }, "HARNESS_PAGE_UNAVAILABLE");
  cdp = new Cdp(targets.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([cdp.command("Runtime.enable"), cdp.command("Page.enable"), cdp.command("Log.enable")]);

  await cdp.command("Page.bringToFront");
  await waitFor(async () => cdp.evaluate(`document.querySelector('textarea:not(:disabled)') !== null`), "HARNESS_WORKSPACE_PICKER_UNAVAILABLE");
  const workspaceSelected = await cdp.evaluate(`(() => {
    const input = document.querySelector('textarea:not(:disabled)');
    if (!/选择一个工作区开始|Choose a workspace to start/.test(input.placeholder)) return true;
    const picker = [...document.querySelectorAll('button')].find((node) => /选择工作区|Choose workspace/.test(node.textContent.trim()));
    if (!picker) return false;
    picker.click();
    return false;
  })()`);
  if (workspaceSelected !== true) {
    await waitFor(async () => cdp.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitem"], button')].find((node) => node.textContent.trim() === 'repository');
      if (!item) return false;
      item.click();
      return true;
    })()`), "HARNESS_WORKSPACE_SELECTION_FAILED");
  }
  await waitFor(async () => cdp.evaluate(`(() => {
    const input = document.querySelector('textarea:not(:disabled)');
    return input && !/选择一个工作区开始|Choose a workspace to start/.test(input.placeholder) && document.body.innerText.includes('repository');
  })()`), "HARNESS_SESSION_COMPOSER_UNAVAILABLE");
  if (initializationFixture) {
    const sendAdmin = async (text) => {
      await cdp.evaluate(`document.querySelector('textarea:not(:disabled)').focus()`);
      await cdp.command("Input.insertText", {text});
      await cdp.command("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:36});
      await cdp.command("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:36});
    };
    await sendAdmin('/crystra doctor');
    await waitFor(async()=>cdp.evaluate(`document.body.innerText.includes('CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE')`),'INITIALIZATION_DOCTOR_DIAGNOSTIC');
    await sendAdmin('/crystra setup');
    await waitFor(async()=>{
      try { return JSON.parse(await readFile(join(temporary,'crystra-state','execution.json'),'utf8')); }
      catch(error){if(error.code==='ENOENT')return undefined;throw error;}
    },'INITIALIZATION_EXECUTION_CONFIG');
    await waitFor(async()=>cdp.evaluate(`document.body.innerText.includes('DEGRADED')`),'INITIALIZATION_SETUP_DIAGNOSTIC');
    const generatedBefore=await readFile(join(temporary,'crystra-state','execution.json'),'utf8');
    await sendAdmin('/crystra setup');
    await waitFor(async()=>cdp.evaluate(`document.querySelectorAll('[data-crystra-initialization="true"]').length >= 3`),'INITIALIZATION_RETRY');
    if(await readFile(join(temporary,'crystra-state','execution.json'),'utf8')!==generatedBefore)throw new Error('INITIALIZATION_CONFIG_OVERWRITE');
    await cdp.command('Page.reload',{ignoreCache:true});
    await waitFor(async()=>cdp.evaluate(`document.querySelector('textarea:not(:disabled)')!==null && document.body.innerText.includes('DEGRADED')`),'INITIALIZATION_RELOAD');
    const severe=cdp.events.filter(event=>event.method==='Runtime.exceptionThrown'||(event.method==='Log.entryAdded'&&event.params.entry.level==='error'));
    if(severe.length)throw new Error(`INITIALIZATION_BROWSER_ERRORS: ${JSON.stringify(severe)}`);
    process.stdout.write(JSON.stringify({initialization:'PASS',doctor:'NEEDS_CONFIGURATION',setup:'DEGRADED',retry:'preserves-config',reload:'PASS',serviceDescriptor:'not-yet-published',errors:0})+'\n');
  } else {
  if (terminalFixture) {
    await waitFor(async () => cdp.evaluate(`(() => {
      const row = document.querySelector('.crystra-delivery-row[aria-label="delivery-completed, SUCCEEDED"]');
      if (!row) return undefined;
      row.click();
      return true;
    })()`), "HARNESS_TERMINAL_BASELINE_SELECTION_FAILED");
    await waitFor(async () => cdp.evaluate(`(() => {
      const input = document.querySelector('textarea:not(:disabled)');
      return document.title.includes('Terminal C') && input ? true : undefined;
    })()`), "HARNESS_TERMINAL_BASELINE_SESSION_UNAVAILABLE");
  }
  await cdp.evaluate(`document.querySelector('textarea:not(:disabled)').focus()`);
  await cdp.command("Input.insertText", { text: "/crystra create hello-world-workflow@0.2.0" });
  const commandDraft = await cdp.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('textarea')].map((input) => ({ value: input.value, disabled: input.disabled, placeholder: input.placeholder }));
    return inputs;
  })()`);
  if (!commandDraft.some((input) => input.value.includes("hello-world-workflow@0.2.0"))) {
    throw new Error(`HARNESS_COMMAND_DRAFT_FAILED: ${JSON.stringify(commandDraft)}`);
  }
  await cdp.command("Input.dispatchKeyEvent", {
    type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 36,
  });
  await cdp.command("Input.dispatchKeyEvent", {
    type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 36,
  });
  await waitFor(async () => cdp.evaluate(`(() => {
    const label = [...document.querySelectorAll('*')]
      .find((node) => node.childElementCount === 0 && node.textContent.trim() === 'Workflow presentation');
    const trigger = label?.closest('button,[role="button"]');
    if (!trigger || !trigger.textContent.includes('TASK_PROMPT_REQUIRED')) return undefined;
    trigger.click();
    return true;
  })()`), "HARNESS_COMMAND_DISCLOSURE_UNAVAILABLE");
  const commandDiagnostic = await waitFor(async () => cdp.evaluate(`(() => {
    const presentations = [...document.querySelectorAll('[data-crystra-presentation="true"]')];
    if (presentations.length !== 1) return undefined;
    const row = presentations[0]?.closest('button,[role="button"]')?.parentElement;
    const detailSummary = [...(row?.querySelectorAll('details > summary') ?? [])]
      .find((summary) => summary.textContent.trim() === 'Technical details');
    const inputs = [...document.querySelectorAll('*')]
      .filter((node) => node.textContent.includes('/crystra') && node.textContent.includes('create hello-world-workflow@0.2.0'))
      .sort((left, right) => left.textContent.length - right.textContent.length);
    const ordered = inputs.length > 0
      && Boolean(inputs[0].compareDocumentPosition(presentations[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { presentations: presentations.length, technicalDetails: detailSummary !== undefined, userBeforePresentation: ordered,
      presentationText: row?.textContent ?? '', errorCode: document.body.textContent.includes('TASK_PROMPT_REQUIRED') };
  })()`), "HARNESS_COMMAND_DIAGNOSTIC_UNAVAILABLE");
  if (!commandDiagnostic.presentationText.includes("Add a Task instruction") || !commandDiagnostic.technicalDetails
    || !commandDiagnostic.errorCode || !commandDiagnostic.userBeforePresentation) {
    throw new Error(`HARNESS_COMMAND_DIAGNOSTIC_INVALID: ${JSON.stringify(commandDiagnostic)}`);
  }
  const listedAfterCommand = await callApi(origin, "session.list", {});
  const usedRows = listedAfterCommand.items.filter((row) => row.blank === false);
  if (usedRows.length !== 1) throw new Error(`HARNESS_COMMAND_SESSION_STATE_INVALID: ${JSON.stringify(listedAfterCommand)}`);
  const usedSession = usedRows[0];
  const usedHistory = await callApi(origin, "session.history", { sessionId: usedSession.sessionId });
  const usedTurns = usedHistory.events.filter(({ event }) => event.type === "turn/start").length;
  if (usedSession.blank !== false || usedTurns !== 1) {
    throw new Error(`HARNESS_COMMAND_SESSION_STATE_INVALID: ${JSON.stringify({ usedSession, usedTurns })}`);
  }
  const newSession = await callApi(origin, "session.create", { workspaceId: workspace.workspace.workspaceId });
  const listedAfterNewSession = await callApi(origin, "session.list", {});
  const originalRow = listedAfterNewSession.items.find((row) => row.sessionId === usedSession.sessionId);
  const newRow = listedAfterNewSession.items.find((row) => row.sessionId === newSession.sessionId);
  const newHistory = await callApi(origin, "session.history", { sessionId: newSession.sessionId });
  const newTurns = newHistory.events.filter(({ event }) => event.type === "turn/start").length;
  if (newSession.sessionId === usedSession.sessionId || originalRow?.blank !== false || newRow?.blank !== true || newTurns !== 0) {
    throw new Error(`HARNESS_NEW_SESSION_ISOLATION_INVALID: ${JSON.stringify({ usedSession, newSession, originalRow, newRow, newTurns })}`);
  }
  const sessionQualification = {
    used: { sessionId: usedSession.sessionId, blank: usedSession.blank, turns: usedTurns },
    created: { sessionId: newSession.sessionId, blank: newRow.blank, turns: newTurns },
    isolated: true,
  };

  const shell = await waitFor(async () => cdp.evaluate(`(() => {
    const resource = document.querySelector('[data-crystra-sidebar-resources="true"]');
    const delivery = document.querySelector('button[aria-controls="crystra-sidebar-delivery"]');
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const deliveryTab = tabs.find((node) => node.textContent.trim() === 'Delivery');
    const studio = tabs.find((node) => node.textContent.trim() === 'CRYSTRA Studio');
    const empty = document.body.innerText.includes('No Deliveries');
    const terminalRows = [...document.querySelectorAll('.crystra-delivery-row')].map((node) => node.getAttribute('aria-label'));
    if (!resource || !delivery || !deliveryTab || !studio || ${terminalFixture ? "terminalRows.length !== 3" : "!empty"} || document.readyState !== 'complete') return undefined;
    return { ready: document.readyState, delivery: delivery.textContent.trim(), empty, terminalRows,
      tabOrder: [deliveryTab.textContent.trim(), studio.textContent.trim()],
      adjacent: tabs.indexOf(studio) === tabs.indexOf(deliveryTab) + 1 };
  })()`), "HARNESS_CRYSTRA_SURFACES_UNAVAILABLE", 30_000);
  if (shell.ready !== "complete" || (terminalFixture ? shell.terminalRows.length !== 3 : !shell.empty) || !shell.adjacent) {
    throw new Error(`HARNESS_DELIVERY_READ_FAILED: ${JSON.stringify(shell)}`);
  }
  const setSidebarDisclosure = async (id, expanded) => {
    const selector = `button[aria-controls=${JSON.stringify(id)}]`;
    await waitFor(async () => cdp.evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(selector)});
      if (!button) return undefined;
      if (button.getAttribute('aria-expanded') !== ${JSON.stringify(String(expanded))}) button.click();
      return button.getAttribute('aria-expanded') === ${JSON.stringify(String(expanded))};
    })()`), `HARNESS_SIDEBAR_DISCLOSURE_${id}_${expanded ? "EXPAND" : "COLLAPSE"}_FAILED`);
  };
  const expandHostSidebar = async () => {
    await waitFor(async () => cdp.evaluate(`(() => {
      const resources = document.querySelector('[data-crystra-sidebar-resources="true"]');
      if (resources?.getBoundingClientRect().width > 100) return true;
      const shell = document.querySelector('[data-sidebar-collapsed="true"]');
      if (shell) {
        const toggle = [...document.querySelectorAll('button')].find((node) => /打开侧边栏|Open sidebar/i.test(node.getAttribute('aria-label') ?? ''));
        if (!toggle) return undefined;
        toggle.click();
        return false;
      }
      return undefined;
    })()`), "HARNESS_SIDEBAR_HOST_EXPAND_FAILED", 3_000);
  };
  const measureSidebar = async (label) => {
    const geometry = await cdp.evaluate(`(() => {
      const root = document.querySelector('[data-crystra-sidebar-resources="true"]');
      const workspaceSection = root?.querySelector('section[aria-label="Workspace"]');
      const deliverySection = root?.querySelector('section[aria-label="Delivery"]');
      const workspaceHeader = root?.querySelector('button[aria-controls="crystra-sidebar-workspace"]');
      const deliveryHeader = root?.querySelector('button[aria-controls="crystra-sidebar-delivery"]');
      const workspaceContent = document.getElementById('crystra-sidebar-workspace');
      const deliveryContent = document.getElementById('crystra-sidebar-delivery');
      if (!root || !workspaceSection || !deliverySection || !workspaceHeader || !deliveryHeader
        || !workspaceContent || !deliveryContent) return null;
      root.querySelectorAll('[data-crystra-sidebar-qualification]').forEach((node) => node.remove());
      const workspaceOverflow = document.createElement('div');
      workspaceOverflow.dataset.crystraSidebarQualification = 'workspace-overflow';
      workspaceOverflow.style.height = '1800px';
      workspaceOverflow.style.flex = '0 0 1800px';
      workspaceOverflow.setAttribute('aria-hidden', 'true');
      workspaceContent.append(workspaceOverflow);
      const deliveryList = deliveryContent.querySelector('[role="list"]') ?? deliveryContent;
      const deliveryOverflow = document.createElement('div');
      deliveryOverflow.dataset.crystraSidebarQualification = 'delivery-overflow';
      deliveryOverflow.style.height = '1800px';
      deliveryOverflow.setAttribute('aria-hidden', 'true');
      deliveryList.append(deliveryOverflow);
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { top: value.top, bottom: value.bottom, left: value.left, right: value.right, height: value.height, width: value.width };
      };
      const rootRect = rect(root);
      const workspaceSectionRect = rect(workspaceSection);
      const deliverySectionRect = rect(deliverySection);
      const workspaceHeaderBefore = rect(workspaceHeader);
      const deliveryHeaderBefore = rect(deliveryHeader);
      workspaceContent.scrollTop = 120;
      deliveryContent.scrollTop = 140;
      const workspaceHeaderAfter = rect(workspaceHeader);
      const deliveryHeaderAfter = rect(deliveryHeader);
      const style = (node) => getComputedStyle(node);
      return {
        viewport: { width: innerWidth, height: innerHeight }, root: rootRect,
        sections: { workspace: workspaceSectionRect, delivery: deliverySectionRect },
        headers: { workspaceBefore: workspaceHeaderBefore, workspaceAfter: workspaceHeaderAfter,
          deliveryBefore: deliveryHeaderBefore, deliveryAfter: deliveryHeaderAfter },
        content: {
          workspace: { clientHeight: workspaceContent.clientHeight, scrollHeight: workspaceContent.scrollHeight,
            scrollTop: workspaceContent.scrollTop, overflowY: style(workspaceContent).overflowY },
          delivery: { clientHeight: deliveryContent.clientHeight, scrollHeight: deliveryContent.scrollHeight,
            scrollTop: deliveryContent.scrollTop, overflowY: style(deliveryContent).overflowY },
        },
        documentOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      };
    })()`);
    if (geometry === null
      || geometry.root.height <= 0
      || geometry.headers.workspaceBefore.top < geometry.root.top - 1
      || geometry.headers.deliveryBefore.bottom > geometry.root.bottom + 1
      || geometry.sections.workspace.bottom > geometry.sections.delivery.top + 1
      || geometry.content.workspace.scrollHeight <= geometry.content.workspace.clientHeight
      || geometry.content.delivery.scrollHeight <= geometry.content.delivery.clientHeight
      || geometry.content.workspace.scrollTop <= 0 || geometry.content.delivery.scrollTop <= 0
      || geometry.content.workspace.overflowY !== "auto" || geometry.content.delivery.overflowY !== "auto"
      || Math.abs(geometry.headers.workspaceBefore.top - geometry.headers.workspaceAfter.top) > 1
      || Math.abs(geometry.headers.deliveryBefore.top - geometry.headers.deliveryAfter.top) > 1
      || geometry.documentOverflow) {
      throw new Error(`${label}: ${JSON.stringify(geometry)}`);
    }
    return geometry;
  };
  await setSidebarDisclosure("crystra-sidebar-workspace", true);
  await setSidebarDisclosure("crystra-sidebar-delivery", true);
  await cdp.command("Emulation.setDeviceMetricsOverride", { width: 720, height: 420, deviceScaleFactor: 1, mobile: false });
  await expandHostSidebar();
  const sidebarNarrow = await measureSidebar("HARNESS_SIDEBAR_NARROW_GEOMETRY_FAILED");
  await cdp.command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await expandHostSidebar();
  const sidebarWide = await measureSidebar("HARNESS_SIDEBAR_WIDE_GEOMETRY_FAILED");

  const workspaceHeader = await cdp.evaluate(`(() => {
    const button = document.querySelector('button[aria-controls="crystra-sidebar-workspace"]');
    button.focus();
    return document.activeElement === button;
  })()`);
  if (!workspaceHeader) throw new Error("HARNESS_SIDEBAR_WORKSPACE_FOCUS_FAILED");
  await cdp.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  const workspaceCollapsed = await waitFor(async () => cdp.evaluate(`(() => {
    const button = document.querySelector('button[aria-controls="crystra-sidebar-workspace"]');
    const delivery = document.querySelector('section[aria-label="Delivery"]');
    const root = document.querySelector('[data-crystra-sidebar-resources="true"]');
    if (button?.getAttribute('aria-expanded') !== 'false') return undefined;
    const buttonRect = button.getBoundingClientRect();
    const deliveryRect = delivery.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return { focused: document.activeElement === button, hiddenContentAbsent: document.getElementById('crystra-sidebar-workspace') === null,
      stored: localStorage.getItem('crystra.sidebar.workspace.expanded.v1'),
      bounded: buttonRect.top >= rootRect.top - 1 && deliveryRect.bottom <= rootRect.bottom + 1 };
  })()`), "HARNESS_SIDEBAR_WORKSPACE_COLLAPSE_FAILED");
  if (!workspaceCollapsed.focused || !workspaceCollapsed.hiddenContentAbsent || workspaceCollapsed.stored !== "false" || !workspaceCollapsed.bounded) {
    throw new Error(`HARNESS_SIDEBAR_WORKSPACE_COLLAPSE_INVALID: ${JSON.stringify(workspaceCollapsed)}`);
  }
  await setSidebarDisclosure("crystra-sidebar-workspace", true);
  await setSidebarDisclosure("crystra-sidebar-delivery", false);
  const deliveryCollapsed = await cdp.evaluate(`(() => {
    const button = document.querySelector('button[aria-controls="crystra-sidebar-delivery"]');
    const workspace = document.querySelector('section[aria-label="Workspace"]');
    const root = document.querySelector('[data-crystra-sidebar-resources="true"]');
    const buttonRect = button.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return { expanded: button.getAttribute('aria-expanded'), hiddenContentAbsent: document.getElementById('crystra-sidebar-delivery') === null,
      stored: localStorage.getItem('crystra.sidebar.delivery.expanded.v1'),
      bounded: workspaceRect.top >= rootRect.top - 1 && buttonRect.bottom <= rootRect.bottom + 1 };
  })()`);
  if (deliveryCollapsed.expanded !== "false" || !deliveryCollapsed.hiddenContentAbsent || deliveryCollapsed.stored !== "false" || !deliveryCollapsed.bounded) {
    throw new Error(`HARNESS_SIDEBAR_DELIVERY_COLLAPSE_INVALID: ${JSON.stringify(deliveryCollapsed)}`);
  }
  const sidebarDocumentOrigin = await cdp.evaluate(`performance.timeOrigin`);
  await cdp.command("Page.reload", { ignoreCache: true });
  const sidebarPersistence = await waitFor(async () => cdp.evaluate(`(() => {
    const workspace = document.querySelector('button[aria-controls="crystra-sidebar-workspace"]');
    const delivery = document.querySelector('button[aria-controls="crystra-sidebar-delivery"]');
    if (performance.timeOrigin === ${JSON.stringify(sidebarDocumentOrigin)} || !workspace || !delivery) return undefined;
    return { workspace: workspace.getAttribute('aria-expanded'), delivery: delivery.getAttribute('aria-expanded'),
      deliveryHidden: document.getElementById('crystra-sidebar-delivery') === null };
  })()`), "HARNESS_SIDEBAR_PERSISTENCE_FAILED", 30_000);
  if (sidebarPersistence.workspace !== "true" || sidebarPersistence.delivery !== "false" || !sidebarPersistence.deliveryHidden) {
    throw new Error(`HARNESS_SIDEBAR_PERSISTENCE_INVALID: ${JSON.stringify(sidebarPersistence)}`);
  }
  await setSidebarDisclosure("crystra-sidebar-delivery", true);
  const sidebarQualification = { narrow: sidebarNarrow, wide: sidebarWide, workspaceCollapsed, deliveryCollapsed, persistence: sidebarPersistence };
  let terminalView;
  if (terminalFixture) {
    await cdp.command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await waitFor(async () => cdp.evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find((node) => node.textContent.trim() === 'Delivery');
      if (!tab) return undefined;
      tab.click();
      return true;
    })()`), "HARNESS_TERMINAL_DELIVERY_TAB_UNAVAILABLE");
    terminalView = await waitFor(async () => cdp.evaluate(`(() => {
      const view = document.querySelector('[data-crystra-delivery-id="delivery-completed"]');
      if (!view) return undefined;
      return { deliveryId: view.getAttribute('data-crystra-delivery-id'), text: view.textContent };
    })()`), "HARNESS_TERMINAL_SESSION_VIEW_UNAVAILABLE");
    const expectedOutcome = "SUCCEEDED";
    if (terminalView.deliveryId !== "delivery-completed" || !terminalView.text.includes(expectedOutcome)) {
      throw new Error(`HARNESS_TERMINAL_SESSION_VIEW_INVALID: ${JSON.stringify(terminalView)}`);
    }
    const firstFold = await cdp.evaluate(`(() => {
      const view = document.querySelector('[data-crystra-delivery-id]');
      const summary = view?.querySelector('[data-crystra-delivery-summary="true"]');
      const disclosure = view?.querySelector('[data-disclosure-row][role="button"]');
      if (!view || !summary || !disclosure) return null;
      const viewportBottom = Math.min(window.innerHeight, view.closest('[role="tabpanel"]')?.getBoundingClientRect().bottom ?? window.innerHeight);
      const items = [...summary.children].map((item) => ({
        label: item.querySelector('dt')?.textContent.trim(),
        top: item.getBoundingClientRect().top,
        bottom: item.getBoundingClientRect().bottom,
      }));
      const required = ['Status', 'Workflow', 'Outcome', 'Elapsed'];
      const visible = required.every((label) => items.some((item) => item.label === label && item.top >= 0 && item.bottom <= viewportBottom));
      const style = getComputedStyle(summary);
      return { visible, required, items, display: style.display, columns: style.gridTemplateColumns,
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        viewOverflow: view.scrollWidth > view.clientWidth, disclosureExpanded: disclosure.getAttribute('aria-expanded') };
    })()`);
    if (firstFold === null || !firstFold.visible || firstFold.display !== "grid" || firstFold.documentOverflow || firstFold.viewOverflow) {
      throw new Error(`HARNESS_DELIVERY_FIRST_FOLD_FAILED: ${JSON.stringify(firstFold)}`);
    }
    await waitForStableDeliveryLayout(cdp, "HARNESS_DELIVERY_DESKTOP_LAYOUT_UNSTABLE");
    const desktopScreenshot = await captureScreenshot(cdp, "delivery-desktop");
    const disclosure = await cdp.evaluate(`(() => {
      const control = document.querySelector('[data-crystra-delivery-id] [data-disclosure-row][role="button"]');
      if (!control) return null;
      control.focus();
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      return { focused: document.activeElement === control, expanded: control.getAttribute('aria-expanded') };
    })()`);
    const expanded = await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-delivery-id] [data-disclosure-row]')?.getAttribute('aria-expanded') === 'true'`), "HARNESS_DELIVERY_DISCLOSURE_FAILED");
    if (disclosure === null || !disclosure.focused || !expanded) throw new Error(`HARNESS_DELIVERY_DISCLOSURE_FAILED: ${JSON.stringify(disclosure)}`);
    await cdp.command("Browser.grantPermissions", { origin, permissions: ["clipboardReadWrite"] });
    const copyControls = await cdp.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('[data-crystra-delivery-id] button[aria-label^="Copy "]')];
      const labels = buttons.map((button) => button.getAttribute('aria-label'));
      if (buttons.length === 0) return { count: 0, labels, focused: false };
      buttons[0].focus();
      buttons[0].click();
      return { count: buttons.length, labels, focused: document.activeElement === buttons[0] };
    })()`);
    const copyFeedback = await waitFor(async () => cdp.evaluate(`(() => {
      const text = document.querySelector('[data-crystra-delivery-id] [role="status"][aria-live="polite"]')?.textContent.trim();
      return text && (text.endsWith('copied') || text.endsWith('copy failed')) ? text : undefined;
    })()`), "HARNESS_DELIVERY_COPY_FAILED");
    if (copyControls.count < 7 || new Set(copyControls.labels).size !== copyControls.count || !copyControls.focused || !copyFeedback) {
      throw new Error(`HARNESS_DELIVERY_COPY_FAILED: ${JSON.stringify(copyControls)}`);
    }
    await waitForStableDeliveryLayout(cdp, "HARNESS_DELIVERY_EXPANDED_LAYOUT_UNSTABLE");
    const expandedScreenshot = await captureScreenshot(cdp, "delivery-identities-expanded");
    const narrowDelivery = await cdp.evaluate(`(() => {
      const view = document.querySelector('[data-crystra-delivery-id]');
      if (!view) return false;
      view.style.width = '320px';
      const summary = view.querySelector('[data-crystra-delivery-summary="true"]');
      const identities = view.querySelector('.crystra-delivery-identities');
      const columns = (node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length;
      return {
        pass: document.documentElement.scrollWidth <= document.documentElement.clientWidth && view.scrollWidth <= view.clientWidth
          && view.getBoundingClientRect().width <= 320 && columns(summary) === 1 && columns(identities) === 1,
        summaryColumns: columns(summary), identityColumns: columns(identities), width: view.getBoundingClientRect().width,
      };
    })()`);
    if (!narrowDelivery?.pass) throw new Error(`HARNESS_DELIVERY_NARROW_OVERFLOW: ${JSON.stringify(narrowDelivery)}`);
    await waitForStableDeliveryLayout(cdp, "HARNESS_DELIVERY_NARROW_LAYOUT_UNSTABLE");
    const narrowScreenshot = await captureScreenshot(cdp, "delivery-narrow-320");
    await cdp.evaluate(`document.querySelector('[data-crystra-delivery-id]').style.width = ''`);
    await cdp.command("Emulation.setDeviceMetricsOverride", { width: 640, height: 400, deviceScaleFactor: 2, mobile: false });
    const zoomDelivery = await cdp.evaluate(`(() => {
      const view = document.querySelector('[data-crystra-delivery-id]');
      return Boolean(view && view.scrollWidth <= view.clientWidth && view.getBoundingClientRect().right <= window.innerWidth);
    })()`);
    if (!zoomDelivery) throw new Error("HARNESS_DELIVERY_ZOOM_OVERFLOW");
    await waitForStableDeliveryLayout(cdp, "HARNESS_DELIVERY_ZOOM_LAYOUT_UNSTABLE");
    const zoomScreenshot = await captureScreenshot(cdp, "delivery-zoom-200");
    await cdp.command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.command("Page.reload", { ignoreCache: true });
    await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-delivery-id=${JSON.stringify(terminalView.deliveryId)}]')?.textContent.includes(${JSON.stringify(expectedOutcome)})`), "HARNESS_TERMINAL_RELOAD_FAILED", 30_000);
    terminalView = { ...terminalView, reload: expectedOutcome, qualification: {
      firstFold, narrowDelivery, zoomDelivery, copyControls: copyControls.count, copyFeedback,
      desktopScreenshot, expandedScreenshot, narrowScreenshot, zoomScreenshot,
    } };
  }
  await cdp.command("Page.bringToFront");
  const before = await cdp.evaluate(`(() => {
    const button = document.querySelector('button[aria-controls="crystra-sidebar-delivery"]');
    button.focus();
    return { expanded: button.getAttribute('aria-expanded'), active: document.activeElement === button };
  })()`);
  if (!before.active) throw new Error("HARNESS_KEYBOARD_FOCUS_FAILED");
  await cdp.evaluate(`document.querySelector('button[aria-controls="crystra-sidebar-delivery"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))`);
  const after = await waitFor(async () => {
    const value = await cdp.evaluate(`document.querySelector('button[aria-controls="crystra-sidebar-delivery"]')?.getAttribute('aria-expanded')`);
    return value !== before.expanded ? value : undefined;
  }, "HARNESS_KEYBOARD_DISCLOSURE_FAILED");

  await cdp.command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.command("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await cdp.command("Page.reload", { ignoreCache: true });
  await waitFor(async () => cdp.evaluate(`([...document.querySelectorAll('[role="tab"]')].some((node) => node.textContent.trim() === 'CRYSTRA Studio'))`), "HARNESS_STUDIO_DARK_RELOAD_FAILED", 30_000);
  await cdp.evaluate(`(() => { [...document.querySelectorAll('[role="tab"]')].find((node) => node.textContent.trim() === 'CRYSTRA Studio').click(); })()`);
  const studio = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-crystra-studio-view="evaluate"]');
    if (!view) return undefined;
    const style = getComputedStyle(view);
    return { role: view.getAttribute('role'), modal: view.getAttribute('aria-modal'), color: style.color, background: style.backgroundColor,
      landmarks: ['nav', 'main'].every((name) => view.querySelector(name)), labelled: !!view.getAttribute('aria-labelledby'),
      regions: ['header', 'main'].every((name) => view.querySelector('[data-crystra-studio-region="' + name + '"]') && view.querySelector('[data-crystra-studio-region="footer"]') === null),
      hostTheme: document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light',
      repositoryInput: view.querySelector('input[aria-label="Repository"]') !== null };
  })()`), "HARNESS_STUDIO_UNAVAILABLE");
  if (studio.role !== "region" || studio.modal !== null || !studio.landmarks || !studio.regions || !studio.labelled || studio.hostTheme !== "dark" || studio.repositoryInput || studio.color === studio.background) {
    throw new Error(`HARNESS_THEME_OR_ACCESSIBILITY_FAILED: ${JSON.stringify(studio)}`);
  }
  await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-studio-page="selection"]') !== null && document.querySelector('[data-crystra-dashboard-layout]') === null`), "HARNESS_STUDIO_SELECTION_PAGE_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Load tasks').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.body.innerText.includes('Writer quality pass')`), "HARNESS_STUDIO_TASKS_FAILED");
  await cdp.evaluate(`(() => { const input = document.querySelector('[data-crystra-task-id="task-a"] input[type="checkbox"]'); if (!input) throw new Error('qualification task checkbox missing: task-a'); input.click(); })()`);
  const selectContract = await cdp.evaluate(`(() => {
    const view = document.querySelector('[data-crystra-studio-page="selection"]');
    const studio = document.querySelector('[data-crystra-studio-view="evaluate"]');
    const buttons = [...studio.querySelectorAll('button')];
    const rows = [...view.querySelectorAll('[data-crystra-task-id]')];
    const modes = buttons.filter((node) => ['Single', 'Compare'].includes(node.textContent.trim()));
    const actions = Object.fromEntries(['Use recent selection', 'Load tasks', 'Evaluate selection', 'Filters', 'Clear'].map((label) => {
      const button = buttons.find((node) => node.textContent.trim() === label);
      return [label, button && { appearance: button.dataset.appearance, tone: button.dataset.tone, size: button.dataset.size }];
    }));
    return {
      schemaVersion: 'crystra.studio-render@1',
      page: view.dataset.crystraStudioPage,
      regions: [...studio.querySelectorAll('[data-crystra-studio-region]')].map((node) => node.dataset.crystraStudioRegion),
      actions,
      segmented: {
        group: view.querySelector('[data-segmented="true"]') !== null,
        modes: modes.map((node) => ({ label: node.textContent.trim(), appearance: node.dataset.appearance, selected: node.getAttribute('aria-pressed') })),
        radioInputs: view.querySelectorAll('input[type="radio"]').length,
      },
      inputKinds: [...view.querySelectorAll('[data-input-kind]')].map((node) => node.dataset.inputKind),
      statusKinds: [...view.querySelectorAll('[data-status]')].map((node) => node.dataset.status).sort(),
      surfaceLevels: [...view.querySelectorAll('[data-level]')].map((node) => node.dataset.level),
      typography: [...studio.querySelectorAll('[data-variant]')].map((node) => node.dataset.variant),
      selectionTypography: {
        taskLabels: view.querySelectorAll('.studio-task-row [data-variant="label"]').length,
        taskCodes: view.querySelectorAll('.studio-task-row [data-variant="code"]').length,
        selectedHeading: [...view.querySelectorAll('[data-variant]')].find((node) => node.textContent.trim() === 'Selected')?.dataset.variant,
        note: [...view.querySelectorAll('[data-variant]')].find((node) => node.textContent.trim().startsWith('Evaluation resolves'))?.dataset.variant,
      },
      rows: rows.length,
      selected: rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked).length,
      terminalRow: rows.at(-1)?.nextElementSibling === null,
    };
  })()`);
  const expectedSelectActions = {
    "Use recent selection": { appearance: "ghost", tone: "neutral", size: "compact" },
    "Load tasks": { appearance: "outline", tone: "neutral", size: "compact" },
    "Evaluate selection": { appearance: "solid", tone: "primary", size: "compact" },
    Filters: { appearance: "outline", tone: "neutral", size: "compact" },
    Clear: { appearance: "ghost", tone: "neutral", size: "compact" },
  };
  const selectActionsMatch = JSON.stringify(selectContract.actions) === JSON.stringify(expectedSelectActions);
  const selectModesMatch = JSON.stringify(selectContract.segmented.modes) === JSON.stringify([
    { label: "Single", appearance: "segment", selected: "true" },
    { label: "Compare", appearance: "segment", selected: "false" },
  ]);
  if (selectContract.schemaVersion !== "crystra.studio-render@1" || selectContract.page !== "selection" ||
      !selectContract.regions.includes("header") || !selectContract.regions.includes("main") || selectContract.regions.includes("footer") ||
      !selectActionsMatch || !selectContract.segmented.group || !selectModesMatch || selectContract.segmented.radioInputs !== 0 ||
      JSON.stringify(selectContract.inputKinds) !== JSON.stringify(["search"]) ||
      !selectContract.statusKinds.includes("selected") || !selectContract.statusKinds.includes("available") ||
      selectContract.surfaceLevels.filter((level) => level === "section").length < 2 ||
      !["pageTitle", "sectionTitle", "caption", "eyebrow", "code"].every((variant) => selectContract.typography.includes(variant)) ||
      selectContract.selectionTypography.taskLabels !== selectContract.rows || selectContract.selectionTypography.taskCodes !== selectContract.rows ||
      selectContract.selectionTypography.selectedHeading !== "label" || selectContract.selectionTypography.note !== "caption" ||
      selectContract.rows !== 3 || selectContract.selected !== 1 || !selectContract.terminalRow) {
    throw new Error(`HARNESS_STUDIO_SELECTION_CONTRACT_FAILED: ${JSON.stringify(selectContract)}`);
  }
  const studioSelectionScreenshot = await captureScreenshot(cdp, "studio-selection-dark-desktop");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Evaluate selection').click(); })()`);
  const dashboard = await waitFor(async () => cdp.evaluate(`(() => {
    if (document.querySelector('[data-crystra-studio-page="dashboard"]') === null || document.querySelector('[data-crystra-selection-browser]') !== null) return undefined;
    const layout = document.querySelector('[data-crystra-dashboard-layout="crystra-dsh.studio-layout@1"]');
    const panels = [...(layout?.querySelectorAll('[data-crystra-dashboard-panel]') ?? [])];
    if (!layout || panels.length === 0 || panels.some((panel) => !panel.querySelector('[data-presentation="dashboard"]'))) return undefined;
    const buttons = [...document.querySelectorAll('[data-crystra-studio-region="header"] button')];
    const headerSurface = document.querySelector('[data-crystra-studio-region="header"]');
    const firstPanelSurface = panels[0]?.querySelector('[data-presentation="dashboard"]');
    const semanticProbe = document.createElement('span');
    semanticProbe.style.backgroundColor = 'var(--dsw-specific-sidebar-fill)';
    headerSurface?.append(semanticProbe);
    const sectionSemanticSurface = getComputedStyle(semanticProbe).backgroundColor;
    semanticProbe.remove();
    const actions = Object.fromEntries(['View receipt', 'Default overview', 'Change evaluation', 'Edit dashboard'].map((label) => {
      const button = buttons.find((node) => node.textContent.trim() === label);
      return [label, button && { appearance: button.dataset.appearance, tone: button.dataset.tone, size: button.dataset.size }];
    }));
    return { schemaVersion: 'crystra.studio-render@1', page: 'dashboard', layoutSchema: layout.dataset.crystraDashboardLayout,
      coreTheme: layout.closest('.crystra-bi')?.getAttribute('data-theme'),
      panels: panels.map((panel) => {
        const content = panel.querySelector('[data-presentation="dashboard"]');
        return { id: panel.dataset.crystraDashboardPanel, columns: panel.style.getPropertyValue('--studio-panel-desktop-columns').trim(),
          size: content?.dataset.panelSize, visualizer: content?.dataset.visualizer };
      }),
      rawDetails: document.querySelectorAll('[data-crystra-studio-page="dashboard"] details').length,
      surfaceRoles: {
        section: headerSurface && getComputedStyle(headerSurface).backgroundColor,
        panel: firstPanelSurface && getComputedStyle(firstPanelSurface).backgroundColor,
      },
      sectionSemanticSurface,
      actions };
  })()`), "HARNESS_STUDIO_DASHBOARD_LAYOUT_FAILED");
  const expectedDashboardActions = {
    "View receipt": { appearance: "outline", tone: "neutral", size: "compact" },
    "Default overview": { appearance: "outline", tone: "neutral", size: "compact" },
    "Change evaluation": { appearance: "outline", tone: "neutral", size: "compact" },
    "Edit dashboard": { appearance: "solid", tone: "primary", size: "compact" },
  };
  if (dashboard.schemaVersion !== "crystra.studio-render@1" || dashboard.layoutSchema !== "crystra-dsh.studio-layout@1" ||
      dashboard.panels.length !== 12 || dashboard.panels.some((panel) => panel.id === undefined || panel.columns === "" || panel.size === undefined || panel.visualizer === undefined) ||
      dashboard.panels.filter((panel) => panel.size === "SMALL").length !== 7 || dashboard.panels.filter((panel) => panel.size === "MEDIUM").length !== 2 ||
      dashboard.panels.filter((panel) => panel.size === "WIDE").length !== 3 ||
      dashboard.panels.filter((panel) => panel.visualizer === "numeric-card@1").length !== 6 ||
      dashboard.panels.filter((panel) => panel.visualizer === "ratio-bar@1").length !== 2 ||
      dashboard.panels.filter((panel) => panel.visualizer === "badge@1").length !== 1 ||
      dashboard.panels.filter((panel) => panel.visualizer === "table@1").length !== 3 || dashboard.rawDetails !== 0 || dashboard.coreTheme !== "dark" ||
      dashboard.surfaceRoles.section === "" || dashboard.surfaceRoles.panel === "" ||
      dashboard.surfaceRoles.section !== dashboard.sectionSemanticSurface ||
      JSON.stringify(dashboard.actions) !== JSON.stringify(expectedDashboardActions)) {
    throw new Error(`HARNESS_STUDIO_DASHBOARD_LAYOUT_INVALID: ${JSON.stringify(dashboard)}`);
  }
  const studioDashboardScreenshot = await captureScreenshot(cdp, "studio-dashboard-dark-desktop");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Edit dashboard').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.body.innerText.includes('Save layout') && document.body.innerText.includes('Cancel editing') && document.body.innerText.includes('Reset layout')`), "HARNESS_STUDIO_DASHBOARD_EDIT_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Resize panel').click(); })()`);
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Save layout').click(); })()`);
  const savedDashboard = await waitFor(async () => cdp.evaluate(`(() => {
    const panel = document.querySelector('[data-crystra-dashboard-panel]');
    const stored = sessionStorage.getItem('crystra.studio.dashboard-layout@1');
    return panel && stored && panel.style.getPropertyValue('--studio-panel-desktop-columns').trim() === '6'
      ? { panelColumns: '6', persisted: JSON.parse(stored).sizes }
      : undefined;
  })()`), "HARNESS_STUDIO_DASHBOARD_SAVE_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Change evaluation').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-studio-page="selection"]') !== null && document.querySelector('[data-crystra-dashboard-layout]') === null`), "HARNESS_STUDIO_CHANGE_EVALUATION_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Compare').click(); })()`);
  await cdp.evaluate(`(() => { const row = document.querySelector('[data-crystra-selection-side="right"][data-crystra-task-id="task-b"]'); const input = row?.querySelector('input'); if (!input) throw new Error('qualification compare task missing'); input.click(); })()`);
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Evaluate selection').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.body.innerText.includes('delivery-cycle-time-ms@2.0.0') && document.body.innerText.includes('left side') && document.body.innerText.includes('right side')`), "HARNESS_STUDIO_COMPARE_METRIC_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'View receipt').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.body.innerText.includes('Evaluation receipt') && document.body.innerText.includes('/v1/evidence/facts')`), "HARNESS_STUDIO_RECEIPT_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Back to Metric Results').click(); })()`);
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'View evidence').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.body.innerText.includes('EVENT_CONTRIBUTION') && document.body.innerText.includes('fact-1')`), "HARNESS_STUDIO_FACT_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.includes(${JSON.stringify(traceId)})).click(); })()`);
  const waterfall = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-trace-renderer="waterfall"]');
    const studio = document.querySelector('[data-crystra-studio-view="evaluate"]');
    const hierarchy = view?.closest('[data-studio-trace-hierarchy]');
    const navigation = hierarchy?.querySelector('[aria-label="Trace renderer views"]');
    const rendererHeader = view?.querySelector('.trace-view-header');
    const headerButtons = [...studio.querySelectorAll('[data-crystra-studio-region="header"] button')];
    const actions = Object.fromEntries(['Back to Dashboard', 'Open Evidence', 'Copy trace identity'].map((label) => {
      const button = headerButtons.find((node) => node.textContent.trim() === label);
      return [label, button && { appearance: button.dataset.appearance, tone: button.dataset.tone, size: button.dataset.size }];
    }));
    const rendererViews = [...studio.querySelectorAll('[aria-label="Trace renderer views"] button')].map((node) => ({
      label: node.textContent.trim(), appearance: node.dataset.appearance, selected: node.getAttribute('aria-pressed'),
    }));
    const summaryLabels = [...view?.querySelectorAll('.trace-summary-stat small') ?? []].map((node) => node.textContent.trim());
    const summaryTones = Object.fromEntries([...view?.querySelectorAll('.trace-summary-stat') ?? []].map((node) => [node.querySelector('small')?.textContent.trim(), node.dataset.tone]));
    const rulerTicks = [...view?.querySelectorAll('.trace-minimap-ruler span') ?? []].map((node) => node.textContent.trim());
    const minimapSlider = view?.querySelector('[role="slider"][aria-label="Trace minimap zoom window"]');
    const minimapOverview = view?.querySelector('[data-testid="trace-waterfall-minimap-overview"]');
    const minimapWindow = view?.querySelector('[data-testid="trace-waterfall-data-zoom-window"]');
    const minimapStartHandle = view?.querySelector('[data-testid="trace-waterfall-data-zoom-handle-left"]');
    const minimapEndHandle = view?.querySelector('[data-testid="trace-waterfall-data-zoom-handle-right"]');
    const rootToggle = view?.querySelector('[aria-label="Collapse Qualification evaluate descendants"]');
    const waterfallActions = view?.querySelector('.trace-waterfall-actions');
    return view && view.textContent.includes('Qualification evaluate')
      && view.querySelector('[aria-label="Recorded trace minimap"]') && minimapSlider && minimapOverview && minimapWindow && minimapStartHandle && minimapEndHandle && view.querySelector('[aria-label="Span passport"]')
      ? { schemaVersion: 'crystra.studio-render@1', motion: view.getAttribute('data-motion'), spans: view.querySelectorAll('[role="treeitem"]').length,
          minimap: true, passport: Boolean(view.querySelector('.trace-passport-head') && view.querySelector('.trace-passport-body') && view.querySelector('.trace-passport-sigil')),
          summaryLabels, summaryTones, rulerTicks, oldToolbar: Boolean(view.querySelector('.trace-view-tools')),
          controls: { expand: Boolean(view.querySelector('[aria-label="展开全部调用"]')), collapse: Boolean(view.querySelector('[aria-label="收起全部调用"]')), search: Boolean(view.querySelector('[aria-label="搜索调用"]')), rootToggle: Boolean(rootToggle) },
          iconActions: { count: waterfallActions?.querySelectorAll('[data-icon-button="true"]').length, grouped: waterfallActions?.getAttribute('role') === 'group', segmented: waterfallActions?.getAttribute('data-segmented') },
          minimapValue: minimapSlider.getAttribute('aria-valuetext'),
          navigationNote: hierarchy?.querySelector('.studio-trace-view-note')?.textContent.trim(),
          navigationBeforeHeader: Boolean(navigation && rendererHeader && (navigation.compareDocumentPosition(rendererHeader) & Node.DOCUMENT_POSITION_FOLLOWING)),
          actions, rendererViews }
      : undefined;
  })()`), "HARNESS_STUDIO_TRACE_WATERFALL_FAILED");
  const expectedTraceActions = {
    "Back to Dashboard": { appearance: "outline", tone: "neutral", size: "compact" },
    "Open Evidence": { appearance: "outline", tone: "neutral", size: "compact" },
    "Copy trace identity": { appearance: "solid", tone: "primary", size: "compact" },
  };
  const expectedTraceViews = [
    { label: "Waterfall", appearance: "segment", selected: "true" },
    { label: "Tree", appearance: "segment", selected: "false" },
    { label: "Statistics", appearance: "segment", selected: "false" },
  ];
  if (waterfall.schemaVersion !== "crystra.studio-render@1" || waterfall.spans !== 7 || !waterfall.passport ||
      JSON.stringify(waterfall.summaryLabels) !== JSON.stringify(["Duration", "Start", "Spans", "Errors"]) ||
      waterfall.summaryTones.Errors !== "error" ||
      waterfall.rulerTicks.some((tick) => tick.includes("%")) || waterfall.rulerTicks.length !== 5 ||
      waterfall.oldToolbar || Object.values(waterfall.controls).some((value) => !value) ||
      waterfall.iconActions.count !== 3 || !waterfall.iconActions.grouped || waterfall.iconActions.segmented !== null ||
      waterfall.navigationNote !== "Exact span timing" || !waterfall.navigationBeforeHeader ||
      JSON.stringify(waterfall.actions) !== JSON.stringify(expectedTraceActions) ||
      JSON.stringify(waterfall.rendererViews) !== JSON.stringify(expectedTraceViews)) {
    throw new Error(`HARNESS_STUDIO_TRACE_WATERFALL_DENSITY_INVALID: ${JSON.stringify(waterfall)}`);
  }
  await cdp.evaluate(`document.querySelector('[aria-label="Collapse Qualification evaluate descendants"]').click()`);
  await waitFor(async () => cdp.evaluate(`document.querySelectorAll('[data-trace-renderer="waterfall"] [role="treeitem"]').length === 1`), "HARNESS_STUDIO_TRACE_COLLAPSE_FAILED");
  await cdp.evaluate(`document.querySelector('[aria-label="展开全部调用"]').click()`);
  await waitFor(async () => cdp.evaluate(`document.querySelectorAll('[data-trace-renderer="waterfall"] [role="treeitem"]').length === 7`), "HARNESS_STUDIO_TRACE_EXPAND_FAILED");
  const studioWaterfallScreenshot = await captureScreenshot(cdp, "studio-trace-waterfall-dark-desktop");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Tree').click(); })()`);
  const tree = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-trace-renderer="tree"]');
    const hierarchy = view?.closest('[data-studio-trace-hierarchy]');
    const navigation = hierarchy?.querySelector('[aria-label="Trace renderer views"]');
    const rendererHeader = view?.querySelector('.trace-view-header');
    const graph = view?.querySelector('canvas[aria-label="Recorded span call tree graph"]');
    return view && view.textContent.includes('Qualification evaluate') && view.querySelector('[aria-label="Span passport"]')
      && graph && view.querySelector('[aria-label="Tree minimap navigation"]')
      ? { schemaVersion: 'crystra.trace-graph@1', spans: view.querySelectorAll('[role="treeitem"]').length,
          parentEdgeCount: Number(graph.dataset.parentEdgeCount),
          linkCount: Number(graph.dataset.linkCount),
          graph: true,
          cameraMap: true,
          navigationNote: hierarchy?.querySelector('.studio-trace-view-note')?.textContent.trim(),
          navigationBeforeHeader: Boolean(navigation && rendererHeader && (navigation.compareDocumentPosition(rendererHeader) & Node.DOCUMENT_POSITION_FOLLOWING)),
          passport: Boolean(view.querySelector('.trace-passport-head') && view.querySelector('.trace-passport-body') && view.querySelector('.trace-passport-sigil')) }
      : undefined;
  })()`), "HARNESS_STUDIO_TRACE_TREE_FAILED");
  if (tree.schemaVersion !== "crystra.trace-graph@1" || tree.spans !== 7 || tree.parentEdgeCount !== 6 || tree.linkCount !== 1 || !tree.graph || !tree.cameraMap || !tree.passport ||
      tree.navigationNote !== "Deterministic geometry · depth → recorded start/end → Span ID" || !tree.navigationBeforeHeader) throw new Error(`HARNESS_STUDIO_TRACE_TREE_DENSITY_INVALID: ${JSON.stringify(tree)}`);
  const studioTreeScreenshot = await captureScreenshot(cdp, "studio-trace-tree-dark-desktop");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Statistics').click(); })()`);
  const statistics = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-trace-renderer="statistics"]');
    const hierarchy = view?.closest('[data-studio-trace-hierarchy]');
    const navigation = hierarchy?.querySelector('[aria-label="Trace renderer views"]');
    const rendererHeader = view?.querySelector('.trace-view-header');
    return view && view.textContent.includes('Recorded spans') && view.textContent.includes('Recorded links')
      && !view.textContent.toLowerCase().includes('critical path') && !view.textContent.toLowerCase().includes('service map')
      ? { exactInventory: true, inferredAnalysis: false,
          navigationNote: hierarchy?.querySelector('.studio-trace-view-note')?.textContent.trim(),
          navigationBeforeHeader: Boolean(navigation && rendererHeader && (navigation.compareDocumentPosition(rendererHeader) & Node.DOCUMENT_POSITION_FOLLOWING)),
          typography: [...view.querySelectorAll('[data-variant]')].map((node) => node.dataset.variant) }
      : undefined;
  })()`), "HARNESS_STUDIO_TRACE_STATISTICS_FAILED");
  const expectedStatisticsTypography = ["overline", "h2", "subtitle1", "body1", "body2", "caption"];
  if (statistics.navigationNote !== "Exact inventory · recorded-time aggregates · no inferred causality" || !statistics.navigationBeforeHeader ||
      expectedStatisticsTypography.some((variant) => !statistics.typography.includes(variant))) {
    throw new Error(`HARNESS_STUDIO_TRACE_STATISTICS_SEMANTICS_INVALID: ${JSON.stringify(statistics)}`);
  }
  const studioStatisticsScreenshot = await captureScreenshot(cdp, "studio-trace-statistics-dark-desktop");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Tree').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.querySelector('[data-trace-renderer="tree"]') !== null`), "HARNESS_STUDIO_TRACE_TREE_RESTORE_FAILED");
  const trace = { waterfall, tree, statistics };
  const storedLocation = await cdp.evaluate(`sessionStorage.getItem('crystra.studio.location@1')`);
  const urlLocation = await cdp.evaluate(`new URL(location.href).searchParams.get('crystra-studio')`);
  if (!storedLocation?.startsWith('/evaluate/trace/') || urlLocation !== null) {
    throw new Error(`HARNESS_STUDIO_LOCATION_FAILED: ${JSON.stringify({ storedLocation, urlLocation })}`);
  }
  await cdp.command("Emulation.setDeviceMetricsOverride", { width: 360, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.evaluate(`(() => {
    const shell = document.querySelector('[data-sidebar-collapsed]');
    if (shell?.getAttribute('data-sidebar-collapsed') === 'true') return;
    const toggle = [...document.querySelectorAll('button')].find((node) => node.getAttribute('aria-label')?.includes('侧边栏'));
    toggle?.click();
  })()`);
  await waitFor(async () => cdp.evaluate(`(() => { const sidebar = document.querySelector('[data-slot="sidebar"] > div'); return document.querySelector('[data-sidebar-collapsed="true"]') !== null && sidebar !== null && sidebar.getBoundingClientRect().width <= 60; })()`), "HARNESS_STUDIO_NARROW_SIDEBAR_FAILED", 3_000);
  const narrow = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-crystra-studio-view="evaluate"]');
    if (view === null) return undefined;
    const passport = view.querySelector('.span-passport');
    const coreStyle = view.querySelector('style[data-crystra-bi-styles]');
    return { pass: view.scrollWidth <= view.clientWidth, scrollWidth: view.scrollWidth, clientWidth: view.clientWidth, innerWidth: window.innerWidth,
      media64: matchMedia('(max-width: 64rem)').matches, passportDisplay: passport === null ? null : getComputedStyle(passport).display,
      coreStyleLength: coreStyle?.textContent.length ?? 0, coreStyleSheetRules: coreStyle?.sheet?.cssRules?.length ?? -1,
      offenders: [...view.querySelectorAll('*')].filter((node) => node.scrollWidth > node.clientWidth + 1).slice(0, 8).map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className : node.getAttribute('class'), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })) };
  })()`), "HARNESS_STUDIO_NARROW_UNAVAILABLE", 3_000);
  if (!narrow.pass) throw new Error(`HARNESS_STUDIO_NARROW_OVERFLOW: ${JSON.stringify(narrow)}`);
  const studioNarrowScreenshot = await captureScreenshot(cdp, "studio-trace-tree-dark-narrow");
  const darkDocumentOrigin = await cdp.evaluate(`performance.timeOrigin`);
  await cdp.command("Page.reload", { ignoreCache: true });
  const restored = await waitFor(async () => cdp.evaluate(`(() => {
    const view = document.querySelector('[data-crystra-studio-view="evaluate"]');
    const waterfall = document.querySelector('[data-trace-renderer="waterfall"]');
    return Boolean(performance.timeOrigin !== ${JSON.stringify(darkDocumentOrigin)} && view && waterfall && waterfall.textContent.includes('Qualification evaluate'));
  })()`), "HARNESS_STUDIO_REFRESH_RECOVERY_FAILED", 30_000);
  await cdp.command("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  const lightDocumentOrigin = await cdp.evaluate(`performance.timeOrigin`);
  await cdp.command("Page.reload", { ignoreCache: true });
  const lightTheme = await waitFor(async () => cdp.evaluate(`performance.timeOrigin !== ${JSON.stringify(lightDocumentOrigin)} && document.querySelector('.crystra-bi[data-theme="light"]') !== null && document.querySelector('[data-trace-renderer="waterfall"]') !== null`), "HARNESS_STUDIO_LIGHT_THEME_FAILED", 30_000);
  const studioLightScreenshot = await captureScreenshot(cdp, "studio-trace-waterfall-light-narrow");
  fixtureAvailable = false;
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Back to Dashboard').click(); })()`);
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Change evaluation').click(); })()`);
  await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-studio-page="selection"]') !== null && document.querySelector('[data-crystra-dashboard-layout]') === null`), "HARNESS_STUDIO_DEGRADED_SELECTION_PAGE_FAILED");
  await cdp.evaluate(`(() => { [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Load tasks').click(); })()`);
  const degraded = await waitFor(async () => cdp.evaluate(`(() => {
    const alert = [...document.querySelectorAll('[role="alert"]')].find((node) => node.textContent.includes('Task list unavailable'));
    return alert?.textContent.trim();
  })()`), "HARNESS_STUDIO_DEGRADED_STATE_FAILED");
  await cdp.command("Page.bringToFront");
  await cdp.command("Input.dispatchKeyEvent", {
    type: "keyDown", key: "Escape", code: "Escape",
    windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 53,
  });
  await cdp.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 53 });
  const retainedAfterEscape = await waitFor(async () => cdp.evaluate(`document.querySelector('[data-crystra-studio-view="evaluate"]') !== null`), "HARNESS_ESCAPE_RETENTION_FAILED", 3_000);

  const severe = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown"
    || (event.method === "Log.entryAdded" && ["error"].includes(event.params.entry.level)));
  if (severe.length > 0) throw new Error(`HARNESS_BROWSER_ERRORS: ${JSON.stringify(severe)}`);
  const owner = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")).packages["node_modules/crystra-execution"];
  process.stdout.write(`${JSON.stringify({
    dsh: run("dsh", ["--version"]).trim(),
    owner: { version: owner.version, resolved: owner.resolved, integrity: owner.integrity, qualificationAsset: executionAsset },
    host: {
      origin,
      csp: csp === "" ? "absent-in-dsh-0.1.1-rc.2" : createHash("sha256").update(csp).digest("hex"),
      activation: ["crystra-execution", "crystra-studio"],
    },
    browser: { deliveryInventory: terminalFixture ? shell.terminalRows : "empty-ready", terminalView: terminalView ?? null, commandDiagnostic, sessionQualification, keyboardDisclosure: `${before.expanded}->${after}`, sidebarQualification, tabOrder: shell.tabOrder, studio,
      evaluate: "single-adjustable-dashboard-compare-metric-receipt-fact-trace", dashboard, savedDashboard,
      themes: { dark: dashboard.coreTheme, light: lightTheme ? "light" : "invalid" }, storedLocation, urlLocation, refreshRecovery: restored,
      screenshots: {
        selectionDarkDesktop: studioSelectionScreenshot,
        dashboardDarkDesktop: studioDashboardScreenshot,
        waterfallDarkDesktop: studioWaterfallScreenshot,
        treeDarkDesktop: studioTreeScreenshot,
        statisticsDarkDesktop: studioStatisticsScreenshot,
        treeDarkNarrow: studioNarrowScreenshot,
        waterfallLightNarrow: studioLightScreenshot,
      },
      escapeBehavior: retainedAfterEscape ? "conversation-view-retained" : "invalid", degraded, narrow, trace, errors: 0 },
  }, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  if (cdp !== undefined) {
    try {
      const diagnostic = await cdp.evaluate(`({ title: document.title, text: document.body?.innerText?.slice(0, 4000), html: document.body?.innerHTML?.slice(0, 4000) })`);
      process.stderr.write(`browser diagnostic: ${JSON.stringify(diagnostic)}\n`);
      process.stderr.write(`browser events: ${JSON.stringify(cdp.events.slice(-20))}\n`);
    } catch { /* retain the primary failure */ }
  }
  if (harnessLog !== "") process.stderr.write(`Harness log:\n${harnessLog.slice(-12_000)}\n`);
  process.exitCode = 1;
} finally {
  cdp?.close();
  if (chrome !== undefined) await stop(chrome);
  if (harness !== undefined) await stop(harness);
  if (fixtureServer !== undefined) await new Promise((accept) => fixtureServer.close(accept));
  await rm(temporary, { recursive: true, force: true });
}
