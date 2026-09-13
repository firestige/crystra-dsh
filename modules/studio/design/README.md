# Accepted Crystra Shell design

This directory is the DSH adapter's checked-in UI design input, not a new runtime protocol or a completed sidebar replacement. `sidebar.template.html` preserves the accepted v8 markup and sample rows; `shell-contract.json` records the host-owned interaction requirements. Do not inject the fixture as production data.

The complete authoritative design and CSS/token assets are in the Crystra superproject at `docs/design/crystra-ui/`. The shared primitives, widgets, icons, search controls and themes are owned by Crystra UI (`crystra-ui-core` remains the current package identity). Import only its public package exports; do not copy React components into this plugin or bypass its immutable package lock.

Host integration must replace the existing banner handler, preserve DSH Input ownership, route exact identities, restore focus and respect reduced motion. Source editing and resource events must use the future workspace service, not the fixture's in-memory demonstrations. Real sidebar routing, persistence, workflow services and Agent integration remain implementation work.

The reviewed Markdown preview uses the first-party `MarkdownText` component. The UI library receives a rendering capability; the host owns imports of DSH primitives. The preview host adapter in the UI repository is development-only, never a library dependency or production entry point.

No package version, release identity, dependency lock or runtime routing is changed by this design handoff. Adopting the new public UI build in the distributed plugin requires its normal qualification and dependency-pinning process.
