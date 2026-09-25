# Crystra UI adoption baseline

Accepted UI designs are recorded under `packages/studio/design/`. Full page designs, decision history, theme assets and v8 previews live in the Crystra superproject under `docs/design/crystra-ui/`.

| Owner | Formal content |
| --- | --- |
| Crystra UI | Theme and geometry tokens, Card surfaces, Button/Icon, List/Tabs/Search/Toggle, widgets, layout rules and their tests |
| DSH Crystra | Shared Shell/sidebar host behavior, navigation/session ownership, file dialogs, Markdown rendering and input integration |
| Crystra | Page and cross-page semantics, acceptance decisions, reviewed previews, source/asset provenance and business handoff |

New branding does not silently rename npm packages, RPC paths or compatibility coordinates. The repositories and released package identities currently retain their legacy names.

The accepted designs are source requirements; preview-only page composition and fixed fixtures must not be exposed as a real data-backed application. In particular, crystallization predictions are distinct from measured Evaluation results; workflow-package owns the resource envelope; draft writes and publication retain their own gates.

## 2026-09-18 migration boundary

This session delivers production code; only the standalone development host is exempt from DSH mounting requirements. The authoritative UI assets for this migration are:
`/Users/firestige/Projects/workflow-self-recursive/tmp/20260907/Crystra-ui-design`.
This explicitly selected directory takes precedence over the older design-location hints above.

- The UI-owned five page frames and `PageHeader` are staged under `wsr-ui/dev/layout/components/crystra-ui/pages/`; content and Chat/Bench mounts are supplied as props. It owns no browser history, session selection, DSH services, fixture task status, or client-loader globals.
- `dsh-crystra/src/client/navigation/routes.js` owns logical page decoding and exact Task/Workflow identities. Missing Workflow revisions remain unresolved; unknown routes do not select another object. The local URL spelling is a preview transport, not a published DSH URL contract.
- `wsr-ui/dev/layout` is the development host: React root, Vite/History adapter, fixture data and placeholder mounts. It imports the owner-organized staged page components and DSH route decoder, rather than maintaining a second page implementation.
- Shared Shell behavior, navigation state, session binding, renderer/slot registration, settings and native Input integration remain DSH-owned. A root-level panel must not be assumed to carry a Session automatically.

### Checked upstream contracts

Inspected the published npm tarballs for `@deepseek-ai/dsh-web-app`, `@deepseek-ai/dsh-client-ui-layout`, and `@deepseek-ai/dsh-cordis-client-runner`, all at `0.1.5-rc.2`.
The Web App package is `dsh-web-app`; the similarly named `dsh-web` package is the search/fetch capability and is not the GUI contract.

`dsh-client-ui-layout/lib/types/client/index.d.ts` defines root `main` as keyed, with reserved `conversation`; other keys have no automatic Session binding. `ILayout.selectPanel(id | null)` changes panels without changing Session; `beginNavigation()` supplies a cancellation signal. `shell.overlay` is additive; replacing `sidebar` replaces its existing child seats. New host adapters must respect those boundaries and the `dsh-client-ui-slots` / renderer registration contracts.

The published layout client still uses `window.__ModuleLoader__.load({ id, factory })`, resolving `react` and `react/jsx-runtime` through the host's `require`. Library code therefore keeps React external; compiled TSX must not bundle another React root/runtime. These observed facts do not validate the repository's older full plugin composition.

At the 2026-09-18 page-frame checkpoint, dependencies still targeted `0.1.1-rc.2` and real-host compatibility was unverified. The 2026-09-21 integration and verification record below supersedes that limitation. Session restoration and full Task admission remain separate from workbench mounting qualification.

### Sidebar component ownership

Sidebar is a **Crystra-dsh component**, including its composition, view state and host behavior. Its implementation, props, CSS and tests are staged at `wsr-ui/dev/layout/components/crystra-dsh/sidebar/` and will move together into Crystra-dsh. It must not be exported by Crystra-ui. It consumes only public UI primitives such as Icon and ExpandableSearchField from `crystra-ui-core`.

New migration components remain staged by final owner under dev until directory-based relocation. This is an organizational staging area, not permission to weaken DSH or production requirements. Dev fixtures, History adapter and placeholders remain separate.

`src/client/navigation/sidebar-model.js` projects supplied owner records into exact navigation hrefs and selection state. Workflow keys include definition/revision/source, and hrefs encode each identity. Production data retrieval and host callbacks remain DSH responsibilities; dev uses the same projection with explicit fixture records. Missing settings/Harness callbacks disable those controls rather than creating a second settings surface or fake session.

### Execution Task catalogue

Task reads now use the Execution-owned Task query, not Delivery inventory or Evidence.
The existing host registers `/crystra-tasks` (`list`, `changes`) in
`modules/execution/src/host/task-query.js`. `createPluginRuntime` obtains the query
from `getExecutionTaskQuery(application)`; an older Execution package without that
entry point returns an explicit unavailable error instead of substituting Evidence.

`changes({after})` is a bounded revision long poll. It rechecks the owner snapshot
once per second, returns a full snapshot after change or timeout, and releases waiters
on host disposal. This supports committed changes from other Execution processes
without a standalone watcher service. Task catalogue scope is the configured Execution
installation's durable root. It does not activate worktree runtimes.

The staged `dev/layout/components/crystra-dsh/tasks` hook subscribes once per shared
host resource, refreshes on invalidation, rejects stale reads, and reconnects after
failure. The 3086 Vite host can mount the same owner query and gateway read-only via
`CRYSTRA_EXECUTION_CONFIG`; production React mounting remains separate. Bench stays a
placeholder and Analysis remains an Evidence consumer.

## 2026-09-21 Task Workbench integration and DSH 0.1.5

This section supersedes the staging locations and 0.1.1 compatibility limitation above.
The mainline target is now **DSH 0.1.5-rc.2**. The removed client-runtime dependency
is replaced by the published Session Controller, UI Session, UI Slots and Store packages.
React and JSX resolve from the host; the plugin creates no React root. Workspace
composition retains the fixed upstream module, re-pinned with source hashes and its
complete service injection requirements. Historical qualification records are not
rewritten or counted as evidence for this version.

- `crystra-ui/packages/bi/src/task-workbench/` owns the five surfaces, read-only
  viewers, semantic summaries, evidence thumbnails and public presentation types.
  `src/task-layout/` owns the shared Header and page frames.
- `crystra-dsh/src/client/task-workbench/` owns the Plan draft adapter, notification
  policy, execution animation, per-Task browse/read state and host composition.
  `src/client/preferences/` owns the motion preference hook.
- The 3086 dev components re-export production implementations. Fixtures, simulated
  progress and dev transport stay under dev; no accepted sample enters the package.
- Root client composition registers a Session-scoped `conversation.view` workbench
  against the existing Execution control-plane binding. Both the view and Delivery
  navigation must match the exact Session before showing Task identity. Native DSH
  Chat and Composer remain owned by DSH. This seat is a Workbench **view tab**;
  the product main panel also composes the native conversation with the accepted Task split-screen layout.
- Five workbench tabs render within the shared Header. Host-scoped store state is
  keyed by exact Task. Badge revisions and system focus require explicit owner facts;
  selecting a tab does not acknowledge unseen notifications.
- Detailed Grilling, Plan, Plan Run, Gate and Delivery projections remain absent from
  the current owner API. Formal pages preserve the designed unavailable states;
  they do not derive these facts from Delivery inventory or Evidence. The lightweight
  Execution monitor is tracked in https://github.com/firestige/crystra/issues/278.
- `.crystra-inputs` currently contains a local UI integration build. The development
  input records `sourceState: working-tree` and an artifact digest. It is not clean
  commit/release provenance; a release must repin the committed sources and rebuild.

Package and isolated-host verification results belong to this migration, and must
be distinguished from deployment verification on the existing acceptance instance on 3085.

### 0.1.5 transport registration

Production Crystra RPC now uses exact `connection.fetch.register` routes under
`/api/crystra-execution`, `/api/crystra-tasks`, `/api/crystra-workflows` and
`/api/crystra-studio`. This uses DSH's shared authenticated API carrier and avoids
custom-prefix registration's service-scope failure on 0.1.5. The adapter validates
DSH envelopes, exact method/route agreement, propagates cancellation, and disposes
routes with the plugin. Domain payload validation remains with each owner gateway.
The standalone Vite host retains its existing dev transport paths.

### Verification recorded for this integration

- UI: 85 Vitest files / 435 tests plus 34 Node tests; package build, shared-library
  Node import, TypeScript and migrated-component ESLint passed.
- DSH: 211 tests passed, including the browser Studio regression; Workbench
  TypeScript, package build and dependency boundaries passed.
- An isolated real DSH 0.1.5-rc.2 profile installed the local package. A real Session
  ran the read-only `/crystra doctor` command, entered the native `任务工作台` view,
  switched all five surfaces and measured the shared Header at 88px. Browser
  errors: zero. This profile intentionally had no configured Execution application;
  it verifies native mounting, navigation and unavailable states, not detailed
  live projections or formal Task admission.
- 3086 review/delivery interactions, resource return navigation and transparent
  evidence tiles were rechecked against the relocated source with zero browser errors.
- Initial package qualification did not redeploy 3085. The subsequent product-shell
  correction below is now deployed on 3085; nothing was published or released.


### Product shell migration (2026-09-21)

The prior additive Session view was an incomplete product integration: it left the
legacy Workspace/Delivery sidebar visible. `src/client/shell/register.tsx` now
registers the accepted Sidebar in the public `sidebar` slot and the product pages
in the composed `main:conversation`. The profile disables the native sidebar and
wraps the exact Conversation module while retaining its declared child slots. Workspace
services remain available to the native Composer; the product sidebar contains only
Tasks, Workflows, Analysis, and Settings. Native Conversation remains owned by DSH.

Sidebar, Settings, Task/Workflow resources and their hooks now live in Crystra-dsh
`src/client/{sidebar,settings,tasks,workflows,shared}`. Dev imports are re-export
bridges to these files. Both hosts use the same components. DSH maps resource reads
to the authenticated `/api` carrier. The local Execution input is pinned by artifact
digest and explicitly marked as a working-tree build, including the query export.

Deployment copies must preserve immutable manifest bytes and their embedded
canonical paths. Rewriting stored paths changes the manifest identity digest and
makes the owner reject Task queries. Only mutable configuration may point at the
copied durable store. Original data and previous deployment remain available.

Verification: 213 DSH tests, 17 focused migrated UI tests, TypeScript and build.
Real DSH browser checks cover Task/Workflow listings, absence of legacy sidebar,
Task tabs and 88px Header, and Settings. Historical missing Session bindings remain
explicit unavailable states; no unrelated Session or sample projection is substituted.

Final deployment verification on 3085 passed with zero page/console errors.
New Task directory selection opens the native Composer. This checks the entry
flow only; it does not claim formal Task admission or live bench projections.


### Crystra / native Harness switching

The shared Sidebar already defined `onOpenHarness`, but neither the standalone dev
App nor the first production host wired it; the expanded brand was therefore disabled.
The formal host now binds that callback to a DSH Store surface preference. It switches
both main and sidebar to the original native components, retaining all native slot
children and injected services. The expanded native DSH banner switches back, replacing its original New Session
handler. No extra return button is added. Collapsed brands only expand the sidebar.
Task route, selected bench tab, query resources and native Session identity survive.
The dev App has no native Harness runtime; the integration guarantee is checked on
the real host, not inferred from a passing standalone component test.

`scripts/qualify-surface-switch.mjs` checks the real brand click, native shell,
return action, preserved Task route/Plan tab and zero browser errors. Supply
`CRYSTRA_HOST_LOG`, `CRYSTRA_TEST_TASK_ID`, and `CRYSTRA_PLAYWRIGHT_MODULE` when
using the sibling UI workspace's browser driver. The regression failed on the
unwired 3085 and passed on the corrected host; it does not force clicks through overlays.

The banner-specific regression evaluates the actual composed upstream handler and
checks that it calls surface switching without Session creation, while the separate
New Session control remains unchanged. Real browser verification checks both banners,
absence of an added return button, preserved Task/Plan, and zero console/page errors.

### Shared page composition and Task admission (2026-09-22)

`src/client/shell/product-pages.tsx` is the single page composition consumed by
both the formal DSH shell and the standalone dev App. Host-owned Chat is injected;
Task/Workflow/Analysis frame layout is no longer rewritten in `ProductMain`.
The production browser entry no longer falls back to the replaced Delivery sidebar.
The native hero heading and duplicate Session header are omitted only in Crystra
mode; native DSH remains available through the banner switch.

Codex and Copilot adapters register with the public DSH LLM service. Model lists
come from authenticated provider catalogs; no copied static model list is used.
The first migration incorrectly restored only provider transport/presentation and
omitted the existing Task control flow along with the replaced UI. This was a
regression, not an authorized removal. The restoration below supersedes that choice.

Task admission requires a persisted nonblank user message and unique Workspace
membership. Execution owns retry-safe Task creation. DSH stores only exact
Task/Session bindings and uses them before Delivery correlations, including Tasks
with no Delivery. Cold bindings remain resolvable after a host restart. The client
refreshes the owner Task list before navigating to the admitted Task workbench.

Validation status: the full DSH suite passed 216 tests before the final cold-binding
and composition regressions (those six targeted tests also pass). Typecheck and
boundaries pass. Browser inspection verified Codex and Copilot catalog groups.
The spare 3087 and live 3085 instance shared a Session store and hit write-owner
contention, so that creation attempt is NOT acceptance evidence. The spare was
stopped and 3085 replaced. The subsequent browser command was denied; real prompt
submission -> Task -> workbench -> reload still requires acceptance. Do not report
this migration as end-to-end qualified until that check succeeds.

### Task admission / layout regression correction (2026-09-22)

The actual DSH 0.1.5 Session no longer exposes `events`. Admission incorrectly
used `session.events.find`, while the test mock still exposed the old field.
A regression using the real published `Session` reproduced the same TypeError.
Admission now uses `ownEvents()`, excluding fork-inherited messages. Admission
errors remain inside the Chat content and cannot add a row above the base Header.

The DSH server serves the SPA only at `/`; path-based client routing left a blank
page on reload. The formal host now uses root-hosted `/#/tasks/...` routes. Dev
may still use pathname routes; both resolve to the same ProductPages components.

`scripts/qualify-task-admission.mjs` performs real Workspace selection, provider
model selection, nonblank first message submission, Task admission and navigation,
all five header tabs, then a browser reload and exact Chat recovery. On 3085 the
final run passed with no browser errors: Header y=0/h=88, Chat y=88/w=501.59,
Bench y=88/w=812.41 at a 1600x1000 viewport. All 221 DSH tests, workbench typecheck,
build and diff whitespace check passed. This supersedes the earlier incomplete
creation/reload acceptance status; it does not assert availability of owner bench
projections that are still represented as unavailable states.

### Restore Chat control while adapting the new UI (2026-09-22)

The migration scope is presentation. `task-flow`, `task-plan-run`,
`task-control-request`, native Brief/Plan confirmations, selected Gate questions,
and provider task instructions are restored from the preserved host implementation.
They remain the control authority; new UI tabs do not approve or advance work.
The DSH 0.1.5 adaptation uses `Session.ownEvents()` and explicit Task enrollment.
Ordinary native DSH conversations are not implicitly admitted as Crystra Tasks.
Execution owns Task identity and reuses that exact Task for Delivery; its terminal
callback reconnects to the existing controller. DSH stores Session bindings only.

`task-control.js` exposes the existing control read model and selected Gate action.
`task-projection.js` maps it to the accepted five workbench components, preserving
digest, Gate, result and artifact identity. Markdown headings are parsed with an
AST. `workflow-activity-projection.js` maps Execution visits and actual call order;
it does not query Evidence or manufacture a second historical trace. The client
polls current Task projections, hydrates exact artifacts, and keeps user-selected
tabs independent of system focus. Dev fixtures remain separate from live transport.

All 236 DSH tests pass, including real Session/provider control integration,
Brief confirmation, dynamic Plan sections, request idempotency, selected Gate
identity, stale projection rejection and Execution REUSE_TASK binding. Typecheck,
build and boundary checks pass. A real 3085 conversation created a pending question,
resolved it on the second user turn, then generated a Plan after native Brief
confirmation; the new demand and Plan panels updated from those actual files.
The browser run stopped before Plan approval: live Workflow execution and delivery
completion are not claimed by this check. `scripts/qualify-task-projection.mjs`
rechecks this existing Task and reload without sending or approving another turn;
set CRYSTRA_HOST_LOG, CRYSTRA_TEST_TASK_ID, CRYSTRA_PLAYWRIGHT_MODULE and optionally
CRYSTRA_BROWSER_STATE for an already initialized local browser profile.

The restart qualification caught a remaining obsolete persistence call. Cold
Session reads now use `sessionPersistence.open(id, "read")`, read from the exact
inherited-event cut, and close the handle even on failure. They acquire no writer
ownership and cannot include fork-parent messages as current Task sources.
The old standalone Chat's `crystra/chat-start` and `crystra/chat-message` events
are no longer written: native assistant streams already own their presentation
and history. Stored-event validation is included in the integration regression.
The test Session's earlier duplicate display records were backed up and marked
ignorable for 0.1.5 compatibility; no message, control file or approval was removed.
Final host verification passed after restart and browser reload: exact Task,
confirmed Brief, available Plan, all five tabs, split Chat/Bench and no browser errors.

### Grilling interaction policy (2026-09-22)

Clarification checks local workspace documents/configuration and, when needed,
official online documentation before asking the user. Ask only for unresolved
intent, preferences, scope tradeoffs or material conflicts. Each interaction asks
one decision with 2–3 distinct options; the first and only recommended option ends
in `（建议）`, accompanied by a short reason. Wait for its answer before choosing
the next question. An internal backlog in the problem map is not a questionnaire.
Do not treat a recommendation as consent or repeat facts already supplied by sources.

Requirements turns explicitly load the complete `skills/grilling/SKILL.md` through
`task-skills.js`, for both providers regardless of their discovery configuration.
The method paragraphs reuse the user's existing shared grilling Skill verbatim;
the integration section adds the requested option format and Task boundary rules.
Provenance is recorded in `skills/grilling/UPSTREAM.md`. A missing Skill fails
explicitly instead of falling back to a competing inline method. It is not loaded
as the active method during Plan/Execution turns. The earlier standalone method
prompt was replaced by this resource; `grilling-policy.js` retains only validators.
The Skill applies to ordinary Chat text and native question tools.
Provider callbacks reject multi-question Codex batches before any
question is shown; both providers reject invalid options. The Chat adapter prevents
overlapping native questions. Native Brief/Plan approval and Gate decisions keep
their existing semantics. Natural-language compound questions and research quality
remain model responsibilities; the structured checks do not pretend to judge them.
Codex enables hosted web search while retaining the shell network restriction;
Copilot allows its read-only web search/fetch tools alongside local reads. Existing
managed approval requirements continue to apply. No JSONIR or question-history IDs
are changed. The policy applies to subsequent turns, without rewriting past messages.

### Workbench reliability corrections (2026-09-23)

- Missing panels have no attention snapshot. Skeleton creation is not a content
  revision and cannot create a blue update badge. Real content retains read cursors.
- Provider turns bracket artifact writes with `beginUpdate`. The presentation RPC
  serves its prior complete snapshot while the provider is writing, with an updating
  status. Native questions release this bracket so users see the saved question
  context. Completion, cancellation and failure release it. Control reads and
  approvals still validate current files, and persistent invalid files remain errors.
- FullBenchViewer explicitly uses a vertical flex layout; Grilling allocates the
  remaining panel height to its cards. The live Brief preview contains all fields
  with internal scrolling instead of truncating the first six and clipping overflow.
- Native Plan confirmation uses a Markdown table with role, provider and model-id
  columns. SDK versions are omitted from presentation; exact binding documents and
  approval identity remain unchanged. Cell values are escaped as text.
- Node/Gate entry assessments accept the exact current confirmed Brief and Plan
  answerIds as well as predecessor result/Gate identities. Foreign or stale
  confirmations remain invalid. The original request for task `task-7d7e9c9e16a1da1789833aff05861322db06245f3ef25d1fa80e68eff9ce1ecf`
  reproduced the defect in an isolated copy and now passes unchanged. Its existing
  check-entry request was replayed successfully; no new Workflow was started.

Verification: 246 DSH tests, typecheck, build and boundaries pass. Shared viewer
component tests pass. `scripts/qualify-workbench-cards.mjs` checks a long real Brief
can scroll to its bottom and a fresh missing-panel response creates no badge; it
accepts the same host log, Task ID, Playwright module and optional browser state
environment variables as the other host qualification scripts.

### Accepted Task Workbench baseline (2026-09-25)

The user accepted the current 3085 Task Workbench and requested committing this
version. `task-workbench-baseline.json` records the component commits, exact local
artifact hashes, client bundle hash and verification evidence. Both component
inputs are now pinned to committed code; this is a local integration baseline,
not a package release. The 3086 preview remains available for subsequent work.
