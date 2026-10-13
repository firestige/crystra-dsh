# Crystra DSH backend plugin

Crystra augments DSH with managed consensus, verifiable step commitments and Barrier gates, independent core-code reflection, and observed/validated crystallization. DSH owns agent execution and scheduling.

The default `dsh-crystra` export is the backend plugin. There is no legacy execution suite, client bundle, UI replacement, bundled model CLI, or compatibility entry point.

Install through DSH's native plugin manager:

```sh
dsh plugin --profile web add dsh-crystra@file:/absolute/path/dsh-crystra-0.1.0.tgz --ignore-scripts
```

The plugin registers the `crystra` settings namespace. It is disabled until configured with a project root, scope, exact consensus publications and host-owned Squidex credential references. Selected agents are attached automatically at native creation/resume, before their first model request. Configuration changes require a DSH restart; approved consensus version switches use a durable binding journal and do not require a restart. Native DSH approval cards handle exact publication, binding switches, withdrawal and historical restoration. Existing model, UI and LAN settings are preserved.

See [native setup and failure behavior](docs/backend-rebuild/native-usage.md) and [backend documentation](docs/backend-rebuild/README.md). Explicit trusted programmatic `resolveConsensus` / `consensus` ports remain available for integrations. Required host services are sessions, persistence, tools, system prompt and agents; native mode also uses settings and credentials. Supported integration profile: DSH 0.1.5-rc.2, Node 24.12.0 / npm 11.6.2. This tested profile does not promise compatibility with later DSH releases.

The optional `dsh-crystra/pi-ai-lifecycle` export manages pi-ai transport shutdown. Actual code-capability execution currently uses the macOS/Python adapter; no portability claim is made for other operating systems.

See [first-run installation and activation](docs/backend-rebuild/first-run.md) for the independent package path. No pre-created consensus references are required.

## Install and manage

The package provides a thin `crystra` CLI: `install`, `uninstall`, `recover`, and `doctor`. It delegates package operations to DSH/pnpm, prepares a managed local consensus service when needed, and restores snapshots on failure. It never installs a container runtime or silently disables execution isolation. Uninstall preserves consensus data by default.

For an existing profile installation: `dsh plugin --profile web exec crystra doctor`. Direct `plugin add` remains supported; missing setup is reported through native diagnostics, warnings, and managed-task checks. See [CLI usage](docs/backend-rebuild/cli-usage.md) for local artifact bootstrap, retained data, and supported boundaries.

## Development and acceptance

- `npm ci`: install development host components.
- `npm test`: all backend regression tests.
- `npm run pack:verify`: default entry and archive contents.
- `npm run qualify:clean-install`: pack, install into an isolated consumer with empty HOME/XDG/npm cache, exercise native DSH capabilities and a fresh Squidex/PostgreSQL instance, then remove that instance and its volumes. Requires macOS, Python, Docker and docker-compose. No model credentials are inherited.

Clean acceptance uses deterministic local model adapters and provider fixtures to test mechanism behavior, including failures. It does not re-establish the previously measured quality of a real high-tier model.
