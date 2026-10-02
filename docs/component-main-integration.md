# Component main integration — 2026-10-02

The accepted UI is on `crystra-ui/main`, but its host and Execution dependencies
were not all on their component main branches. This change closes the development
submission gap. It is not a release qualification or a new UI acceptance claim.

| Component | Required source | Integration |
| --- | --- | --- |
| Contracts | `e387cfc6b3b10845507615766f79a0f92db699ce` | Exact prerelease Workflow package/snapshot validation; merge PR #21 first. |
| Execution | `0572430875bb6d5b32b9a67f9e7f9430fa83be44` | Restored local Workflow queries, Task admission/query and presentation metadata on current main, including DSH provider #47. |
| UI | `01c49ecf96cb55b11d341caef45a75d304b2dbe1` | Already on component main; no replacement UI implementation. |
| Evidence | `e23eec0` | Recorded-time trace queries and metadata already on component main. |
| Evolution | `6e69428` | Recorded-time evaluation and exact Workflow resolution already on component main. |
| DSH | This branch | Accepted 0.1.5 host integration, with updated exact Execution development artifact. |

Merge order is Contracts, Execution, then DSH. Execution and UI source revisions
and artifact hashes are pinned in `config/development-inputs.json` and recreated
by `inputs:prepare`; they are development inputs, not published release artifacts.
The original Execution commits remain on `codex/main-before-sync-20260929`.

The installed-artifact integration tests exercise the host Task gateway against
the real Execution owner: persistence after reconstruction, rename/pin, immutable
Task identity and stale-revision rejection. They also reject an old Execution
artifact that lacks the production DSH provider. Runtime registration is checked
without invoking live model inference.

The existing DSH 0.1.5 host implementation and its React/UI ownership boundaries
are retained. The earlier remote integration record explains its supersession of
the old host assembly. Historical checkpoint and acceptance documents are not
replayed over newer mainline acceptance status.

No release request is advanced, no package version is bumped, and no superproject
component pointer is updated. Superproject version selection is reserved for GA.
