import { readFileSync } from "node:fs";

const CONFIG_SCHEMA = "crystra.loopback-host@1.0.0";
const STATUS_SCHEMA = "crystra.loopback-status@1.0.0";
const MAXIMUM_HEALTH_BYTES = 4096;
const MAXIMUM_CAPABILITY_BYTES = 1024 * 1024;
const REQUIRED_PATHS = Object.freeze({
  evidence: Object.freeze([
    "/v1/evidence/tasks",
    "/v1/evidence/facts",
    "/v1/evidence/traces",
  ]),
  evolution: Object.freeze(["/api/evolution/v1/evaluations:compute"]),
});
const EXPECTED = Object.freeze({
  evidence: Object.freeze({
    healthPath: "/healthz",
    healthKind: "json-status-ok",
    contracts: Object.freeze([
      Object.freeze({ name: "evidence.query", revision: "0.1.0", operations: Object.freeze(["facts/read", "traces/read"]) }),
      Object.freeze({ name: "evidence.query", revision: "1.0.0", operations: Object.freeze(["tasks/list"]) }),
    ]),
  }),
  evolution: Object.freeze({
    healthPath: "/healthz",
    healthKind: "plain-ok",
    contracts: Object.freeze([
      Object.freeze({ name: "evolution.compute", revision: "1", operations: Object.freeze(["evaluations/compute"]) }),
    ]),
  }),
});

function configurationError(reason) {
  throw new TypeError(`LOOPBACK_HOST_CONFIG_${reason}`);
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function baseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    configurationError("ENDPOINT_MALFORMED");
  }
  if (
    parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.port === "" ||
    parsed.username !== "" || parsed.password !== "" || parsed.pathname !== "/" ||
    parsed.search !== "" || parsed.hash !== ""
  ) configurationError("LOOPBACK_REQUIRED");
  return parsed.origin;
}

function service(name, value) {
  if (!exactKeys(value, ["baseUrl", "healthPath", "healthKind", "contracts"])) {
    configurationError("SERVICE_SHAPE_INVALID");
  }
  const expected = EXPECTED[name];
  if (
    value.healthPath !== expected.healthPath || value.healthKind !== expected.healthKind ||
    JSON.stringify(value.contracts) !== JSON.stringify(expected.contracts)
  ) configurationError("CONTRACT_INCOMPATIBLE");
  return Object.freeze({
    baseUrl: baseUrl(value.baseUrl),
    healthPath: expected.healthPath,
    healthKind: expected.healthKind,
    contracts: expected.contracts,
  });
}

export function normalizeLoopbackHostConfig(value) {
  if (!exactKeys(value, ["schemaVersion", "services", "observation"]) || value.schemaVersion !== CONFIG_SCHEMA) {
    configurationError("SCHEMA_UNSUPPORTED");
  }
  if (!exactKeys(value.services, ["evidence", "evolution"])) configurationError("SERVICES_INVALID");
  const evidence = service("evidence", value.services.evidence);
  const evolution = service("evolution", value.services.evolution);
  if (!exactKeys(value.observation, ["baseUrl"])) configurationError("OBSERVATION_INVALID");
  const observationBaseUrl = baseUrl(value.observation.baseUrl);
  if (observationBaseUrl !== evidence.baseUrl) configurationError("OBSERVATION_ENDPOINT_MISMATCH");
  return Object.freeze({
    schemaVersion: CONFIG_SCHEMA,
    services: Object.freeze({ evidence, evolution }),
    observation: Object.freeze({ baseUrl: observationBaseUrl }),
  });
}

export function loadLoopbackHostConfigFile(path, reader = readFileSync) {
  let source;
  try {
    source = reader(path, "utf8");
    if (typeof source !== "string" || new TextEncoder().encode(source).byteLength > 16_384) {
      throw new Error("bounded config required");
    }
    return normalizeLoopbackHostConfig(JSON.parse(source));
  } catch (error) {
    if (String(error?.message).startsWith("LOOPBACK_HOST_CONFIG_")) throw error;
    throw new TypeError("LOOPBACK_HOST_CONFIG_FILE_INVALID");
  }
}

function typed(code) {
  return Object.freeze({ state: code === "ready" ? "ready" : "degraded", code });
}

async function boundedHealth(response, serviceConfig) {
  if (!response.ok) return typed("downstream-http-error");
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > MAXIMUM_HEALTH_BYTES) {
    return typed("downstream-malformed");
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAXIMUM_HEALTH_BYTES) return typed("downstream-malformed");
  if (serviceConfig.healthKind === "plain-ok") {
    return body.trim() === "ok" ? typed("ready") : typed("downstream-malformed");
  }
  if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) {
    return typed("downstream-malformed");
  }
  try {
    const value = JSON.parse(body);
    return exactKeys(value, ["status"]) && value.status === "ok"
      ? typed("ready")
      : typed("downstream-incompatible");
  } catch {
    return typed("downstream-malformed");
  }
}

async function boundedCapabilities(response, name) {
  if (!response.ok) return typed("downstream-incompatible");
  if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) {
    return typed("downstream-malformed");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > MAXIMUM_CAPABILITY_BYTES) {
    return typed("downstream-malformed");
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAXIMUM_CAPABILITY_BYTES) {
    return typed("downstream-malformed");
  }
  try {
    const value = JSON.parse(body);
    if (!record(value?.paths)) return typed("downstream-malformed");
    return REQUIRED_PATHS[name].every((path) => Object.hasOwn(value.paths, path))
      ? typed("ready")
      : typed("downstream-incompatible");
  } catch {
    return typed("downstream-malformed");
  }
}

async function boundedEvolutionCapability(response) {
  if (response.status !== 400) return typed("downstream-incompatible");
  if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get("content-type") ?? "")) {
    return typed("downstream-malformed");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > MAXIMUM_HEALTH_BYTES) {
    return typed("downstream-malformed");
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAXIMUM_HEALTH_BYTES) {
    return typed("downstream-malformed");
  }
  try {
    const value = JSON.parse(body);
    return record(value?.error) && value.error.code === "INVALID_REQUEST" && value.error.retryable === false
      ? typed("ready")
      : typed("downstream-incompatible");
  } catch {
    return typed("downstream-malformed");
  }
}

export function createLoopbackHostIntegration(value, options = {}) {
  const config = normalizeLoopbackHostConfig(value);
  const fetcher = options.fetcher ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (typeof fetcher !== "function") configurationError("FETCH_UNAVAILABLE");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    configurationError("TIMEOUT_INVALID");
  }

  async function probe(name, serviceConfig) {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetcher(`${serviceConfig.baseUrl}${serviceConfig.healthPath}`, {
        method: "GET",
        headers: { Accept: serviceConfig.healthKind === "plain-ok" ? "text/plain" : "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: timeout,
      });
      const health = await boundedHealth(response, serviceConfig);
      if (health.code !== "ready") return health;
      const isEvolution = name === "evolution";
      const capabilities = await fetcher(`${serviceConfig.baseUrl}${isEvolution
        ? "/api/evolution/v1/evaluations:compute"
        : "/openapi.json"}`, {
        method: isEvolution ? "POST" : "GET",
        headers: isEvolution
          ? { Accept: "application/json", "Content-Type": "application/json" }
          : { Accept: "application/json" },
        ...(isEvolution ? { body: "{}" } : {}),
        credentials: "omit",
        redirect: "error",
        signal: timeout,
      });
      return isEvolution
        ? await boundedEvolutionCapability(capabilities)
        : await boundedCapabilities(capabilities, name);
    } catch {
      return typed(timeout.aborted ? "downstream-timeout" : "downstream-unavailable");
    }
  }

  return Object.freeze({
    config,
    async status() {
      const [evidence, evolution] = await Promise.all([
        probe("evidence", config.services.evidence),
        probe("evolution", config.services.evolution),
      ]);
      return Object.freeze({
        schemaVersion: STATUS_SCHEMA,
        state: evidence.state === "ready" && evolution.state === "ready" ? "ready" : "degraded",
        services: Object.freeze({ evidence, evolution }),
      });
    },
  });
}

export function defaultLoopbackHostConfig(options = {}) {
  const evidenceBaseUrl = options.evidenceBaseUrl ?? "http://127.0.0.1:4318";
  return normalizeLoopbackHostConfig({
    schemaVersion: CONFIG_SCHEMA,
    services: {
      evidence: { ...EXPECTED.evidence, baseUrl: evidenceBaseUrl },
      evolution: { ...EXPECTED.evolution, baseUrl: options.evolutionBaseUrl ?? "http://127.0.0.1:8000" },
    },
    observation: { baseUrl: evidenceBaseUrl },
  });
}
