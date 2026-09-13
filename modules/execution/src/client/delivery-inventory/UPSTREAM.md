# Fixed Workspace UI fork provenance

This feature is a composition fork of
`@deepseek-ai/dsh-client-ui-workspace@0.1.1-rc.2`. It invokes that exact
browser module while intercepting its single `sidebar.workspaces` registration
so the CRYSTRA shell owns the slot and renders the unmodified `WorkspaceBrowser`
component as a React child under Workspace. It performs no DOM reparenting.

- Upstream repository: `https://github.com/deepseek-ai/deepseek-harness.git`
- Upstream source directory: `packages/client/ui-workspace`
- npm package: `@deepseek-ai/dsh-client-ui-workspace@0.1.1-rc.2`
- npm tarball integrity: `sha512-k/jB5ke2e+oNyNKzu4/PBlriwCHKVg5bY3kn7Co3MtWZdqbJ42hfwZkRNMnn+nmziQXCVXWRzuiHZt0xNTAveA==`
- Installed upstream `lib/client.js` SHA-256: `75d8a09a43a820e0ff8470e7b9c87b6dced523764ee650a8382317f6ef7a314b`
- Installed upstream `package.json` SHA-256: `d8f1788dbd53719690bec6f236602a02aa1d213494e241c2aa8d645e4bf05706`
- Installed upstream `LICENSE` SHA-256: `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be`
- Upstream license: MIT; exact text is retained in `LICENSE.upstream`.

The CRYSTRA composition and Delivery code are Apache-2.0. The upstream Workspace
UI implementation remains MIT-licensed and is not copied into this directory.

