# Fixed Workspace UI fork provenance

This feature is a composition fork of
`@deepseek-ai/dsh-client-ui-workspace@0.1.5-rc.2`. It invokes that exact
browser module while intercepting its single `sidebar.workspaces` registration
so the CRYSTRA shell owns the slot and renders the unmodified `WorkspaceBrowser`
component as a React child under Workspace. It performs no DOM reparenting.

- Upstream repository: `https://github.com/deepseek-ai/deepseek-harness.git`
- Upstream source directory: `packages/client/ui-workspace`
- npm package: `@deepseek-ai/dsh-client-ui-workspace@0.1.5-rc.2`
- npm tarball integrity: `sha512-BRe/RDIJJblCECYLwVroy8h4+cXrf3eXSfLjJ6BdpnW2fI3CBJuEKlFaBPGtKAFTTain0rQ+dP6SscZNrXm5Gw==`
- Installed upstream `lib/client.js` SHA-256: `383b9ef779366c13d818500b6488896328b189f156addbaa480c835e902edd5f`
- Installed upstream `package.json` SHA-256: `4681a07eed83ad42146938b1f97d1654d55808789a19060b05cee85b7a88d4ee`
- Installed upstream `LICENSE` SHA-256: `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be`
- Upstream license: MIT; exact text is retained in `LICENSE.upstream`.

The CRYSTRA composition and Delivery code are Apache-2.0. The upstream Workspace
UI implementation remains MIT-licensed and is not copied into this directory.

