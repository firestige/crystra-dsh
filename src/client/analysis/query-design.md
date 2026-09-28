> 2026-09-28 实施更新：时间范围 Evaluation、Delivery 元数据目录、独立 Trace 查询与 localStorage 配置已接入。当前页面与验证边界见 [README](README.md)，跨层决策见 [Analysis 设计修订](../../../../workflow-self-recursive/docs/systems/bi/analysis-data-integration.md)。下文保留设计推演，涉及“尚未接入”的表述是历史状态，不作为当前待办。

# Analysis query hooks — candidate infrastructure

This design implements the agreed cost/complexity split. It does not publish or change
an Evidence, Observation, Evaluation or Contracts envelope. The first explicit single-Task Evaluation adapter is now connected; Trace/report
adapters remain pending. No invented endpoint, metric or fixture is connected.

The three-layer design and panel/API gap matrix are in [data-design.md](./data-design.md).

## Ownership and flow — corrected 2026-09-28

Package boundaries follow DSH dependencies, not the presentation/business/query layers.
See [the shared ownership decision](../../../../wsr-ui/docs/analysis-data-boundaries.md).

- Target Crystra-ui support/data: generic query resources, cache/paging/actions,
  React hooks and memoized projections.
- Target Crystra-ui Analysis: business hooks, joins, grouping, aggregation and per-chart
  typed data projection. Panel/Chart components remain free of those business operations.
- Target Crystra-ui Contract adapters: Evidence/Evaluation decoding, validation,
  revision binding and pagination semantics, without DSH imports.
- Crystra-dsh: page/slot/routing composition, DSH RPC and authentication adapters,
  service address configuration, loading policy and host resource lifetime.
- Inject transport and configuration into reusable code. A generic HTTP transport
  may also be reusable; DSH RPC is a host implementation, not a dependency of the core.

Implementation update (2026-09-28): query resources/hooks and their tests have moved
into Crystra-ui `support/data`, consumed through public exports. DSH's old copies were
removed. `ResolvedPage`/query state now carry generic `Meta`; adapters can validate or
merge metadata atomically on append. Structured `QueryError` retains service codes.
The Analysis client currently caches only one active evaluation scope, not query history.

## Generic seam (internal, not a wire protocol)

```ts
interface TypeResolver<Wire, Row, Continuation, Meta = undefined> {
  resolve(wire: Wire): { rows: readonly Row[]; next: Continuation | null; meta?: Meta };
}
interface PageRequest<Continuation> {
  signal: AbortSignal;
  continuation: Continuation | undefined;
}
```

`Wire` may be `unknown` so the resolver validates before returning typed rows.
A typed transport may supply a specific response type instead. No cast replaces
runtime validation. `Continuation` is opaque to the resource: cursor, offset, or a
cursor plus route snapshot/lease are all possible. `undefined` is reserved for the
first request; `null` marks the end of traversal. Row identity/deduplication and
cross-page consistency follow the source contract, not guessed IDs in this utility.
Contract revision changes are isolated in the adapter while this seam remains valid;
a changed transport or pagination semantic may also require changing `read`.

## Hook and actions

`usePagedQuery(resource, enabled)` returns `phase`, `operation`, `rows`, `hasMore`,
`error`, generic `meta` and `actions`. `useQueryProjection(rows, project)` memoizes a pure selector.
Keep the projector reference stable when its inputs are unchanged.

- `load()`: share an in-flight request or reuse successfully loaded rows. Retry an
  unsuccessful first load on explicit invocation. No implicit timer/retry loop.
- `loadMore()`: request one next page and append; concurrent calls share the request.
  No automatic full traversal. Cached rows remain available when this page fails;
  repeating the action retries the same continuation.
- `refresh()`: abort the previous generation, request from the beginning, replace
  on success, discard any late response. Keep old display rows while loading/on
  failure, with the phase/error visible. Invalidate old continuation immediately;
  never append a new traversal to stale cached rows. `load()` retries failed refresh.
- `dispose()`: abort, ignore late responses and release subscribers. The host owns
  disposal; a panel unmount does not dispose a shared resource.

`hasMore` is transport traversal state, never Delivery completeness. Before initial
success it is false, distinguished by phase/error. Cursor expiry is an explicit
error until refresh starts a fresh traversal; no silent snapshot replacement.

## Scope, cache and query triggers

Create one resource for one immutable query in the host application scope, then pass
that resource to all consumers. Cache reuse currently means the current loaded
traversal of that resource, not a global persistent cache. The host must recreate or
select a different resource when source, authorization scope, actual request filters,
resolution/grain, page size or resolver revision changes. Dispose unused resources
when evicted; do not construct a resource on every render or keep all query histories.
No heuristic key serialization, cache TTL, background polling or authorization logic
is built into this primitive before those policies are specified.

A local display filter, grouping, chart type or statistic does not change the query.
Use `projectRows(rows, {filter, sort, offset, limit}, project?)` for local processing,
or pass an existing domain projector to `useQueryProjection`. Source arrays are not
sorted or sliced in place. Grouping/aggregation uses the caller's pure projector;
there is no arbitrary expression evaluator or invented metric registry.

Selection happens before projection. For an aggregate of all locally filtered rows,
omit local offset/limit; apply table pagination separately. A projection returns only
its output, without a new provenance/transform envelope. Exports can consume the
original rows and the chart. Requested scope and load state remain query concerns.

## Small and large datasets

For a bounded small dataset, the adapter returns all rows with `next: null`; local
pagination/filtering/statistics avoid repeated requests. For large datasets the
adapter uses the existing server pagination capability and exposes continuation;
only requested pages are fetched. The hook does not invent backend pagination or
choose undocumented thresholds. Choose request policy from known source capability,
record/byte volume, latency and memory cost; measure thresholds in integration.

Local statistics cover loaded rows only. Percentiles can be derived from actual
latency samples; a P95 series cannot yield the original population's P99. Do not
label current-page statistics as the whole requested population. If a whole-range
statistic needs too many rows, bind a supported service-side statistic or show that
it is unavailable; never silently download every page. No source-scope expansion.

## Envelope discussion still needed

Next bind required row fields/grain, supported metadata dimensions, exact values and
units, truth states, query scope and published pagination into concrete resolvers.
These decisions do not block the infrastructure above. No business-specific
`useAnalysisMetrics`/`useAnalysisDeliveries` is named as implemented until its adapter
and transport are actually wired and verified.

## Connected adapter status

`createAnalysisClient` uses the existing decodeTaskPage/decodeComputeResponse validators.
The Task page resolver enforces a stable snapshot across appended pages; Evaluation keeps
its exact receipt, rejects a mismatched selection, and returns non-paged MetricResult rows.
The initial consumer exposes three existing metrics per authoritative slice without new
aggregations. Additional resolvers and multi-query caching remain future work.
