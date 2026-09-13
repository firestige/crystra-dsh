const STORAGE_KEY = "crystra.studio.location@1";
const EVIDENCE_TARGET_STORAGE_KEY = "crystra.studio.exact-evidence@1";
const TRACE_TARGET_STORAGE_KEY = "crystra.studio.exact-trace@1";
const MAX_URL_BYTES = 8 * 1024;
const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/u;
const TRACE_ID = /^[a-f0-9]{32}$/u;
const SPAN_ID = /^[a-f0-9]{16}$/u;
const encoder = new TextEncoder();

function validIds(ids) {
  return Array.isArray(ids) && ids.length >= 1 && ids.length <= 24 &&
    ids.every((id) => typeof id === "string" && TASK_ID.test(id)) &&
    new Set(ids).size === ids.length;
}

function canonicalIds(ids) {
  if (!validIds(ids)) throw new Error("INVALID_SELECTION");
  return [...ids].sort((left, right) => {
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const length = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < length; index += 1) {
      const difference = leftBytes[index] - rightBytes[index];
      if (difference !== 0) return difference;
    }
    return leftBytes.length - rightBytes.length;
  });
}

function selectionParams(selection) {
  if (selection.mode === "single") return [["task", canonicalIds(selection.taskIds)]];
  if (selection.mode === "compare") return [
    ["mode", ["compare"]],
    ["left_task", canonicalIds(selection.leftTaskIds)],
    ["right_task", canonicalIds(selection.rightTaskIds)],
  ];
  throw new Error("INVALID_SELECTION");
}

function appendSelection(params, selection) {
  params.set("v", "1");
  for (const [key, values] of selectionParams(selection)) for (const value of values) params.append(key, value);
}

function bounded(value) {
  if (encoder.encode(value).byteLength > MAX_URL_BYTES) throw new Error("STUDIO_URL_BOUND_EXCEEDED");
  return value;
}

export function serializeStudioLocation(route) {
  if (route.page === "select") return "/evaluate";
  const params = new URLSearchParams();
  appendSelection(params, route.selection);
  if (route.page === "results") return bounded(`/evaluate?${params}`);
  if (route.page === "receipt") return bounded(`/evaluate/receipt?${params}`);
  if (route.page === "facts") {
    params.set("metric", route.metric);
    params.set("scope", route.scope);
    if (route.side !== undefined) params.set("side", route.side);
    return bounded(`/evaluate/facts?${params}`);
  }
  if (route.page === "trace" && TRACE_ID.test(route.traceId) && (route.spanId === undefined || SPAN_ID.test(route.spanId))) {
    if (route.spanId !== undefined) params.set("span", route.spanId);
    return bounded(`/evaluate/trace/${route.traceId}?${params}`);
  }
  throw new Error("UNKNOWN_STUDIO_ROUTE");
}

function parseSelection(params) {
  if (params.get("v") !== "1" || params.getAll("v").length !== 1) return undefined;
  if (params.get("mode") === "compare") {
    const leftTaskIds = params.getAll("left_task");
    const rightTaskIds = params.getAll("right_task");
    return validIds(leftTaskIds) && validIds(rightTaskIds)
      ? { mode: "compare", leftTaskIds: canonicalIds(leftTaskIds), rightTaskIds: canonicalIds(rightTaskIds) }
      : undefined;
  }
  if (params.has("mode")) return undefined;
  const taskIds = params.getAll("task");
  return validIds(taskIds) ? { mode: "single", taskIds: canonicalIds(taskIds) } : undefined;
}

function only(params, keys) {
  const allowed = new Set(keys);
  return [...params.keys()].every((key) => allowed.has(key));
}

export function parseStudioLocation(relativeUrl) {
  if (typeof relativeUrl !== "string" || encoder.encode(relativeUrl).byteLength > MAX_URL_BYTES) {
    return { page: "invalid", reason: "STUDIO_URL_BOUND_EXCEEDED" };
  }
  let url;
  try { url = new URL(relativeUrl, "http://studio.local"); } catch { return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" }; }
  if (url.origin !== "http://studio.local" || url.hash !== "") return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
  if (url.pathname === "/evaluate" && url.search === "") return { page: "select" };
  if (
    url.pathname !== "/evaluate" &&
    url.pathname !== "/evaluate/receipt" &&
    url.pathname !== "/evaluate/facts" &&
    !url.pathname.startsWith("/evaluate/trace/")
  ) return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
  const selection = parseSelection(url.searchParams);
  if (selection === undefined) return { page: "invalid", reason: "INVALID_SELECTION" };
  const baseKeys = selection.mode === "single" ? ["v", "task"] : ["v", "mode", "left_task", "right_task"];
  if (url.pathname === "/evaluate" && only(url.searchParams, baseKeys)) return { page: "results", selection };
  if (url.pathname === "/evaluate/receipt" && only(url.searchParams, baseKeys)) return { page: "receipt", selection };
  if (url.pathname === "/evaluate/facts" && only(url.searchParams, [...baseKeys, "metric", "scope", "side"])) {
    const metric = url.searchParams.get("metric");
    const scope = url.searchParams.get("scope");
    const side = url.searchParams.get("side") ?? undefined;
    if (metric !== null && metric.length <= 256 && ["result", "related", "read-set"].includes(scope) &&
        (side === undefined || (selection.mode === "compare" && ["left", "right"].includes(side)) || (selection.mode === "single" && side === "single"))) {
      return { page: "facts", selection, metric, scope, ...(side === undefined ? {} : { side }) };
    }
  }
  if (url.pathname.startsWith("/evaluate/trace/") && only(url.searchParams, [...baseKeys, "span"])) {
    const traceId = url.pathname.slice("/evaluate/trace/".length);
    const spanId = url.searchParams.get("span") ?? undefined;
    if (TRACE_ID.test(traceId) && (spanId === undefined || SPAN_ID.test(spanId))) return { page: "trace", selection, traceId, ...(spanId === undefined ? {} : { spanId }) };
  }
  return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
}

function sideResults(result) {
  if (result?.mode === "SINGLE" && result.result?.tag === "SIDE_RESULT") {
    return [{ side: "single", value: result.result }];
  }
  if (result?.mode !== "COMPARE") return [];
  return [
    ...(result.left?.tag === "SIDE_RESULT" ? [{ side: "left", value: result.left }] : []),
    ...(result.right?.tag === "SIDE_RESULT" ? [{ side: "right", value: result.right }] : []),
  ];
}

export function projectStudioPresentation(snapshot) {
  const sides = sideResults(snapshot.result);
  const metrics = new Map();
  for (const { side, value } of sides) {
    for (const metric of value.metric_results ?? []) {
      const coordinate = `${metric.metric_id}@${metric.metric_version}`;
      const current = metrics.get(coordinate) ?? { coordinate, sides: [] };
      current.sides.push({ side, slices: metric.slices ?? [] });
      metrics.set(coordinate, current);
    }
  }
  return Object.freeze({
    mode: snapshot.result?.mode === "COMPARE" ? "compare" : snapshot.result?.mode === "SINGLE" ? "single" : "empty",
    phase: snapshot.phase,
    page: snapshot.route?.page ?? "select",
    metrics: Object.freeze([...metrics.values()]),
    deltas: Object.freeze(snapshot.result?.mode === "COMPARE" ? [...(snapshot.result.deltas ?? [])] : []),
    receipts: Object.freeze(sides.map(({ side, value }) => ({ side, receipt: value.receipt }))),
    facts: Object.freeze([...(snapshot.drilldown?.facts ?? [])]),
    trace: Object.freeze([...(snapshot.drilldown?.trace ?? [])]),
    drilldownError: snapshot.drilldown?.error,
  });
}

function bodyFor(selection) {
  if (selection.mode === "single") return {
    api_version: 1,
    mode: "SINGLE",
    selection: { selection_version: 1, task_ids: canonicalIds(selection.taskIds) },
  };
  return {
    api_version: 1,
    mode: "COMPARE",
    left: { selection_version: 1, task_ids: canonicalIds(selection.leftTaskIds) },
    right: { selection_version: 1, task_ids: canonicalIds(selection.rightTaskIds) },
  };
}

const incompatibleResponse = Object.freeze({
  code: "incompatible-response",
  message: "Studio received an incompatible formal API response",
});

function validTaskPage(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    value.contract?.name === "evidence.query" && value.contract?.revision === "1.0.0" &&
    value.observation_profile === "2.0.0" && value.read_model_revision === "2.0.0" &&
    typeof value.snapshot === "string" && value.snapshot !== "" &&
    Array.isArray(value.items) && value.items.length <= 200 && value.items.every((item) =>
      item !== null && typeof item === "object" && TASK_ID.test(item.task_id)) &&
    (value.next_cursor === null || typeof value.next_cursor === "string");
}

function side(value, catalogCoordinates) {
  return value?.tag === "SIDE_RESULT"
    ? Array.isArray(value.metric_results) && value.receipt !== null && typeof value.receipt === "object" &&
      (catalogCoordinates === undefined || (value.metric_results.length === catalogCoordinates.length &&
        value.metric_results.every((metric, index) => `${metric.metric_id}@${metric.metric_version}` === catalogCoordinates[index])))
    : value?.tag === "SIDE_ERROR" && typeof value.code === "string";
}

function validComputeResponse(value, catalogCoordinates) {
  if (value?.api_version !== 1) return false;
  if (value.mode === "SINGLE") return side(value.result, catalogCoordinates) && value.result.tag === "SIDE_RESULT";
  return value.mode === "COMPARE" &&
    ["FULL_COMPARE", "PARTIAL_COMPARE"].includes(value.status) &&
    side(value.left, catalogCoordinates) && side(value.right, catalogCoordinates) && Array.isArray(value.deltas);
}

function initialRoute(storage, context) {
  const saved = storage?.getItem(STORAGE_KEY);
  if (saved !== null && saved !== undefined) {
    const parsed = parseStudioLocation(saved);
    if (parsed.page !== "invalid") return parsed;
  }
  return context?.taskId !== undefined && TASK_ID.test(context.taskId)
    ? { page: "results", selection: { mode: "single", taskIds: [context.taskId] } }
    : { page: "select" };
}

function storedExactTarget(storage, key, page, selection) {
  const saved = storage?.getItem(key);
  if (saved === null || saved === undefined || selection === undefined) return undefined;
  const parsed = parseStudioLocation(saved);
  return parsed.page === page && JSON.stringify(parsed.selection) === JSON.stringify(selection)
    ? { ...parsed, status: "available" }
    : undefined;
}

function clearStoredExactTargets(storage) {
  storage?.setItem(EVIDENCE_TARGET_STORAGE_KEY, "");
  storage?.setItem(TRACE_TARGET_STORAGE_KEY, "");
}

export function createEvaluateController({ gateway, storage, initialContext, catalogCoordinates } = {}) {
  if (gateway === undefined || typeof gateway.call !== "function") throw new Error("STUDIO_GATEWAY_REQUIRED");
  const route = initialRoute(storage, initialContext);
  const storedEvidence = storedExactTarget(storage, EVIDENCE_TARGET_STORAGE_KEY, "facts", route.selection);
  const storedTrace = storedExactTarget(storage, TRACE_TARGET_STORAGE_KEY, "trace", route.selection);
  const initialExactTargets = {
    ...(storedEvidence === undefined && route.page !== "facts" ? {} : { evidence: storedEvidence ?? { ...route, status: "available" } }),
    ...(storedTrace === undefined && route.page !== "trace" ? {} : { trace: storedTrace ?? { ...route, status: "available" } }),
  };
  let snapshot = {
    phase: "idle",
    route,
    selection: route.selection,
    recentSelection: route.selection,
    taskList: { phase: "idle", items: [] },
    drilldown: { phase: "idle", facts: [], trace: [] },
    exactTargets: initialExactTargets,
    result: undefined,
    error: undefined,
    refreshing: false,
  };
  const listeners = new Set();
  const publish = (change) => {
    snapshot = { ...snapshot, ...change };
    for (const listener of listeners) listener();
  };
  const persist = (nextRoute) => {
    snapshot = { ...snapshot, route: nextRoute };
    storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
    for (const listener of listeners) listener();
  };
  const controller = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setSelection(selection) {
      bodyFor(selection);
      publish({ selection, recentSelection: selection, route: { page: "results", selection }, phase: "idle", error: undefined, exactTargets: {} });
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation({ page: "results", selection }));
    },
    clearSelection() {
      const nextRoute = { page: "select" };
      snapshot = {
        ...snapshot,
        phase: "idle",
        route: nextRoute,
        selection: undefined,
        result: undefined,
        error: undefined,
        refreshing: false,
        drilldown: { phase: "idle", facts: [], trace: [] },
        exactTargets: {},
      };
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
      for (const listener of listeners) listener();
    },
    async loadTasks(cursor) {
      publish({ taskList: { ...snapshot.taskList, phase: "loading", error: undefined } });
      const answer = await gateway.call("tasks/list", { limit: 100, ...(cursor === undefined ? {} : { cursor }) });
      if (!answer.ok) {
        publish({ taskList: { ...snapshot.taskList, phase: "error", error: answer.error } });
        return;
      }
      if (!validTaskPage(answer.value)) {
        publish({ taskList: { ...snapshot.taskList, phase: "error", error: incompatibleResponse } });
        return;
      }
      const prior = cursor === undefined ? [] : snapshot.taskList.items;
      const byId = new Map([...prior, ...answer.value.items].map((item) => [item.task_id, item]));
      const items = [...byId.values()].sort((left, right) => canonicalIds([left.task_id, right.task_id])[0] === left.task_id ? -1 : 1);
      publish({ taskList: { phase: "ready", items, page: answer.value } });
    },
    async evaluate() {
      if (snapshot.selection === undefined) throw new Error("INVALID_SELECTION");
      const retaining = snapshot.result !== undefined;
      publish({ phase: retaining ? snapshot.phase : "loading", refreshing: retaining, error: undefined });
      const answer = await gateway.call("evaluations/compute", bodyFor(snapshot.selection));
      if (!answer.ok) {
        publish({ phase: retaining ? "degraded" : "error", refreshing: false, error: answer.error });
        return;
      }
      if (!validComputeResponse(answer.value, catalogCoordinates)) {
        publish({ phase: retaining ? "degraded" : "error", refreshing: false, error: incompatibleResponse });
        return;
      }
      const phase = answer.value?.mode === "COMPARE" && answer.value.status === "PARTIAL_COMPARE" ? "partial" : "ready";
      const nextRoute = { page: "results", selection: snapshot.selection };
      snapshot = {
        ...snapshot,
        phase,
        refreshing: false,
        error: undefined,
        result: answer.value,
        route: nextRoute,
        drilldown: { phase: "idle", facts: [], trace: [] },
        exactTargets: {},
      };
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
      for (const listener of listeners) listener();
    },
    async refresh() { await controller.evaluate(); },
    async loadFacts(filters) {
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: undefined } });
      const answer = await gateway.call("facts/read", filters);
      if (!answer.ok) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
          exactTargets: snapshot.route.page === "facts"
            ? { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } }
            : snapshot.exactTargets,
        });
        return;
      }
      const facts = answer.value.items ?? [];
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", facts, error: undefined },
        exactTargets: snapshot.route.page === "facts"
          ? { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: facts.length === 0 ? "unavailable" : "available" } }
          : snapshot.exactTargets,
      });
    },
    async loadMetricFacts(metricCoordinate, scope = "result", side) {
      if (!["result", "related", "read-set"].includes(scope) || snapshot.result === undefined) return;
      const sides = sideResults(snapshot.result).filter((candidate) => side === undefined || candidate.side === side);
      const metric = sides.flatMap(({ value }) => value.metric_results ?? [])
        .find((candidate) => `${candidate.metric_id}@${candidate.metric_version}` === metricCoordinate);
      if (metric === undefined) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: incompatibleResponse },
          exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } },
        });
        return;
      }
      const deliveryIds = [...new Set(sides.flatMap(({ value }) => value.receipt?.task_population ?? [])
        .flatMap((task) => task.memberships ?? []).map((membership) => membership.delivery_id)
        .filter((id) => boundedText(id, 256)))].sort();
      const resultRefs = new Set((metric.slices ?? []).flatMap((slice) => slice.provenance_refs ?? []));
      const readSetRefs = new Set(sides.flatMap(({ value }) => value.receipt?.input_refs ?? [])
        .filter((reference) => reference.kind === "FACT")
        .flatMap((reference) => [reference.identity, reference.provenance_ref]));
      const wanted = scope === "read-set" ? readSetRefs : resultRefs;
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: undefined } });
      const facts = [];
      for (const delivery_id of deliveryIds) {
        const answer = await gateway.call("facts/read", { delivery_id, limit: 200 });
        if (!answer.ok) {
          publish({
            drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
            exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } },
          });
          return;
        }
        if (!Array.isArray(answer.value?.items)) {
          publish({
            drilldown: { ...snapshot.drilldown, phase: "error", error: incompatibleResponse },
            exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } },
          });
          return;
        }
        facts.push(...answer.value.items);
      }
      const matches = (fact) => [fact?.id, fact?.provenance?.accepted_digest].some((identity) => wanted.has(identity));
      const selected = scope === "related" ? facts.filter((fact) => !matches(fact)) : facts.filter(matches);
      const returned = new Set(facts.flatMap((fact) => [fact?.id, fact?.provenance?.accepted_digest]));
      const references = [...wanted].sort().map((identity) => ({ identity, loadedAsFact: returned.has(identity) }));
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", facts: selected, references, error: undefined },
        exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: selected.length === 0 ? "unavailable" : "available" } },
      });
    },
    async loadTrace(filters) {
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: undefined } });
      const answer = await gateway.call("traces/read", filters);
      if (!answer.ok) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
          exactTargets: { ...snapshot.exactTargets, trace: { ...snapshot.exactTargets.trace, status: "unavailable" } },
        });
        return;
      }
      const trace = answer.value.items ?? [];
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", trace, error: undefined },
        exactTargets: { ...snapshot.exactTargets, trace: { ...snapshot.exactTargets.trace, status: trace.length === 0 ? "unavailable" : "available" } },
      });
    },
    openReceipt() {
      if (snapshot.selection === undefined || snapshot.result === undefined) return;
      persist({ page: "receipt", selection: snapshot.selection });
    },
    openFacts(metric, scope = "result", side) {
      if (snapshot.selection === undefined) return;
      const nextRoute = { page: "facts", selection: snapshot.selection, metric, scope, ...(side === undefined ? {} : { side }) };
      snapshot = { ...snapshot, exactTargets: { ...snapshot.exactTargets, evidence: { ...nextRoute, status: "available" } } };
      storage?.setItem(EVIDENCE_TARGET_STORAGE_KEY, serializeStudioLocation(nextRoute));
      persist(nextRoute);
    },
    openTrace(traceId, spanId) {
      if (snapshot.selection === undefined) return;
      const nextRoute = { page: "trace", selection: snapshot.selection, traceId, ...(spanId === undefined ? {} : { spanId }) };
      snapshot = { ...snapshot, exactTargets: { ...snapshot.exactTargets, trace: { ...nextRoute, status: "available" } } };
      storage?.setItem(TRACE_TARGET_STORAGE_KEY, serializeStudioLocation(nextRoute));
      persist(nextRoute);
    },
    restoreExactEvidence() {
      if (snapshot.exactTargets.evidence?.status === "unavailable") return;
      if (snapshot.exactTargets.evidence !== undefined) {
        const { status: _status, ...route } = snapshot.exactTargets.evidence;
        persist(route);
      }
    },
    restoreExactTrace() {
      if (snapshot.exactTargets.trace?.status === "unavailable") return;
      if (snapshot.exactTargets.trace !== undefined) {
        const { status: _status, ...route } = snapshot.exactTargets.trace;
        persist(route);
      }
    },
    backToResults() {
      if (snapshot.selection === undefined) persist({ page: "select" });
      else persist({ page: "results", selection: snapshot.selection });
    },
  };
  return controller;
}

function boundedText(value, maximum) {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}
