# Crystra plugin boundaries

The root `dsh-crystra` package is the only public plugin. The target release and registration authority is `firestige/crystra-dsh`.

- `modules/execution` owns the DSH Execution adapter, Host integration and Delivery presentation.
- `modules/studio` owns the Studio Host gateway and client composition.
- Root Host/client entries compose both modules and preserve their Cordis lifecycle.

Execution, Delivery, Manifest, Runner, Evaluation, Evidence, Evolution, Workflow Package and shared Contracts remain in their component repositories. Ordinary component dependencies are allowed. Source-relative imports across repositories, copied domain implementations and reverse dependencies on a DSH plugin fail boundary checks.

The development input manifest binds exact component commits and archive digests until published new assets exist. Release candidates require immutable GitHub asset coordinates. Neither old release artifacts nor the combination repository's working tree are development inputs.

DSH owns its native Workspace sidebar. Crystra does not disable it, embed a Workspace composition fork, or append a Delivery accordion. React and ReactDOM resolve from the DSH host. The Crystra entry occupies the public brand-mark slot and adapts only the expanded banner button on the pinned DSH 0.1.1-rc.2 DOM. Its capture listener suppresses the native new-session click; the collapsed toggle remains host-owned. Disposing the slot removes the listener and restores the original accessible label. No footer entry is registered.

## Native banner acceptance

Run `CRYSTRA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-host-navigation.mjs http://127.0.0.1:3086` against a dedicated installed profile. This creates an isolated temporary workspace through the public workspace API, exercises native unsent drafts without sending a message, and checks mouse/Enter/Space round trips and both collapsed banners. It also checks that the native New Session action still receives its unprevented click. Use a test profile; workspace records are retained for inspection. The adapter baseline is guarded by a SidebarRoot SHA-256 test.
