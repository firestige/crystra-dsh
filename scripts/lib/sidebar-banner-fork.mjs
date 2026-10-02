/** Exact 0.1.5-rc.2 SidebarRoot seam. Replace only the expanded brand action. */
export function composeSidebarBanner(source) {
 const signature='function SidebarRoot({ collapsed, width, startSession, toggleSidebar,';
 const anchor='className: clsx(SidebarRoot_module_css_default.brand, SidebarRoot_module_css_default.wide),\n\t\t\t\t\t\t\t';
 const action='"aria-label": t("session.new.label"),\n\t\t\t\t\t\t\tonClick: () => {\n\t\t\t\t\t\t\t\tstartSession();\n\t\t\t\t\t\t\t},';
 if(source.split(signature).length!==2 || source.split(anchor+action).length!==2) throw Error('SIDEBAR_BANNER_UPSTREAM_DRIFT');
 return source.replace(signature,'function SidebarRoot({ collapsed, width, startSession, onSwitchSurface, toggleSidebar,')
 .replace(anchor+action,anchor+'"aria-label": onSwitchSurface ? "返回 Crystra" : t("session.new.label"),\n\t\t\t\t\t\t\t"data-section-id": "surface-banner",\n\t\t\t\t\t\t\ttitle: onSwitchSurface ? "返回 Crystra" : void 0,\n\t\t\t\t\t\t\tonClick: () => {\n\t\t\t\t\t\t\t\tif (collapsed) toggleSidebar();\n\t\t\t\t\t\t\t\telse if (onSwitchSurface) onSwitchSurface();\n\t\t\t\t\t\t\t\telse startSession();\n\t\t\t\t\t\t\t},');
}
