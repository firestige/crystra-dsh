import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { removeRunDirectory, stopChildProcess } from "./stop-child-process.mjs";

test("forced child shutdown resolves only after the process emits exit", async () => {
  class DelayedForcedExitChild extends EventEmitter {
    exitCode = null;
    signalCode = null;
    signals = [];

    kill(signal) {
      this.signals.push(signal);
      if (signal === "SIGKILL") {
        setTimeout(() => {
          this.signalCode = signal;
          this.emit("exit", null, signal);
        }, 10);
      }
      return true;
    }
  }

  const child = new DelayedForcedExitChild();
  await stopChildProcess(child, { termTimeoutMs: 1, killTimeoutMs: 100 });

  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(child.signalCode, "SIGKILL");
});

test("forced child shutdown fails closed when exit never arrives", async () => {
  class StuckChild extends EventEmitter {
    exitCode = null;
    signalCode = null;
    kill() { return true; }
  }

  await assert.rejects(
    stopChildProcess(new StuckChild(), { termTimeoutMs: 1, killTimeoutMs: 1 }),
    /CHILD_PROCESS_TERMINATION_TIMEOUT/u,
  );
});

test("run-directory cleanup retries bounded ENOTEMPTY races until removal succeeds", async () => {
  let attempts = 0;
  let removed = false;
  const remove = async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("directory not empty"), { code: "ENOTEMPTY" });
    removed = true;
  };

  await removeRunDirectory("/tmp/run-owned", {
    maxAttempts: 3,
    remove,
    delay: async () => undefined,
  });

  assert.equal(attempts, 3);
  assert.equal(removed, true);
});

test("run-directory cleanup does not retry errors outside ENOTEMPTY", async () => {
  let attempts = 0;
  const remove = async () => {
    attempts += 1;
    throw Object.assign(new Error("permission denied"), { code: "EACCES" });
  };

  await assert.rejects(
    removeRunDirectory("/tmp/run-owned", { maxAttempts: 3, remove, delay: async () => undefined }),
    (error) => error?.code === "EACCES",
  );
  assert.equal(attempts, 1);
});

test("run-directory cleanup fails closed after the bounded ENOTEMPTY attempts", async () => {
  let attempts = 0;
  const remove = async () => {
    attempts += 1;
    throw Object.assign(new Error("directory not empty"), { code: "ENOTEMPTY" });
  };

  await assert.rejects(
    removeRunDirectory("/tmp/run-owned", { maxAttempts: 3, remove, delay: async () => undefined }),
    (error) => error?.code === "ENOTEMPTY",
  );
  assert.equal(attempts, 3);
});
