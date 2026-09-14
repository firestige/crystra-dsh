/** Outer geometry only for the pinned DSH ui-layout 0.1.1-rc.2.
 * This reuses the dedicated runtime's Conversation; it never moves its DOM
 * or imports sessions from another instance. Requalify when the host changes.
 */
export const nativeInputLayoutStyles=`
.pI_x6G_frame:has([data-crystra-product-overlay]):not(:has([data-crystra-native-input="hero"])) > .pI_x6G_centerCol {display:none;}
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_sidebarCol,
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_detailsCol,
.pI_x6G_frame:has([data-crystra-product-overlay]) > .pI_x6G_handle {display:none;}
.pI_x6G_frame:has([data-crystra-native-input="hero"]) > .pI_x6G_centerCol {
 position:fixed;left:260px;right:0;top:0;bottom:0;
}
.crystra-product-overlay[data-crystra-native-input="hero"],
.crystra-product-overlay[data-crystra-native-input="hero"] .crystra-product-shell[data-product-surface] {
 background:transparent;pointer-events:none;
}
.crystra-product-overlay[data-crystra-native-input="hero"] .crystra-product-shell > aside {pointer-events:auto;}
@media(max-width:1439px){.pI_x6G_frame:has([data-crystra-native-input="hero"]) > .pI_x6G_centerCol {left:220px;}}
`;
