import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeliveryControlPlaneGateway,
  createDshSessionControlPlaneReadModel,
} from "../src/host/delivery-control-plane.js";
import { IntakeSessionBindingRepository } from "../src/intake/binding-repository.js";
import { inject as intakeInject } from "../src/intake/plugin.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("DSH Intake declares the Host connection service used by its formal projection gateway", () => {
  assert.ok(intakeInject.includes("connection"));
});
import {
  createDeliveryControlPlaneClient,
} from "../src/client/delivery/control-plane-port.js";

const item = Object.freeze({
  deliveryId: "delivery-a",
  deliveryBindingIdentity: `sha256:${"a".repeat(64)}`,
  task: Object.freeze({ identity: "task-a", displayName: "Task A" }),
  worktree: "/workspace/a",
  workflow: Object.freeze({
    identity: "workflow-a",
    packageName: "hello-world",
    exactPackageVersion: "1.2.3",
    packageDigest: `sha256:${"b".repeat(64)}`,
    snapshotIdentity: "snapshot-a",
    snapshotDigest: `sha256:${"c".repeat(64)}`,
  }),
  lifecycle: "RUNNING_CORRELATED",
  detached: false,
  recoverable: true,
  navigation: Object.freeze({ sessionCorrelation: "session-a" }),
  current: Object.freeze({ kind: "ACTION", identity: "action-a" }),
  timing: Object.freeze({ startedAt: 1_777_000_000_000, updatedAt: 1_777_000_001_000, elapsedMs: 1000 }),
  terminal: null,
  error: null,
});

const snapshot = (generation = 1, deliveries = [item]) => Object.freeze({
  schemaVersion: "execution.delivery-control-plane@1.0.0",
  generation,
  deliveries: Object.freeze(deliveries),
});

test("Host gateway consumes the exact async DeliveryControlPlaneReadModel and exposes read RPC only", async () => {
  let inventory = snapshot();
  let listener;
  let onError;
  let disposed = 0;
  const readModel = Object.freeze({
    async snapshot() { return inventory; },
    async session(sessionCorrelation) {
      return sessionCorrelation === "session-a"
        ? Object.freeze({ kind: "BOUND", sessionCorrelation, delivery: item })
        : Object.freeze({ kind: "UNBOUND", sessionCorrelation });
    },
    async subscribe(next, error) {
      listener = next;
      onError = error;
      next(await this.snapshot());
      return () => { disposed += 1; };
    },
  });
  const gateway = await createDeliveryControlPlaneGateway(readModel);

  assert.deepEqual(Object.keys(gateway).sort(), ["close", "handle"]);
  assert.deepEqual(await gateway.handle("inventory/read", {}), { ok: true, value: snapshot() });
  assert.deepEqual(await gateway.handle("session/read", { sessionCorrelation: "session-a" }), {
    ok: true,
    value: { kind: "BOUND", sessionCorrelation: "session-a", delivery: item },
  });
  inventory = snapshot(2, []);
  listener(inventory);
  assert.deepEqual(await gateway.handle("inventory/read", {}), { ok: true, value: inventory });
  onError(Object.assign(new Error("unavailable"), { code: "DELIVERY_PROJECTION_UNAVAILABLE" }));
  assert.deepEqual(await gateway.handle("inventory/read", {}), { ok: true, value: inventory });
  await assert.rejects(() => gateway.handle("delivery/delete", { deliveryId: "delivery-a" }), /CONTROL_PLANE_RPC_INVALID/u);
  await gateway.close();
  assert.equal(disposed, 1);
});

test("Host gateway retries the owner snapshot after a transient subscription failure", async () => {
  let onError;
  let reads = 0;
  const readModel = Object.freeze({
    async snapshot() { reads += 1; return snapshot(reads); },
    async session(sessionCorrelation) { return { kind: "UNBOUND", sessionCorrelation }; },
    async subscribe(listener, error) {
      onError = error;
      listener(await this.snapshot());
      return () => undefined;
    },
  });
  const gateway = await createDeliveryControlPlaneGateway(readModel);
  onError(Object.assign(new Error("stale"), { code: "DELIVERY_PROJECTION_STALE_BINDING" }));

  const recovered = await gateway.handle("inventory/read", {});

  assert.equal(recovered.ok, true);
  assert.equal(recovered.value.generation, 2);
  assert.equal(reads, 2);
  await gateway.close();
});

test("browser store maps unary Host reads into replayable React snapshots without commands", async () => {
  let remote = snapshot();
  const calls = [];
  const rpc = Object.freeze({ async call(channel, endpoint, payload) {
    calls.push({ channel, endpoint, payload });
    if (endpoint === "inventory/read") return { ok: true, value: remote };
    if (endpoint === "session/read") return { ok: true, value: remote.deliveries.length === 0
      ? { kind: "UNBOUND", sessionCorrelation: payload.sessionCorrelation }
      : { kind: "BOUND", sessionCorrelation: payload.sessionCorrelation, delivery: remote.deliveries[0] } };
    throw new Error("unexpected endpoint");
  } });
  const client = createDeliveryControlPlaneClient(rpc);
  const changes = [];
  const unsubscribe = client.inventory.subscribe(() => changes.push(client.inventory.getSnapshot()));

  assert.deepEqual(client.inventory.getSnapshot(), { kind: "loading" });
  await client.refresh();
  assert.deepEqual(client.inventory.getSnapshot(), { kind: "ready", snapshot: remote });
  const session = client.bindSession("session-a");
  await session.refresh();
  assert.deepEqual(session.getSnapshot(), { kind: "ready", view: { kind: "BOUND", sessionCorrelation: "session-a", delivery: item } });
  remote = snapshot(2, []);
  await client.refresh();
  await session.refresh();
  assert.deepEqual(session.getSnapshot(), { kind: "ready", view: { kind: "UNBOUND", sessionCorrelation: "session-a" } });
  assert.equal(calls.some(({ endpoint }) => endpoint.includes("command") || endpoint.includes("delete") || endpoint.includes("recover")), false);
  assert.equal(changes.length, 2);
  unsubscribe();
});

test("DSH Host edge maps owner correlations to Session ids without changing the formal schema", async () => {
  const owner = Object.freeze({
    async snapshot() { return snapshot(1, [{ ...item, navigation: { sessionCorrelation: "intake-correlation-a" } }]); },
    async session(sessionCorrelation) {
      assert.equal(sessionCorrelation, "intake-correlation-a");
      return { kind: "BOUND", sessionCorrelation, delivery: { ...item, navigation: { sessionCorrelation } } };
    },
    async subscribe(listener) { listener(await this.snapshot()); return () => undefined; },
  });
  const bindings = Object.freeze({
    async listProjection() { return [{ sessionKey: "session-a", correlation: "intake-correlation-a", deliveryId: "delivery-a", deliveryBindingIdentity: `sha256:${"a".repeat(64)}`, worktree: "/workspace/a", state: "BOUND" }]; },
    async bySession(sessionKey) { return sessionKey === "session-a" ? { sessionKey, correlation: "intake-correlation-a", deliveryId: "delivery-a", deliveryBindingIdentity: `sha256:${"a".repeat(64)}`, worktree: "/workspace/a", state: "BOUND" } : undefined; },
  });
  const dsh = createDshSessionControlPlaneReadModel(owner, bindings);
  const inventory = await dsh.snapshot();
  assert.equal(inventory.schemaVersion, "execution.delivery-control-plane@1.0.0");
  assert.deepEqual(inventory.deliveries[0].navigation, { sessionCorrelation: "session-a" });
  assert.deepEqual(await dsh.session("session-a"), {
    kind: "BOUND",
    sessionCorrelation: "session-a",
    delivery: { ...item, navigation: { sessionCorrelation: "session-a" } },
  });
  assert.deepEqual(await dsh.session("session-unknown"), { kind: "UNBOUND", sessionCorrelation: "session-unknown" });
  const drift = createDshSessionControlPlaneReadModel(owner, Object.freeze({
    async listProjection() { return [{ ...(await bindings.listProjection())[0], deliveryBindingIdentity: `sha256:${"f".repeat(64)}` }]; },
    bySession: bindings.bySession,
  }));
  await assert.rejects(() => drift.snapshot(), (error) => error?.code === "DELIVERY_PROJECTION_STALE_BINDING");
});

test("exact Core terminal facts survive Host mapping, gateway and browser reads after active cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-terminal-projection-"));
  try {
    const bindings = new IntakeSessionBindingRepository(join(root, "bindings.json"));
    await bindings.start();
    const history = [
      { sessionKey: "session-a", correlation: "intake-completed", deliveryId: "delivery-completed", deliveryBindingIdentity: `sha256:${"d".repeat(64)}`, worktree: "/workspace/a", outcome: "SUCCEEDED", updatedAt: 180 },
      { sessionKey: "session-a", correlation: "intake-failed", deliveryId: "delivery-failed", deliveryBindingIdentity: `sha256:${"e".repeat(64)}`, worktree: "/workspace/a", outcome: "FAILED", updatedAt: 190 },
      { sessionKey: "session-b", correlation: "intake-cancelled", deliveryId: "delivery-cancelled", deliveryBindingIdentity: `sha256:${"f".repeat(64)}`, worktree: "/workspace/b", outcome: "CANCELLED", updatedAt: 200 },
    ];
    const terminalItems = history.map((entry) => Object.freeze({
      ...item,
      deliveryId: entry.deliveryId,
      deliveryBindingIdentity: entry.deliveryBindingIdentity,
      worktree: entry.worktree,
      lifecycle: "TERMINAL",
      recoverable: false,
      navigation: Object.freeze({ sessionCorrelation: entry.correlation }),
      current: null,
      timing: Object.freeze({ startedAt: 100, updatedAt: entry.updatedAt, elapsedMs: entry.updatedAt - 100 }),
      terminal: Object.freeze({ outcome: entry.outcome, finishedAt: entry.updatedAt }),
      error: entry.outcome === "FAILED" ? Object.freeze({ code: "ACTION_FAILED" }) : null,
    }));
    for (let index = 0; index < history.length; index += 1) {
      await bindings.archiveTerminal(history[index].sessionKey, terminalItems[index]);
    }
    const owner = Object.freeze({
      async snapshot() { return snapshot(7, terminalItems); },
      async session(correlation) {
        const delivery = terminalItems.find((candidate) => candidate.navigation.sessionCorrelation === correlation);
        return delivery === undefined ? { kind: "UNBOUND", sessionCorrelation: correlation } : { kind: "BOUND", sessionCorrelation: correlation, delivery };
      },
      async subscribe(listener) { listener(await this.snapshot()); return () => undefined; },
    });
    const gateway = await createDeliveryControlPlaneGateway(createDshSessionControlPlaneReadModel(owner, bindings));
    const rpc = Object.freeze({ call: (_channel, endpoint, payload) => gateway.handle(endpoint, payload) });
    const browser = createDeliveryControlPlaneClient(rpc);
    await browser.refresh();
    assert.deepEqual(browser.inventory.getSnapshot().snapshot.deliveries.map(({ deliveryId, terminal }) => [deliveryId, terminal.outcome]), [
      ["delivery-completed", "SUCCEEDED"], ["delivery-failed", "FAILED"], ["delivery-cancelled", "CANCELLED"],
    ]);
    const sessionA = browser.bindSession("session-a");
    await sessionA.refresh();
    assert.equal(sessionA.getSnapshot().view.delivery.deliveryId, "delivery-failed");
    await gateway.close();

    const reloaded = new IntakeSessionBindingRepository(join(root, "bindings.json"));
    await reloaded.start();
    const replayed = createDshSessionControlPlaneReadModel(owner, reloaded);
    assert.equal((await replayed.session("session-a")).delivery.deliveryId, "delivery-failed");
    assert.equal((await replayed.session("session-b")).delivery.deliveryId, "delivery-cancelled");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Session projection prefers active exact association then deterministically selects newest history", async () => {
  const deliveries = [
    { ...item, deliveryId: "delivery-old", deliveryBindingIdentity: `sha256:${"d".repeat(64)}`, navigation: { sessionCorrelation: "intake-old" }, lifecycle: "TERMINAL", recoverable: false, current: null, timing: { startedAt: 10, updatedAt: 20, elapsedMs: 10 }, terminal: { outcome: "SUCCEEDED", finishedAt: 20 } },
    { ...item, deliveryId: "delivery-z", deliveryBindingIdentity: `sha256:${"e".repeat(64)}`, navigation: { sessionCorrelation: "intake-z" }, lifecycle: "TERMINAL", recoverable: false, current: null, timing: { startedAt: 10, updatedAt: 30, elapsedMs: 20 }, terminal: { outcome: "FAILED", finishedAt: 30 } },
    { ...item, deliveryId: "delivery-zz", deliveryBindingIdentity: `sha256:${"1".repeat(64)}`, navigation: { sessionCorrelation: "intake-zz" }, lifecycle: "TERMINAL", recoverable: false, current: null, timing: { startedAt: 10, updatedAt: 30, elapsedMs: 20 }, terminal: { outcome: "CANCELLED", finishedAt: 30 } },
    { ...item, deliveryId: "delivery-new", deliveryBindingIdentity: `sha256:${"f".repeat(64)}`, navigation: { sessionCorrelation: "intake-new" } },
  ];
  const owner = Object.freeze({
    async snapshot() { return snapshot(8, deliveries); },
    async session(correlation) { const delivery = deliveries.find((row) => row.navigation.sessionCorrelation === correlation); return { kind: "BOUND", sessionCorrelation: correlation, delivery }; },
    async subscribe(listener) { listener(await this.snapshot()); return () => undefined; },
  });
  let active = true;
  const bindings = Object.freeze({
    async listProjection() { return [
      { sessionKey: "session-a", correlation: "intake-old", deliveryId: "delivery-old", deliveryBindingIdentity: `sha256:${"d".repeat(64)}`, worktree: "/workspace/a", state: "HISTORICAL" },
      { sessionKey: "session-a", correlation: "intake-z", deliveryId: "delivery-z", deliveryBindingIdentity: `sha256:${"e".repeat(64)}`, worktree: "/workspace/a", state: "HISTORICAL" },
      { sessionKey: "session-a", correlation: "intake-zz", deliveryId: "delivery-zz", deliveryBindingIdentity: `sha256:${"1".repeat(64)}`, worktree: "/workspace/a", state: "HISTORICAL" },
      ...(active ? [{ sessionKey: "session-a", correlation: "intake-new", deliveryId: "delivery-new", deliveryBindingIdentity: `sha256:${"f".repeat(64)}`, worktree: "/workspace/a", state: "BOUND" }] : []),
    ]; },
    async bySession(sessionKey) { return active && sessionKey === "session-a" ? { sessionKey, correlation: "intake-new", deliveryId: "delivery-new", deliveryBindingIdentity: `sha256:${"f".repeat(64)}`, worktree: "/workspace/a", state: "BOUND" } : undefined; },
  });
  const dsh = createDshSessionControlPlaneReadModel(owner, bindings);
  assert.equal((await dsh.session("session-a")).delivery.deliveryId, "delivery-new");
  active = false;
  assert.equal((await dsh.session("session-a")).delivery.deliveryId, "delivery-zz");
});

test("browser preserves bounded gateway projection codes and distinguishes reconnect from empty", async () => {
  let mode = "empty";
  const rpc = Object.freeze({ async call(_channel, endpoint, payload) {
    if (mode === "stale") return { ok: false, error: { code: "DELIVERY_PROJECTION_STALE_BINDING", message: "Delivery control plane unavailable" } };
    if (endpoint === "inventory/read") return { ok: true, value: snapshot(9, []) };
    return { ok: true, value: { kind: "UNBOUND", sessionCorrelation: payload.sessionCorrelation } };
  } });
  const browser = createDeliveryControlPlaneClient(rpc);
  await browser.refresh();
  assert.deepEqual(browser.inventory.getSnapshot(), { kind: "ready", snapshot: snapshot(9, []) });
  mode = "stale";
  await browser.refresh();
  assert.equal(browser.inventory.getSnapshot().kind, "reconnecting");
  assert.equal(browser.inventory.getSnapshot().code, "DELIVERY_PROJECTION_STALE_BINDING");
  const session = browser.bindSession("session-a");
  await session.refresh();
  assert.equal(session.getSnapshot().code, "DELIVERY_PROJECTION_STALE_BINDING");
});

test("repository terminal transition recovers a cached gateway failure without another Core invalidation", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-terminal-reconnect-"));
  try {
    const bindings = new IntakeSessionBindingRepository(join(root, "bindings.json"));
    await bindings.start();
    await bindings.claim({ sessionKey: "session-a", correlation: "intake-a", deliveryId: "delivery-a", deliveryBindingIdentity: item.deliveryBindingIdentity, worktree: item.worktree });
    let current = { ...item, navigation: { sessionCorrelation: "intake-a" } };
    let ownerListener;
    const owner = Object.freeze({
      async snapshot() { return snapshot(1, [current]); },
      async session(correlation) { return { kind: "BOUND", sessionCorrelation: correlation, delivery: current }; },
      async subscribe(listener) { ownerListener = listener; listener(await this.snapshot()); return () => undefined; },
    });
    const gateway = await createDeliveryControlPlaneGateway(createDshSessionControlPlaneReadModel(owner, bindings));
    assert.equal((await gateway.handle("inventory/read", {})).ok, true);

    current = {
      ...current, lifecycle: "TERMINAL", recoverable: false, current: null,
      timing: { startedAt: 100, updatedAt: 180, elapsedMs: 80 },
      terminal: { outcome: "SUCCEEDED", finishedAt: 180 },
    };
    ownerListener(snapshot(2, [current]));
    await new Promise((accept) => setTimeout(accept, 0));
    await bindings.archiveTerminal("session-a", current);
    await new Promise((accept) => setTimeout(accept, 0));

    const recovered = await gateway.handle("inventory/read", {});
    assert.equal(recovered.ok, true);
    assert.equal(recovered.value.deliveries[0].lifecycle, "TERMINAL");
    assert.deepEqual(recovered.value.deliveries[0].navigation, { sessionCorrelation: "session-a" });
    await gateway.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
