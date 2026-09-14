# Crystra for DeepSeek Harness

Crystra turns repeatable workflow steps into deterministic execution, reducing unnecessary agent and LLM calls. This repository owns the single public DSH plugin **dsh-crystra**; its target registration repository is **firestige/crystra-dsh**.

Execution and Studio are internal modules of this plugin. `crystra-execution` and `crystra-ui-core` remain ordinary, independently versioned component dependencies. Domain implementations stay in their component repositories.

## Current development state

The qualified [dsh-crystra RC2](https://github.com/firestige/crystra-dsh/releases/tag/crystra-dsh-v0.1.0-rc.2) is available in the [Crystra RC1 combination](https://github.com/firestige/crystra/releases/tag/crystra-v0.1.0-rc.1). Install its exact archive using DSH 0.1.1-rc.2; see the [quickstart](https://github.com/firestige/crystra/blob/main/docs/guides/quickstart.md). The distribution starts at `0.1.0`. During rename preparation, `config/development-inputs.json` binds exact component commits and SHA-256 digests. The eight repositories now use their Crystra coordinates. Production candidates reject local file dependencies and require exact published GitHub Release assets.

Use Node 24.12.0, npm 11.6.2 and pnpm 11.23.0. The current checkout consumes qualified component RCs by exact URL and digest:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/verify-candidate-inputs.mjs --cache
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

The plugin binds `crystra-services-v0.1.0-rc.3`. Setup still requires repository role bindings before workflow execution is ready. If a development fixture has no service descriptor, it explicitly reports `DEGRADED / CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE`.

New RC tags use `crystra-dsh-v<version>-rc.N`. Stable promotion reuses qualified bytes through GitHub Releases and retains its manual release gate. There is no npm publication stage. Historical release records describe their original artifacts, not this new distribution.

See [foundation boundaries](docs/foundation-boundaries.md), [source notice](NOTICE.md), and [security policy](SECURITY.md).

The release archive bundles only the two digest-verified first-party component packages using npm bundled dependencies. Their registry dependencies remain ordinary root dependencies, resolved for the installation platform. Packaging never copies the development machine's native dependencies. This permits normal DSH installation with pnpm's default URL-subdependency protection enabled.

The Crystra workbench consumes public v8 UI components. Its Trace directory joins the current instance's Execution Delivery inventory to admitted Evidence `DELIVERY_ROOT` relationships; it preserves exact Task/Workflow identities and execution start times. Missing, expired, ambiguous or unavailable bindings do not select a guessed Trace. Direct exact Trace ID reads remain available.

Conditional authoring stores keep immutable resource candidates separate from the source package. Exact revision reads never silently select the latest candidate. Resource persistence does not imply publication, execution authorization or Agent notification; the explicit design exploration helpers are not shipped in the plugin archive.

For explicitly configured, read-only Task exploration, the root plugin accepts
`exploration: {taskFile, sourceLockFile, sourceLockDigest, allowFixtures}`.
Both files must use absolute paths; the SHA-256 pins the source-lock bytes and each
source in that lock is rechecked. `taskFile` uses `crystra-task-file@1` with
`tasks: [{selection: {taskId, goalRevision, planRevision}, projection}]`.
Each projection follows the conditional `crystra-ui-exploration/draft.1` envelope,
uses adapter ID `crystra-task-file@1`, and carries its own expiry and provenance.
This option defaults to disabled. Fixture content additionally requires
`allowFixtures: true`. Read-only loopback RPCs expose `catalog/read` and
`projection/read`; callers cannot choose filesystem paths. The client refreshes
every five seconds and clears old content within a ten-second read lease or at
snapshot expiry, whichever comes first. The adapter does not create sessions,
authorize execution, or supply missing plan graphs/documents/evidence. An owner
Task with the same ID takes precedence and never inherits the draft projection.

Optional `exploration.workflowFile` uses `crystra-workflow-file@1` with
`workflows: [{selection, projection}]`. Selection pins `definitionId`,
`definitionRevision` and `workspaceId`; the binding uses adapter
`crystra-workflow-file@1` and the same conditional envelope/source lock as Task.
Configure at least one of `taskFile` or `workflowFile`. Each definition has one
explicitly selected revision; ambiguous duplicate identities are rejected.
Workflow projections supply an exact draft directory entry and independent
`studio`, `resources`, `crystallization` available/unavailable surfaces.
The public v8 components consume validated maps/layouts, read-only resource
snapshots and crystallization projections. Missing edits, relations, sessions,
Agent events or measured results remain unavailable. No design fixture is
bundled. Workflow reads use `workflow/catalog/read` and
`workflow/projection/read` on the loopback `/crystra-exploration` channel.

When Workflow exploration is explicitly configured, the read-only
`crystra_workflow_draft_read` tool resolves the live Agent's registered workspace
and requires the projection's exact native session binding. It reads only the
requested resource revision and returns at most 10,000 characters per call,
with a content digest and continuation offset. Source expiry or session binding
changes reject the read. Draft references added to native Input neither submit
a message nor grant permission to edit, adopt, execute or publish.
