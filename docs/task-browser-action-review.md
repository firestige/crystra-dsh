# Task Browser action review — 2026-09-26

The accepted dev Task Browser now mounts through ProductPages in the local
DSH 0.1.5 host on port 3085. Dev re-exports the same Crystra-dsh adapter.
Crystra-ui owns the reusable display components; the host adapter reads the
shared Execution Tasks resource. Production task links use /#/tasks/:id.
New Task and Sidebar creation use the same session-clear + navigation action.

Available for review: search, filter, descending sort, grouping/collapse,
Gallery/List, selection, pagination, task entry, New Task entry and menus.
Missing owner metadata (workspace, lifecycle, attention, cost, progress) remains
unknown and cannot qualify for active/attention filters. Task reads do not run
the runtime. Archive, rename, thumbnail and Pin writes are not implemented and
remain visibly disabled. This deployment does not assert that these writes work.

Verification: UI build, DSH build/foundation checks, 246 DSH tests; real host
loads 8 tasks, selection survives view switch, search works, task opens the
existing Workbench, New Task opens native Composer. No test prompt was sent.
Local working-tree artifacts are recorded by checksum in development-inputs;
this is not a release or a replacement acceptance of the Workbench baseline.
