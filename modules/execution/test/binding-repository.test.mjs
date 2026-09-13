import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { IntakeSessionBindingRepository } from "../src/intake/binding-repository.js";

const identity = (letter) => `sha256:${letter.repeat(64)}`;
const binding = (overrides = {}) => Object.freeze({
  sessionKey: "session-a",
  correlation: "intake-a",
  deliveryId: "delivery-a",
  deliveryBindingIdentity: identity("a"),
  worktree: "/workspace/a",
  ...overrides,
});
const terminal = (overrides = {}) => Object.freeze({
  deliveryId: "delivery-a",
  deliveryBindingIdentity: identity("a"),
  worktree: "/workspace/a",
  lifecycle: "TERMINAL",
  recoverable: false,
  navigation: Object.freeze({ sessionCorrelation: "intake-a" }),
  current: null,
  timing: Object.freeze({ startedAt: 100, updatedAt: 180, elapsedMs: 80 }),
  terminal: Object.freeze({ outcome: "SUCCEEDED", finishedAt: 180 }),
  error: null,
  ...overrides,
});

async function repositoryCase(run) {
  const root = await mkdtemp(join(tmpdir(), "crystra-binding-repository-"));
  const file = join(root, "bindings.json");
  try { await run({ file, repository: new IntakeSessionBindingRepository(file) }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("terminal projection releases active intake while retaining an exact reload-safe historical association", async () => {
  await repositoryCase(async ({ file, repository }) => {
    await repository.start();
    await repository.claim(binding());
    await repository.archiveTerminal("session-a", terminal());

    assert.equal(await repository.bySession("session-a"), undefined);
    assert.equal(await repository.byDelivery("delivery-a"), undefined);
    assert.deepEqual(await repository.list(), []);
    assert.deepEqual(await repository.listProjection(), [{ ...binding(), state: "HISTORICAL" }]);

    await repository.claim(binding({
      correlation: "intake-b", deliveryId: "delivery-b",
      deliveryBindingIdentity: identity("b"),
    }));
    assert.equal((await repository.bySession("session-a")).deliveryId, "delivery-b");
    assert.equal((await repository.listProjection()).length, 2);

    const reloaded = new IntakeSessionBindingRepository(file);
    await reloaded.start();
    assert.equal((await reloaded.bySession("session-a")).deliveryId, "delivery-b");
    assert.deepEqual((await reloaded.listProjection()).map(({ deliveryId, state }) => ({ deliveryId, state }))
      .sort((left, right) => left.deliveryId.localeCompare(right.deliveryId)), [
      { deliveryId: "delivery-a", state: "HISTORICAL" },
      { deliveryId: "delivery-b", state: "BOUND" },
    ]);
    assert.equal(JSON.parse(await readFile(file, "utf8")).schemaVersion, "execution.intake-bindings@3.0.0");
  });
});

test("preview schema freezes the new model and fails closed without rewriting legacy binding files", async () => {
  await repositoryCase(async ({ file, repository }) => {
    const legacy = `${JSON.stringify({
      schemaVersion: "execution.intake-bindings@2.0.0",
      bindings: [{ ...binding(), state: "BOUND" }],
    })}\n`;
    await writeFile(file, legacy);
    await assert.rejects(
      repository.start(),
      (error) => error?.code === "INTAKE_BINDING_INVARIANT_VIOLATION",
    );
    assert.equal(await readFile(file, "utf8"), legacy);
  });
});

test("historical creation requires one exact terminal Core projection and is idempotent", async () => {
  await repositoryCase(async ({ repository }) => {
    await repository.start();
    await assert.rejects(
      repository.archiveTerminal("session-a", terminal({ lifecycle: "RUNNING_CORRELATED", terminal: null, recoverable: true })),
      (error) => error?.code === "INTAKE_BINDING_INVARIANT_VIOLATION",
    );
    await repository.claim(binding());
    await assert.rejects(
      repository.archiveTerminal("session-a", terminal({ deliveryBindingIdentity: identity("f") })),
      (error) => error?.code === "INTAKE_BINDING_INVARIANT_VIOLATION",
    );
    await repository.archiveTerminal("session-a", terminal());
    await repository.archiveTerminal("session-a", terminal());
    assert.equal((await repository.listProjection()).length, 1);
  });
});

test("historical associations never satisfy active intake, delivery, or worktree occupancy lookups", async () => {
  await repositoryCase(async ({ repository }) => {
    await repository.start();
    await repository.archiveTerminal("session-a", terminal());
    assert.equal(await repository.bySession("session-a"), undefined);
    assert.equal(await repository.byDelivery("delivery-a"), undefined);
    assert.deepEqual(await repository.list(), []);
    await repository.claim(binding({
      correlation: "intake-b", deliveryId: "delivery-b", deliveryBindingIdentity: identity("b"),
    }));
    assert.equal((await repository.list()).length, 1);
  });
});
