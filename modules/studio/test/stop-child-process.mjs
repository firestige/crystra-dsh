import { rm } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(hasExited(child));
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

export async function stopChildProcess(child, options = {}) {
  if (child === undefined || hasExited(child)) return;
  const termTimeoutMs = options.termTimeoutMs ?? 5_000;
  const killTimeoutMs = options.killTimeoutMs ?? 5_000;
  child.kill("SIGTERM");
  if (await waitForExit(child, termTimeoutMs)) return;
  child.kill("SIGKILL");
  if (!await waitForExit(child, killTimeoutMs)) {
    throw new Error("CHILD_PROCESS_TERMINATION_TIMEOUT");
  }
}

export async function removeRunDirectory(path, options = {}) {
  const remove = options.remove ?? rm;
  const delay = options.delay ?? wait;
  const maxAttempts = options.maxAttempts ?? 6;
  const retryDelayMs = options.retryDelayMs ?? 100;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await remove(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error?.code !== "ENOTEMPTY" || attempt === maxAttempts) throw error;
      await delay(retryDelayMs * attempt);
    }
  }
}
