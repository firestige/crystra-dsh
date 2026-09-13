import React from "react";
import { createRoot } from "react-dom/client";
import * as Primitives from "@deepseek-ai/dsh-client-ui-primitives";
import * as Bi from "crystra-ui-core";
import "crystra-ui-core/styles.css";

import { createStudioClientPlugin } from "../src/client/studio.js";

const roots = new Map();
const mount = (name, Component) => {
  const target = document.querySelector(name === "shell.overlay" ? "#studio" : "#entry");
  roots.get(name)?.unmount();
  const root = createRoot(target);
  roots.set(name, root);
  root.render(React.createElement(Component));
  return () => { root.unmount(); roots.delete(name); };
};

const taskPage = Object.freeze({
  contract: { name: "evidence.query", revision: "1.0.0" }, observation_profile: "2.0.0",
  read_model_revision: "2.0.0", snapshot: "dev", items: [{ task_id: "task-example", display_name: "Example Task" }], next_cursor: null,
});
const result = Object.freeze({ api_version: 1, mode: "SINGLE", result: {
  tag: "SIDE_RESULT", receipt: {
    population_state: "COMPLETE",
    evidence_bindings: [],
    task_population: [{ task_id: "task-example", memberships: [{ delivery_id: "delivery-example" }] }],
    input_refs: [],
  },
  metric_results: [{
    metric_id: "delivery-cycle-time-ms",
    metric_version: "2.0.0",
    slices: [{
      slice_key: {}, state: "AVAILABLE",
      value: { kind: "DURATION_MS", value: "12", unit: "ms" },
      measures: {}, coverage: null, compatibility: {}, exclusions: [], missing_inputs: [],
      provenance_refs: ["digest-fact-1"],
    }],
  }],
} });
const traceId = "a".repeat(32);
const spanId = "b".repeat(16);
const truth = Object.freeze({ completeness: "FINAL", availability: "AVAILABLE", expiry: "ACTIVE", expires_at: null });
const fact = Object.freeze({
  id: "fact-1", kind: "EVENT_CONTRIBUTION", recorded_at: "2026-09-01T00:00:00Z",
  provenance: { accepted_digest: "digest-fact-1", profile_version: "1.0.0", family_schema: null, owner_key: [] },
  compatibility: { family_schema: null, event_name: "studio-browser", completeness: "FINAL", dimensions: [] },
  truth,
  source: { kind: "SPAN", trace_id: traceId, span_id: spanId }, fields: [], relationships: [],
});
const trace = Object.freeze([{
  id: "trace-node-1", kind: "NODE", trace_id: traceId, recorded_at: "2026-09-01T00:00:00Z",
  source: { kind: "SPAN", trace_id: traceId, span_id: spanId }, truth,
  node: {
    span_id: spanId, span_name: "Studio browser delivery", span_kind: "INTERNAL",
    start_time_unix_nano: "1000000000", end_time_unix_nano: "2000000000",
    span_status: "OK", span_flags: 1, trace_state: null, fields: [],
  },
  edge: null,
}]);

const ctx = {
  connection: { rpc: { async call(_channel, endpoint) {
    if (endpoint === "tasks/list") return { ok: true, value: taskPage };
    if (endpoint === "evaluations/compute") return { ok: true, value: result };
    if (endpoint === "facts/read") return { ok: true, value: { items: [fact] } };
    if (endpoint === "traces/read") return { ok: true, value: { items: trace } };
    return { ok: true, value: { items: [] } };
  } } },
  slots: {
    inject(_name, factory) { factory(); },
    register({ name }, Component) { return mount(name, Component); },
  },
};

createStudioClientPlugin({ React, Primitives, Bi: { ...Bi, CATALOG_COORDINATES: undefined } }).apply(ctx);
