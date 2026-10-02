# Conversation composition provenance

Upstream: https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-conversation

Exact module: `@deepseek-ai/dsh-client-ui-conversation@0.1.5-rc.2`.
The build embeds the published `lib/client.js` factory with a guarded hero seam.
`composeConversationSurface` adds a default-false flag to ConversationRoot. Only
in Crystra mode, the native HeroShell is omitted because ProductPages owns the
heading. The native Composer and Workspace picker are unchanged. The root slot
wrapper omits the duplicate native session header in Crystra mode.
SHA-256: `81314dfd95864f2522f8edb812e3f8e08b04a8ef2141913e6e8cbdaae1ffc37f`.
License: MIT, Copyright (c) 2026 DeepSeek. License text is retained in
`modules/execution/src/client/delivery-inventory/LICENSE.upstream`.

The composition intercepts only the `main:conversation` component registration,
retains its child declarations (in particular `main.conversation`), and supplies
Crystra's product frame. All other registrations, Session scope, Composer, Chat,
settings and controller lifecycle are upstream. The default `ui-conversation`
entry is disabled to prevent duplicate service/slot registration. Its Host-side
settings schema is registered by the root Crystra plugin.

Crystra neither creates a React root nor reparents DOM nodes. Browser module
loading retains the exact dependency identity. The standalone dev host reuses
Crystra components and supplies its own placeholder Chat.

## Sidebar surface switch

The exact `@deepseek-ai/dsh-client-ui-sidebar@0.1.5-rc.2` browser factory is also
embedded with a guarded banner-action composition seam (MIT, same upstream repository/license).
SHA-256: `171e3f0014e09c0f907e04e3a5503cae937bdd7169e3dc5f5c63e0e2671f64e0`.
Its registration retains all child declarations and injected props. The host's
surface mode selects either the original SidebarRoot/ConversationPanel pair or
the Crystra components. Native Workspace/Settings remain native. The return action replaces only the expanded native banner handler through
`scripts/lib/sidebar-banner-fork.mjs`; the original New Session button is unchanged.
The build fails if the exact upstream banner seam changes. No DOM hiding or page recreation
is used to approximate the native shell.
