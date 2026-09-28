# Analysis host integration

## Current candidate — 2026-09-28

Crystra-ui owns the reusable query resources, generic decoding interfaces, metadata/metric adapters and presentation. DSH coordinates route, host transport, selection and browser persistence. Panels do not fetch. Evidence owns recorded Observation metadata; Evaluation owns metric calculation. No Contracts or Observation schema files change in this candidate.

- Overview queries Evaluation over the global Evidence recorded-time range, without a Task selector.
- Trace queries the paginated Evidence Delivery directory. Selecting a Delivery issues a separate exact Trace request in the same recorded-time range. Trace does not issue Evaluation compute requests.
- Comparison combines Evaluation with Delivery metadata for its optional subset. Directory paging does not imply complete membership until exhausted; server total remains distinct from loaded/local-filtered count.
- Directory search is sent to Evidence for the whole query range. Local refinement only filters loaded rows. Cursor pagination backs incremental scrolling; the mounted list window is capped at 30 rows.
- Relative ranges are resolved again when refreshed, including across midnight. Cadence and manual refresh share that path.
- Selected Trace pages remain explicitly partial until loaded; selection switches cancel stale requests.

`configuration-store` stores accepted layout and observation settings in localStorage under `crystra.analysis.configuration.v1`. UI validates the structural shape independently of the metric catalogue, so retired metrics do not destroy saved layouts. Drafts, observations and transient selections are not persisted. Malformed/denied reads use defaults; failed writes keep the in-memory change and show a notice. Browser storage is local to the origin/browser, not cross-device storage.

## Interfaces

The DSH gateway allowlists `deliveries/list` to Evidence `GET /v1/evidence/deliveries`. This additive local query candidate requires `recorded_from` and `recorded_to`, supports metadata filters and snapshot-bound cursors, and returns metadata only. The existing Trace and Evaluation contracts retain ownership of their payloads.

See [UI binding notes](../../../../wsr-ui/docs/analysis-metric-bindings.md) and [three-layer design](./data-design.md). Earlier verification results in those documents describe their particular candidate, not a release qualification.
