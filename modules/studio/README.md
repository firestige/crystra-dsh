# CRYSTRA Studio

`dsh-crystra-studio` is the independently installable **CRYSTRA Studio** bundle. It
provides the Harness-native, non-modal Evaluate conversation tab immediately after Delivery, Task single/compare selection,
Metric Result, receipt, Fact, and recorded Trace navigation.

The browser calls only the DSH Host channel. The Host gateway accepts exact
loopback Evidence/Evolution origins and exposes a closed read/evaluate
allowlist; downstream outage remains isolated from CRYSTRA Execution. Configure:

```sh
./crystra-compose host-config > /path/to/crystra-loopback-host.json
```

Then set `hostConfigFile: /path/to/crystra-loopback-host.json` in the plugin config.

Evidence and Evolution retain API, validation, persistence, and calculation
authority. The published service bundle's `./crystra-compose host-config` command
materializes the same `crystra.loopback-host@1.0.0` fixture, including the Evidence
base reused by Execution Observation and the operation-scoped
`evidence.query@0.1.0` facts/traces plus `evidence.query@1.0.0` Task revisions.
Service outage, restart, timeout, partial
stack, malformed health, and incompatible health appear only as typed Studio
degradation; they never change Execution Delivery lifecycle. Migration
provenance is recorded in `src/client/UPSTREAM.md`.

Studio queries the installation-wide Evidence Task catalog. Repository is not
a Studio selection or Session context: there is no repository input and no
`cwd` inference. When Evidence or Evolution includes repository provenance in
a formal result or receipt, the complete value remains visible read-only in
the DSH JSON disclosure; Studio never turns provenance into query authority.

For local component work, `npm run studio:dev` mounts the production Studio
plugin in a minimal development Harness at `127.0.0.1:4173`. It is not a
separate product or release artifact and deliberately owns no domain logic.

## Accepted Crystra UI design

See [Shell design input](design/README.md) and [adoption ownership](../../docs/crystra-ui-adoption.md). This handoff does not replace the qualified runtime UI dependency.
