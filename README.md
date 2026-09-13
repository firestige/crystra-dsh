# Crystra for DeepSeek Harness

Crystra turns repeatable workflow steps into deterministic execution, reducing unnecessary agent and LLM calls. This repository owns the single public DSH plugin **dsh-crystra**; its target registration repository is **firestige/crystra-dsh**.

Execution and Studio are internal modules of this plugin. `crystra-execution` and `crystra-ui-core` remain ordinary, independently versioned component dependencies. Domain implementations stay in their component repositories.

## Current development state

The new distribution starts at `0.1.0`; no Crystra release is claimed by this source checkout. During rename preparation, `config/development-inputs.json` binds exact component commits and SHA-256 digests. Existing repository URLs remain until the coordinated repository rename. Production candidates reject local file dependencies and require exact published GitHub Release assets.

Use Node 24.12.0, npm 11.6.2 and pnpm 11.23.0. Check out the configured Execution and UI commits under `.crystra-inputs/sources/execution` and `.crystra-inputs/sources/ui`, then run:

```sh
node scripts/prepare-development-artifacts.mjs
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3
npm run build
npm test
npm run pack:verify
```

The build emits one CSP-compatible browser bundle with module identity `dsh-crystra`. Its Cordis patch registers one plugin and the internal Workspace override. Archives include source and license attribution; internal modules have no separate plugin manifests.

## Isolated integration checks

Use DSH `0.1.1-rc.2`. Set `CRYSTRA_DSH_BINARY` to that version's executable when the global DSH differs. Checks use temporary DSH homes and profiles:

```sh
npm run qualify:clean-profile
npm run qualify:lifecycle
npm run qualify:provider-routing
npm run qualify:real-harness
CRYSTRA_QUALIFY_TERMINAL=1 npm run qualify:real-harness
CRYSTRA_QUALIFY_INITIALIZATION=1 npm run qualify:real-harness
```

Real Harness checks cover the Host, Chrome, Delivery, Studio, recorded traces, and downstream unavailability. The terminal fixture mode supplies deterministic owner facts without invoking an LLM. DSH 0.1.1-rc.2 supplies no CSP header; the bundle check separately rejects dynamic code and inline-script injection.

The root plugin loads without pre-existing Execution configuration. `/crystra setup` prepares configuration and the bound service group; `/crystra doctor` reports readiness and missing repository role bindings. `/crystra services start|stop|status` manages the installation's own Compose namespace. These commands are deterministic and do not invoke an LLM. No independent public product installer is shipped. See [initialization](docs/initialization.md).

Before new service assets are published and bound, setup activates Execution and explicitly reports `DEGRADED / CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE`. This development state is not a fully installed release.

New RC tags use `crystra-dsh-v<version>-rc.N`. Stable promotion reuses qualified bytes through GitHub Releases and retains its manual release gate. There is no npm publication stage. Historical release records describe their original artifacts, not this new distribution.

See [foundation boundaries](docs/foundation-boundaries.md), [source notice](NOTICE.md), and [security policy](SECURITY.md).
