import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createLoopbackHostIntegration,
  loadLoopbackHostConfigFile,
  normalizeLoopbackHostConfig,
} from "../src/host/loopback-integration.js";
import { createStudioGatewayHandler } from "../src/host/gateway.js";

const config = JSON.parse(await readFile(new URL("./fixtures/loopback-host.json", import.meta.url), "utf8"));

function response(body, contentType, status = 200) {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

function capabilities(name) {
  const paths = name === "evidence"
    ? {
      "/v1/evidence/tasks": {},
      "/v1/evidence/facts": {},
      "/v1/evidence/traces": {},
    }
    : { "/api/evolution/v1/evaluations:compute": {} };
  return response(JSON.stringify({ paths }), "application/json");
}

function evolutionCapability() {
  return response(JSON.stringify({
    error: {
      code: "INVALID_REQUEST",
      retryable: false,
      detail: "request does not match evolution compute API v1",
      details: [],
    },
  }), "application/json", 400);
}

test("loopback Host config binds the endpoint owners and compatible contracts", () => {
  const normalized = normalizeLoopbackHostConfig(config);
  assert.deepEqual(normalized.services.evidence.contracts, [
    { name: "evidence.query", revision: "0.1.0", operations: ["facts/read", "traces/read"] },
    { name: "evidence.query", revision: "1.0.0", operations: ["tasks/list"] },
  ]);
  assert.deepEqual(normalized.services.evolution.contracts, [
    { name: "evolution.compute", revision: "1", operations: ["evaluations/compute"] },
  ]);
  assert.equal(normalized.observation.baseUrl, normalized.services.evidence.baseUrl);
});

test("the Host loads the generated credential-free fixture before plugin effects", () => {
  const path = new URL("./fixtures/loopback-host.json", import.meta.url);
  const loaded = loadLoopbackHostConfigFile(path);
  assert.equal(loaded.services.evidence.baseUrl, "http://127.0.0.1:4318");
  assert.throws(
    () => loadLoopbackHostConfigFile("ignored", () => "{"),
    /LOOPBACK_HOST_CONFIG_FILE_INVALID/,
  );
  assert.throws(
    () => loadLoopbackHostConfigFile("ignored", () => "x".repeat(16_385)),
    /LOOPBACK_HOST_CONFIG_FILE_INVALID/,
  );
});

test("malformed, credentialed, remote, and incompatible endpoint config fails before registration", () => {
  const cases = [
    ["remote", { ...config, services: { ...config.services, evidence: { ...config.services.evidence, baseUrl: "http://0.0.0.0:4318" } } }],
    ["localhost", { ...config, services: { ...config.services, evidence: { ...config.services.evidence, baseUrl: "http://localhost:4318" } } }],
    ["credential", { ...config, services: { ...config.services, evidence: { ...config.services.evidence, baseUrl: "http://user:secret@127.0.0.1:4318" } } }],
    ["contract", { ...config, services: { ...config.services, evidence: { ...config.services.evidence, contracts: [{ name: "evidence.query", revision: "2.0.0", operations: ["facts/read"] }] } } }],
    ["observation", { ...config, observation: { baseUrl: "http://127.0.0.1:9999" } }],
  ];
  for (const [name, value] of cases) {
    assert.throws(() => normalizeLoopbackHostConfig(value), /LOOPBACK_HOST_CONFIG_/, name);
  }
});

test("health reports ready and independently typed partial-stack degradation", async () => {
  const integration = createLoopbackHostIntegration(config, {
    timeoutMs: 50,
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/openapi.json")) return capabilities("evidence");
      return url.includes(":4318/")
        ? response(JSON.stringify({ status: "ok" }), "application/json")
        : response("maintenance", "text/plain", 503);
    },
  });
  assert.deepEqual(await integration.status(), {
    schemaVersion: "crystra.loopback-status@1.0.0",
    state: "degraded",
    services: {
      evidence: { state: "ready", code: "ready" },
      evolution: { state: "degraded", code: "downstream-http-error" },
    },
  });
});

test("a nominally healthy service missing the pinned read capability is incompatible", async () => {
  const integration = createLoopbackHostIntegration(config, {
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/evolution/v1/evaluations:compute")) return evolutionCapability();
      if (url.endsWith("/openapi.json")) {
        const paths = url.includes(":4318/")
          ? { "/v1/evidence/facts": {}, "/v1/evidence/traces": {} }
          : { "/api/evolution/v1/evaluations:compute": {} };
        return response(JSON.stringify({ paths }), "application/json");
      }
      return url.includes(":4318/")
        ? response(JSON.stringify({ status: "ok" }), "application/json")
        : response("ok", "text/plain");
    },
  });
  const status = await integration.status();
  assert.equal(status.services.evidence.code, "downstream-incompatible");
  assert.equal(status.services.evolution.code, "ready");
});

test("Evolution capability uses its fail-closed invalid-request seam without requiring OpenAPI", async () => {
  const integration = createLoopbackHostIntegration(config, {
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.includes(":4318/openapi.json")) return capabilities("evidence");
      if (url.includes(":4318/healthz")) {
        return response(JSON.stringify({ status: "ok" }), "application/json");
      }
      if (url.endsWith("/healthz")) return response("ok", "text/plain");
      if (url.endsWith("/api/evolution/v1/evaluations:compute")) {
        assert.equal(init.method, "POST");
        assert.equal(init.body, "{}");
        return response(JSON.stringify({
          error: {
            code: "INVALID_REQUEST",
            retryable: false,
            detail: "request does not match evolution compute API v1",
            details: [],
          },
        }), "application/json", 400);
      }
      return response(JSON.stringify({ detail: "Not Found" }), "application/json", 404);
    },
  });
  assert.equal((await integration.status()).services.evolution.code, "ready");
});

test("restart, malformed health, connection refusal, and timeout remain bounded typed state", async () => {
  let evolutionAttempts = 0;
  const integration = createLoopbackHostIntegration(config, {
    timeoutMs: 5,
    fetcher: async (input, init) => {
      if (String(input).endsWith("/api/evolution/v1/evaluations:compute")) {
        return evolutionCapability();
      }
      if (String(input).endsWith("/openapi.json")) {
        return capabilities(String(input).includes(":4318/") ? "evidence" : "evolution");
      }
      if (String(input).includes(":4318/")) {
        return response("not-json", "application/json");
      }
      evolutionAttempts += 1;
      if (evolutionAttempts === 1) throw new Error("ECONNREFUSED secret path");
      if (evolutionAttempts === 2) {
        return await new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        });
      }
      return response("ok", "text/plain");
    },
  });

  assert.equal((await integration.status()).services.evolution.code, "downstream-unavailable");
  assert.equal((await integration.status()).services.evolution.code, "downstream-timeout");
  const recovered = await integration.status();
  assert.equal(recovered.services.evolution.code, "ready");
  assert.equal(recovered.services.evidence.code, "downstream-malformed");
  assert.doesNotMatch(JSON.stringify(recovered), /ECONNREFUSED|secret path/);
});

test("Studio exposes service degradation only on its read gateway", async () => {
  const integration = createLoopbackHostIntegration(config, {
    fetcher: async () => response("ok", "text/plain", 503),
  });
  const handler = createStudioGatewayHandler({ integration });
  const result = await handler("services/status", {}, new AbortController().signal);
  assert.equal(result.ok, true);
  assert.equal(result.value.state, "degraded");
  assert.equal(result.value.services.evidence.code, "downstream-http-error");
});
