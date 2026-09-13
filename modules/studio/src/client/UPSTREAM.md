# BI/Evaluate source attribution

This Studio presentation is a clean DSH-specific adaptation of the BI/Evaluate
interaction model first implemented in `firestige/crystra-ui` at commit
`d92c6ce2e62a7a51edff8591942a2aa0ad5017dd` (Apache-2.0).

The migrated product behaviors are Task selection, single/compare evaluation,
Metric Result navigation, receipt access, Fact/Trace drill-down, partial-result
retention, refresh recovery, and accessible loading/error states. This package
does not copy Evidence or Evolution validators, formulas, persistence, or query
semantics. Those remain owned by their versioned HTTP APIs. `crystra-ui` remains
historical migration provenance and is not a second product publisher.

## #120 handoff inventory

The retained behavior mapping is complete for the current milestone:

- `/evaluate` selection and compare -> `evaluate-model.js` plus the single
  Evaluate page in `studio.js`;
- metric result, receipt, Fact, and recorded Trace navigation -> formal
  Evolution compute and Evidence read responses rendered by `studio.js`;
- refresh/deep-link recovery -> the bounded `crystra-studio` host URL parameter;
- the old standalone development role -> `dev/main.js`, which mounts the same
  production plugin and is never packed.

No old validator, formula, persistence adapter, HTTP transport, or execution
archive was migrated. Repository rename/archive and historical disposition
remain exclusively owned by crystra #120.
