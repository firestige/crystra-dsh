# Component main integration — 2026-10-02

The accepted UI is on `crystra-ui/main`, but its host and Execution dependencies
were not all on their component main branches. This change closes the development
submission gap. It is not a release qualification or a new UI acceptance claim.

| Component | Required source | Integration |
| --- | --- | --- |
| Contracts | `e387cfc6b3b10845507615766f79a0f92db699ce` | Exact prerelease Workflow package/snapshot validation; PR #21 is merged. |
| Execution | `147a3e6e6270c3ef5ede002a5f72ffaa9468eca8` | Restored local Workflow queries, Task admission/query and presentation metadata on current main, including the DSH provider migrated to 0.1.5-rc.2. |
| UI | `01c49ecf96cb55b11d341caef45a75d304b2dbe1` | Already on component main; no replacement UI implementation. |
| Evidence | `e23eec0` | Recorded-time trace queries and metadata already on component main. |
| Evolution | `6e69428` | Recorded-time evaluation and exact Workflow resolution already on component main. |
| DSH | This branch | Accepted 0.1.5 host integration, with updated exact Execution development artifact. |

Contracts and the initial component integration are merged. For the runtime update, merge Execution before DSH. Execution and UI source revisions
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

## DSH runtime alignment

The installed Execution artifact must admit `provider.dsh@0.1.5-rc.2`, matching
the host peer and compatibility policy. The artifact test rejects the former
0.1.1 provider even if its Task APIs are present. Execution qualifies its packed
library against real rc.2 sessions, including persistence and restoration.

`config/dsh-qualification-runtime.json` pins the qualification CLI and its DSH
components, plus the rc.2 Cordis foundation. The release workflow installs this
isolated runtime, and clean qualification profiles inherit the same overrides.
This prevents upstream version ranges from pulling later RCs or incompatible
HMR plugins. The machine's running host and global CLI are not modified.

The retired private Execution Intake browser fixture is no longer a product
acceptance claim. This component retains ownership of the current public host's
browser qualification; the runtime alignment does not claim a new complete
Task-to-Delivery browser acceptance or GA qualification.
