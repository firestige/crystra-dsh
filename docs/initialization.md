# Crystra initialization and services

DSH owns plugin installation and the Host. Crystra owns its own configuration, service readiness and diagnostics. Execution and Studio remain internal modules behind one `/crystra` command.

## Commands

- `/crystra setup`: generate private new-brand configuration without overwriting existing files, activate Execution, prepare the exact bound service archive, and start its stack. Ready is recorded only after migration and health checks succeed.
- `/crystra doctor`: inspect actual services and use Execution's public validator for role bindings in the current conversation workspace. Missing bindings are reported with their path; no provider or model is selected implicitly.
- `/crystra services start|stop|status`: use only the state root's own Compose namespace. Stop preserves configuration and database volumes.

Default loading performs no Docker start or image pull. Command input and status cards are visible in the conversation; administrative commands are intercepted before model execution. Workflow commands retain their existing Execution handler.

## Configuration

Configure the root DSH plugin with `stateRoot` (optional absolute path), `services.ports.evidence` and `services.ports.evolution` (distinct integers 1024–65535), and optional explicit `execution.configFile` / `execution.bindingFile` absolute paths. Unknown service fields and image overrides are rejected. Explicit Studio adapter configuration remains available for development qualification.

macOS defaults to `~/Library/Application Support/Crystra`; Linux uses XDG config/state roots under `crystra`; Windows uses APPDATA/LOCALAPPDATA under `Crystra`. An explicit `stateRoot` keeps generated configuration and state together for isolated installations.

Generated `config.json` records initialization defaults. DSH plugin configuration is the supported source of port overrides. Generated `execution.json` is preserved on retries; its managed workspace root has no inferred role bindings. Use `.crystra/role-provider-bindings.json` in the selected workspace and the existing Provider authorization interfaces. Crystra never reads `.wsr` as a fallback.

## Service lifecycle

The release-bound descriptor at `modules/initialization/src/service-descriptor.json` identifies a GitHub service archive and its SHA-256. It is supplied during the new release assembly; a development checkout without it reports that explicitly. Service-group source and the strict image-digest builder live under `services/`. The combination release publishes that resource before binding the plugin, so no self-containing manifest is required by the plugin.

Downloads and archive extraction are bounded; links, path traversal and unexpected archive roots are rejected. Preparation uses an exclusive state-root lock. Failed operations are retryable against the same descriptor; incompatible applied identities are rejected. Private command diagnostics are bounded and written to `services-last-error.log` with credential-pattern redaction.

Cancelling a command aborts its pending subprocess/download work. Unloading the plugin unregisters commands, RPC, hooks and client slots; it does not stop an already-running stack, remove user files or delete volumes. Stop services explicitly before uninstall if they should not continue running. A lock left by an abruptly killed process needs inspection before manual removal; it is not timed out while another operation might still be running.

## Qualification boundaries

`CRYSTRA_QUALIFY_INITIALIZATION=1 npm run qualify:real-harness` verifies an empty profile, doctor/setup status, retry preservation and browser refresh. `node scripts/qualify-initialization-services.mjs` verifies the Host service coordinator against existing local new-component image IDs in an isolated temporary namespace, then cleans only that namespace. It is explicitly development-only, not registry, multi-platform or candidate qualification. Exact published bytes are verified in the later release phase.
