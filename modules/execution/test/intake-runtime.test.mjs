import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import * as executionApi from "crystra-execution";
import { parseCrystraCommand } from "../src/intake/command.js";
import { createPluginRuntime } from "../src/intake/plugin.js";

const identity = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await predicate();
    if (value) return value;
    await new Promise((accept) => setTimeout(accept, 5));
  }
  throw new Error("TEST_TIMEOUT");
}

test("runtime archives only an exact terminal Core row, releases routing, and permits the next Session Delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-runtime-"));
  try {
    const spelling = join(root, "worktree");
    await mkdir(spelling);
    const worktree = await realpath(spelling);
    const requests = [];
    const pending = [];
    const attachments = [];
    let projected = [];
    const application = Object.freeze({
      async start() {},
      async execute(request) {
        requests.push(request);
        return new Promise((resolve) => pending.push(resolve));
      },
      async inspect() { throw new Error("not used"); },
      async cancel() { throw new Error("not used"); },
      status() { return { state: "READY" }; },
      async close() {},
    });
    const control = Object.freeze({
      async bindingInventory() { return []; },
      attach(deliveryId, correlation) {
        attachments.push(readFile(join(root, "bindings.json"), "utf8").then((value) => ({ deliveryId, correlation, value })));
      },
      async waitForDelivery(correlation) {
        const index = requests.findIndex((request) => request.intakeCorrelation === correlation);
        return { deliveryId: `delivery-${index + 1}`, worktree, deliveryBindingIdentity: identity(`delivery-${index + 1}`) };
      },
      async answerAction() { throw new Error("not used"); },
    });
    const ownerProjection = Object.freeze({ async snapshot() {
      return { schemaVersion: "execution.delivery-control-plane@1.0.0", generation: 1, deliveries: projected };
    } });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control,
      ownerProjection,
      quiesceTimeoutMs: 10,
      ensureGitWorktree: async () => ({ path: worktree, initialized: false }),
      resolveConversationWorkspace: async (agent) => ({ sessionKey: String(agent.id), workspaceId: "workspace-a", path: worktree }),
    });
    const input = (text) => ({
      sessionKey: "session-a", agent: { id: "session-a" },
      operation: parseCrystraCommand(`create fixture@1.0.0\n${text}`),
      turnText: `/crystra create fixture@1.0.0\n${text}`, images: [],
    });
    assert.match((await runtime.invokeForSession(input("first"))).kind, /START_UNCERTAIN/u);
    const first = await runtime.bindings.bySession("session-a");
    assert.equal(attachments.length, 1);
    const attached = await attachments[0];
    assert.equal(attached.deliveryId, "delivery-1");
    assert.equal(attached.correlation, first.correlation);
    assert.match(attached.value, /delivery-1/u);
    projected = [{
      deliveryId: first.deliveryId, deliveryBindingIdentity: first.deliveryBindingIdentity,
      task: { identity: "task-a", displayName: "Task A" }, worktree,
      workflow: { identity: "workflow-a", packageName: "fixture", exactPackageVersion: "1.0.0", packageDigest: identity("package"), snapshotIdentity: "snapshot-a", snapshotDigest: identity("snapshot") },
      lifecycle: "TERMINAL", detached: false, recoverable: false,
      navigation: { sessionCorrelation: first.correlation }, current: null,
      timing: { startedAt: 100, updatedAt: 180, elapsedMs: 80 },
      terminal: { outcome: "SUCCEEDED", finishedAt: 180 }, error: null,
    }];
    pending[0]({ kind: "TERMINAL", worktree, deliveryId: first.deliveryId, outcome: "SUCCEEDED" });
    await waitFor(async () => (await runtime.bindings.bySession("session-a")) === undefined);
    assert.deepEqual((await runtime.bindings.listProjection()).map(({ deliveryId, state }) => ({ deliveryId, state })), [
      { deliveryId: "delivery-1", state: "HISTORICAL" },
    ]);

    assert.match((await runtime.invokeForSession(input("second"))).kind, /START_UNCERTAIN/u);
    assert.equal((await runtime.bindings.bySession("session-a")).deliveryId, "delivery-2");
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-registration ERROR creates no historical association", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-error-"));
  try {
    const worktree = await realpath(root);
    const application = Object.freeze({
      async start() {}, async execute() { return { kind: "ERROR", code: "WORKFLOW_NOT_FOUND", message: "WORKFLOW_NOT_FOUND" }; },
      async inspect() {}, async cancel() {}, status() { return { state: "READY" }; }, async close() {},
    });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control: Object.freeze({ async bindingInventory() { return []; }, attach() {}, async waitForDelivery() { return undefined; } }),
      ownerProjection: Object.freeze({ async snapshot() { return { schemaVersion: "execution.delivery-control-plane@1.0.0", generation: 1, deliveries: [] }; } }),
      ensureGitWorktree: async () => ({ path: worktree, initialized: false }),
      resolveConversationWorkspace: async () => ({ sessionKey: "session-a", workspaceId: "workspace-a", path: worktree }),
    });
    const result = await runtime.invokeForSession({
      sessionKey: "session-a", agent: { id: "session-a" },
      operation: parseCrystraCommand("create fixture@1.0.0\nmissing"), turnText: "/crystra create fixture@1.0.0\nmissing", images: [],
    });
    assert.equal(result.kind, "ERROR");
    assert.deepEqual(await runtime.bindings.listProjection(), []);
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no-ID abandon infers only the Delivery bound to the current Session", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-abandon-"));
  try {
    const worktree = await realpath(root);
    const cancelled = [];
    const application = Object.freeze({
      async start() {}, async execute() {}, async inspect() {},
      async cancel(deliveryId) { cancelled.push(deliveryId); return { kind: "ERROR", code: "CANCEL_PENDING", message: "CANCEL_PENDING" }; },
      status() { return { state: "READY" }; }, async close() {},
    });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control: Object.freeze({ async bindingInventory() { return []; } }),
      ownerProjection: Object.freeze({ async snapshot() { return { schemaVersion: "execution.delivery-control-plane@1.0.0", generation: 1, deliveries: [] }; } }),
    });
    await runtime.bindings.claim({
      sessionKey: "session-a", correlation: "correlation-a", deliveryId: "delivery-bound",
      worktree, deliveryBindingIdentity: identity("delivery-bound"),
    });

    assert.equal((await runtime.invokeForSession({
      sessionKey: "session-a", agent: { id: "session-a" }, operation: parseCrystraCommand("abandon"), images: [],
    })).code, "CANCEL_PENDING");
    assert.deepEqual(cancelled, ["delivery-bound"]);
    assert.equal((await runtime.invokeForSession({
      sessionKey: "session-b", agent: { id: "session-b" }, operation: parseCrystraCommand("abandon"), images: [],
    })).code, "CRYSTRA_COMMAND_INVALID");
    assert.deepEqual(cancelled, ["delivery-bound"]);
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no-ID abandon archives its authoritative terminal result without a projection round trip", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-abandon-terminal-"));
  try {
    const worktree = await realpath(root);
    const deliveryId = "delivery-bound";
    const deliveryBindingIdentity = identity(deliveryId);
    const correlation = "correlation-a";
    let snapshots = 0;
    const application = Object.freeze({
      async start() {}, async execute() {}, async inspect() {},
      async cancel(candidate) {
        assert.equal(candidate, deliveryId);
        return { kind: "TERMINAL", worktree, deliveryId, outcome: "CANCELLED" };
      },
      status() { return { state: "READY" }; }, async close() {},
    });
    const ownerProjection = Object.freeze({ async snapshot() {
      snapshots += 1;
      if (snapshots === 2) {
        throw Object.assign(new Error("transient stale binding"), { code: "DELIVERY_PROJECTION_STALE_BINDING" });
      }
      return {
        schemaVersion: "execution.delivery-control-plane@1.0.0", generation: snapshots,
        deliveries: [{
          deliveryId, deliveryBindingIdentity, worktree,
          lifecycle: "TERMINAL", detached: false, recoverable: false,
          navigation: { sessionCorrelation: correlation }, current: null,
          timing: { updatedAt: 100 }, terminal: { outcome: "CANCELLED", finishedAt: 100 }, error: null,
        }],
      };
    } });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control: Object.freeze({ async bindingInventory() { return []; } }),
      ownerProjection,
    });
    await runtime.bindings.claim({ sessionKey: "session-a", correlation, deliveryId, worktree, deliveryBindingIdentity });

    assert.deepEqual(await runtime.invokeForSession({
      sessionKey: "session-a", agent: { id: "session-a" }, operation: parseCrystraCommand("abandon"), images: [],
    }), { kind: "TERMINAL", worktree, deliveryId, outcome: "CANCELLED" });
    assert.equal(snapshots, 1);
    assert.equal(await runtime.bindings.bySession("session-a"), undefined);
    assert.equal((await runtime.bindings.listProjection())[0]?.state, "HISTORICAL");
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("terminal abandon archives from its authoritative result without consulting a circularly stale projection", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-abandon-result-"));
  try {
    const worktree = await realpath(root);
    const deliveryId = "delivery-bound";
    const deliveryBindingIdentity = identity(deliveryId);
    const correlation = "correlation-a";
    let snapshots = 0;
    const application = Object.freeze({
      async start() {}, async execute() {}, async inspect() {},
      async cancel(candidate) {
        assert.equal(candidate, deliveryId);
        return { kind: "TERMINAL", worktree, deliveryId, outcome: "CANCELLED" };
      },
      status() { return { state: "READY" }; }, async close() {},
    });
    const ownerProjection = Object.freeze({ async snapshot() {
      snapshots += 1;
      if (snapshots > 1) {
        throw Object.assign(new Error("binding makes projection permanently stale after slot release"), {
          code: "DELIVERY_PROJECTION_STALE_BINDING",
        });
      }
      return { schemaVersion: "execution.delivery-control-plane@1.0.0", generation: 1, deliveries: [] };
    } });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control: Object.freeze({ async bindingInventory() { return []; } }),
      ownerProjection,
    });
    await runtime.bindings.claim({ sessionKey: "session-a", correlation, deliveryId, worktree, deliveryBindingIdentity });

    assert.deepEqual(await runtime.invokeForSession({
      sessionKey: "session-a", agent: { id: "session-a" }, operation: parseCrystraCommand("abandon"), images: [],
    }), { kind: "TERMINAL", worktree, deliveryId, outcome: "CANCELLED" });
    assert.equal(snapshots, 1);
    assert.equal(await runtime.bindings.bySession("session-a"), undefined);
    assert.equal((await runtime.bindings.listProjection())[0]?.state, "HISTORICAL");
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registration polling survives a cold-start timeout and commits the Session binding before terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-intake-cold-registration-"));
  try {
    const worktree = await realpath(root);
    let resolveExecution;
    const execution = new Promise((resolve) => { resolveExecution = resolve; });
    let waits = 0;
    const attached = [];
    let projected = [];
    const application = Object.freeze({
      async start() {}, async execute() { return execution; }, async inspect() {}, async cancel() {},
      status() { return { state: "READY" }; }, async close() {},
    });
    const control = Object.freeze({
      async bindingInventory() { return []; },
      attach(deliveryId, correlation) { attached.push({ deliveryId, correlation }); },
      async waitForDelivery() {
        waits += 1;
        return waits === 1 ? undefined : {
          deliveryId: "delivery-cold", worktree, deliveryBindingIdentity: identity("delivery-cold"),
        };
      },
    });
    const runtime = await createPluginRuntime({ configFile: join(root, "execution.json"), bindingFile: join(root, "bindings.json") }, {
      moduleLoader: async () => executionApi,
      factory: Object.freeze({ async create() { return application; } }),
      control,
      ownerProjection: Object.freeze({ async snapshot() { return { schemaVersion: "execution.delivery-control-plane@1.0.0", generation: 1, deliveries: projected }; } }),
      quiesceTimeoutMs: 1,
      ensureGitWorktree: async () => ({ path: worktree, initialized: false }),
      resolveConversationWorkspace: async () => ({ sessionKey: "session-cold", workspaceId: "workspace-cold", path: worktree }),
    });

    const terminalFallback = setTimeout(() => resolveExecution({ kind: "TERMINAL", worktree, deliveryId: "delivery-cold", outcome: "SUCCEEDED" }), 25);
    const result = await runtime.invokeForSession({
      sessionKey: "session-cold", agent: { id: "session-cold" },
      operation: parseCrystraCommand("create fixture@1.0.0\nrun after cold start"),
      turnText: "/crystra create fixture@1.0.0\nrun after cold start", images: [],
    });
    assert.deepEqual(result, { kind: "START_UNCERTAIN", worktree, deliveryId: "delivery-cold" });
    assert.equal(waits, 2);
    assert.equal(attached.length, 1);
    assert.match((await readFile(join(root, "bindings.json"), "utf8")), /delivery-cold/u);
    clearTimeout(terminalFallback);
    projected = [{
      deliveryId: "delivery-cold", deliveryBindingIdentity: identity("delivery-cold"),
      worktree, lifecycle: "TERMINAL", recoverable: false, current: null,
      navigation: { sessionCorrelation: attached[0].correlation },
      timing: { updatedAt: 100 }, terminal: { outcome: "SUCCEEDED", finishedAt: 100 },
    }];
    resolveExecution({ kind: "TERMINAL", worktree, deliveryId: "delivery-cold", outcome: "SUCCEEDED" });
    await waitFor(async () => (await runtime.bindings.listProjection())[0]?.state === "HISTORICAL");
    await runtime.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
