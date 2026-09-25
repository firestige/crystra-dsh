import assert from "node:assert/strict";
import test from "node:test";

import {
  createStudioGatewayHandler,
  registerStudioGateway,
} from "../src/host/gateway.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const bases = {
  evidenceBaseUrl: "http://127.0.0.1:4318",
  evolutionBaseUrl: "http://127.0.0.1:8000",
};

test("the Host gateway accepts only exact loopback downstream origins", () => {
  for (const value of [
    "http://localhost:4318",
    "http://0.0.0.0:4318",
    "https://127.0.0.1:4318",
    "http://127.0.0.1:4318/path",
    "http://user:secret@127.0.0.1:4318",
  ]) {
    assert.throws(
      () => createStudioGatewayHandler({ ...bases, evidenceBaseUrl: value }),
      /STUDIO_GATEWAY_LOOPBACK_REQUIRED/,
    );
  }
});

test("the allowlist maps typed requests to exact formal read APIs without credentials", async () => {
  const requests = [];
  const handler = createStudioGatewayHandler({
    ...bases,
    fetcher: async (input, init) => {
      requests.push({ input: String(input), init });
      return jsonResponse({ ok: true });
    },
  });

  for (const [endpoint, payload] of [
    ["tasks/list", { limit: 100 }],
    ["facts/read", { delivery_id: "delivery-1", limit: 50 }],
    ["traces/read", { trace_id: "a".repeat(32), limit: 200 }],
    [
      "evaluations/compute",
      {
        api_version: 1,
        mode: "SINGLE",
        selection: { selection_version: 1, task_ids: ["task-1"] },
      },
    ],
  ]) {
    const result = await handler(endpoint, payload, new AbortController().signal);
    assert.equal(result.ok, true, endpoint);
  }

  assert.deepEqual(
    requests.map(({ input, init }) => ({
      input,
      method: init.method,
      headers: init.headers,
      credentials: init.credentials,
      redirect: init.redirect,
    })),
    [
      {
        input: "http://127.0.0.1:4318/v1/evidence/tasks?limit=100",
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
      },
      {
        input: "http://127.0.0.1:4318/v1/evidence/facts?delivery_id=delivery-1&limit=50",
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
      },
      {
        input: `http://127.0.0.1:4318/v1/evidence/traces?trace_id=${"a".repeat(32)}&limit=200`,
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
      },
      {
        input: "http://127.0.0.1:8000/api/evolution/v1/evaluations:compute",
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "omit",
        redirect: "error",
      },
    ],
  );
  assert.ok(requests.every(({ init }) => init.headers.Authorization === undefined));
});

test("unknown, write-shaped, oversized, and malformed requests fail closed before fetch", async () => {
  let calls = 0;
  const handler = createStudioGatewayHandler({
    ...bases,
    fetcher: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  const cases = [
    ["facts/delete", {}],
    ["tasks/list", { limit: 0 }],
    ["facts/read", { unknown: "value" }],
    ["traces/read", { trace_id: "bad" }],
    ["traces/read", { trace_id: "a".repeat(32), delivery_id: "d" }],
    ["evaluations/compute", { api_version: 1, mode: "SINGLE", selection: { selection_version: 1, task_ids: [] } }],
  ];
  for (const [endpoint, payload] of cases) {
    const result = await handler(endpoint, payload, new AbortController().signal);
    assert.equal(result.ok, false, endpoint);
    assert.equal(result.error.code, "invalid-request", endpoint);
  }
  assert.equal(calls, 0);
});

test("bounded response, timeout, partial HTTP errors, and outage stay in a Studio RPC result", async () => {
  for (const fetcher of [
    async () => new Response("not json", { headers: { "content-type": "text/plain" } }),
    async () => new Response("x".repeat(65), { headers: { "content-type": "application/json" } }),
    async () => { throw new Error("downstream offline"); },
  ]) {
    const handler = createStudioGatewayHandler({
      ...bases,
      fetcher,
      maximumResponseBytes: 64,
      timeoutMs: 25,
    });
    const result = await handler("tasks/list", { limit: 1 }, new AbortController().signal);
    assert.equal(result.ok, false);
    assert.match(result.error.code, /^downstream-/);
    assert.doesNotMatch(result.error.message, /offline|not json|x{10}/);
  }
});

test("a downstream HTTP failure cannot masquerade as a successful Task page", async () => {
  const handler = createStudioGatewayHandler({
    ...bases,
    fetcher: async () => jsonResponse({ error: { code: "QUERY_UNAVAILABLE", message: "private detail" } }, { status: 503 }),
  });
  const result = await handler("tasks/list", { limit: 1 }, new AbortController().signal);
  assert.deepEqual(result, {
    ok: false,
    error: { code: "downstream-http-error", message: "Studio downstream rejected the request" },
  });
});

test("the Host deadline aborts a stalled downstream without leaking its failure", async () => {
  const handler = createStudioGatewayHandler({
    ...bases,
    timeoutMs: 5,
    fetcher: async (_input, init) => await new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  const result = await handler("tasks/list", { limit: 1 }, new AbortController().signal);
  assert.deepEqual(result, {
    ok: false,
    error: { code: "downstream-timeout", message: "Studio downstream timed out" },
  });
});

test("registration uses exact DSH authenticated Fetch routes and disposes them", async () => {
 const routes=[];let disposed=0;
 const ctx={connection:{fetch:{register(route){routes.push(route);return async()=>{disposed++;};}}},effect(){}};
 const stop=registerStudioGateway(ctx,{...bases,fetcher:async()=>jsonResponse({})});
 assert.equal(routes.length,5);assert.ok(routes.every(route=>route.path.startsWith("/api/crystra-studio/")&&route.methods[0]==="POST"));
 await stop();assert.equal(disposed,5);
});

test("registration maps Studio domain failures onto the DSH transport error contract", async () => {
  const routes=new Map();
  const ctx={connection:{fetch:{register(route){routes.set(route.path,route);return ()=>{};}}},effect(){}};
  registerStudioGateway(ctx, {
    ...bases,
    fetcher: async () => { throw new Error("offline"); },
  });

  const response = await routes.get("/api/crystra-studio/tasks/list").fetch(new Request("http://localhost/api/crystra-studio/tasks/list",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"client-request",rpcId:"test",method:"crystra-studio/tasks/list",payload:{limit:1}})}));
  const {result} = await response.json();
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "internal",
      message: "Studio gateway (downstream-unavailable): Studio downstream is unavailable",
      details: {},
    },
  });
});
