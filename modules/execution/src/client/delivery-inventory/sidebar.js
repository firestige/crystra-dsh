import { projectDeliveryInventory } from "./model.js";

const STYLE_ID = "dsh-crystra-execution-delivery-inventory";
const CSS = ".crystra-sidebar-resources{box-sizing:border-box;height:100%;min-height:0;flex:1 1 0;overflow:hidden;display:flex;flex-direction:column;gap:4px}.crystra-sidebar-resource{min-height:36px;flex:0 0 auto;overflow:hidden;display:flex;flex-direction:column}.crystra-sidebar-resource[data-expanded=true]{min-height:0;flex:1 1 0}.crystra-sidebar-resource-content{min-height:0;flex:1 1 auto;overflow:auto;overscroll-behavior:contain}.crystra-sidebar-resource-header{box-sizing:border-box;width:100%;height:36px;flex:0 0 36px;cursor:pointer;color:var(--dsw-alias-label-tertiary);background:transparent;border:0;border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 8px;font-size:13px;text-align:left}.crystra-sidebar-resource-header:hover{background:var(--dsw-alias-interactive-bg-hover)}.crystra-delivery-row{box-sizing:border-box;width:100%;height:32px;cursor:pointer;color:var(--dsw-alias-label-primary);background:transparent;border:0;border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 8px;font-size:14px;line-height:20px;text-align:left}.crystra-delivery-row:hover,.crystra-delivery-row[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover)}.crystra-delivery-row:disabled{cursor:default}.crystra-delivery-row>span:first-child{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;flex:1}.crystra-delivery-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}.crystra-delivery-status-recoverable{color:var(--dsw-alias-state-warning-primary)}";

function installStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.dataset.plugin = "dsh-crystra-execution";
  tag.textContent = CSS;
  document.head.append(tag);
}

function persisted(key) {
  try { return typeof localStorage === "undefined" || localStorage.getItem(key) !== "false"; }
  catch { return true; }
}

function persist(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, String(value)); }
  catch { /* browser storage is optional */ }
}

export function createSidebarResources(React, WorkspaceBrowser, inventory) {
  return function CrystraSidebarResources(props) {
    const [workspaceExpanded, setWorkspaceExpanded] = React.useState(() => persisted("crystra.sidebar.workspace.expanded.v1"));
    const [deliveryExpanded, setDeliveryExpanded] = React.useState(() => persisted("crystra.sidebar.delivery.expanded.v1"));
    const selectedSessionId = props.useSessions((state) => state.current);
    const state = React.useSyncExternalStore(inventory.subscribe, inventory.getSnapshot, inventory.getSnapshot);
    const view = React.useMemo(() => projectDeliveryInventory(state, { selectedSessionId }), [state, selectedSessionId]);
    const toggle = (kind) => {
      if (kind === "workspace") {
        const next = !workspaceExpanded;
        setWorkspaceExpanded(next);
        persist("crystra.sidebar.workspace.expanded.v1", next);
      } else {
        const next = !deliveryExpanded;
        setDeliveryExpanded(next);
        persist("crystra.sidebar.delivery.expanded.v1", next);
      }
    };
    const header = (id, label, expanded, kind) => React.createElement("button", {
      type: "button", className: "crystra-sidebar-resource-header",
      "aria-controls": id, "aria-expanded": expanded, onClick: () => toggle(kind),
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle(kind);
      },
    }, React.createElement("span", { "aria-hidden": "true" }, expanded ? "▾" : "▸"), label);
    return React.createElement("div", { className: "crystra-sidebar-resources", "data-crystra-sidebar-resources": "true" },
      React.createElement("section", { className: "crystra-sidebar-resource", "data-expanded": workspaceExpanded, "aria-label": "Workspace" },
        header("crystra-sidebar-workspace", "Workspace", workspaceExpanded, "workspace"),
        workspaceExpanded && React.createElement("div", { id: "crystra-sidebar-workspace", className: "crystra-sidebar-resource-content" }, React.createElement(WorkspaceBrowser, props))),
      React.createElement("section", { className: "crystra-sidebar-resource", "data-expanded": deliveryExpanded, "aria-label": "Delivery" },
        header("crystra-sidebar-delivery", "Delivery", deliveryExpanded, "delivery"),
        deliveryExpanded && React.createElement("div", {
          id: "crystra-sidebar-delivery", className: "crystra-sidebar-resource-content",
          role: view.kind === "error" ? "alert" : "region", "aria-live": "polite",
        }, view.kind === "ready"
          ? React.createElement("div", { role: "list", "aria-label": "Deliveries" }, view.rows.map((row) => React.createElement("button", {
              key: row.deliveryId, type: "button", role: "listitem", className: "crystra-delivery-row",
              "aria-current": row.selected ? "page" : undefined,
              "aria-label": `${row.label}, ${row.statusLabel}`,
              disabled: row.sessionId === null,
              onClick: row.sessionId === null ? undefined : () => props.open(row.sessionId),
            }, React.createElement("span", null, row.label), React.createElement("span", {
              className: `crystra-delivery-status crystra-delivery-status-${row.availability}`,
            }, row.statusLabel))))
          : React.createElement("div", { role: view.role }, view.label))));
  };
}

/** Fixed-version Workspace UI composition fork; CRYSTRA owns the single slot. */
export function applyDeliverySidebar(ctx, { React, workspaceUi, inventory }) {
  installStyle();
  const originalSlots = ctx.slots;
  const slots = Object.create(originalSlots);
  slots.register = (definition, component) => definition?.name === "sidebar.workspaces"
    ? originalSlots.register(definition, createSidebarResources(React, component, inventory))
    : originalSlots.register(definition, component);
  slots.inject = (name, factory) => originalSlots.inject(name, factory);
  const forked = new Proxy(ctx, { get(target, property) { return property === "slots" ? slots : Reflect.get(target, property); } });
  return workspaceUi.apply(forked);
}
