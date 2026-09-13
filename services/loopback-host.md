# Loopback Host integration

The generated published-image bundle and `dsh-crystra-studio` share the closed
`crystra.loopback-host@1.0.0` fixture. Run `./crystra-compose host-config` to materialize
the effective fixture after port overrides, and copy its Evidence base URL into
Execution's optional `observation.endpoint`. No database hostname, internal
Compose port, or credential is part of that output.

| Endpoint | Authority | Default host address | Health | Compatible contract |
| --- | --- | --- | --- | --- |
| DSH Studio RPC `/crystra-studio` | `dsh-crystra-studio` Host plugin | DSH-owned local connection | DSH lifecycle | closed gateway operations |
| Evidence facts/traces | Evidence | `http://127.0.0.1:4318` | JSON `/healthz` | `evidence.query@0.1.0` |
| Evidence Task discovery | Evidence | `http://127.0.0.1:4318` | same listener | `evidence.query@1.0.0` |
| Evolution compute | Evolution | `http://127.0.0.1:8000` | plain-text `/healthz` | `evolution.compute@1` |
| Standalone BI | BI deployment owner (not this bundle) | `http://127.0.0.1:8080` when separately enabled | BI-owned | presentation only |
| PostgreSQL | Evidence deployment internals | not published | container health only | no consumer contract |

`start` performs endpoint, contract, loopback-host, port-bound, and port-conflict
preflight before Docker or secret effects. A non-`127.0.0.1` host override is an
explicit `LOOPBACK_HOST_REQUIRED` refusal: remote access, TLS, and reverse proxy
design remain outside the MVP. `preflight` is also available independently.

The browser bundle contains neither these downstream URLs nor downstream or
database credentials. It sends only closed typed operations to the DSH Host.
The Host reports timeout, refusal, malformed health, incompatible health,
partial-stack, and restart windows as bounded Studio degradation. Those states
do not enter Execution's Delivery control plane and cannot change Delivery
lifecycle. Observation export remains optional and best effort; it uses the
same Evidence base URL as this fixture.
