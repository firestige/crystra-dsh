# Analysis host integration

## Current implementation — 2026-09-28 correction

The v8 page contract controls the UI. Overview observes the whole system within the
global time range; it has no Task selector or drill-down. Trace selects one Delivery
inside the global time range and optional Task context. Comparison uses observation
settings and an optional Delivery subset inside that same global range.

The temporary Task compute overview and its three-card replacement were removed.
`HostAnalysis` now mounts the shared `AnalysisSurface` directly. No Task directory or
whole-Task compute is requested on page entry. Shared query primitives, validated
Contract adapters, projection helpers and DSH allowlisted transport remain available
for future integration, but are not substitutes for a time-scoped data source.

Overview preserves the resources/quality themes, default Widget layout, grouping,
layout editing and configuration import/export/add/save/cancel. Missing values are
explicitly unavailable, including scalar values represented as null. No provider,
model, price, subscription or measurement is fabricated. Provider-specific widgets
must be expanded from actual dimensions; the unbound page uses a generic cache slot.

Global date controls are restored. Period changes are reflected in the host URL;
Task scope is only retained in Trace URLs. Source identities are not applied to
Overview or Comparison. Date changes and page switches do not change layout/settings.
Refresh and its cadence control remain visible (manual, 15s, 30s, 1m, 5m), disabled
with an explicit explanation until a correctly time-scoped request can be supplied.
No fake refresh or whole-Task compute is issued as a fallback.

`configuration-store` owns accepted layout/settings for the host session. UI owns
editing drafts and display state. Crystra-ui owns reusable query/business/presentation
code; DSH owns routing, configuration and host transport. No Contracts or Observation
schemas changed. No new backend API or production metric is asserted by the UI catalog.

## Validation

Regression coverage verifies the empty-data overview retains both themes, metric
placeholders and layout controls, without a Task selector. The query decoder tests
continue to validate exact Task selection independently from the overview UI.
Validation after correction: UI 479 Vitest tests plus 34 script tests passed;
DSH 266 tests passed in a settled, serial run (the parallel run hit the existing
cold-start polling timeout). Type checks, builds and boundary/dependency checks passed.
The authenticated 3085 browser check found no errors, no Task/compute requests and
15 unavailable Widget slots. Date changes persisted in the URL across tabs; layout
cancel worked. At 1180px viewport width the header client/scroll heights were both
87px and the page had no horizontal overflow. Refresh is explicitly unavailable.

The separate UI package-artifact guard previously reported a CommonJS loader helper
also present in the pre-integration deployed baseline; this is a separate packaging
issue, not a passing release qualification.

## Authority and remaining work

- [v8 page](../../../../workflow-self-recursive/tmp/20260907/Crystra-ui-design/pages/analysis-audit.md)
- [Package boundary](../../../../wsr-ui/docs/analysis-data-boundaries.md)
- [Three-layer design](./data-design.md)
- [Query primitives](./query-design.md)
- [Missing data versus composition cost](./contract-composition-report.md)

Still unbound: system time-range metrics, Delivery index/Trace data and comparison
series. Relative-range rolling policy and refresh scheduling for inactive views or
terminal Deliveries require explicit decisions. API limitations must be recorded as
gaps rather than changing these page semantics.
