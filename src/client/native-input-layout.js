/** Outer geometry only for the pinned DSH ui-layout 0.1.1-rc.2.
 * This reuses the dedicated runtime's Conversation; it never moves its DOM
 * or imports sessions from another instance. Requalify when the host changes.
 */
export const nativeInputLayoutStyles=`
.pI_x6G_frame {--crystra-sidebar-width:260px;}
@media(max-width:1439px){.pI_x6G_frame {--crystra-sidebar-width:220px;}}
.pI_x6G_frame:has(.crystra-product-shell[data-sidebar-collapsed="true"]){--crystra-sidebar-width:64px;}
.pI_x6G_frame:has([data-crystra-native-input="task"]) > .pI_x6G_centerCol {
 position:fixed;left:var(--crystra-sidebar-width);top:112px;bottom:0;
 width:max(360px,min(calc((100vw - var(--crystra-sidebar-width))*0.38),calc(100vw - var(--crystra-sidebar-width) - 680px)));
}
.crystra-product-overlay[data-crystra-native-input="task"],
.crystra-product-overlay[data-crystra-native-input="task"] .crystra-product-shell[data-product-surface],
.crystra-product-overlay[data-crystra-native-input="task"] .crystra-task-workbench {background:transparent;pointer-events:none;}
.crystra-product-overlay[data-crystra-native-input="task"] .crystra-product-shell > aside,
.crystra-product-overlay[data-crystra-native-input="task"] [data-section-id="workspace-header"],
.crystra-product-overlay[data-crystra-native-input="task"] [data-section-id="control-workspace"] {pointer-events:auto;background:var(--color-background-shell);}

.pI_x6G_frame:has([data-crystra-product-overlay]):not(:has([data-crystra-native-input])) > .pI_x6G_centerCol {display:none;}
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_sidebarCol,
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_detailsCol,
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_handle {display:none;}
.pI_x6G_frame:has([data-crystra-native-input="hero"]) > .pI_x6G_centerCol {
 position:fixed;left:var(--crystra-sidebar-width);right:0;top:0;bottom:0;
}
.crystra-product-overlay[data-crystra-native-input="hero"],
.crystra-product-overlay[data-crystra-native-input="hero"] .crystra-product-shell[data-product-surface] {
 background:transparent;pointer-events:none;
}
.crystra-product-overlay[data-crystra-native-input="hero"] .crystra-product-shell > aside {pointer-events:auto;}

`;
