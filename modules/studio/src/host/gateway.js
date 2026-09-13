const DEFAULT_TIMEOUT_MS = 125_000;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 8 * 1024 * 1024;
const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/u;
const TRACE_ID = /^[a-f0-9]{32}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;

function invalid(message = "Studio request does not match the allowlist") {
  return { ok: false, error: { code: "invalid-request", message } };
}

function downstream(code, message) {
  return { ok: false, error: { code, message } };
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, required, optional = []) {
  if (!record(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function boundedText(value, maximum = 8192) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !CONTROL.test(value);
}

function loopbackBase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("STUDIO_GATEWAY_LOOPBACK_REQUIRED");
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.port === "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) throw new Error("STUDIO_GATEWAY_LOOPBACK_REQUIRED");
  return url.origin;
}

function validLimit(value) {
  return Number.isInteger(value) && value >= 1 && value <= 200;
}

function validCommon(payload, allowed) {
  if (!record(payload) || Object.keys(payload).some((key) => !allowed.has(key))) return false;
  if (payload.limit !== undefined && !validLimit(payload.limit)) return false;
  if (payload.cursor !== undefined && !boundedText(payload.cursor, 4096)) return false;
  return true;
}

const FACT_KEYS = [
  "kind", "event_name", "family_schema", "delivery_id", "trace_id",
  "recorded_from", "recorded_to", "limit", "cursor",
];
const TRACE_KEYS = ["trace_id", "delivery_id", "limit", "cursor"];
const FACT_KINDS = new Set([
  "EVENT_CONTRIBUTION", "FINDING_ASSERTION", "FINDING_TARGET", "FINDING_STATUS",
  "FINDING_FIX", "FINDING_RECHECK", "ROLE_LINEAGE", "DELIVERY_ROOT_BINDING",
  "MODEL_ATTRIBUTION",
]);
const EVENT_NAMES = new Set([
  "delivery.summary", "review.finding", "review.summary", "test.summary",
  "intervention", "role.lineage", "usage", "sampling.decision",
  "implementation.summary", "system_design.summary",
]);

function query(entries) {
  const params = new URLSearchParams();
  for (const key of entries) if (key[1] !== undefined) params.set(key[0], String(key[1]));
  const encoded = params.toString();
  return encoded === "" ? "" : `?${encoded}`;
}

function taskRequest(payload) {
  if (!validCommon(payload, new Set(["limit", "cursor"]))) return undefined;
  const limit = payload.limit ?? 100;
  return { path: `/v1/evidence/tasks${query([["limit", limit], ["cursor", payload.cursor]])}`, method: "GET" };
}

function factsRequest(payload) {
  if (!validCommon(payload, new Set(FACT_KEYS))) return undefined;
  if (payload.kind !== undefined && !FACT_KINDS.has(payload.kind)) return undefined;
  if (payload.event_name !== undefined && !EVENT_NAMES.has(payload.event_name)) return undefined;
  if (payload.event_name !== undefined && payload.kind !== undefined && payload.kind !== "EVENT_CONTRIBUTION") return undefined;
  for (const key of FACT_KEYS.filter((key) => !["limit"].includes(key))) {
    if (payload[key] !== undefined && !boundedText(payload[key], key === "delivery_id" ? 256 : 8192)) return undefined;
  }
  if (payload.trace_id !== undefined && !TRACE_ID.test(payload.trace_id)) return undefined;
  return { path: `/v1/evidence/facts${query(FACT_KEYS.map((key) => [key, payload[key]]))}`, method: "GET" };
}

function tracesRequest(payload) {
  if (!validCommon(payload, new Set(TRACE_KEYS))) return undefined;
  if ((payload.trace_id === undefined) === (payload.delivery_id === undefined)) return undefined;
  if (payload.trace_id !== undefined && !TRACE_ID.test(payload.trace_id)) return undefined;
  if (payload.delivery_id !== undefined && !boundedText(payload.delivery_id, 256)) return undefined;
  return { path: `/v1/evidence/traces${query(TRACE_KEYS.map((key) => [key, payload[key]]))}`, method: "GET" };
}

function selection(value) {
  return exactKeys(value, ["selection_version", "task_ids"]) &&
    value.selection_version === 1 &&
    Array.isArray(value.task_ids) &&
    value.task_ids.length >= 1 && value.task_ids.length <= 24 &&
    value.task_ids.every((id) => typeof id === "string" && TASK_ID.test(id)) &&
    new Set(value.task_ids).size === value.task_ids.length;
}

function computeRequest(payload) {
  if (!record(payload) || payload.api_version !== 1) return undefined;
  const valid = payload.mode === "SINGLE"
    ? exactKeys(payload, ["api_version", "mode", "selection"]) && selection(payload.selection)
    : payload.mode === "COMPARE"
      ? exactKeys(payload, ["api_version", "mode", "left", "right"]) && selection(payload.left) && selection(payload.right)
      : false;
  return valid ? {
    path: "/api/evolution/v1/evaluations:compute",
    method: "POST",
    body: JSON.stringify(payload),
  } : undefined;
}

function requestFor(endpoint, payload) {
  if (endpoint === "tasks/list") return { owner: "evidence", request: taskRequest(payload) };
  if (endpoint === "facts/read") return { owner: "evidence", request: factsRequest(payload) };
  if (endpoint === "traces/read") return { owner: "evidence", request: tracesRequest(payload) };
  if (endpoint === "evaluations/compute") return { owner: "evolution", request: computeRequest(payload) };
  return undefined;
}

async function boundedJson(response, maximumBytes) {
  const type = response.headers.get("content-type");
  if (type === null || !/^application\/json(?:\s*;|$)/iu.test(type)) {
    return downstream("downstream-incompatible", "Studio downstream did not return JSON");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/u.test(declared) && BigInt(declared) > BigInt(maximumBytes)) {
    return downstream("downstream-response-too-large", "Studio downstream response exceeded its byte bound");
  }
  const reader = response.body?.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (reader !== undefined) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        return downstream("downstream-response-too-large", "Studio downstream response exceeded its byte bound");
      }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
    } catch {
      return downstream("downstream-malformed", "Studio downstream returned malformed JSON");
    }
  } finally {
    reader?.releaseLock();
  }
}

export function createStudioGatewayHandler(options) {
  const integration = options.integration;
  if (integration !== undefined && (typeof integration?.status !== "function" || integration.config === undefined)) {
    throw new Error("STUDIO_GATEWAY_INTEGRATION_INVALID");
  }
  const evidenceBase = loopbackBase(integration?.config.services.evidence.baseUrl ?? options.evidenceBaseUrl);
  const evolutionBase = loopbackBase(integration?.config.services.evolution.baseUrl ?? options.evolutionBaseUrl);
  const fetcher = options.fetcher ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maximumBytes = options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 125_000) throw new Error("STUDIO_GATEWAY_INVALID_TIMEOUT");
  if (!Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > DEFAULT_MAXIMUM_RESPONSE_BYTES) throw new Error("STUDIO_GATEWAY_INVALID_RESPONSE_BOUND");

  return async function handle(endpoint, payload, signal) {
    if (endpoint === "services/status") {
      if (!record(payload) || Object.keys(payload).length !== 0 || integration === undefined) return invalid();
      return { ok: true, value: await integration.status() };
    }
    const selected = requestFor(endpoint, payload);
    if (selected?.request === undefined) return invalid();
    const timer = AbortSignal.timeout(timeoutMs);
    const combined = signal === undefined ? timer : AbortSignal.any([signal, timer]);
    const headers = selected.request.method === "POST"
      ? { Accept: "application/json", "Content-Type": "application/json" }
      : { Accept: "application/json" };
    try {
      const response = await fetcher(
        `${selected.owner === "evidence" ? evidenceBase : evolutionBase}${selected.request.path}`,
        {
          method: selected.request.method,
          headers,
          ...(selected.request.body === undefined ? {} : { body: selected.request.body }),
          credentials: "omit",
          redirect: "error",
          signal: combined,
        },
      );
      const decoded = await boundedJson(response, maximumBytes);
      if (!decoded.ok) return decoded;
      if (!response.ok) return downstream("downstream-http-error", "Studio downstream rejected the request");
      return decoded;
    } catch (error) {
      const timedOut = timer.aborted && !signal?.aborted;
      return downstream(
        timedOut ? "downstream-timeout" : "downstream-unavailable",
        timedOut ? "Studio downstream timed out" : "Studio downstream is unavailable",
      );
    }
  };
}

export function registerStudioGateway(ctx, options) {
  const handle = createStudioGatewayHandler(options);
  return ctx.connection.rpc.handle(
    "/crystra-studio",
    async (...args) => {
      const result = await handle(...args);
      if (result.ok) return result;
      return {
        ok: false,
        error: {
          code: "internal",
          message: `Studio gateway (${result.error.code}): ${result.error.message}`,
          details: {},
        },
      };
    },
    { authority: "loopback" },
  );
}
