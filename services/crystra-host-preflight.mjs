#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

const templateUrl = new URL("./host-endpoints.template.json", import.meta.url);
const mode = process.argv[2] ?? "check";
const allowedOccupied = new Set((process.argv[3] ?? "").split(",").filter(Boolean));

function fail(code, message) {
  process.stderr.write(`${code}: ${message}\n`);
  process.exitCode = 2;
}

function port(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  if (!/^\d+$/u.test(raw)) throw new Error(`LOOPBACK_PORT_INVALID:${name}`);
  const value = Number(raw);
  if (value < 1 || value > 65535) throw new Error(`LOOPBACK_PORT_INVALID:${name}`);
  return value;
}

function verifyHost(name) {
  const value = process.env[name] ?? "127.0.0.1";
  if (value !== "127.0.0.1") throw new Error(`LOOPBACK_HOST_REQUIRED:${name}`);
}

async function canBind(value) {
  await new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: value });
    socket.unref();
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      reject(Object.assign(new Error("listener already accepts connections"), { code: "EADDRINUSE" }));
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(Object.assign(new Error("listener probe timed out"), { code: "EADDRINUSE" }));
    });
    socket.once("error", (error) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve();
      else reject(error);
    });
  });
}

async function waitUntilBindable(value, waitMs) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      await canBind(value);
      return;
    } catch (error) {
      if (error?.code !== "EADDRINUSE" || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

try {
  verifyHost("CRYSTRA_EVIDENCE_HOST");
  verifyHost("CRYSTRA_EVOLUTION_HOST");
  const evidencePort = port("CRYSTRA_EVIDENCE_PORT", 4318);
  const evolutionPort = port("CRYSTRA_EVOLUTION_PORT", 8000);
  const portWaitMs = port("CRYSTRA_PREFLIGHT_PORT_WAIT_MS", 15_000);
  if ([...allowedOccupied].some((name) => name !== "evidence" && name !== "evolution")) {
    throw new Error("LOOPBACK_PREFLIGHT_OWNER_INVALID");
  }
  if (evidencePort === evolutionPort) throw new Error("LOOPBACK_PORT_COLLISION");
  const config = JSON.parse(await readFile(templateUrl, "utf8"));
  if (
    config.schemaVersion !== "crystra.loopback-host@1.0.0" ||
    JSON.stringify(config.services?.evidence?.contracts) !== JSON.stringify([
      { name: "evidence.query", revision: "0.1.0", operations: ["facts/read", "traces/read"] },
      { name: "evidence.query", revision: "1.0.0", operations: ["tasks/list"] },
    ]) ||
    JSON.stringify(config.services?.evolution?.contracts) !== JSON.stringify([
      { name: "evolution.compute", revision: "1", operations: ["evaluations/compute"] },
    ])
  ) throw new Error("LOOPBACK_CONTRACT_INCOMPATIBLE");
  config.services.evidence.baseUrl = `http://127.0.0.1:${evidencePort}`;
  config.services.evolution.baseUrl = `http://127.0.0.1:${evolutionPort}`;
  config.observation.baseUrl = config.services.evidence.baseUrl;
  if (mode === "config") {
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  } else if (mode === "check") {
    try {
      if (!allowedOccupied.has("evidence")) await waitUntilBindable(evidencePort, portWaitMs);
      if (!allowedOccupied.has("evolution")) await waitUntilBindable(evolutionPort, portWaitMs);
    } catch (error) {
      if (error?.code === "EADDRINUSE") throw new Error("LOOPBACK_PORT_IN_USE");
      throw error;
    }
    process.stdout.write(
      `Loopback preflight passed for Evidence 127.0.0.1:${evidencePort} and Evolution 127.0.0.1:${evolutionPort}.\n`,
    );
  } else {
    throw new Error("LOOPBACK_PREFLIGHT_MODE_INVALID");
  }
} catch (error) {
  const [code, detail] = String(error?.message ?? error).split(":", 2);
  fail(code, detail === undefined ? "loopback Host preflight failed" : `${detail} is invalid`);
}
