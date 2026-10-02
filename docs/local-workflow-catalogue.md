# Local Workflow catalogue

Crystra-dsh owns the binding of user-selected authoring directories and the browser
query boundary. Workflow package files remain the source of definition identity and
metadata. This catalogue never queries Evidence, downloads remote packages, edits a
remote repository, or treats Execution's `workflow.local.v1` archive index as an
editable source directory. It does not mutate Workflow files or execution bindings.

The host reads `<Crystra stateRoot>/workflow-directories.json`:

```json
{
  "schemaVersion": "crystra.workflow-directories@1.0.0",
  "directories": [
    { "path": "/absolute/path/to/workflow-collection", "kind": "collection" },
    { "path": "/absolute/path/to/one-workflow", "kind": "package" }
  ]
}
```

A `package` points at the editable package root containing `definition/package.json`.
A `collection` considers immediate child directories containing that envelope. It does
not recursively search arbitrary workspaces. A missing binding is an explicit unbound
state; an empty bound collection is a successful empty catalogue. Bindings can be
edited outside the browser and take effect through the same change query.

The read projection supports `agentops.workflow-dsl@2.0.0` metadata, follows the
envelope's declared `documents.workflow` inside `definition`, and reads its stable
`workflow.id`, name, version plus Package status. This is metadata parsing, not full
execution eligibility, graph validation or publication. Each identity has one bound
working copy; ambiguous duplicate identities fail rather than picking a directory.

Local content revision is `local:sha256:<digest>` over paths and bytes within the
package, including resources. It is distinct from the declared version displayed in
the sidebar and from a published execution revision. `.git`, `node_modules` and
`.DS_Store` are excluded. Symlinks are rejected, and files/scans have size/count limits.
Changes detected during a scan reject that observation; invalid definitions retain
last valid client data with an error instead of silently removing entries.

The existing DSH host registers `/crystra-workflows` with `list` and `changes({after})`.
Task and Workflow share the bounded revision-query transport, but keep separate owner
queries, stores and React hooks. Changes are detected by bounded long polling, including
external edits and binding changes. Sidebar and Explorer share one initial read.
Studio matches the exact identity plus local revision; an old URL reports a changed or
unbound version, never silently selecting current content. No historical local snapshots
or editable Studio panels are added in this step; Bench remains a placeholder.

The 3086 dev host mounts this same gateway. `CRYSTRA_WORKFLOW_BINDINGS` selects its
binding file; the default is ignored `dev/layout/workflow-directories.local.json`.
No directory is implicitly bound merely because it exists on the developer's machine.
Production mounting does not require a standalone service or an Execution runtime.

## Settings

The DSH-owned Settings dialog is opened by the sidebar footer and edits this binding
through `/crystra-workflows/settings/read` and `settings/save`. Save carries the read
revision; stale saves fail with `WORKFLOW_SETTINGS_CONFLICT`. The host validates local
absolute paths, directory kinds and duplicate canonical roots, then atomically replaces
the binding file under a writer lock. Invalid paths never replace the current binding.
A save changes only source selection; it does not edit or publish Workflow contents.

The UI preserves entered values on errors, offers explicit reload for conflicts, and
refreshes the shared Workflow resource after a successful save. Closing the modal
preserves the underlying route and restores keyboard focus to its sidebar trigger.
