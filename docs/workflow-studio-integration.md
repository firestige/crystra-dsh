# Workflow Studio local host integration

The product Workflow route now composes the public Crystra-ui
`WorkflowMapWorkbench` and `WorkflowResourceBrowser`. DSH owns routing, native
Chat draft references, polling, source projection, and resource write actions.
The browser never reads filesystem paths directly or uses v8 sample globals.

`/api/crystra-workflows/studio/read` resolves an explicitly bound local package
by definition ID and optional exact content revision. `studio/save` requires
that revision, the exact file path and prior content, then atomically replaces
an eligible text resource. Definition documents are not editable through this
endpoint. Writes are serialized within the host; stale revisions and changed
file content are rejected. This is authoring, not package publication or an
Execution admission. Package identities/validation must still be reconciled by
the Workflow owner after source edits. Independent external editors do not
participate in the host's write queue.

Projection reads Workflow DSL graph nodes, normal/event edges, deterministic
routing cases, parallel branches and joins, actions, routes and declared resource
references. The existing UI layout engine computes the live graph. It does not
substitute the precomputed design samples. Unknown edge targets fail explicitly.
There is no complex graph editor. References are inserted into native DSH Chat
through its session input API; they do not send a message or start an Agent.

Resource content editing and `studio/mutate` add/rename/delete are connected to
local disk. Add creates an owned declaration and a generated resource path;
it does not automatically create an executable Role or change node bindings.
Rename changes the display name, preserving IDs and paths. Display names live
in `.crystra/resources.json` (schema `crystra.workflow-resource-names@1`), excluded
from editable resource files but included in the local revision. Delete checks
DSL resource references and relative Markdown links, and removes owned declarations.
A Skill deletion includes its member files. All mutations require an exact revision.
Multi-file changes use a rollback journal next to the binding configuration;
interrupted writes are recovered on service startup. Content saves update owned
resource hashes; package publication identities still require owner reconciliation.

Workflow routes ensure a native DSH Session keyed by bound directory and definition
ID, independent of the content revision. No Task history is copied. Chat remains
unmounted until the selected Session matches this binding. The backend rejects
Task admission and suppresses Task control context for these reserved Session IDs.
Task routes restore the selected topic Session under the original Task identity.
Task Plan groups and Workflow identity groups support persisted topic selection,
new blank Sessions and renaming; see task-topics-candidate.md. Crystallization shows an honest empty state
until an owner supplies real candidate/comparison data. No sample results are
installed into the product.

The 3085 deployment retains its existing profile and state roots. Its
`workflow-integration.json` records artifact hashes and the pre-install backup.
Host validation covered real Hello World and Implementation graphs, resource
references, empty crystallization, an unchanged-content save through the live
RPC, and the five Task Workbench tabs. Changed-content persistence, stale writes,
and source/path boundaries are tested against temporary bound packages.

2026-09-27 isolation/resource qualification: 253 DSH tests passed, along with
workbench typechecking, boundaries, and build. Live 3085 browser verification
covered add → rename → reload → delete against a temporary bound package,
including disk content/declarations, stable Session identity across revisions,
and rejected Task admission. Task → Workflow → Task → Workflow restored the
original Task history and kept Workflow composer drafts separate, without
sending an LLM prompt. Temporary package files and directory bindings were removed.
Native Workflow Session creation also registers its bound directory as a DSH
Workspace, and the client idempotently adopts the Session before opening Chat.

Resource contract convergence: `crystra.workflow-studio@2` includes an owned
resource catalogue keyed by the DSL declaration ID and `resourceKind`. Add takes
`resourceKind`; rename/delete take `resourceId`; content save takes `resourceId`
and a member path, verified against that declaration. Paths and display names
are values, never resource type discriminators. The Host computes reference
reasons once for both read projection and deletion, including decoded URI links.
The UI uses those reasons; preview-only legacy snapshots retain their adapter.
Display-name metadata is now keyed by resource ID (old path keys remain readable).

The Host controller owns polling, write serialization, generation checks,
snapshot replacement and recovery scheduling in `finally`. The page composes
components and navigation only. Shared Host RPC lives outside Task modules.
Resource management uses the shared ResourceDialog; submit, Escape and cancel
are locked while a write is pending. Dev's sibling-repository dependency remains
an intentional temporary integration boundary until v8 migration is complete.

Convergence verification: UI 448 Vitest cases plus 34 script tests and DSH 255
cases passed; both typechecks, package builds and the DSH boundary check passed.
Live 3085 verification held a mutation in flight to check cancel/Escape locking,
aborted its transport to prove automatic read recovery and retained form input,
then retried and completed add/rename/reload/delete with semantic RPC keys.
Task/Workflow history and draft isolation remained intact. No model prompt was sent.
