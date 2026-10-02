# Task Browser integration — 2026-09-26

Accepted UI baselines: Crystra-ui `d5783e1`, Crystra-dsh `4551b95`.
The Task Browser mounts through ProductPages in DSH 0.1.5 on port 3085.
Dev re-exports the same adapter. Crystra-ui owns display primitives and the
resource dialog; Crystra-dsh owns confirmation, upload preparation and shared
Task actions. Execution owns durable resource metadata, never Evidence.

## Resource commands

`/crystra-tasks/update` accepts `taskId`, `expectedRevision`, and one or more
of `displayTitle`, `pinned`, `archived`, `thumbnailPng` (base64 PNG or null).
Execution checks the Task exists and updates its presentation revision using
SQLite compare-and-swap. A stale revision fails without overwriting a newer
change. The client refreshes the shared Task resource after every attempt;
other windows receive changes through the existing revision subscription.

Rename changes only the display title (trimmed, 1–120 characters), preserving
Task identity, original goal, Delivery and Chat bindings. Pin sorts tasks first
within the current filter. Archive hides tasks from the default Browser and
Sidebar without stopping execution or deleting data. The archived view supports
restore. Batch operations report partial failures; Undo uses the resulting
revisions and refuses to overwrite newer edits.

Uploads accept PNG/JPEG/WebP/GIF up to 10MB and normalize to a static PNG with
maximum 320px edge in the browser. Execution independently validates PNG bounds,
CRC and inflated scanline size, limits stored images to 256KiB/512px, and stores
content-addressed assets alongside `tasks/presentation.sqlite`. Clearing a
thumbnail restores the default icon. Referenced assets are read inside the
metadata transaction; obsolete assets are reclaimed after successful updates.

Missing owner metadata (workspace, lifecycle, attention, cost, progress) remains
unknown. Resource commands do not start the runtime, alter the plan or send a
Chat prompt. No provider/model configuration changes are part of this feature.

## Verification

Execution: typecheck/build and 7 focused persistence/identity/conflict/asset tests.
UI: typecheck/build, 441 component tests and 34 layout tests, including shared menu and search regressions.
DSH: typecheck/build/foundation and 247 tests.
Real 3085: rename, Pin/unpin, upload, refresh persistence, archive/restore,
cross-window synchronization, List actions, default-image restore, selection
archive and Undo verified with isolated temporary Tasks. No user Task was edited.

Local artifacts are recorded by checksum in development-inputs.json. This is
local integration, not a package release. Workbench remains the accepted baseline.

Component implementation commits: Execution `f648298`, UI `20088ea`.
Menu presentations share interaction behavior; rename uses TextInput and the
resource dialog leaves descendant input/image styling to its content slot.
