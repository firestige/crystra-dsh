window.__ModuleLoader__.load({
  id: "dsh-crystra",
  factory: (platformRequire) => {
    const fixedWorkspaceUi = ((require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region lib/types/client/stores.js
		/**
		* The workspace browser's viewing store: the session-list grouping mode,
		* persisted across reloads. Module level exports the factory only (a
		* module-level handle would pin the store identity across plugin reloads);
		* register() receives the factory and the browser derives its PropsStore
		* share from the return type.
		*/
		/** Browser-local order account for the hierarchy-free flat Session list. */
		const FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
		/**
		* Create the workspace browser viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createWorkspaceViewStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					groupBy: "workspace",
					orderBy: "updated",
					groupExpansion: {},
					sessionOrderByAccount: {},
					sessionUpdatedAtByAccount: {}
				}),
				persist: "dsh.workspace.view.v5",
				actions: {
					setGroupBy: (d, mode) => {
						d.groupBy = mode;
					},
					setOrderBy: (d, mode) => {
						d.orderBy = mode;
					},
					setGroupExpanded: (d, key, expanded) => {
						d.groupExpansion[key] = expanded;
					},
					retainAccountKeys: (d, workspaceKeys) => {
						const retained = new Set(workspaceKeys);
						d.groupExpansion = Object.fromEntries(Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)));
						d.sessionOrderByAccount = Object.fromEntries(Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)));
						d.sessionUpdatedAtByAccount = Object.fromEntries(Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)));
					},
					syncSessionOrderAccount: (d, accountKey, order, updatedAt) => {
						d.sessionOrderByAccount[accountKey] = order;
						d.sessionUpdatedAtByAccount[accountKey] = updatedAt;
					},
					setSessionOrder: (d, accountKey, order) => {
						d.sessionOrderByAccount[accountKey] = order;
					}
				}
			});
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		/** Display label for the ungrouped bucket row. */
		const UNGROUPED_LABEL = "Ungrouped";
		/**
		* Directory display label: basename of the path (both separators accepted).
		* Ungrouped-bucket fallback for surfaces without a workspace title.
		* @param cwd - directory path, or undefined for the ungrouped bucket.
		* @returns basename, the raw cwd when it has no basename, or the ungrouped label.
		*/
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNGROUPED_LABEL;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/** Recency comparator: newest first, id as the deterministic tiebreak (ids are unique per group). */
		function byRecency(a, b) {
			if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
			return a.id < b.id ? -1 : 1;
		}
		/**
		* Ordinary sessions are visible; among blank sessions, only the current one
		* is visible. Subagent children use their parent header catalog; archived
		* sessions are visible nowhere, while their accounting slots remain so
		* unarchiving restores position.
		*/
		function sessionVisible(session, current, archived) {
			return session.origin !== "subagent" && !archived.has(session.id) && (!session.blank || session.id === current);
		}
		/**
		* A blank session is the selected Workspace's provisional New Session row;
		* its canonical title never enters search (blank rows are query-excluded)
		* and the renderer localizes its display label.
		*/
		function sessionTitle(session) {
			return session.blank ? "New Session" : session.displayTitle;
		}
		/** Build one group without projecting session lineage into presentation. */
		function buildGroup(key, workspaceId, cwd, createdAt, label, members, order) {
			const sessions = [...members];
			if (order === "recency") sessions.sort(byRecency);
			return {
				key,
				workspaceId,
				cwd,
				createdAt,
				label,
				sessions
			};
		}
		/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
		function orderedUngrouped(members, stored) {
			const byId = new Map(members.map((session) => [session.id, session]));
			const included = /* @__PURE__ */ new Set();
			const ordered = [];
			for (const key of stored) {
				const session = byId.get(key);
				if (session === void 0 || included.has(key)) continue;
				ordered.push(session);
				included.add(key);
			}
			for (const session of [...members].sort(byRecency)) {
				if (included.has(session.id)) continue;
				ordered.push(session);
			}
			return ordered;
		}
		/**
		* Group Sessions by Host Workspace: one group per entity in stable Host
		* order, with members resolved from sessionIds in their stored order. Sessions
		* outside every Workspace trail in the browser-local Ungrouped order, which
		* falls back to recency before that order is initialized.
		*/
		function groupByWorkspace(list, workspaces, archived, ungroupedOrder) {
			const groups = [];
			const accounted = /* @__PURE__ */ new Set();
			for (const workspace of workspaces) {
				const members = [];
				for (const id of workspace.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0) continue;
					accounted.add(id);
					if (!sessionVisible(summary, list.current, archived)) continue;
					members.push(summary);
				}
				groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members, "account"));
			}
			const stray = list.ids.map((id) => list.byId[id]).filter((s) => s !== void 0 && !accounted.has(s.id) && sessionVisible(s, list.current, archived));
			if (stray.length > 0) groups.push(buildGroup("", void 0, void 0, void 0, UNGROUPED_LABEL, ungroupedOrder === void 0 ? stray : orderedUngrouped(stray, ungroupedOrder), ungroupedOrder === void 0 ? "recency" : "account"));
			return groups;
		}
		function sessionNode(s, descendants) {
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: s.running,
				runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
				completed: s.completed === true,
				updatedAt: s.updatedAt,
				...s.pendingInteraction === void 0 ? {} : { pendingInteraction: s.pendingInteraction }
			};
		}
		/**
		* Derive the workspace browser groups with every session as a top-level row.
		*
		* Every group shows; sessions populate under expanded groups in the selected
		* local order. Blank sessions are excluded except for the selected
		* provisional New Session row; archived sessions are excluded everywhere.
		* Content search lives outside this derivation
		* (see {@link deriveSearchResults}).
		* @param list - sessions list snapshot (`current` feeds containsCurrent).
		* @param workspaces - real workspaces in stable Host order.
		* @param archivedSessionIds - registry-global archive set.
		* @param view - local expansion arrays.
		* @returns group sections in render order.
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, view) {
			const archived = new Set(archivedSessionIds);
			const expandedGroups = new Set(view.expandedGroups);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const currentGroup = list.current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(list.current))?.workspaceId ?? "";
			const groups = [];
			for (const g of groupByWorkspace(list, workspaces, archived, view.ungroupedOrder)) {
				const expanded = expandedGroups.has(g.key);
				groups.push({
					key: g.key,
					workspaceId: g.workspaceId,
					cwd: g.cwd,
					createdAt: g.createdAt,
					label: g.label,
					sessionCount: g.sessions.length,
					expanded,
					containsCurrent: g.key === currentGroup,
					sessions: expanded ? g.sessions.map((session) => sessionNode(session, descendants)) : []
				});
			}
			return groups;
		}
		/**
		* Derive the flat session list ("In one list" mode): every session — fork
		* children included — as a top-level row, strictly newest-first. No grouping,
		* no parent/child adjacency. Content search lives outside this derivation
		* (see {@link deriveSearchResults}).
		* @param list - sessions list snapshot.
		* @param archivedSessionIds - registry-global archive set.
		* @returns flat rows in render order.
		*/
		function deriveFlat(list, archivedSessionIds) {
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const rows = [];
			for (const id of list.ids) {
				const s = list.byId[id];
				if (s === void 0 || !sessionVisible(s, list.current, archived)) continue;
				rows.push(s);
			}
			rows.sort(byRecency);
			return rows.map((session) => sessionNode(session, descendants));
		}
		/**
		* Merge immediate title/Workspace substring matches with ranked Host content
		* matches. Local rows lead newest-first, content-only rows retain backend
		* order, and duplicate sessions receive the backend snippet in place.
		* @param list - session metadata authority.
		* @param workspaces - Workspace membership and display labels.
		* @param query - caller text; surrounding whitespace is ignored.
		* @param archivedSessionIds - registry-global archive set (members never match).
		* @param content - ranked Host content-search page.
		* @param limit - protocol-owned maximum merged row count.
		* @returns bounded deduplicated flat rows and a refine-query hint bit.
		*/
		function deriveSearchResults(list, workspaces, query, archivedSessionIds, content, limit) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				items: [],
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title);
			const labelOf = (summary) => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
			const contentBySession = /* @__PURE__ */ new Map();
			for (const item of content.items) if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, list.current, archived)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			local.sort(byRecency);
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of local) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary);
			}
			return {
				items: ordered.slice(0, limit).map((summary) => {
					const match = contentBySession.get(summary.id);
					return {
						id: summary.id,
						title: sessionTitle(summary),
						workspace: labelOf(summary),
						running: summary.running,
						runningSubagentCount: descendants.get(summary.id)?.runningCount ?? 0,
						...summary.pendingInteraction === void 0 ? {} : { pendingInteraction: summary.pendingInteraction },
						completed: summary.completed === true,
						...match === void 0 ? {} : { snippet: match.snippet }
					};
				}),
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/**
		* Compact relative time for session rows, as a structured bucket the
		* renderer localizes ("now"/"5min"/"3h"/"2d"/"4mo"/"1y" in en).
		* @param updatedAt - epoch ms of the session's last activity.
		* @param now - current epoch ms (injected for pure rendering).
		* @returns the row's trailing time bucket and magnitude.
		*/
		function relativeTime(updatedAt, now) {
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			const diff = Math.max(0, now - updatedAt);
			if (diff < MIN) return {
				unit: "now",
				n: 0
			};
			if (diff < HOUR) return {
				unit: "minutes",
				n: Math.floor(diff / MIN)
			};
			if (diff < DAY) return {
				unit: "hours",
				n: Math.floor(diff / HOUR)
			};
			if (diff < 30 * DAY) return {
				unit: "days",
				n: Math.floor(diff / DAY)
			};
			if (diff < 365 * DAY) return {
				unit: "months",
				n: Math.floor(diff / (30 * DAY))
			};
			return {
				unit: "years",
				n: Math.floor(diff / (365 * DAY))
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-workspace/src/client/rows/Rows.module.css.mjs
		const css$2 = ".YDXeBa_projectRow,.YDXeBa_sessionRow{cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:6px;padding:0 8px;display:flex}.YDXeBa_projectRow:hover,.YDXeBa_sessionRow:hover,.YDXeBa_sessionRow.YDXeBa_selected{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_searchResultRow{box-sizing:border-box;cursor:pointer;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:8px;flex-direction:column;align-items:stretch;padding:4px 8px;display:flex}.YDXeBa_searchResultRow:hover,.YDXeBa_searchResultRow.YDXeBa_selected{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_searchResultHeading{align-items:center;min-width:0;display:flex}.YDXeBa_searchResultTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;margin-left:4px;font-size:14px;line-height:20px;overflow:hidden}.YDXeBa_searchResultMeta{align-items:center;gap:6px;min-width:0;margin-left:20px;display:flex}.YDXeBa_searchResultWorkspace,.YDXeBa_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}.YDXeBa_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}.YDXeBa_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}.YDXeBa_projectRow{box-sizing:border-box;align-items:center;height:34px}.YDXeBa_projectRow .YDXeBa_rowActions{height:20px}.YDXeBa_sessionRow{height:32px;animation:YDXeBa_row-in .15s var(--ds-ease-in-out);gap:0}.YDXeBa_sessionRow .YDXeBa_title{margin:0 6px 0 4px}.YDXeBa_flatSessionRowWithoutStatus .YDXeBa_title{margin-left:0}@keyframes YDXeBa_row-in{0%{opacity:0}}.YDXeBa_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.YDXeBa_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.YDXeBa_folderActive{color:var(--dsw-alias-state-business-primary)}.YDXeBa_projectRow .YDXeBa_chevron{display:none}.YDXeBa_projectRow:hover .YDXeBa_chevron{display:inline-flex}.YDXeBa_projectRow:hover .YDXeBa_folder{display:none}.YDXeBa_arrow{transition:transform .15s var(--ds-ease-in-out)}.YDXeBa_arrowOpen{transform:rotate(90deg)}.YDXeBa_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.YDXeBa_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;overflow:hidden}.YDXeBa_renameInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;border-radius:4px;outline:none;padding:0 2px;font-size:14px;line-height:20px}.YDXeBa_sessionRow .YDXeBa_title{flex:1}.YDXeBa_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}.YDXeBa_time{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:20px}.YDXeBa_dot{flex:none}.YDXeBa_rowActions{flex:none;align-items:center;gap:12px;display:none}.YDXeBa_projectRow:hover .YDXeBa_rowActions,.YDXeBa_sessionRow:hover .YDXeBa_rowActions,.YDXeBa_projectRow.YDXeBa_menuOpen .YDXeBa_rowActions,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_rowActions{display:inline-flex}.YDXeBa_sessionRow:hover .YDXeBa_time,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_time{display:none}.YDXeBa_projectRow.YDXeBa_menuOpen,.YDXeBa_sessionRow.YDXeBa_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_sessionRow.YDXeBa_dropBefore,.YDXeBa_sessionRow.YDXeBa_dropAfter{position:relative}.YDXeBa_sessionRow.YDXeBa_dropBefore:before,.YDXeBa_sessionRow.YDXeBa_dropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}.YDXeBa_sessionRow.YDXeBa_dropBefore:before{top:-7px}.YDXeBa_sessionRow.YDXeBa_dropAfter:after{bottom:-7px}.YDXeBa_hoverContent{flex-direction:column;gap:8px;display:flex}.YDXeBa_hoverTitle{color:#fff;overflow-wrap:break-word;font-size:14px;line-height:20px}.YDXeBa_hoverPath{color:#cfd3d6;word-break:break-all;font-size:12px;line-height:16px}.YDXeBa_hoverTime{color:#cfd3d6;font-size:12px;line-height:16px}.YDXeBa_hoverStatus{color:#adb2b8;align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}.YDXeBa_iconButton{cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.YDXeBa_iconButton:hover{color:var(--dsw-alias-label-primary)}.YDXeBa_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){.YDXeBa_sessionRow,.YDXeBa_arrow{transition:none;animation:none}}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-workspace/Rows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var Rows_module_css_default = {
			"arrow": "YDXeBa_arrow",
			"arrowOpen": "YDXeBa_arrowOpen",
			"chevron": "YDXeBa_chevron",
			"dot": "YDXeBa_dot",
			"dropAfter": "YDXeBa_dropAfter",
			"dropBefore": "YDXeBa_dropBefore",
			"flatSessionRowWithoutStatus": "YDXeBa_flatSessionRowWithoutStatus",
			"folder": "YDXeBa_folder",
			"folderActive": "YDXeBa_folderActive",
			"hoverContent": "YDXeBa_hoverContent",
			"hoverPath": "YDXeBa_hoverPath",
			"hoverStatus": "YDXeBa_hoverStatus",
			"hoverTime": "YDXeBa_hoverTime",
			"hoverTitle": "YDXeBa_hoverTitle",
			"iconButton": "YDXeBa_iconButton",
			"menuOpen": "YDXeBa_menuOpen",
			"meta": "YDXeBa_meta",
			"projectRow": "YDXeBa_projectRow",
			"projectText": "YDXeBa_projectText",
			"renameInput": "YDXeBa_renameInput",
			"row-in": "YDXeBa_row-in",
			"rowActions": "YDXeBa_rowActions",
			"searchResultHeading": "YDXeBa_searchResultHeading",
			"searchResultMeta": "YDXeBa_searchResultMeta",
			"searchResultRow": "YDXeBa_searchResultRow",
			"searchResultSnippet": "YDXeBa_searchResultSnippet",
			"searchResultTitle": "YDXeBa_searchResultTitle",
			"searchResultWorkspace": "YDXeBa_searchResultWorkspace",
			"selected": "YDXeBa_selected",
			"sessionRow": "YDXeBa_sessionRow",
			"slot": "YDXeBa_slot",
			"time": "YDXeBa_time",
			"title": "YDXeBa_title",
			"visuallyHidden": "YDXeBa_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/rows/Rows.js
		/**
		* Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
		* all data and callbacks arrive via props. Hover swaps (folder->chevron,
		* time->ellipsis, action buttons) are CSS-only. Row ... menus are visual-only
		* except workspace Rename/Delete and session Rename/Fork/Archive; the session
		* and workspace hover cards are suppressed while a menu is open.
		*/
		/** Row display title: blank rows show the localized New Session label. */
		function displayTitle(node, t) {
			return node.blank ? t("session.new") : node.title;
		}
		/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
		function timeLabel(updatedAt, now, t) {
			const { unit, n } = relativeTime(updatedAt, now);
			return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
		}
		/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
		function hoverTimeLabel(updatedAt, now, t) {
			const { unit, n } = relativeTime(updatedAt, now);
			return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
		}
		/**
		* Absolute creation time through the dictionary's date template (the message
		* clock pattern): `toLocaleString` would follow the browser language, not the
		* app locale, and produce mixed-language text after a switch.
		*/
		function createdLabel(createdAt, t) {
			const d = new Date(createdAt);
			const pad2 = (v) => String(v).padStart(2, "0");
			return t("hover.created", { time: `${t("date.ymd", {
				y: d.getFullYear(),
				m: d.getMonth() + 1,
				d: d.getDate()
			})} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
		}
		/** Hover-card body: workspace title, display directory path, absolute creation time. */
		function WorkspaceHoverContent({ label, cwd, createdAt, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: label
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverPath,
						children: cwd
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: createdLabel(createdAt, t)
					})
				]
			});
		}
		/** Pointer-position half of a row (insert line above or below). */
		function rowHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/**
		* Project (workspace) header row: folder + title;
		* hover reveals the chevron and create button, and dwelling on a real
		* Workspace shows its hover card (the ungrouped bucket has none).
		* `containsCurrent` arrives on the node (derivation fact, no renderer scan).
		* @param props.group - derived group node.
		* @param props.onToggle - expand/collapse the group.
		* @param props.onCreate - start a frontend Session inside this Workspace.
		* @param props.drag - optional workspace-row drag wiring.
		* @param props.home - host account home for POSIX hover-path abbreviation.
		* @param props.t - the browser root's locale seat.
		* @returns the row element.
		*/
		function ProjectRowItem({ group, onToggle, onCreate, actions, drag, home, t }) {
			const row = group;
			const label = row.workspaceId === void 0 ? t("group.ungrouped") : row.label;
			const active = group.expanded && group.containsCurrent;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const workspaceMenuItems = [{
				id: "rename",
				label: t("rename"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
			}, {
				id: "delete",
				label: t("delete.workspace"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
				danger: true
			}];
			const ownRow = (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(Rows_module_css_default.projectRow, menuOpen && Rows_module_css_default.menuOpen),
				role: "treeitem",
				"aria-expanded": row.expanded,
				onClick: onToggle,
				draggable: drag !== void 0,
				onDragStart: drag === void 0 ? void 0 : (e) => {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", row.key);
					drag.start();
				},
				onDragEnd: drag?.end,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.folder, active && Rows_module_css_default.folderActive),
						children: row.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, {})
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.chevron),
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, { className: clsx(Rows_module_css_default.arrow, row.expanded && Rows_module_css_default.arrowOpen) })
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.projectText,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.title,
							children: label
						})
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: Rows_module_css_default.rowActions,
						children: [actions !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: workspaceMenuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								/* v8 ignore next -- workspaceMenuItems carries exactly these two rows today. */
								if (id !== "rename" && id !== "delete") return;
								if (id === "rename") actions.rename();
								else actions.delete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Rows_module_css_default.iconButton,
								"aria-label": t("actions.workspace.aria", { name: label }),
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
							})
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Rows_module_css_default.iconButton,
							"aria-label": t("actions.newSession.aria", { name: label }),
							onClick: (e) => {
								e.stopPropagation();
								onCreate();
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {})
						})]
					})
				]
			});
			if (row.createdAt === void 0) return ownRow;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: ownRow,
				content: (0, react_jsx_runtime.jsx)(WorkspaceHoverContent, {
					label: row.label,
					cwd: row.cwd === void 0 ? void 0 : (0, _deepseek_ai_dsh_client_runtime_client.abbreviateHomePath)(row.cwd, home),
					createdAt: row.createdAt,
					t
				}),
				disabled: menuOpen,
				copyText: row.cwd,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
		function assertNever(value) {
			throw new Error(`unknown pending interaction: ${String(value)}`);
		}
		/**
		* Session status presentation; pending interaction is primary and live activity
		* outranks completion reminders.
		*/
		function sessionStatuses(node, t) {
			const subagents = node.runningSubagentCount === 0 ? void 0 : {
				state: "ongoing",
				label: t(node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: node.runningSubagentCount })
			};
			let pending;
			switch (node.pendingInteraction) {
				case "approval":
					pending = {
						state: "warning",
						label: t("status.waitingApproval")
					};
					break;
				case "plan-review":
					pending = {
						state: "warning",
						label: t("status.planReview")
					};
					break;
				case "question":
					pending = {
						state: "warning",
						label: t("status.waitingAnswer")
					};
					break;
				case void 0: break;
				/* v8 ignore next -- closed PendingInteractionStatus union */
				default: return assertNever(node.pendingInteraction);
			}
			if (pending !== void 0) return subagents === void 0 ? [pending] : [pending, subagents];
			if (node.running) {
				const primary = {
					state: "ongoing",
					label: t("status.running")
				};
				return subagents === void 0 ? [primary] : [primary, subagents];
			}
			if (subagents !== void 0) return [subagents];
			if (node.completed) return [{
				state: "done",
				label: t("status.completed")
			}];
			return [{
				state: "done",
				label: t("status.idle")
			}];
		}
		/** Primary status dot plus every status's screen-reader label, shared by the search and session rows. */
		function SessionStatusDots({ statuses }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statuses[0].state }), statuses.map((status) => (0, react_jsx_runtime.jsx)("span", {
				className: Rows_module_css_default.visuallyHidden,
				children: status.label
			}, status.label))] });
		}
		/** Hover-card body: full title, relative time, and every relevant live status. */
		function SessionHoverContent({ node, now, t }) {
			const statuses = sessionStatuses(node, t);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: displayTitle(node, t)
					}),
					!node.blank && (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: hoverTimeLabel(node.updatedAt, now, t)
					}),
					statuses.map((status) => (0, react_jsx_runtime.jsxs)("div", {
						className: Rows_module_css_default.hoverStatus,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: status.state }), (0, react_jsx_runtime.jsx)("span", { children: status.label })]
					}, status.label))
				]
			});
		}
		/**
		* One flat search result: title, Workspace context, and optional content
		* excerpt. Search navigation opens the session only; it does not address an
		* event inside the conversation.
		* @param props.result - merged local/content search row.
		* @param props.currentId - selected session id.
		* @param props.onOpen - open the selected session.
		* @param props.t - Workspace-browser translation seat.
		* @returns the result button.
		*/
		function SearchResultItem({ result, currentId, onOpen, t }) {
			const selected = result.id === currentId;
			const statuses = sessionStatuses(result, t);
			const primaryStatus = statuses[0];
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: clsx(Rows_module_css_default.searchResultRow, selected && Rows_module_css_default.selected),
				role: "treeitem",
				"aria-selected": selected,
				onClick: () => {
					onOpen(result.id);
				},
				children: [(0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultHeading,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.slot,
						children: (primaryStatus.state !== "done" || result.completed) && (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses })
					}), (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultTitle,
						children: result.title
					})]
				}), (0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultMeta,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultWorkspace,
						children: result.workspace
					}), result.snippet !== void 0 && (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultSnippet,
						children: result.snippet
					})]
				})]
			});
		}
		/**
		* One top-level 34px session row: status dot (pending user interaction outranks
		* own or descendant activity), title, relative time, and the row actions menu.
		* @param props.node - derived session node.
		* @param props.currentId - selected session id (row highlight).
		* @param props.now - epoch ms for relative-time formatting.
		* @param props.onOpen - open a session by id.
		* @param props.onRename - open the session rename dialog (id + current title).
		* @param props.onFork - fork a session at its last completed turn.
		* @param props.onArchive - archive a session by id.
		* @param props.drag - optional draggable-row wiring.
		* @param props.flat - omit the empty status slot in the hierarchy-free flat list.
		* @param props.t - the browser root's locale seat.
		* @returns the session row.
		*/
		function SessionNodeItem({ node, currentId, now, onOpen, onRename, onFork, onArchive, drag, flat = false, t }) {
			const row = node;
			const title = displayTitle(node, t);
			const selected = node.id === currentId;
			const statuses = sessionStatuses(node, t);
			const showStatus = statuses[0].state !== "done" || row.completed;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const sessionMenuItems = [
				{
					id: "rename",
					label: t("rename"),
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
				},
				{
					id: "fork",
					label: t("menu.fork"),
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {})
				},
				{
					id: "archive",
					label: t("menu.archiveSession"),
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 16 })
				}
			];
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: (0, react_jsx_runtime.jsxs)("div", {
					className: clsx(Rows_module_css_default.sessionRow, selected && Rows_module_css_default.selected, menuOpen && Rows_module_css_default.menuOpen, flat && !showStatus && Rows_module_css_default.flatSessionRowWithoutStatus, drag?.marker === "before" && Rows_module_css_default.dropBefore, drag?.marker === "after" && Rows_module_css_default.dropAfter),
					role: "treeitem",
					"aria-selected": selected,
					onClick: () => {
						onOpen(node.id);
					},
					draggable: drag !== void 0,
					onDragStart: drag === void 0 ? void 0 : (e) => {
						e.dataTransfer.effectAllowed = "move";
						e.dataTransfer.setData("text/plain", node.id);
						drag.start();
					},
					onDragEnd: drag?.end,
					onDragOver: drag === void 0 ? void 0 : (e) => {
						if (!drag.active) return;
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
						drag.hover(rowHalf(e));
					},
					onDrop: drag === void 0 ? void 0 : (e) => {
						if (!drag.active) return;
						e.preventDefault();
						drag.drop(rowHalf(e));
					},
					children: [
						(!flat || showStatus) && (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.slot,
							children: showStatus && (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses })
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.title,
							children: title
						}),
						!row.blank && (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.time,
							children: timeLabel(row.updatedAt, now, t)
						}),
						!row.blank && (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.rowActions,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								onClose: () => {
									setMenuOpen(false);
								},
								items: sessionMenuItems,
								onSelect: (id) => {
									setMenuOpen(false);
									if (id === "rename") onRename(node.id, row.title);
									if (id === "fork") onFork(node.id);
									if (id === "archive") onArchive(node.id);
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Rows_module_css_default.iconButton,
									"aria-label": t("actions.session.aria", { name: title }),
									onClick: (e) => {
										e.stopPropagation();
										setMenuOpen((v) => !v);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutline16, {})
								})
							})
						})
					]
				}),
				content: (0, react_jsx_runtime.jsx)(SessionHoverContent, {
					node,
					now,
					t
				}),
				disabled: menuOpen || drag?.active === true,
				copyText: row.blank ? void 0 : row.title,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-workspace/src/client/WorkspacePicker.module.css.mjs
		const css$1 = "._G5b-a_modalAction{min-width:72px}._G5b-a_modalError,._G5b-a_menuStatus{margin-top:8px;font-size:12px;line-height:18px}._G5b-a_modalError{color:var(--dsw-alias-state-error-primary)}._G5b-a_menuStatus{color:var(--dsw-alias-label-secondary)}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-workspace/WorkspacePicker.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var WorkspacePicker_module_css_default = {
			"menuStatus": "_G5b-a_menuStatus",
			"modalAction": "_G5b-a_modalAction",
			"modalError": "_G5b-a_modalError"
		};
		//#endregion
		//#region lib/types/client/WorkspacePicker.js
		const ADD_WORKSPACE = "::add-workspace";
		/**
		* Render the pick menu plus the adoption error dialog.
		* @param props - owner-controlled flow props.
		* @returns menu + dialog elements.
		*/
		function WorkspacePickFlow({ t, open, anchorRef, useWorkspaces, createWorkspace, useDirectoryFlow, renderDirectoryFlow, onPick, onClose, addOnly = false, side = "bottom", selectedId }) {
			const workspaceSnapshot = useWorkspaces((state) => state);
			const workspaces = workspaceSnapshot.items;
			const getAnchorRect = (0, react.useCallback)(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
			const [errorOpen, setErrorOpen] = (0, react.useState)(false);
			const [modalError, setModalError] = (0, react.useState)(null);
			const [flowOpen, setFlowOpen] = (0, react.useState)(false);
			const [pickingFolder, setPickingFolder] = (0, react.useState)(false);
			const flowBusy = flowOpen || pickingFolder;
			const flowAvailable = useDirectoryFlow((occupied) => occupied);
			(0, react.useEffect)(() => {
				if (flowOpen && !flowAvailable) setFlowOpen(false);
			}, [flowOpen, flowAvailable]);
			const addEntries = flowAvailable ? [{
				id: ADD_WORKSPACE,
				label: t("menu.addWorkspace"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 16 }),
				disabled: flowBusy
			}] : [];
			const pinAdd = !addOnly && workspaces.length > 0;
			const items = pinAdd ? workspaces.map((workspace) => ({
				id: workspace.workspaceId,
				label: workspace.title,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }),
				disabled: flowBusy
			})) : addEntries;
			const menuIsEmpty = items.length === 0;
			const closeModal = () => {
				setErrorOpen(false);
				setModalError(null);
			};
			/** Adopt a picked directory; failures land in the folder-error dialog (Choose again reopens the flow). */
			const adoptDirectory = (path) => createWorkspace({ path }).then((workspace) => {
				setFlowOpen(false);
				onPick(workspace.workspaceId);
			}).catch((reason) => {
				setModalError(reason instanceof Error ? reason.message : String(reason));
				setFlowOpen(false);
				setErrorOpen(true);
			});
			const openDirectoryFlow = (0, react.useCallback)(() => {
				onClose();
				setErrorOpen(false);
				setModalError(null);
				setFlowOpen(true);
			}, [onClose]);
			const listSettled = addOnly || workspaceSnapshot.phase === "ready";
			const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
			(0, react.useEffect)(() => {
				if (open && addIsTheOnlyEntry && !flowBusy) openDirectoryFlow();
			}, [
				open,
				addIsTheOnlyEntry,
				flowBusy,
				openDirectoryFlow
			]);
			/** Owner side of the flow conversation: adopt keeps the flow open (busy) until the Host answers. */
			const flowOwner = {
				open: flowOpen,
				busy: pickingFolder,
				onPicked: (path) => {
					setPickingFolder(true);
					adoptDirectory(path).finally(() => {
						setPickingFolder(false);
					});
				},
				onCancel: () => {
					setFlowOpen(false);
				},
				onError: (message) => {
					setFlowOpen(false);
					setModalError(message);
					setErrorOpen(true);
				}
			};
			const handleSelect = (id) => {
				if (id === ADD_WORKSPACE) {
					openDirectoryFlow();
					return;
				}
				onPick(id);
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open: open && !addIsTheOnlyEntry && !menuIsEmpty,
					anchor: null,
					items,
					...pinAdd ? { footer: addEntries } : {},
					selectedId,
					onSelect: handleSelect,
					onClose,
					side,
					portal: true,
					getAnchorRect
				}),
				open && !addIsTheOnlyEntry && !menuIsEmpty && workspaceSnapshot.phase === "pending" && (0, react_jsx_runtime.jsx)("div", {
					className: WorkspacePicker_module_css_default.menuStatus,
					role: "status",
					children: t("picker.loading")
				}),
				renderDirectoryFlow(flowOwner),
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: errorOpen,
					onClose: closeModal,
					closeLabel: t("close"),
					title: t("folderError.title"),
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: WorkspacePicker_module_css_default.modalAction,
						onClick: closeModal,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: WorkspacePicker_module_css_default.modalAction,
						disabled: !flowAvailable,
						onClick: openDirectoryFlow,
						children: t("folderError.retry")
					})] }),
					children: (0, react_jsx_runtime.jsx)("div", {
						className: WorkspacePicker_module_css_default.modalError,
						role: "alert",
						children: modalError
					})
				})
			] });
		}
		/**
		* The conversation empty-state registration: adapts the owner share to the
		* core flow (all state and semantics live in the flow / the owner).
		* @param props - empty-state slot props (owner share + injected creation callback).
		* @returns the flow element.
		*/
		function WorkspacePicker({ open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, useDirectoryFlow, renderSlot, t }) {
			return (0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
				t,
				open,
				anchorRef,
				useWorkspaces,
				createWorkspace,
				useDirectoryFlow,
				renderDirectoryFlow: (owner) => renderSlot("conversation.hero.workspace.directoryFlow", owner),
				selectedId,
				onPick,
				onClose
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-workspace/src/client/WorkspaceBrowser.module.css.mjs
		const css = ".qDHVXG_root{--dsh-session-list-edge-inset:var(--dsh-sidebar-inline-padding);--dsh-session-list-scrollbar-width:8px;--dsh-session-list-scrollbar-offset:2px;box-sizing:border-box;min-height:0;padding-right:var(--dsh-session-list-edge-inset);flex-direction:column;flex:1;display:flex}.qDHVXG_root.qDHVXG_rail{padding-right:0}.qDHVXG_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.qDHVXG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.qDHVXG_sectionHeader{box-sizing:border-box;height:36px;color:var(--dsw-alias-label-tertiary);border-radius:12px;flex:none;justify-content:flex-end;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;display:flex;overflow:hidden}.qDHVXG_root:not(.qDHVXG_rail) .qDHVXG_sectionHeader{margin-top:2px;margin-right:-4px}.qDHVXG_sectionLabel{white-space:nowrap;opacity:1;visibility:visible;min-width:0;max-width:45%;transition:max-width .18s var(--ds-ease-in-out), margin-right .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;line-height:20px;overflow:hidden}.qDHVXG_sectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.qDHVXG_searchSlot{box-sizing:border-box;min-width:0;max-width:28px;transition:max-width .18s var(--ds-ease-in-out), padding-left .18s var(--ds-ease-in-out);flex:1;align-items:center;margin-left:auto;padding-left:0;display:flex}.qDHVXG_searchSlotExpanded{max-width:100%;padding-left:0}.qDHVXG_headerActions{opacity:1;visibility:visible;max-width:60px;transition:max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.qDHVXG_headerActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.qDHVXG_search{box-sizing:border-box;cursor:text;width:100%;height:28px;color:var(--dsw-alias-label-secondary);transition:width .18s var(--ds-ease-in-out), padding .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out), background-color .18s var(--ds-ease-in-out);background:0 0;border:none;border-radius:50%;flex:none;align-items:center;gap:0;margin:0;padding:0;display:flex;overflow:hidden}.qDHVXG_searchExpanded{border:1px solid var(--dsw-alias-border-l2);width:calc(100% + 4px);height:30px;color:var(--dsw-alias-label-caption);background:0 0;border-radius:10px;margin-inline:-2px;padding:0 4px 0 0}.qDHVXG_searchButton{cursor:pointer;width:28px;height:28px;color:inherit;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.qDHVXG_searchExpanded .qDHVXG_searchButton{width:28px;height:30px}.qDHVXG_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.qDHVXG_searchExpanded .qDHVXG_searchButton:hover{background:0 0}.qDHVXG_searchInput{opacity:0;pointer-events:none;width:0;min-width:0;color:var(--dsw-alias-label-primary);transition:opacity .12s var(--ds-ease-in-out);background:0 0;border:none;outline:none;flex:1;font-size:13px;line-height:18px}.qDHVXG_searchExpanded .qDHVXG_searchInput{opacity:1;pointer-events:auto;margin-left:-2px}.qDHVXG_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.qDHVXG_clearButton{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.qDHVXG_clearButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.qDHVXG_rail .qDHVXG_sectionHeader{justify-content:flex-start;gap:0;margin-bottom:12px;padding-left:0}.qDHVXG_rail .qDHVXG_headerActions{max-width:none}.qDHVXG_rail .qDHVXG_iconButton{width:36px;height:36px;color:var(--dsw-alias-label-primary)}.qDHVXG_rail .qDHVXG_search{background:0 0;border-color:#0000;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.qDHVXG_rail .qDHVXG_searchButton{width:36px;height:36px;color:var(--dsw-alias-label-primary)}.qDHVXG_rail .qDHVXG_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.qDHVXG_listArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-session-list-edge-inset));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.qDHVXG_rail .qDHVXG_listArea{margin-left:0;margin-right:0;padding-left:0}.qDHVXG_treeBody{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.qDHVXG_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}.qDHVXG_wide{animation:qDHVXG_wide-in .2s var(--ds-ease-in-out)}@keyframes qDHVXG_wide-in{0%{opacity:0}}.qDHVXG_list{min-height:0;margin-left:-4px;margin-right:var(--dsh-session-list-scrollbar-offset);padding-left:4px;padding-right:calc(var(--dsh-session-list-edge-inset) - var(--dsh-session-list-scrollbar-width) - var(--dsh-session-list-scrollbar-offset));scrollbar-gutter:stable;flex:1;padding-bottom:16px;overflow-y:auto}.qDHVXG_flatList>*+*,.qDHVXG_searchTree>[role=treeitem]+[role=treeitem],.qDHVXG_groupSection>*+*{margin-top:2px}.qDHVXG_searchStatus,.qDHVXG_searchWarning{color:var(--dsw-alias-label-tertiary);padding:10px 12px;font-size:12px;line-height:18px}.qDHVXG_searchWarning{color:var(--dsw-alias-label-secondary)}.qDHVXG_groupSection{position:relative}.qDHVXG_groupSection+.qDHVXG_groupSection{margin-top:4px}.qDHVXG_listTopDropIndicator,.qDHVXG_workspaceDropBefore:before,.qDHVXG_workspaceDropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:0}.qDHVXG_listTopDropIndicator{top:-8px;left:0;right:var(--dsh-session-list-edge-inset)}.qDHVXG_listTopDropActive>.qDHVXG_workspaceDropBefore:first-child:before{display:none}.qDHVXG_workspaceDropBefore:before{top:-8px}.qDHVXG_workspaceDropAfter:after{bottom:-8px}.qDHVXG_sessionOverflowButton{cursor:pointer;text-align:left;width:100%;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;padding:0 12px 0 28px;font-size:12px}.qDHVXG_groupSection>.qDHVXG_sessionOverflowButton{margin-top:0}.qDHVXG_sessionOverflowButton:hover{color:var(--dsw-alias-label-secondary);background:0 0}.qDHVXG_empty{color:var(--dsw-alias-label-tertiary);padding:16px 12px;font-size:13px}.qDHVXG_renameInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;border-radius:22px;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.qDHVXG_renameInput:disabled{color:var(--dsw-alias-label-dimmed)}.qDHVXG_renameError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}.qDHVXG_deleteAction:not(:disabled){color:var(--dsw-alias-state-error-primary)}.qDHVXG_deleteStatus{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}@media (prefers-reduced-motion:reduce){.qDHVXG_wide{animation:none}.qDHVXG_search,.qDHVXG_sectionLabel,.qDHVXG_searchSlot,.qDHVXG_searchInput,.qDHVXG_headerActions{transition:none}}";
		const tagId = "@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WorkspaceBrowser_module_css_default = {
			"clearButton": "qDHVXG_clearButton",
			"deleteAction": "qDHVXG_deleteAction",
			"deleteStatus": "qDHVXG_deleteStatus",
			"empty": "qDHVXG_empty",
			"fade": "qDHVXG_fade",
			"flatList": "qDHVXG_flatList",
			"groupSection": "qDHVXG_groupSection",
			"headerActions": "qDHVXG_headerActions",
			"headerActionsHidden": "qDHVXG_headerActionsHidden",
			"iconButton": "qDHVXG_iconButton",
			"list": "qDHVXG_list",
			"listArea": "qDHVXG_listArea",
			"listTopDropActive": "qDHVXG_listTopDropActive",
			"listTopDropIndicator": "qDHVXG_listTopDropIndicator",
			"rail": "qDHVXG_rail",
			"renameError": "qDHVXG_renameError",
			"renameInput": "qDHVXG_renameInput",
			"root": "qDHVXG_root",
			"search": "qDHVXG_search",
			"searchButton": "qDHVXG_searchButton",
			"searchExpanded": "qDHVXG_searchExpanded",
			"searchInput": "qDHVXG_searchInput",
			"searchSlot": "qDHVXG_searchSlot",
			"searchSlotExpanded": "qDHVXG_searchSlotExpanded",
			"searchStatus": "qDHVXG_searchStatus",
			"searchTree": "qDHVXG_searchTree",
			"searchWarning": "qDHVXG_searchWarning",
			"sectionHeader": "qDHVXG_sectionHeader",
			"sectionLabel": "qDHVXG_sectionLabel",
			"sectionLabelHidden": "qDHVXG_sectionLabelHidden",
			"sessionOverflowButton": "qDHVXG_sessionOverflowButton",
			"treeBody": "qDHVXG_treeBody",
			"wide": "qDHVXG_wide",
			"wide-in": "qDHVXG_wide-in",
			"workspaceDropAfter": "qDHVXG_workspaceDropAfter",
			"workspaceDropBefore": "qDHVXG_workspaceDropBefore"
		};
		//#endregion
		//#region lib/types/client/WorkspaceBrowser.js
		/**
		* The workspace/session browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + view options + add
		* workspace), search, the grouped tree or flat list, and the workspace
		* dialogs. Wide state renders the full browser; rail state renders the two
		* region icons (search / add workspace) as 36px controls on the shell's shared
		* rail entry path, each requesting expansion through the owner share. Adding
		* is the header button's one action, so it raises the directory flow with no
		* menu in between; the flow and its error dialog live in WorkspacePicker
		* (same package — direct composition, no slot between them).
		*/
		/**
		* Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
		* focus() forces a synchronous layout and would jank the slide.
		*/
		const EXPAND_SLIDE_MS = 300;
		/** Pause between the latest keystroke and a Host content-search request. */
		const SEARCH_DEBOUNCE_MS = 250;
		/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		/** Session rows visible per Workspace before the local overflow control. */
		const COLLAPSED_SESSION_LIMIT = 5;
		/** Keep controlled input and RPC payload inside the session.search wire contract. */
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			let end = SEARCH_QUERY_MAX_CODE_UNITS;
			const last = withoutNul.charCodeAt(end - 1);
			const next = withoutNul.charCodeAt(end);
			if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
			return withoutNul.slice(0, end);
		}
		/** Immutable membership toggle for the local expand-all array. */
		function toggled(list, key) {
			return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
		}
		/**
		* Accept the native drag at document level while a row drag is active: row
		* hover still owns the insertion marker, and releasing outside the list must
		* not be rendered as a rejected drop before dragend commits that last marker.
		*/
		function useNativeDragAcceptance(active) {
			(0, react.useEffect)(() => {
				if (!active) return;
				const acceptDrag = (event) => {
					event.preventDefault();
					if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
				};
				const acceptDrop = (event) => {
					event.preventDefault();
				};
				document.addEventListener("dragover", acceptDrag);
				document.addEventListener("drop", acceptDrop);
				return () => {
					document.removeEventListener("dragover", acceptDrag);
					document.removeEventListener("drop", acceptDrop);
				};
			}, [active]);
		}
		/** Reconcile a stored view order with the Workspace's current session account. */
		function reconciledSessionOrder(sessionIds, stored) {
			if (stored === void 0) return [...sessionIds];
			const byId = new Map(sessionIds.map((id) => [id, id]));
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			for (const key of stored) {
				const id = byId.get(key);
				if (id === void 0 || included.has(key)) continue;
				ordered.push(id);
				included.add(key);
			}
			for (const id of sessionIds) {
				if (included.has(id)) continue;
				ordered.push(id);
			}
			return ordered;
		}
		/** Newest update first with stable Session identity as the tie-break. */
		function compareSessionRecency(a, b, byId) {
			const aUpdatedAt = byId[a]?.updatedAt ?? Number.NEGATIVE_INFINITY;
			const bUpdatedAt = byId[b]?.updatedAt ?? Number.NEGATIVE_INFINITY;
			if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt;
			return a < b ? -1 : 1;
		}
		/** Reconcile one editable order account and apply its activity-promotion policy. */
		function nextSessionOrderAccount({ sessionIds, previousOrder, previousUpdatedAt, list, orderBy, sortByRecency }) {
			let order = reconciledSessionOrder(sessionIds, previousOrder);
			if (sortByRecency) order.sort((a, b) => compareSessionRecency(a, b, list.byId));
			else if (orderBy === "updated") {
				const promoted = sessionIds.filter((id) => {
					const session = list.byId[id];
					return session !== void 0 && (previousUpdatedAt[id] === void 0 || session.updatedAt > previousUpdatedAt[id]);
				}).sort((a, b) => compareSessionRecency(a, b, list.byId));
				if (promoted.length > 0) {
					const promotedIds = new Set(promoted);
					order = [...promoted, ...order.filter((id) => !promotedIds.has(id))];
				}
			}
			const updatedAt = {};
			for (const id of sessionIds) {
				const session = list.byId[id];
				if (session !== void 0) updatedAt[id] = session.updatedAt;
			}
			const orderChanged = previousOrder === void 0 || order.length !== previousOrder.length || order.some((id, index) => id !== previousOrder[index]);
			const timestampsChanged = Object.keys(updatedAt).length !== Object.keys(previousUpdatedAt).length || Object.entries(updatedAt).some(([id, timestamp]) => previousUpdatedAt[id] !== timestamp);
			return {
				order,
				updatedAt,
				changed: orderChanged || timestampsChanged
			};
		}
		/** Grouping and ordering menu; own open state so it resets with the wide chrome. */
		function ViewOptionsMenu({ groupBy, orderBy, onGroupPick, onOrderPick, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [
					{
						type: "label",
						id: "group-by",
						text: t("groupBy.label")
					},
					{
						id: "workspace",
						label: t("groupBy.workspace")
					},
					{
						id: "flat",
						label: t("groupBy.flat")
					},
					{
						type: "separator",
						id: "order-by-separator"
					},
					{
						type: "label",
						id: "order-by",
						text: t("orderBy.label")
					},
					{
						id: "manual",
						label: t("orderBy.manual")
					},
					{
						id: "updated",
						label: t("orderBy.updated")
					}
				],
				selectedIds: [groupBy, orderBy],
				onSelect: (id) => {
					if (id === "workspace" || id === "flat") onGroupPick(id);
					else if (id === "manual" || id === "updated") onOrderPick(id);
					setOpen(false);
				},
				align: "end",
				dense: true,
				portal: true,
				anchor: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("viewOptions.label"),
					side: "bottom",
					delayMs: 500,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(WorkspaceBrowser_module_css_default.iconButton, WorkspaceBrowser_module_css_default.wide),
						"aria-label": t("viewOptions.label"),
						onClick: () => {
							setOpen((v) => !v);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutline16, {})
					})
				})
			});
		}
		/** Resolve an insertion side from the full rendered workspace group. */
		function workspaceGroupHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/** The scrolling session tree; unmounting drops the sessions subscription and expand-all state. */
		function SessionTree({ useSessions, startSession, open, forkSession, workspaces, archivedSessionIds, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, insertWorkspaceBefore, insertSessionBefore, orderBy, groupExpansion, setGroupExpanded, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, home, t }) {
			const list = useSessions((s) => s);
			const current = list.current;
			const [expandedSessionGroups, setExpandedSessionGroups] = (0, react.useState)([]);
			const [drag, setDrag] = (0, react.useState)(null);
			const sessionDropCommitted = (0, react.useRef)(false);
			const [workspaceDrag, setWorkspaceDrag] = (0, react.useState)(null);
			const workspaceDropCommitted = (0, react.useRef)(false);
			const previousOrderBy = (0, react.useRef)(orderBy);
			useNativeDragAcceptance(drag !== null || workspaceDrag !== null);
			const currentGroup = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId ?? "";
			(0, react.useEffect)(() => {
				if (current === void 0 || currentGroup === void 0 || Object.hasOwn(groupExpansion, currentGroup)) return;
				setGroupExpanded(currentGroup, true);
			}, [
				current,
				currentGroup,
				setGroupExpanded,
				groupExpansion
			]);
			const expandedGroups = (0, react.useMemo)(() => Object.entries(groupExpansion).filter(([, expanded]) => expanded).map(([key]) => key), [groupExpansion]);
			const ungroupedSessionIds = (0, react.useMemo)(() => {
				const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
				return list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id));
			}, [list, workspaces]);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready") return;
				const switchedToUpdated = previousOrderBy.current !== "updated" && orderBy === "updated";
				previousOrderBy.current = orderBy;
				const accounts = [...workspaces.map((workspace) => ({
					key: workspace.workspaceId,
					sessionIds: workspace.sessionIds.filter((id) => list.byId[id] !== void 0)
				})), {
					key: "",
					sessionIds: ungroupedSessionIds
				}];
				for (const { key, sessionIds } of accounts) {
					const previousOrder = sessionOrderByAccount[key];
					const next = nextSessionOrderAccount({
						sessionIds,
						previousOrder,
						previousUpdatedAt: sessionUpdatedAtByAccount[key] ?? {},
						list,
						orderBy,
						sortByRecency: orderBy === "updated" && (previousOrder === void 0 || switchedToUpdated)
					});
					if (next.changed) syncSessionOrderAccount(key, next.order.map((id) => id), next.updatedAt);
				}
			}, [
				list,
				orderBy,
				sessionOrderByAccount,
				sessionUpdatedAtByAccount,
				syncSessionOrderAccount,
				ungroupedSessionIds,
				workspaces
			]);
			const orderedWorkspaces = (0, react.useMemo)(() => {
				return workspaces.map((workspace) => {
					const stored = sessionOrderByAccount[workspace.workspaceId];
					const sessionIds = reconciledSessionOrder(workspace.sessionIds, stored);
					return {
						...workspace,
						sessionIds
					};
				});
			}, [sessionOrderByAccount, workspaces]);
			const orderedUngroupedSessionIds = (0, react.useMemo)(() => reconciledSessionOrder(ungroupedSessionIds, sessionOrderByAccount[""]), [sessionOrderByAccount, ungroupedSessionIds]);
			const groups = (0, react.useMemo)(() => deriveGroups(list, orderedWorkspaces, archivedSessionIds, {
				expandedGroups,
				...sessionOrderByAccount[""] === void 0 ? {} : { ungroupedOrder: sessionOrderByAccount[""] }
			}), [
				list,
				orderedWorkspaces,
				archivedSessionIds,
				expandedGroups,
				sessionOrderByAccount
			]);
			const now = Date.now();
			const commitSessionDrag = (activeDrag, over) => {
				if (sessionDropCommitted.current) return;
				sessionDropCommitted.current = true;
				setDrag(null);
				const group = groups.find((candidate) => candidate.key === activeDrag.accountKey);
				if (group === void 0) return;
				const targetIndex = group.sessions.findIndex((session) => session.id === over.id);
				if (targetIndex === -1) return;
				const anchor = over.half === "before" ? over.id : group.sessions[targetIndex + 1]?.id;
				if (anchor === activeDrag.sessionId) return;
				const sourceIndex = group.sessions.findIndex((session) => session.id === activeDrag.sessionId);
				const anchorIndex = anchor === void 0 ? group.sessions.length : group.sessions.findIndex((session) => session.id === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				const accountSessionIds = activeDrag.accountKey === "" ? orderedUngroupedSessionIds : orderedWorkspaces.find((workspace) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
				if (accountSessionIds === void 0) return;
				const nextOrder = accountSessionIds.filter((id) => id !== activeDrag.sessionId);
				const insertAt = anchor === void 0 ? nextOrder.length : nextOrder.indexOf(anchor);
				nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId);
				setSessionOrder(activeDrag.accountKey, nextOrder.map((id) => id));
				if (orderBy === "updated" || activeDrag.accountKey === "") return;
				insertSessionBefore(activeDrag.accountKey, activeDrag.sessionId, anchor).catch((reason) => {
					console.warn("session reorder rejected:", reason);
				});
			};
			const commitWorkspaceDrag = (activeDrag, over) => {
				if (workspaceDropCommitted.current) return;
				workspaceDropCommitted.current = true;
				setWorkspaceDrag(null);
				const rowIndex = workspaces.findIndex((workspace) => workspace.workspaceId === over.id);
				if (rowIndex === -1) return;
				const anchor = over.half === "before" ? over.id : workspaces[rowIndex + 1]?.workspaceId;
				if (anchor === activeDrag.workspaceId) return;
				const sourceIndex = workspaces.findIndex((workspace) => workspace.workspaceId === activeDrag.workspaceId);
				const anchorIndex = anchor === void 0 ? workspaces.length : workspaces.findIndex((workspace) => workspace.workspaceId === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
					console.warn("workspace reorder rejected:", reason);
				});
			};
			const workspaceDropAtListStart = groups[0]?.workspaceId !== void 0 && workspaceDrag?.over?.id === groups[0].workspaceId && workspaceDrag.over.half === "before";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [
					workspaceDropAtListStart && (0, react_jsx_runtime.jsx)("span", {
						className: WorkspaceBrowser_module_css_default.listTopDropIndicator,
						"aria-hidden": "true"
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: clsx(WorkspaceBrowser_module_css_default.list, workspaceDropAtListStart && WorkspaceBrowser_module_css_default.listTopDropActive),
						role: "tree",
						"aria-label": t("section.sessions"),
						children: [groups.length === 0 && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							children: t("empty.none")
						}), groups.map((group) => {
							const workspaceId = group.workspaceId;
							const workspaceMarker = workspaceId !== void 0 && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
							const workspaceDragProps = workspaceId === void 0 ? void 0 : {
								start: () => {
									workspaceDropCommitted.current = false;
									setWorkspaceDrag({
										workspaceId,
										over: null
									});
								},
								end: () => {
									if (workspaceDrag?.over !== null && workspaceDrag?.over !== void 0) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
									else setWorkspaceDrag(null);
									workspaceDropCommitted.current = false;
								}
							};
							const hoverWorkspace = workspaceId === void 0 ? void 0 : (half) => {
								setWorkspaceDrag((active) => active === null ? active : {
									...active,
									over: {
										id: workspaceId,
										half
									}
								});
							};
							const dropWorkspace = workspaceId === void 0 ? void 0 : (half) => {
								if (workspaceDrag === null) return;
								commitWorkspaceDrag(workspaceDrag, {
									id: workspaceId,
									half
								});
							};
							return (0, react_jsx_runtime.jsxs)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.groupSection, workspaceMarker === "before" && WorkspaceBrowser_module_css_default.workspaceDropBefore, workspaceMarker === "after" && WorkspaceBrowser_module_css_default.workspaceDropAfter),
								onDragOver: workspaceDrag === null || hoverWorkspace === void 0 ? void 0 : (e) => {
									e.preventDefault();
									e.dataTransfer.dropEffect = "move";
									hoverWorkspace(workspaceGroupHalf(e));
								},
								onDrop: workspaceDrag === null || dropWorkspace === void 0 ? void 0 : (e) => {
									e.preventDefault();
									dropWorkspace(workspaceGroupHalf(e));
								},
								children: [
									(0, react_jsx_runtime.jsx)(ProjectRowItem, {
										group,
										home,
										t,
										onToggle: () => {
											if (group.expanded) setExpandedSessionGroups((keys) => keys.filter((key) => key !== group.key));
											setGroupExpanded(group.key, !group.expanded);
										},
										onCreate: () => {
											if (group.workspaceId !== void 0) {
												setGroupExpanded(group.key, true);
												startSession(group.workspaceId);
											}
										},
										drag: workspaceDragProps,
										actions: group.workspaceId === void 0 ? void 0 : {
											rename: () => {
												/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
												if (group.workspaceId !== void 0) onRenameRequest(group.workspaceId, group.label);
											},
											delete: () => {
												/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
												if (group.workspaceId !== void 0) onDeleteRequest(group.workspaceId, group.label);
											}
										}
									}),
									(expandedSessionGroups.includes(group.key) ? group.sessions : group.sessions.slice(0, COLLAPSED_SESSION_LIMIT)).map((node) => {
										const sameGroupDrag = drag !== null && drag.accountKey === group.key;
										return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
											node,
											currentId: current,
											now,
											onOpen: open,
											onRename: onSessionRename,
											onFork: forkSession,
											onArchive: onSessionArchive,
											drag: {
												start: () => {
													sessionDropCommitted.current = false;
													setDrag({
														accountKey: group.key,
														sessionId: node.id,
														over: null
													});
												},
												active: sameGroupDrag,
												marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
												hover: (half) => {
													/* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
													setDrag((d) => d === null ? d : {
														...d,
														over: {
															id: node.id,
															half
														}
													});
												},
												drop: (half) => {
													/* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
													if (drag === null) return;
													commitSessionDrag(drag, {
														id: node.id,
														half
													});
												},
												end: () => {
													if (drag?.over !== null && drag?.over !== void 0) commitSessionDrag(drag, drag.over);
													else setDrag(null);
													sessionDropCommitted.current = false;
												}
											},
											t
										}, node.id);
									}),
									group.sessions.length > COLLAPSED_SESSION_LIMIT && (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: WorkspaceBrowser_module_css_default.sessionOverflowButton,
										"aria-expanded": expandedSessionGroups.includes(group.key),
										onClick: () => {
											setExpandedSessionGroups((keys) => toggled(keys, group.key));
										},
										children: expandedSessionGroups.includes(group.key) ? t("sessions.collapse") : t("sessions.expand", { n: group.sessions.length - COLLAPSED_SESSION_LIMIT })
									})
								]
							}, group.key);
						})]
					}),
					(0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })
				]
			});
		}
		/** The flat "In one list" body: every session is one draggable top-level row. */
		function FlatList({ useSessions, open, forkSession, onSessionRename, onSessionArchive, archivedSessionIds, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, t }) {
			const list = useSessions((s) => s);
			const baseRows = (0, react.useMemo)(() => deriveFlat(list, archivedSessionIds), [list, archivedSessionIds]);
			const sessionIds = (0, react.useMemo)(() => baseRows.map((row) => row.id), [baseRows]);
			const previousOrderBy = (0, react.useRef)(orderBy);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready") return;
				const previousOrder = sessionOrderByAccount[FLAT_SESSION_ORDER_KEY];
				const previousUpdatedAt = sessionUpdatedAtByAccount["__flat_session_order__"] ?? {};
				const switchedToUpdated = previousOrderBy.current !== "updated" && orderBy === "updated";
				previousOrderBy.current = orderBy;
				const next = nextSessionOrderAccount({
					sessionIds,
					previousOrder,
					previousUpdatedAt,
					list,
					orderBy,
					sortByRecency: orderBy === "updated" && (previousOrder === void 0 || switchedToUpdated)
				});
				if (next.changed) syncSessionOrderAccount(FLAT_SESSION_ORDER_KEY, next.order.map((id) => id), next.updatedAt);
			}, [
				list,
				orderBy,
				sessionOrderByAccount,
				sessionUpdatedAtByAccount,
				sessionIds,
				syncSessionOrderAccount
			]);
			const rows = (0, react.useMemo)(() => {
				const byId = new Map(baseRows.map((row) => [row.id, row]));
				return reconciledSessionOrder(sessionIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY]).flatMap((id) => {
					const row = byId.get(id);
					return row === void 0 ? [] : [row];
				});
			}, [
				baseRows,
				sessionOrderByAccount,
				sessionIds
			]);
			const [drag, setDrag] = (0, react.useState)(null);
			const dropCommitted = (0, react.useRef)(false);
			useNativeDragAcceptance(drag !== null);
			const commitDrag = (activeDrag, over) => {
				if (dropCommitted.current) return;
				dropCommitted.current = true;
				setDrag(null);
				const targetIndex = rows.findIndex((row) => row.id === over.id);
				if (targetIndex === -1) return;
				const anchor = over.half === "before" ? over.id : rows[targetIndex + 1]?.id;
				if (anchor === activeDrag.sessionId) return;
				const sourceIndex = rows.findIndex((row) => row.id === activeDrag.sessionId);
				const anchorIndex = anchor === void 0 ? rows.length : rows.findIndex((row) => row.id === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				const nextOrder = rows.map((row) => row.id).filter((id) => id !== activeDrag.sessionId);
				const insertAt = anchor === void 0 ? nextOrder.length : nextOrder.indexOf(anchor);
				nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId);
				setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder.map((id) => id));
			};
			const now = Date.now();
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: clsx(WorkspaceBrowser_module_css_default.list, WorkspaceBrowser_module_css_default.flatList),
					role: "tree",
					"aria-label": t("section.sessions"),
					children: [rows.length === 0 && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.empty,
						children: t("empty.none")
					}), rows.map((node) => {
						const active = drag !== null;
						return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
							node,
							currentId: list.current,
							now,
							onOpen: open,
							onRename: onSessionRename,
							onFork: forkSession,
							onArchive: onSessionArchive,
							flat: true,
							drag: {
								start: () => {
									dropCommitted.current = false;
									setDrag({
										accountKey: FLAT_SESSION_ORDER_KEY,
										sessionId: node.id,
										over: null
									});
								},
								active,
								marker: active && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									setDrag((current) => current === null ? current : {
										...current,
										over: {
											id: node.id,
											half
										}
									});
								},
								drop: (half) => {
									if (drag !== null) commitDrag(drag, {
										id: node.id,
										half
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitDrag(drag, drag.over);
									else setDrag(null);
									dropCommitted.current = false;
								}
							},
							t
						}, node.id);
					})]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/** Flat search body: local metadata matches plus the current Host result page. */
		function SearchResults({ useSessions, open, workspaces, archivedSessionIds, query, remote, resultLimit, t }) {
			const list = useSessions((s) => s);
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const results = (0, react.useMemo)(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, currentRemote, resultLimit), [
				list,
				workspaces,
				query,
				archivedSessionIds,
				currentRemote,
				resultLimit
			]);
			const pending = currentRemote.status === "loading";
			const failed = currentRemote.status === "error";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: WorkspaceBrowser_module_css_default.list,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchTree,
							role: "tree",
							"aria-label": t("search.results.aria"),
							children: results.items.map((result) => (0, react_jsx_runtime.jsx)(SearchResultItem, {
								result,
								currentId: list.current,
								onOpen: open,
								t
							}, result.id))
						}),
						pending && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							role: "status",
							children: t("search.pending")
						}),
						failed && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchWarning,
							role: "status",
							children: t("search.unavailable")
						}),
						!pending && results.items.length === 0 && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							children: t("search.noMatches")
						}),
						results.hasMore && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							children: t("search.hasMore", { n: resultLimit })
						})
					]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function WorkspaceBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, searchSessions, searchResultLimit, useDirectoryFlow, useHostDescription, renderSlot, t }) {
			const home = useHostDescription((description) => description?.home);
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const directoryFlowAvailable = useDirectoryFlow((occupied) => occupied);
			const groupBy = useStore((s) => s.groupBy);
			const orderBy = useStore((s) => s.orderBy);
			const groupExpansion = useStore((s) => s.groupExpansion);
			const sessionOrderByAccount = useStore((s) => s.sessionOrderByAccount);
			const sessionUpdatedAtByAccount = useStore((s) => s.sessionUpdatedAtByAccount);
			const currentBlankSessionId = useSessions((state) => {
				const current = state.current;
				return current !== void 0 && state.byId[current]?.blank === true ? current : void 0;
			});
			const currentBlankAccount = currentBlankSessionId === void 0 ? void 0 : workspaces.find((workspace) => workspace.sessionIds.includes(currentBlankSessionId))?.workspaceId ?? "";
			const promotedBlank = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				if (currentBlankSessionId === void 0 || currentBlankAccount === void 0) {
					promotedBlank.current = void 0;
					return;
				}
				if (promotedBlank.current?.sessionId === currentBlankSessionId && promotedBlank.current.accountKey === currentBlankAccount) return;
				promotedBlank.current = {
					sessionId: currentBlankSessionId,
					accountKey: currentBlankAccount
				};
				for (const accountKey of new Set([currentBlankAccount, FLAT_SESSION_ORDER_KEY])) {
					const previous = sessionOrderByAccount[accountKey] ?? [];
					actions.setSessionOrder(accountKey, [currentBlankSessionId, ...previous.filter((id) => id !== currentBlankSessionId)]);
				}
			}, [
				actions.setSessionOrder,
				currentBlankAccount,
				currentBlankSessionId,
				sessionOrderByAccount
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainAccountKeys([
					"",
					FLAT_SESSION_ORDER_KEY,
					...workspaces.map((workspace) => workspace.workspaceId)
				]);
			}, [
				actions.retainAccountKeys,
				workspacePhase,
				workspaces
			]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchRoot = (0, react.useRef)(null);
			const searchInput = (0, react.useRef)(null);
			const [wsPickerOpen, setWsPickerOpen] = (0, react.useState)(false);
			const wsPlusRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			const [searchOnExpand, setSearchOnExpand] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (wide && searchOnExpand) {
					const timer = window.setTimeout(() => {
						searchInput.current?.focus({ preventScroll: true });
						setSearchOnExpand(false);
					}, EXPAND_SLIDE_MS);
					return () => {
						window.clearTimeout(timer);
					};
				}
			}, [wide, searchOnExpand]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded || searchOnExpand) return;
				searchInput.current?.focus({ preventScroll: true });
			}, [
				wide,
				searchExpanded,
				searchOnExpand
			]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded || searchOnExpand) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded,
				searchOnExpand
			]);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const closeRename = () => {
				if (renaming) return;
				setRenameTarget(null);
				setRenameError(null);
			};
			const confirmRename = () => {
				if (renameBlocked) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const closeSessionRename = () => {
				if (sessionRenaming) return;
				setSessionRenameTarget(null);
				setSessionRenameError(null);
			};
			const confirmSessionRename = () => {
				if (sessionRenameBlocked) return;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					setSessionRenaming(false);
					setSessionRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionRename = (sessionId, currentTitle) => {
				setSessionRenameTarget({
					sessionId,
					currentTitle
				});
				setSessionRenameDraft(currentTitle);
				setSessionRenameError(null);
			};
			const onSessionArchive = (sessionId) => {
				archiveSession(sessionId).catch((reason) => {
					console.warn("session archive rejected:", reason);
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteCommittedId, setDeleteCommittedId] = (0, react.useState)(null);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (deleteCommittedId === null || workspaces.some((workspace) => workspace.workspaceId === deleteCommittedId)) return;
				setDeleting(false);
				setDeleteCommittedId(null);
				setDeleteTarget(null);
			}, [deleteCommittedId, workspaces]);
			const closeDelete = () => {
				if (deleting) return;
				setDeleteTarget(null);
				setDeleteError(null);
			};
			const confirmDelete = () => {
				/* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteCommittedId(null);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleteCommittedId(deleteTarget.workspaceId);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.root, !wide && WorkspaceBrowser_module_css_default.rail),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: WorkspaceBrowser_module_css_default.sectionHeader,
						children: [
							wide && (0, react_jsx_runtime.jsx)("span", {
								className: clsx(WorkspaceBrowser_module_css_default.sectionLabel, WorkspaceBrowser_module_css_default.wide, searchExpanded && WorkspaceBrowser_module_css_default.sectionLabelHidden),
								children: groupBy === "flat" ? t("section.sessions") : t("section.workspaces")
							}),
							wide && (0, react_jsx_runtime.jsx)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.searchSlot, searchExpanded && WorkspaceBrowser_module_css_default.searchSlotExpanded),
								children: (0, react_jsx_runtime.jsxs)("div", {
									ref: searchRoot,
									className: clsx(WorkspaceBrowser_module_css_default.search, searchExpanded && WorkspaceBrowser_module_css_default.searchExpanded),
									onClick: () => {
										setWsPickerOpen(false);
										setSearchExpanded(true);
										searchInput.current?.focus();
									},
									children: [
										(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("search"),
											side: "bottom",
											delayMs: 500,
											disabled: searchExpanded,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: WorkspaceBrowser_module_css_default.searchButton,
												"aria-label": t("search.sessions.aria"),
												"aria-expanded": searchExpanded,
												onClick: () => {
													setWsPickerOpen(false);
													setSearchExpanded(true);
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: searchExpanded ? 11 : 14 })
											})
										}),
										(0, react_jsx_runtime.jsx)("input", {
											ref: searchInput,
											className: WorkspaceBrowser_module_css_default.searchInput,
											type: "text",
											placeholder: t("search.placeholder"),
											maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
											value: query,
											tabIndex: searchExpanded ? 0 : -1,
											onChange: (e) => {
												setQuery(sanitizeSearchQuery(e.target.value));
											},
											onKeyDown: (e) => {
												if (e.key !== "Escape") return;
												setQuery("");
												setSearchExpanded(false);
											}
										}),
										searchExpanded && (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: WorkspaceBrowser_module_css_default.clearButton,
											"aria-label": t("search.clear"),
											onClick: (e) => {
												e.stopPropagation();
												setQuery("");
												setSearchExpanded(false);
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, {})
										})
									]
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.headerActions, wide && searchExpanded && WorkspaceBrowser_module_css_default.headerActionsHidden),
								children: [wide && (0, react_jsx_runtime.jsx)(ViewOptionsMenu, {
									groupBy,
									orderBy,
									onGroupPick: (mode) => {
										actions.setGroupBy(mode);
									},
									onOrderPick: (mode) => {
										actions.setOrderBy(mode);
									},
									t
								}), directoryFlowAvailable && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("workspace.add"),
									side: "bottom",
									delayMs: 500,
									children: (0, react_jsx_runtime.jsx)("button", {
										ref: wsPlusRef,
										type: "button",
										className: WorkspaceBrowser_module_css_default.iconButton,
										"aria-label": t("workspace.add"),
										onClick: () => {
											setWsPickerOpen((v) => !v);
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutline16, { size: wide ? 16 : 18 })
									})
								})]
							}),
							(0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
								t,
								open: wsPickerOpen,
								anchorRef: wsPlusRef,
								useWorkspaces,
								createWorkspace,
								useDirectoryFlow,
								renderDirectoryFlow: (owner) => renderSlot("sidebar.workspaces.directoryFlow", owner),
								addOnly: true,
								side: "right",
								onPick: (workspaceId) => {
									setWsPickerOpen(false);
									startSession(workspaceId);
								},
								onClose: () => {
									setWsPickerOpen(false);
								}
							})
						]
					}),
					!wide && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.search,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: WorkspaceBrowser_module_css_default.searchButton,
								"aria-label": t("search.sessions.aria"),
								onClick: () => {
									setSearchExpanded(true);
									setSearchOnExpand(true);
									expandSidebar();
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 18 })
							})
						})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.listArea,
						children: wide && (normalizedQuery !== "" ? (0, react_jsx_runtime.jsx)(SearchResults, {
							useSessions,
							open,
							workspaces,
							archivedSessionIds,
							query: normalizedQuery,
							remote: remoteSearch,
							resultLimit: searchResultLimit,
							t
						}) : groupBy === "flat" ? (0, react_jsx_runtime.jsx)(FlatList, {
							useSessions,
							open,
							forkSession,
							onSessionRename,
							onSessionArchive,
							archivedSessionIds,
							orderBy,
							sessionOrderByAccount,
							sessionUpdatedAtByAccount,
							syncSessionOrderAccount: actions.syncSessionOrderAccount,
							setSessionOrder: actions.setSessionOrder,
							t
						}) : (0, react_jsx_runtime.jsx)(SessionTree, {
							useSessions,
							onSessionRename,
							onSessionArchive,
							forkSession,
							workspaces,
							groupExpansion,
							setGroupExpanded: actions.setGroupExpanded,
							sessionOrderByAccount,
							sessionUpdatedAtByAccount,
							syncSessionOrderAccount: actions.syncSessionOrderAccount,
							setSessionOrder: actions.setSessionOrder,
							archivedSessionIds,
							startSession,
							open,
							insertWorkspaceBefore,
							insertSessionBefore,
							orderBy,
							home,
							t,
							onRenameRequest: (workspaceId, currentTitle) => {
								setRenameTarget({
									workspaceId,
									currentTitle
								});
								setRenameDraft(currentTitle);
								setRenameError(null);
							},
							onDeleteRequest: (workspaceId, title) => {
								setDeleteTarget({
									workspaceId,
									title
								});
								setDeleteError(null);
							}
						}))
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: closeRename,
						closeLabel: t("close"),
						title: t("rename.workspace.title"),
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: renaming,
							onClick: closeRename,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("rename")
						})] }),
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								className: WorkspaceBrowser_module_css_default.renameInput,
								value: renameDraft,
								"aria-label": t("field.workspaceName"),
								autoFocus: true,
								disabled: renaming,
								onFocus: (e) => {
									e.target.select();
								},
								onChange: (e) => {
									setRenameDraft(e.target.value);
									setRenameError(null);
								},
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								},
								onKeyDown: (e) => {
									if (e.key === "Enter" && !composingRef.current) {
										e.preventDefault();
										confirmRename();
									}
								}
							}),
							renameDuplicate && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: t("conflict.named", { name: renameTrimmed })
							}),
							renameError !== null && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: renameError
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: sessionRenameTarget !== null,
						onClose: closeSessionRename,
						closeLabel: t("close"),
						title: t("rename.session.title"),
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: sessionRenaming,
							onClick: closeSessionRename,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: t("rename")
						})] }),
						children: [(0, react_jsx_runtime.jsx)("input", {
							className: WorkspaceBrowser_module_css_default.renameInput,
							value: sessionRenameDraft,
							"aria-label": t("field.sessionName"),
							autoFocus: true,
							disabled: sessionRenaming,
							onFocus: (e) => {
								e.target.select();
							},
							onChange: (e) => {
								setSessionRenameDraft(e.target.value);
								setSessionRenameError(null);
							},
							onCompositionStart: () => {
								composingRef.current = true;
							},
							onCompositionEnd: () => {
								composingRef.current = false;
							},
							onKeyDown: (e) => {
								if (e.key === "Enter" && !composingRef.current) {
									e.preventDefault();
									confirmSessionRename();
								}
							}
						}), sessionRenameError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: sessionRenameError
						})]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: closeDelete,
						closeLabel: t("close"),
						title: t("delete.workspace"),
						...deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) },
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: WorkspaceBrowser_module_css_default.deleteAction,
							disabled: deleting,
							onClick: confirmDelete,
							children: t("delete.workspace")
						})] }),
						children: [deleting && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.deleteStatus,
							role: "status",
							children: t("delete.pending")
						}), deleteError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: deleteError
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `workspace` namespace dictionaries: the browsing region (section header,
		* search, tree rows, dialogs) and the pick/add flow. Runtime failure
		* messages (wire error strings) pass through untranslated by policy.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"group.ungrouped": "未分组",
			"session.new": "新会话",
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			"viewOptions.label": "视图选项",
			"groupBy.label": "分组方式",
			"groupBy.workspace": "按工作区",
			"groupBy.flat": "单列表",
			"orderBy.label": "排序方式",
			"orderBy.manual": "手动排序",
			"orderBy.updated": "最近更新",
			"sessions.expand": "展开其余 {n} 个会话",
			"sessions.collapse": "收起",
			"empty.none": "暂无会话",
			"empty.noMatches": "无匹配结果",
			"workspace.add": "添加工作区",
			"search.sessions.aria": "搜索会话",
			"search.placeholder": "搜索会话…",
			"search.clear": "清除搜索",
			"search.results.aria": "搜索结果",
			"search.pending": "正在搜索会话历史…",
			"search.unavailable": "内容搜索暂不可用，仅显示名称匹配。",
			"search.noMatches": "无匹配会话",
			"search.hasMore": "仅显示前 {n} 条结果，请缩小搜索范围。",
			"menu.addWorkspace": "添加工作区…",
			"picker.loading": "正在加载工作区…",
			"conflict.named": "已存在名为“{name}”的工作区。",
			"folderError.title": "无法打开文件夹",
			"folderError.retry": "重新选择",
			"rename": "重命名",
			"rename.workspace.title": "重命名工作区",
			"rename.session.title": "重命名会话",
			"field.workspaceName": "工作区名称",
			"field.sessionName": "会话名称",
			"delete.workspace": "删除工作区",
			"delete.desc": "将把“{name}”从工作区列表中移除。文件夹与会话记录会保留，其会话将显示在“未分组”下。",
			"delete.pending": "正在删除工作区…",
			"menu.fork": "分叉会话",
			"menu.archiveSession": "归档会话",
			"sessions.count.one": "{n} 个会话",
			"sessions.count.other": "{n} 个会话",
			"actions.workspace.aria": "工作区“{name}”的操作",
			"actions.session.aria": "会话“{name}”的操作",
			"actions.newSession.aria": "在“{name}”中新建会话",
			"status.running": "进行中",
			"status.subagentsRunning.one": "{n} 个子代理运行中",
			"status.subagentsRunning.other": "{n} 个子代理运行中",
			"status.idle": "空闲",
			"status.waitingApproval": "等待审批",
			"status.planReview": "计划待审",
			"status.waitingAnswer": "等待回答",
			"status.completed": "已完成",
			"hover.created": "创建于 {time}",
			"hover.copied": "已复制",
			"date.ymd": "{y}年{m}月{d}日",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"group.ungrouped": "Ungrouped",
			"session.new": "New Session",
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			"viewOptions.label": "View options",
			"groupBy.label": "Group by",
			"groupBy.workspace": "WorkSpace",
			"groupBy.flat": "In one list",
			"orderBy.label": "Order by",
			"orderBy.manual": "Manual",
			"orderBy.updated": "Last updated",
			"sessions.expand": "Show {n} more sessions",
			"sessions.collapse": "Show less",
			"empty.none": "No sessions yet",
			"empty.noMatches": "No matches",
			"workspace.add": "Add workspace",
			"search.sessions.aria": "Search sessions",
			"search.placeholder": "Search sessions...",
			"search.clear": "Clear search",
			"search.results.aria": "Search results",
			"search.pending": "Searching session history…",
			"search.unavailable": "Content search is temporarily unavailable. Showing name matches.",
			"search.noMatches": "No matching sessions",
			"search.hasMore": "Showing the first {n} results. Narrow your search.",
			"menu.addWorkspace": "Add workspace…",
			"picker.loading": "Loading workspaces…",
			"conflict.named": "A workspace named “{name}” already exists.",
			"folderError.title": "Couldn’t open folder",
			"folderError.retry": "Choose again",
			"rename": "Rename",
			"rename.workspace.title": "Rename workspace",
			"rename.session.title": "Rename session",
			"field.workspaceName": "Workspace name",
			"field.sessionName": "Session name",
			"delete.workspace": "Delete workspace",
			"delete.desc": "This removes “{name}” from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped.",
			"delete.pending": "Deleting workspace…",
			"menu.fork": "Fork session",
			"menu.archiveSession": "Archive session",
			"sessions.count.one": "{n} session",
			"sessions.count.other": "{n} sessions",
			"actions.workspace.aria": "Workspace actions for {name}",
			"actions.session.aria": "Session actions for {name}",
			"actions.newSession.aria": "New session in {name}",
			"status.running": "Running",
			"status.subagentsRunning.one": "{n} subagent running",
			"status.subagentsRunning.other": "{n} subagents running",
			"status.idle": "Idle",
			"status.waitingApproval": "Waiting for approval",
			"status.planReview": "Plan awaiting review",
			"status.waitingAnswer": "Waiting for answer",
			"status.completed": "Completed",
			"hover.created": "Created {time}",
			"hover.copied": "Copied",
			"date.ymd": "{y}-{m}-{d}",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspace";
		/**
		* Required services (cordis fiber inject). The target slots are declared by
		* the ui-sidebar / ui-conversation applies, whose activation order relative
		* to this one is NOT constrained: dsh.client.inject edges are informational
		* (loading/prefetch metadata, never apply sequencing) and neither owner
		* provides a waitable service. apply therefore depends on each slot
		* declaration through `slots.inject()` instead of assuming order.
		*/
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"connection"
		];
		/**
		* Register the browser and picker once their slot declarations are on the
		* ledger. Inject factories return plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const hostDescription = ctx.get("connection").hostDescription;
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-workspace: dictionaries");
			const searchSessions = async (query, signal) => {
				const result = await ctx.sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const flowSource = (hole) => ({
				getSnapshot: () => ctx.slots.entries(hole).length > 0,
				subscribe: (listener) => ctx.slots.subscribe(hole, listener)
			});
			const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
			const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
			const browserInjected = () => ({
				startSession: (workspaceId) => {
					ctx.workspaces.startSession(workspaceId);
				},
				open: (sessionId) => {
					ctx.sessions.open(sessionId);
				},
				searchSessions,
				searchResultLimit: ctx.sessions.searchResultLimit,
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const result = await session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				forkSession: (sessionId) => {
					ctx.sessions.fork({
						sessionId,
						increaseTitle: true
					}).then((childId) => {
						ctx.sessions.open(childId);
					}).catch(() => {});
				},
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await ctx.workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				archiveSession: async (sessionId) => {
					await ctx.workspaces.archiveSession(sessionId);
				},
				insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
					await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				hooks: {
					directoryFlow: browserFlowSource,
					hostDescription
				}
			});
			const pickerInjected = () => ({
				createWorkspace: (input) => ctx.workspaces.create(input),
				hooks: { directoryFlow: pickerFlowSource }
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				children: { "sidebar.workspaces.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				store: createWorkspaceViewStore(),
				inject: browserInjected,
				locale: NS
			}, WorkspaceBrowser));
			ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({
				name: "conversation.hero.workspace",
				children: { "conversation.hero.workspace.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: pickerInjected,
				locale: NS
			}, WorkspacePicker));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
})(platformRequire);
    const require = (name) => name === "@deepseek-ai/dsh-client-ui-workspace" ? fixedWorkspaceUi : platformRequire(name);
    const module = { exports: {} };
    const exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name5 in all)
    __defProp(target, name5, { get: all[name5], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply4,
  inject: () => inject4,
  name: () => name4
});
module.exports = __toCommonJS(index_exports);

// modules/initialization/src/client.js
var client_exports = {};
__export(client_exports, {
  InitializationView: () => InitializationView,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
var import_react = __toESM(require("react"), 1);
function InitializationView({ node }) {
  let result;
  try {
    result = JSON.parse(node.outcome?.text ?? "{}");
  } catch {
    result = { status: "FAILED", code: node.outcome?.text };
  }
  return import_react.default.createElement(
    "section",
    { "data-crystra-initialization": "true", role: "status", style: { padding: "12px", border: "1px solid currentColor", borderRadius: "8px" } },
    import_react.default.createElement("strong", null, "Crystra"),
    import_react.default.createElement("div", null, result.status ?? "PREPARING"),
    result.code ? import_react.default.createElement("div", null, result.code) : null,
    ...(result.diagnostics ?? []).map((item, index) => import_react.default.createElement("div", { key: index }, `${item.code}${item.path ? ": " + item.path : ""}`)),
    result.retry ? import_react.default.createElement("div", null, `Retry: /crystra ${result.retry}`) : null,
    result.status === "NEEDS_CONFIGURATION" ? import_react.default.createElement("div", null, "Run /crystra setup to prepare this installation.") : null
  );
}
var name = "crystra-initialization-client";
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("conversation.chat.commandview", () => {
    ctx.slots.register({ name: "conversation.chat.commandview", key: "crystra-initialization" }, InitializationView);
  });
}

// modules/execution/src/client/browser-entry.js
var browser_entry_exports = {};
__export(browser_entry_exports, {
  apply: () => apply2,
  inject: () => inject2,
  name: () => name2
});
var import_react2 = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var workspaceUi = __toESM(require("@deepseek-ai/dsh-client-ui-workspace"), 1);

// modules/execution/src/action-presentation/model.js
var DSH_ACTION_PRESENTATION_COMPATIBILITY = Object.freeze({
  dsh: "0.1.1-rc.2",
  uiPrimitives: "@deepseek-ai/dsh-client-ui-primitives@0.1.1-rc.2",
  presentation: "crystra.presentation@1.0.0"
});
var ROOT_KEYS = "correlation,data,kind,schemaVersion";
var KINDS = /* @__PURE__ */ new Set([
  "command-accepted",
  "delivery-running",
  "delivery-list",
  "delivery-status",
  "action-output",
  "action-input-request",
  "terminal-result",
  "error"
]);
var ACTION_STATES = /* @__PURE__ */ new Set(["running", "completed", "failed", "cancelled", "waiting", "recovering", "uncertain", "unresolved"]);
var TERMINAL_OUTCOMES = /* @__PURE__ */ new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
var DELIVERY_STATES = /* @__PURE__ */ new Set([
  "BOUND",
  "START_UNCERTAIN",
  "RUNNING_CORRELATED",
  "START_FAILED",
  "RESULT_UNRESOLVED",
  "TERMINAL_HANDLING",
  "RUNNING",
  "RECOVERING",
  "WAITING",
  "AWAITING_INPUT",
  "COMPLETED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED"
]);
var MAX_PRESENTATION_BYTES = 4096;
function deepFreeze(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
function invalidPresentation() {
  return deepFreeze({
    schemaVersion: DSH_ACTION_PRESENTATION_COMPATIBILITY.presentation,
    correlation: "presentation-invalid",
    kind: "error",
    data: { code: "CRYSTRA_PRESENTATION_INVALID", message: "CRYSTRA presentation unavailable" }
  });
}
function plainJson(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => plainJson(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && descriptors[key] !== void 0 && "value" in descriptors[key] && plainJson(descriptors[key].value, seen));
}
function hasValidTypedData(value) {
  if (value.kind === "action-output") {
    const state = value.data.state === void 0 ? "completed" : value.data.state;
    const channel = value.data.channel === void 0 ? "action" : value.data.channel;
    return typeof state === "string" && ACTION_STATES.has(state) && (channel === "action" || channel === "tool");
  }
  if (value.kind === "terminal-result") {
    const hasFinalOutput = Object.hasOwn(value.data, "finalOutput");
    const hasSummary = Object.hasOwn(value.data, "summary");
    const outputValid = hasFinalOutput ? typeof value.data.finalOutput === "string" && value.data.finalOutput.length > 0 : hasSummary ? typeof value.data.summary === "string" && value.data.summary.length > 0 : value.data.outcome === "SUCCEEDED";
    return typeof value.data.outcome === "string" && TERMINAL_OUTCOMES.has(value.data.outcome) && outputValid;
  }
  if (value.kind === "delivery-running" || value.kind === "delivery-status") {
    const diagnostic2 = value.data.diagnostic;
    const diagnosticValid = diagnostic2 === void 0 || diagnostic2 !== null && typeof diagnostic2 === "object" && !Array.isArray(diagnostic2) && Object.keys(diagnostic2).sort().join(",") === "causeCode,stage" && typeof diagnostic2.stage === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(diagnostic2.stage) && typeof diagnostic2.causeCode === "string" && /^[A-Z][A-Z0-9_]{0,127}$/u.test(diagnostic2.causeCode);
    return diagnosticValid && (value.data.state === void 0 || typeof value.data.state === "string" && DELIVERY_STATES.has(value.data.state));
  }
  return true;
}
function parseExecutionPresentation(input) {
  let value = input;
  if (typeof input === "string") {
    if (input.length === 0 || new TextEncoder().encode(input).byteLength > MAX_PRESENTATION_BYTES) return invalidPresentation();
    try {
      value = JSON.parse(input);
    } catch {
      return invalidPresentation();
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== ROOT_KEYS || value.schemaVersion !== DSH_ACTION_PRESENTATION_COMPATIBILITY.presentation || typeof value.correlation !== "string" || value.correlation.length === 0 || !KINDS.has(value.kind) || value.data === null || typeof value.data !== "object" || Array.isArray(value.data) || !plainJson(value.data) || !hasValidTypedData(value)) return invalidPresentation();
  return deepFreeze(structuredClone(value));
}
function text(value, keys = ["text", "message", "question", "summary", "result"]) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const lines = value.map((item) => text(item, keys)).filter((item) => typeof item === "string" && item.length > 0);
    return lines.length === 0 ? void 0 : lines.join("\n\n");
  }
  if (value === null || typeof value !== "object") return void 0;
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue;
    const nested = text(value[key], keys);
    if (nested !== void 0) return nested;
  }
  return void 0;
}
function normalizedLifecycle(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().replaceAll("_", "-");
  if (["succeeded", "success", "done", "terminal"].includes(normalized)) return "completed";
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  if (["waiting", "awaiting-input"].includes(normalized)) return "waiting";
  if (["start-failed"].includes(normalized)) return "failed";
  if (normalized === "start-uncertain") return "uncertain";
  if (normalized === "result-unresolved") return "unresolved";
  if (["recovering", "recovery", "terminal-handling"].includes(normalized)) return "recovering";
  if (["running", "accepted", "running-correlated", "bound"].includes(normalized)) return "running";
  return fallback;
}
var STATE_LABELS = Object.freeze({
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  waiting: "Waiting for input",
  recovering: "Recovering",
  uncertain: "Start uncertain",
  unresolved: "Result unresolved"
});
function model(input) {
  return deepFreeze(input);
}
function projectExecutionPresentation(event) {
  const { correlation, data } = event;
  if (event.kind === "delivery-list") throw new TypeError("CRYSTRA_PRESENTATION_OUT_OF_SCOPE");
  if (event.kind === "terminal-result") {
    const state2 = normalizedLifecycle(data.outcome, "failed");
    const body = typeof data.finalOutput === "string" ? data.finalOutput : data.summary;
    return model({
      correlation,
      layer: "final",
      state: state2,
      title: "Final result",
      summary: data.outcome[0] + data.outcome.slice(1).toLowerCase(),
      body,
      defaultOpen: false,
      focusPolicy: "none",
      role: "article",
      compatibility: typeof data.finalOutput === "string" ? "current" : "legacy-summary"
    });
  }
  if (event.kind === "action-input-request") {
    return model({
      correlation,
      layer: "action",
      state: "waiting",
      title: typeof data.label === "string" ? data.label : "Workflow Action",
      summary: STATE_LABELS.waiting,
      body: text(data.prompt) ?? "Input required",
      defaultOpen: true,
      focusPolicy: "preserve",
      role: "status",
      compatibility: "current"
    });
  }
  if (event.kind === "action-output") {
    const state2 = data.state ?? "completed";
    return model({
      correlation,
      layer: data.channel === "tool" ? "tool" : "action",
      state: state2,
      title: typeof data.label === "string" ? data.label : "Workflow Action",
      summary: STATE_LABELS[state2],
      body: text(data.content) ?? "CRYSTRA content unavailable",
      defaultOpen: false,
      focusPolicy: "none",
      role: "status",
      compatibility: "current"
    });
  }
  if (event.kind === "error") {
    return model({
      correlation,
      layer: "progress",
      state: "failed",
      title: "Workflow presentation",
      summary: typeof data.code === "string" ? data.code : "CRYSTRA_ERROR",
      body: typeof data.message === "string" ? data.message : "CRYSTRA presentation unavailable",
      defaultOpen: false,
      focusPolicy: "none",
      role: "alert",
      compatibility: "current"
    });
  }
  const state = event.kind === "delivery-running" ? normalizedLifecycle(data.state, "running") : normalizedLifecycle(data.state, event.kind === "command-accepted" ? "running" : "running");
  const deliveryId = typeof data.deliveryId === "string" ? data.deliveryId : void 0;
  const diagnostic2 = data.diagnostic;
  return model({
    correlation,
    layer: "progress",
    state,
    title: "Workflow delivery",
    summary: `${STATE_LABELS[state]}${deliveryId === void 0 ? "" : ` \xB7 ${deliveryId}`}`,
    body: diagnostic2 === void 0 ? void 0 : `${diagnostic2.stage} \xB7 ${diagnostic2.causeCode}`,
    defaultOpen: false,
    focusPolicy: "none",
    role: "status",
    compatibility: "current"
  });
}
function resolveDisclosureOpen({ current, previousState, nextState, containsFocus }) {
  if (nextState === "waiting") return true;
  if (nextState === "completed" && previousState !== "completed") return containsFocus ? true : false;
  return current;
}

// modules/execution/src/action-presentation/view.js
var DOT_STATE = Object.freeze({
  running: "ongoing",
  recovering: "ongoing",
  uncertain: "warning",
  unresolved: "warning",
  completed: "done",
  waiting: "warning",
  failed: "error",
  cancelled: "error"
});
var ACTIONS_STYLE_ID = "dsh-crystra-execution-final-actions";
var ACTIONS_CSS = ".crystra-answer-actions{align-items:center;gap:10px;height:28px;margin-top:16px;margin-left:-6px;display:flex}.crystra-answer-action{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:transparent;border:none;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex}.crystra-answer-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}";
function installActionPresentationStyle() {
  if (typeof document === "undefined" || document.getElementById(ACTIONS_STYLE_ID) !== null) return;
  const tag = document.createElement("style");
  tag.id = ACTIONS_STYLE_ID;
  tag.dataset.plugin = "dsh-crystra-execution";
  tag.textContent = ACTIONS_CSS;
  document.head.append(tag);
}
function createActionPresentationView({
  React: React4,
  DisclosureRow: DisclosureRow2,
  MessageText: MessageText2,
  StateDot: StateDot2,
  JsonTree: JsonTree2,
  Tooltip: Tooltip2,
  IconCopyOutline16: IconCopyOutline162,
  IconCheckOutline16: IconCheckOutline162,
  writeClipboard: writeClipboard2,
  observe = () => void 0
}) {
  if (typeof DisclosureRow2 !== "function") throw new TypeError("DSH_DISCLOSURE_ROW_REQUIRED");
  installActionPresentationStyle();
  return function CrystraExecutionPresentationView({ node, technicalDetails }) {
    const presentation = node.data;
    const presentationKind = typeof technicalDetails?.kind === "string" ? technicalDetails.kind : presentation.layer === "final" ? "terminal-result" : presentation.state === "waiting" ? "action-input-request" : ["action", "tool"].includes(presentation.layer) ? "action-output" : presentation.state === "failed" && presentation.title === "Workflow presentation" ? "error" : presentation.layer === "progress" && presentation.state === "running" ? "command-accepted" : "delivery-status";
    const [open, setOpen] = React4.useState(presentation.defaultOpen);
    const [copyState, setCopyState] = React4.useState("idle");
    const bodyRef = React4.useRef(null);
    const previousState = React4.useRef(presentation.state);
    const copyPending = React4.useRef(false);
    const copyEpoch = React4.useRef(0);
    const copyTimer = React4.useRef(null);
    React4.useEffect(() => {
      setOpen((current) => resolveDisclosureOpen({
        current,
        previousState: previousState.current,
        nextState: presentation.state,
        containsFocus: typeof document !== "undefined" && bodyRef.current !== null && bodyRef.current.contains(document.activeElement)
      }));
      previousState.current = presentation.state;
    }, [presentation.state]);
    React4.useEffect(() => {
      copyEpoch.current += 1;
      copyPending.current = false;
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      copyTimer.current = null;
      setCopyState("idle");
      return () => {
        copyEpoch.current += 1;
        copyPending.current = false;
        if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      };
    }, [presentation.body, presentation.correlation]);
    observe(presentation);
    if (presentation.layer === "final" && presentation.state === "completed") {
      const label = copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy";
      const onCopy = async () => {
        if (copyState === "copied" || copyPending.current) return;
        const epoch = copyEpoch.current;
        copyPending.current = true;
        let accepted = false;
        try {
          accepted = await writeClipboard2(presentation.body);
        } catch {
          accepted = false;
        }
        if (epoch !== copyEpoch.current) return;
        copyPending.current = false;
        setCopyState(accepted ? "copied" : "failed");
        copyTimer.current = globalThis.setTimeout(() => {
          copyTimer.current = null;
          setCopyState("idle");
        }, 1e3);
      };
      return React4.createElement(
        "article",
        {
          "data-crystra-presentation": "true",
          "data-crystra-kind": presentationKind,
          "data-crystra-surface": "chat",
          "data-crystra-layer": "final",
          "data-crystra-state": presentation.state,
          "data-crystra-correlation": presentation.correlation,
          "data-crystra-chat-role": "assistant",
          "data-crystra-compatibility": presentation.compatibility,
          "aria-label": presentation.title
        },
        React4.createElement(MessageText2, { text: presentation.body }),
        React4.createElement("div", {
          className: "crystra-answer-actions",
          "data-crystra-answer-actions": "true"
        }, React4.createElement(Tooltip2, { label, side: "bottom" }, React4.createElement("button", {
          type: "button",
          className: "crystra-answer-action",
          "aria-label": label,
          "data-copy-state": copyState,
          onClick: onCopy
        }, React4.createElement(copyState === "copied" ? IconCheckOutline162 : IconCopyOutline162, null))))
      );
    }
    const waiting = presentation.state === "waiting";
    const expandable = (presentation.body !== void 0 || technicalDetails !== void 0) && !waiting;
    const body = presentation.body === void 0 && technicalDetails === void 0 ? void 0 : React4.createElement("div", {
      ref: bodyRef,
      "data-crystra-presentation-body": "true",
      "data-crystra-layer": presentation.layer,
      "data-crystra-state": presentation.state,
      "data-crystra-correlation": presentation.correlation,
      "data-crystra-action-input": waiting ? "true" : void 0,
      role: waiting ? "group" : void 0,
      tabIndex: waiting ? 0 : void 0,
      "aria-label": waiting ? presentation.summary : void 0,
      "aria-live": waiting ? "polite" : void 0
    }, presentation.body === void 0 ? null : React4.createElement("pre", {
      style: { margin: 0, maxHeight: "20rem", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }
    }, presentation.body), technicalDetails === void 0 ? null : React4.createElement(
      "details",
      null,
      React4.createElement("summary", null, "Technical details"),
      JsonTree2 === void 0 ? React4.createElement("pre", null, JSON.stringify(technicalDetails, null, 2)) : React4.createElement(JsonTree2, { data: technicalDetails, label: "CRYSTRA presentation", copyable: true, expandTopLevel: true })
    ));
    return React4.createElement(DisclosureRow2, {
      icon: React4.createElement(StateDot2, { state: DOT_STATE[presentation.state], size: 10 }),
      title: presentation.title,
      open: waiting ? true : open,
      expandable,
      onToggle: waiting ? () => void 0 : () => setOpen((current) => !current),
      expandOnRowClick: expandable,
      // The locked primitive animates its hover-preview icon without a
      // reduced-motion branch. Keeping that optional preview off preserves the
      // same keyboard disclosure while making CRYSTRA rows motion-free.
      previewChevron: false,
      keepContentWhenOpen: true,
      collapsedContent: React4.createElement("span", {
        role: presentation.role,
        "data-crystra-presentation": "true",
        "data-crystra-kind": presentationKind,
        "data-crystra-surface": "chat",
        "data-crystra-chat-role": "assistant",
        "data-crystra-correlation": presentation.correlation,
        "data-crystra-state": presentation.state,
        "aria-live": ["running", "recovering", "waiting"].includes(presentation.state) ? "polite" : void 0
      }, presentation.summary)
    }, body);
  };
}
var TERMINAL_PRESENTATION = Object.freeze({
  SUCCEEDED: Object.freeze({ state: "completed", label: "Succeeded" }),
  FAILED: Object.freeze({ state: "failed", label: "Failed" }),
  CANCELLED: Object.freeze({ state: "cancelled", label: "Cancelled" })
});
function reconcileDeliveryPresentation(presentation, admitted, inventoryState) {
  const deliveryId = admitted?.kind === "delivery-running" && typeof admitted.data.deliveryId === "string" ? admitted.data.deliveryId : void 0;
  const deliveries = ["ready", "reconnecting"].includes(inventoryState?.kind) && Array.isArray(inventoryState.snapshot?.deliveries) ? inventoryState.snapshot.deliveries : [];
  const matches = deliveryId === void 0 ? [] : deliveries.filter((delivery) => delivery?.deliveryId === deliveryId);
  const exact = matches.length === 1 ? matches[0] : void 0;
  const terminal = exact?.lifecycle === "TERMINAL" ? TERMINAL_PRESENTATION[exact?.terminal?.outcome] : void 0;
  if (terminal !== void 0) return Object.freeze({
    ...presentation,
    state: terminal.state,
    summary: `${terminal.label} \xB7 ${deliveryId}`,
    defaultOpen: false
  });
  if (exact === void 0 || typeof exact.lifecycle !== "string") return presentation;
  const lifecycle = /* @__PURE__ */ new Set(["BOUND", "START_UNCERTAIN", "RUNNING_CORRELATED", "START_FAILED", "RESULT_UNRESOLVED", "TERMINAL_HANDLING"]);
  return lifecycle.has(exact.lifecycle) ? projectExecutionPresentation({
    correlation: presentation.correlation,
    kind: "delivery-status",
    data: {
      deliveryId,
      state: exact.lifecycle,
      ...admitted?.data?.diagnostic === void 0 ? {} : { diagnostic: admitted.data.diagnostic }
    }
  }) : presentation;
}
function commandPresentation(node, admitted, inventoryState) {
  if (node.outcome === null) return Object.freeze({
    correlation: String(node.commandId),
    layer: "progress",
    state: "running",
    title: "Workflow delivery",
    summary: "Running",
    body: void 0,
    defaultOpen: false,
    focusPolicy: "none",
    role: "status",
    compatibility: "current"
  });
  const event = admitted ?? parseExecutionPresentation(node.outcome?.text);
  if (event.kind === "delivery-list") {
    const count = Array.isArray(event.data.items) ? event.data.items.length : 0;
    return Object.freeze({
      correlation: event.correlation,
      layer: "progress",
      state: "completed",
      title: "Delivery list",
      summary: `${count} ${count === 1 ? "delivery" : "deliveries"}`,
      body: count === 0 ? "No deliveries." : JSON.stringify(event.data.items, null, 2),
      defaultOpen: false,
      focusPolicy: "none",
      role: "status",
      compatibility: "current"
    });
  }
  return reconcileDeliveryPresentation(projectExecutionPresentation(event), event, inventoryState);
}
function createCrystraCommandView(options) {
  const View = createActionPresentationView(options);
  const { React: React4, inventory } = options;
  return function CrystraCommandView({ node }) {
    const admitted = node.outcome === null ? void 0 : parseExecutionPresentation(node.outcome?.text);
    const inventoryState = inventory === void 0 ? void 0 : React4.useSyncExternalStore(inventory.subscribe, inventory.getSnapshot, inventory.getSnapshot);
    return View({ node: { data: commandPresentation(node, admitted, inventoryState) }, technicalDetails: admitted });
  };
}
function registerActionPresentation(ctx, View) {
  ctx.slots.inject("conversation.chat.commandview", () => {
    ctx.slots.register({ name: "conversation.chat.commandview", key: "crystra" }, () => null);
    ctx.slots.register({ name: "conversation.chat.commandview", key: "crystra-presentation" }, View);
  });
}

// modules/execution/src/client/delivery/control-plane-port.js
var CHANNEL = "/crystra-execution";
var ERROR_CODES = /* @__PURE__ */ new Set([
  "DELIVERY_PROJECTION_CORRUPT",
  "DELIVERY_PROJECTION_STALE_BINDING",
  "DELIVERY_PROJECTION_RECOVERY_MISMATCH",
  "DELIVERY_PROJECTION_UNAVAILABLE"
]);
function createStore(initial) {
  let snapshot = initial;
  const listeners = /* @__PURE__ */ new Set();
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(value) {
      snapshot = Object.freeze(value);
      for (const listener of [...listeners]) listener();
    }
  });
}
function message(error) {
  return typeof error?.message === "string" && error.message.length > 0 ? error.message : "Delivery control plane unavailable";
}
function createDeliveryControlPlaneClient(rpc) {
  if (typeof rpc?.call !== "function") throw new TypeError("DSH_CONNECTION_RPC_REQUIRED");
  const inventory = createStore(Object.freeze({ kind: "loading" }));
  const sessions = /* @__PURE__ */ new Map();
  const read = async (endpoint, payload) => {
    const result = await rpc.call(CHANNEL, endpoint, payload);
    if (result?.ok !== true) throw Object.assign(new Error(message(result?.error)), {
      code: ERROR_CODES.has(result?.error?.code) ? result.error.code : "DELIVERY_PROJECTION_UNAVAILABLE"
    });
    return result.value;
  };
  const client = {
    inventory,
    async refresh() {
      try {
        const value = await read("inventory/read", {});
        inventory.publish({ kind: "ready", snapshot: value });
        for (const source of sessions.values()) void source.refresh();
      } catch (error) {
        const previous = inventory.getSnapshot();
        inventory.publish({
          kind: previous.kind === "ready" ? "reconnecting" : "error",
          code: typeof error?.code === "string" ? error.code : "DELIVERY_PROJECTION_UNAVAILABLE",
          message: message(error),
          ...previous.kind === "ready" ? { snapshot: previous.snapshot } : {}
        });
      }
    },
    bindSession(sessionCorrelation) {
      if (typeof sessionCorrelation !== "string" || sessionCorrelation.length === 0 || sessionCorrelation.length > 512) {
        throw new TypeError("SESSION_CORRELATION_INVALID");
      }
      if (sessions.has(sessionCorrelation)) return sessions.get(sessionCorrelation);
      const store = createStore(Object.freeze({ kind: "loading" }));
      const source = Object.freeze({
        getSnapshot: store.getSnapshot,
        subscribe: store.subscribe,
        async refresh() {
          try {
            store.publish({ kind: "ready", view: await read("session/read", { sessionCorrelation }) });
          } catch (error) {
            store.publish({ kind: "error", code: typeof error?.code === "string" ? error.code : "DELIVERY_PROJECTION_UNAVAILABLE", message: message(error) });
          }
        }
      });
      sessions.set(sessionCorrelation, source);
      return source;
    }
  };
  return Object.freeze(client);
}

// modules/execution/src/client/delivery/session-delivery-view.js
var DELIVERY_VIEW_ID = "delivery";
var DELIVERY_VIEW_ORDER = 20;
var SHA256 = /^sha256:[0-9a-f]{64}$/u;
var LIFECYCLES = /* @__PURE__ */ new Set([
  "BOUND",
  "START_UNCERTAIN",
  "RUNNING_CORRELATED",
  "START_FAILED",
  "RESULT_UNRESOLVED",
  "TERMINAL_HANDLING",
  "TERMINAL"
]);
var DELIVERY_STYLE_ID = "dsh-crystra-execution-delivery-view";
var DELIVERY_CSS = `
.crystra-delivery-view { box-sizing: border-box; width: 100%; max-width: 960px; margin: 0 auto; padding: 20px; color: var(--dsw-alias-label-primary); }
.crystra-delivery-heading { margin: 0 0 16px; font-size: 20px; line-height: 28px; }
.crystra-delivery-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 8px; margin: 0 0 16px; }
.crystra-delivery-summary-item { min-width: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.crystra-delivery-summary-item dt, .crystra-delivery-identity dt { margin: 0 0 3px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.crystra-delivery-summary-item dd, .crystra-delivery-identity dd { min-width: 0; margin: 0; font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.crystra-delivery-status { display: inline-flex; min-width: 0; align-items: center; gap: 6px; }
.crystra-delivery-status > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crystra-delivery-identities { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 8px 16px; margin: 8px 0 0; }
.crystra-delivery-identity { min-width: 0; margin: 0; }
.crystra-delivery-identity dd { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
.crystra-delivery-identity code { display: block; min-width: 0; max-width: 100%; color: inherit; font-family: var(--dsw-font-family-mono, ui-monospace, monospace); overflow-wrap: anywhere; white-space: normal; }
.crystra-delivery-preview { display: block; min-width: 0; max-width: 100%; margin-inline-start: 8px; overflow: hidden; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.crystra-delivery-copy-feedback { min-height: 20px; margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 20px; }
.crystra-delivery-condition { margin-top: 12px; padding: 10px 12px; border-left: 3px solid var(--dsw-alias-state-warn-primary); border-radius: 4px; background: var(--dsw-alias-bg-layer-1); }
.crystra-delivery-condition h3 { margin: 0 0 4px; font-size: 13px; line-height: 20px; }
.crystra-delivery-condition code, .crystra-delivery-state code { overflow-wrap: anywhere; }
.crystra-delivery-state { display: grid; gap: 8px; }
.crystra-delivery-state p { margin: 0; }
@media (max-width: 720px) { .crystra-delivery-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .crystra-delivery-view { padding: 12px; } .crystra-delivery-summary, .crystra-delivery-identities { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .crystra-delivery-view, .crystra-delivery-view * { scroll-behavior: auto !important; transition: none !important; } }
`;
function ensureDeliveryStyles() {
  if (typeof document === "undefined" || document.getElementById(DELIVERY_STYLE_ID) !== null) return;
  const tag = document.createElement("style");
  tag.id = DELIVERY_STYLE_ID;
  tag.textContent = DELIVERY_CSS;
  document.head.appendChild(tag);
}
function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
function validDelivery(delivery, sessionCorrelation) {
  return delivery !== null && typeof delivery === "object" && !Array.isArray(delivery) && nonEmpty(delivery.deliveryId) && SHA256.test(delivery.deliveryBindingIdentity) && nonEmpty(delivery.task?.identity) && nonEmpty(delivery.workflow?.identity) && nonEmpty(delivery.workflow?.packageName) && nonEmpty(delivery.workflow?.exactPackageVersion) && SHA256.test(delivery.workflow?.packageDigest) && nonEmpty(delivery.workflow?.snapshotIdentity) && SHA256.test(delivery.workflow?.snapshotDigest) && LIFECYCLES.has(delivery.lifecycle) && delivery.navigation?.sessionCorrelation === sessionCorrelation && delivery.detached === false && typeof delivery.recoverable === "boolean" && Number.isSafeInteger(delivery.timing?.startedAt) && Number.isSafeInteger(delivery.timing?.updatedAt) && Number.isSafeInteger(delivery.timing?.elapsedMs) && delivery.timing.elapsedMs >= 0;
}
function duration(value) {
  const seconds = Math.floor(value / 1e3);
  if (seconds < 60) return `${seconds}.${String(value % 1e3).padStart(3, "0")}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function safeSnapshot(source) {
  try {
    return source.getSnapshot();
  } catch {
    return { kind: "error", code: "DELIVERY_PROJECTION_UNAVAILABLE", message: "Execution projection unavailable" };
  }
}
function safeSubscribe(source, notify) {
  try {
    const dispose = source.subscribe(notify);
    return typeof dispose === "function" ? dispose : () => void 0;
  } catch {
    return () => void 0;
  }
}
function summaryItem(React4, label, value, extra = {}) {
  return React4.createElement(
    "div",
    { className: "crystra-delivery-summary-item", ...extra },
    React4.createElement("dt", null, label),
    React4.createElement("dd", null, value)
  );
}
function statePanel(React4, StateDot2, role, code, message2) {
  return React4.createElement(
    "section",
    {
      className: "crystra-delivery-view crystra-delivery-state",
      "aria-labelledby": "crystra-delivery-view-title",
      "aria-live": role === "alert" ? "assertive" : "polite",
      "data-crystra-delivery-view": "true",
      role
    },
    React4.createElement("h2", { className: "crystra-delivery-heading", id: "crystra-delivery-view-title" }, "Delivery"),
    React4.createElement(
      "p",
      null,
      React4.createElement(StateDot2, { state: role === "alert" ? "error" : "ongoing", size: 10 }),
      " ",
      message2
    ),
    code === void 0 ? null : React4.createElement("code", null, code)
  );
}
function statusState(delivery, failed) {
  if (failed) return "error";
  if (delivery.terminal?.outcome === "SUCCEEDED") return "done";
  if (delivery.terminal !== null || ["START_UNCERTAIN", "RESULT_UNRESOLVED", "START_FAILED"].includes(delivery.lifecycle)) return "warning";
  return "ongoing";
}
function identityCard(React4, primitives, label, value, displayValue = value) {
  const { Button: Button2, IconCheckOutline16: IconCheckOutline162, IconCopyOutline16: IconCopyOutline162, Tooltip: Tooltip2, onCopy, copiedLabel } = primitives;
  const exact = React4.createElement("code", {
    "aria-label": `${label}: ${value}`,
    "data-crystra-delivery-identity": label,
    title: value
  }, displayValue);
  const copied = copiedLabel === label;
  const control = React4.createElement(
    Tooltip2,
    { label: copied ? `${label} copied` : `Copy ${label}`, side: "bottom" },
    React4.createElement(Button2, {
      "aria-label": `Copy ${label}`,
      icon: React4.createElement(copied ? IconCheckOutline162 : IconCopyOutline162, null),
      onClick: () => onCopy(label, value),
      size: "sm",
      type: "button",
      variant: "toolbar"
    }, copied ? "Copied" : "Copy")
  );
  return React4.createElement(
    "div",
    { className: "crystra-delivery-identity", key: label },
    React4.createElement("dt", null, label),
    React4.createElement("dd", null, exact, control)
  );
}
function createSessionDeliveryView(React4, primitives = {}) {
  if (typeof React4?.createElement !== "function" || typeof React4?.useSyncExternalStore !== "function") {
    throw new TypeError("DELIVERY_VIEW_REACT_INVALID");
  }
  const DisclosureRow2 = primitives.DisclosureRow ?? "div";
  const Button2 = primitives.Button ?? "button";
  const IconCheckOutline162 = primitives.IconCheckOutline16 ?? "span";
  const IconCopyOutline162 = primitives.IconCopyOutline16 ?? "span";
  const Pill2 = primitives.Pill ?? "span";
  const StateDot2 = primitives.StateDot ?? "span";
  const Tooltip2 = primitives.Tooltip ?? "span";
  const writeClipboard2 = primitives.writeClipboard ?? (async () => false);
  ensureDeliveryStyles();
  return function SessionDeliveryView({ sessionId, source }) {
    const [identitiesOpen, setIdentitiesOpen] = typeof React4.useState === "function" ? React4.useState(false) : [false, () => void 0];
    const [copiedLabel, setCopiedLabel] = typeof React4.useState === "function" ? React4.useState("") : ["", () => void 0];
    const state = React4.useSyncExternalStore(
      (notify) => safeSubscribe(source, notify),
      () => safeSnapshot(source),
      () => safeSnapshot(source)
    );
    if (state.kind === "loading") return statePanel(React4, StateDot2, "status", void 0, "Loading Delivery\u2026");
    if (state.kind === "error") return statePanel(React4, StateDot2, "alert", state.code ?? "DELIVERY_PROJECTION_UNAVAILABLE", state.message ?? "Execution projection unavailable");
    const view = state.view;
    if (state.kind !== "ready" || view?.sessionCorrelation !== sessionId) {
      return statePanel(React4, StateDot2, "alert", "DELIVERY_PROJECTION_CORRUPT", "Delivery projection invalid");
    }
    if (view.kind === "UNBOUND") return statePanel(React4, StateDot2, "status", void 0, "No Delivery bound to this Session");
    if (view.kind !== "BOUND" || !validDelivery(view.delivery, sessionId)) {
      return statePanel(React4, StateDot2, "alert", "DELIVERY_PROJECTION_CORRUPT", "Delivery projection invalid");
    }
    const delivery = view.delivery;
    const failed = delivery.terminal?.outcome === "FAILED" || delivery.error !== null;
    const identityRows = [
      ["Delivery", delivery.deliveryId],
      ["Task", delivery.task.identity, delivery.task.displayName === null ? delivery.task.identity : `${delivery.task.displayName} \xB7 ${delivery.task.identity}`],
      ["Workflow", delivery.workflow.identity],
      ["Package", `${delivery.workflow.packageName}@${delivery.workflow.exactPackageVersion}`],
      ["Package digest", delivery.workflow.packageDigest],
      ["Snapshot", delivery.workflow.snapshotIdentity],
      ["Snapshot digest", delivery.workflow.snapshotDigest],
      ["Binding", delivery.deliveryBindingIdentity],
      ...nonEmpty(delivery.worktree) ? [["Worktree", delivery.worktree]] : []
    ];
    const statusLabel = delivery.terminal?.outcome ?? delivery.lifecycle;
    const workflowLabel = `${delivery.workflow.identity} \xB7 ${delivery.workflow.packageName}@${delivery.workflow.exactPackageVersion}`;
    const summary = [
      summaryItem(React4, "Status", React4.createElement(
        "span",
        { className: "crystra-delivery-status" },
        React4.createElement(StateDot2, { state: statusState(delivery, failed), size: 10 }),
        React4.createElement(Pill2, { "aria-label": `Delivery status ${statusLabel}` }, statusLabel)
      )),
      summaryItem(React4, "Workflow", workflowLabel),
      ...delivery.current === null ? [] : [summaryItem(
        React4,
        delivery.current.kind === "ACTION" ? "Current Action" : "Current Intervention",
        delivery.current.identity,
        { "data-crystra-delivery-conditional": "current" }
      )],
      ...delivery.terminal === null ? [] : [summaryItem(React4, "Outcome", delivery.terminal.outcome, { "data-crystra-delivery-conditional": "terminal" })],
      summaryItem(React4, "Elapsed", duration(delivery.timing.elapsedMs)),
      summaryItem(React4, "Started", new Date(delivery.timing.startedAt).toISOString()),
      ...delivery.terminal === null ? [] : [summaryItem(React4, "Ended", new Date(delivery.terminal.finishedAt).toISOString())]
    ];
    return React4.createElement(
      "section",
      {
        className: "crystra-delivery-view",
        "aria-labelledby": "crystra-delivery-view-title",
        "aria-live": failed ? "assertive" : "polite",
        "data-crystra-delivery-id": delivery.deliveryId,
        "data-crystra-delivery-view": "true",
        role: failed ? "alert" : "region"
      },
      React4.createElement("h2", { className: "crystra-delivery-heading", id: "crystra-delivery-view-title" }, "Delivery"),
      React4.createElement("dl", { "aria-label": "Delivery summary", "data-crystra-delivery-summary": "true", className: "crystra-delivery-summary" }, summary),
      React4.createElement(
        DisclosureRow2,
        {
          title: "Identity details",
          icon: React4.createElement(StateDot2, { state: statusState(delivery, failed), size: 10 }),
          open: identitiesOpen,
          expandable: true,
          expandOnRowClick: true,
          onToggle: () => setIdentitiesOpen((open) => !open),
          collapsedContent: React4.createElement("code", { className: "crystra-delivery-preview" }, delivery.deliveryId)
        },
        React4.createElement(
          "dl",
          { "aria-label": "Delivery identity", className: "crystra-delivery-identities" },
          identityRows.map(([label, value, displayValue]) => identityCard(React4, {
            Button: Button2,
            IconCheckOutline16: IconCheckOutline162,
            IconCopyOutline16: IconCopyOutline162,
            Tooltip: Tooltip2,
            copiedLabel,
            async onCopy(copyLabel, value2) {
              setCopiedLabel(await writeClipboard2(value2) ? copyLabel : `${copyLabel} copy failed`);
            }
          }, label, value, displayValue))
        ),
        React4.createElement("p", {
          "aria-live": "polite",
          className: "crystra-delivery-copy-feedback",
          role: "status"
        }, copiedLabel === "" ? "" : copiedLabel.endsWith("copy failed") ? copiedLabel : `${copiedLabel} copied`)
      ),
      delivery.error === null ? null : React4.createElement("section", {
        className: "crystra-delivery-condition",
        "data-crystra-delivery-conditional": "error",
        role: "alert"
      }, React4.createElement("h3", null, "Failure diagnostic"), React4.createElement("code", null, delivery.error.code))
    );
  };
}
function registerSessionDeliveryView(ctx, options) {
  if (typeof ctx?.slots?.inject !== "function" || typeof ctx?.slots?.register !== "function" || typeof options?.bindProjection !== "function") throw new TypeError("DELIVERY_VIEW_REGISTRATION_INVALID");
  const View = createSessionDeliveryView(options.React, options);
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: DELIVERY_VIEW_ID,
    order: DELIVERY_VIEW_ORDER,
    label: "Delivery",
    inject: (sessionId) => ({ source: options.bindProjection(sessionId) })
  }, View));
}

// modules/execution/src/client/delivery-inventory/model.js
var CONTROL_PLANE_SCHEMA = "execution.delivery-control-plane@1.0.0";
var LIFECYCLES2 = /* @__PURE__ */ new Set([
  "BOUND",
  "START_UNCERTAIN",
  "RUNNING_CORRELATED",
  "START_FAILED",
  "RESULT_UNRESOLVED",
  "TERMINAL_HANDLING",
  "TERMINAL"
]);
var ERROR_CODES2 = /* @__PURE__ */ new Set([
  "DELIVERY_PROJECTION_CORRUPT",
  "DELIVERY_PROJECTION_STALE_BINDING",
  "DELIVERY_PROJECTION_RECOVERY_MISMATCH",
  "DELIVERY_PROJECTION_UNAVAILABLE"
]);
function errorView(label = "Delivery inventory unavailable") {
  return Object.freeze({ kind: "error", role: "alert", label, rows: Object.freeze([]) });
}
function diagnostic(state, label) {
  return typeof state?.code === "string" && ERROR_CODES2.has(state.code) ? `${state.code}: ${label}` : label;
}
function validString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512;
}
function lifecycleLabel(delivery) {
  if (delivery.lifecycle === "TERMINAL") return delivery.terminal?.outcome ?? "Terminal";
  return delivery.lifecycle.toLowerCase().replaceAll("_", " ").replace(/^./u, (value) => value.toUpperCase());
}
function rowsFrom(deliveries, selectedSessionId) {
  if (!Array.isArray(deliveries)) return void 0;
  const identities = /* @__PURE__ */ new Set();
  const rows = [];
  for (const delivery of deliveries) {
    const sessionCorrelation = delivery?.navigation?.sessionCorrelation ?? null;
    if (delivery === null || typeof delivery !== "object" || Array.isArray(delivery) || !validString(delivery.deliveryId) || identities.has(delivery.deliveryId) || !LIFECYCLES2.has(delivery.lifecycle) || typeof delivery.detached !== "boolean" || typeof delivery.recoverable !== "boolean" || !validString(delivery.task?.identity) || !(delivery.task.displayName === null || validString(delivery.task.displayName)) || !(sessionCorrelation === null || validString(sessionCorrelation))) return void 0;
    identities.add(delivery.deliveryId);
    rows.push(Object.freeze({
      deliveryId: delivery.deliveryId,
      label: delivery.task.displayName ?? delivery.task.identity,
      statusLabel: lifecycleLabel(delivery),
      sessionId: sessionCorrelation,
      availability: sessionCorrelation !== null ? "bound" : delivery.recoverable ? "recoverable" : "detached",
      selected: sessionCorrelation !== null && sessionCorrelation === selectedSessionId
    }));
  }
  rows.sort((left, right) => left.deliveryId.localeCompare(right.deliveryId));
  return Object.freeze(rows);
}
function projectDeliveryInventory(state, { selectedSessionId } = {}) {
  if (state?.kind === "loading") return Object.freeze({ kind: "loading", role: "status", label: "Loading Deliveries", rows: Object.freeze([]) });
  if (state?.kind === "error") {
    const label = validString(state.message) ? state.message : "Delivery inventory unavailable";
    return errorView(diagnostic(state, label));
  }
  if (!(/* @__PURE__ */ new Set(["ready", "reconnecting"])).has(state?.kind)) return errorView();
  const snapshot = state.snapshot;
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot) || snapshot.schemaVersion !== CONTROL_PLANE_SCHEMA || !Number.isSafeInteger(snapshot.generation) || snapshot.generation < 1) return errorView();
  const rows = rowsFrom(snapshot.deliveries, selectedSessionId);
  if (rows === void 0) return errorView();
  if (state.kind === "reconnecting") return Object.freeze({
    kind: "reconnecting",
    role: "status",
    label: diagnostic(state, "Reconnecting to Delivery inventory"),
    rows
  });
  if (rows.length === 0) return Object.freeze({ kind: "empty", role: "status", label: "No Deliveries", rows });
  return Object.freeze({ kind: "ready", role: "list", label: "Deliveries", rows });
}

// modules/execution/src/client/delivery-inventory/sidebar.js
var STYLE_ID = "dsh-crystra-execution-delivery-inventory";
var CSS = ".crystra-sidebar-resources{box-sizing:border-box;height:100%;min-height:0;flex:1 1 0;overflow:hidden;display:flex;flex-direction:column;gap:4px}.crystra-sidebar-resource{min-height:36px;flex:0 0 auto;overflow:hidden;display:flex;flex-direction:column}.crystra-sidebar-resource[data-expanded=true]{min-height:0;flex:1 1 0}.crystra-sidebar-resource-content{min-height:0;flex:1 1 auto;overflow:auto;overscroll-behavior:contain}.crystra-sidebar-resource-header{box-sizing:border-box;width:100%;height:36px;flex:0 0 36px;cursor:pointer;color:var(--dsw-alias-label-tertiary);background:transparent;border:0;border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 8px;font-size:13px;text-align:left}.crystra-sidebar-resource-header:hover{background:var(--dsw-alias-interactive-bg-hover)}.crystra-delivery-row{box-sizing:border-box;width:100%;height:32px;cursor:pointer;color:var(--dsw-alias-label-primary);background:transparent;border:0;border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 8px;font-size:14px;line-height:20px;text-align:left}.crystra-delivery-row:hover,.crystra-delivery-row[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover)}.crystra-delivery-row:disabled{cursor:default}.crystra-delivery-row>span:first-child{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;flex:1}.crystra-delivery-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}.crystra-delivery-status-recoverable{color:var(--dsw-alias-state-warning-primary)}";
function installStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.dataset.plugin = "dsh-crystra-execution";
  tag.textContent = CSS;
  document.head.append(tag);
}
function persisted(key) {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
}
function persist(key, value) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, String(value));
  } catch {
  }
}
function createSidebarResources(React4, WorkspaceBrowser, inventory) {
  return function CrystraSidebarResources(props) {
    const [workspaceExpanded, setWorkspaceExpanded] = React4.useState(() => persisted("crystra.sidebar.workspace.expanded.v1"));
    const [deliveryExpanded, setDeliveryExpanded] = React4.useState(() => persisted("crystra.sidebar.delivery.expanded.v1"));
    const selectedSessionId = props.useSessions((state2) => state2.current);
    const state = React4.useSyncExternalStore(inventory.subscribe, inventory.getSnapshot, inventory.getSnapshot);
    const view = React4.useMemo(() => projectDeliveryInventory(state, { selectedSessionId }), [state, selectedSessionId]);
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
    const header = (id2, label, expanded, kind) => React4.createElement("button", {
      type: "button",
      className: "crystra-sidebar-resource-header",
      "aria-controls": id2,
      "aria-expanded": expanded,
      onClick: () => toggle(kind),
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle(kind);
      }
    }, React4.createElement("span", { "aria-hidden": "true" }, expanded ? "\u25BE" : "\u25B8"), label);
    return React4.createElement(
      "div",
      { className: "crystra-sidebar-resources", "data-crystra-sidebar-resources": "true" },
      React4.createElement(
        "section",
        { className: "crystra-sidebar-resource", "data-expanded": workspaceExpanded, "aria-label": "Workspace" },
        header("crystra-sidebar-workspace", "Workspace", workspaceExpanded, "workspace"),
        workspaceExpanded && React4.createElement("div", { id: "crystra-sidebar-workspace", className: "crystra-sidebar-resource-content" }, React4.createElement(WorkspaceBrowser, props))
      ),
      React4.createElement(
        "section",
        { className: "crystra-sidebar-resource", "data-expanded": deliveryExpanded, "aria-label": "Delivery" },
        header("crystra-sidebar-delivery", "Delivery", deliveryExpanded, "delivery"),
        deliveryExpanded && React4.createElement("div", {
          id: "crystra-sidebar-delivery",
          className: "crystra-sidebar-resource-content",
          role: view.kind === "error" ? "alert" : "region",
          "aria-live": "polite"
        }, view.kind === "ready" ? React4.createElement("div", { role: "list", "aria-label": "Deliveries" }, view.rows.map((row) => React4.createElement("button", {
          key: row.deliveryId,
          type: "button",
          role: "listitem",
          className: "crystra-delivery-row",
          "aria-current": row.selected ? "page" : void 0,
          "aria-label": `${row.label}, ${row.statusLabel}`,
          disabled: row.sessionId === null,
          onClick: row.sessionId === null ? void 0 : () => props.open(row.sessionId)
        }, React4.createElement("span", null, row.label), React4.createElement("span", {
          className: `crystra-delivery-status crystra-delivery-status-${row.availability}`
        }, row.statusLabel)))) : React4.createElement("div", { role: view.role }, view.label))
      )
    );
  };
}
function applyDeliverySidebar(ctx, { React: React4, workspaceUi: workspaceUi2, inventory }) {
  installStyle();
  const originalSlots = ctx.slots;
  const slots = Object.create(originalSlots);
  slots.register = (definition, component) => definition?.name === "sidebar.workspaces" ? originalSlots.register(definition, createSidebarResources(React4, component, inventory)) : originalSlots.register(definition, component);
  slots.inject = (name5, factory) => originalSlots.inject(name5, factory);
  const forked = new Proxy(ctx, { get(target, property) {
    return property === "slots" ? slots : Reflect.get(target, property);
  } });
  return workspaceUi2.apply(forked);
}

// modules/execution/src/client/browser-entry.js
var name2 = "crystra-execution-client";
var inject2 = Object.freeze([
  "connection",
  "sessions",
  "slots",
  "workspaces",
  "locale"
]);
function apply2(ctx) {
  const controlPlane = createDeliveryControlPlaneClient(ctx.connection.rpc);
  const refresh = () => {
    void controlPlane.refresh();
  };
  refresh();
  const timer2 = setInterval(refresh, 2e3);
  ctx.effect(() => () => clearInterval(timer2), "crystra-execution: control-plane refresh");
  applyDeliverySidebar(ctx, { React: import_react2.default, workspaceUi, inventory: controlPlane.inventory });
  registerSessionDeliveryView(ctx, {
    React: import_react2.default,
    Button: import_dsh_client_ui_primitives.Button,
    DisclosureRow: import_dsh_client_ui_primitives.DisclosureRow,
    IconCheckOutline16: import_dsh_client_ui_primitives.IconCheckOutline16,
    IconCopyOutline16: import_dsh_client_ui_primitives.IconCopyOutline16,
    Pill: import_dsh_client_ui_primitives.Pill,
    StateDot: import_dsh_client_ui_primitives.StateDot,
    Tooltip: import_dsh_client_ui_primitives.Tooltip,
    writeClipboard: import_dsh_client_ui_primitives.writeClipboard,
    bindProjection(sessionId) {
      const source = controlPlane.bindSession(String(sessionId));
      void source.refresh();
      return source;
    }
  });
  registerActionPresentation(ctx, createCrystraCommandView({
    React: import_react2.default,
    DisclosureRow: import_dsh_client_ui_primitives.DisclosureRow,
    IconCheckOutline16: import_dsh_client_ui_primitives.IconCheckOutline16,
    IconCopyOutline16: import_dsh_client_ui_primitives.IconCopyOutline16,
    JsonTree: import_dsh_client_ui_primitives.JsonTree,
    MessageText: import_dsh_client_ui_primitives.MessageText,
    StateDot: import_dsh_client_ui_primitives.StateDot,
    Tooltip: import_dsh_client_ui_primitives.Tooltip,
    writeClipboard: import_dsh_client_ui_primitives.writeClipboard,
    inventory: controlPlane.inventory
  }));
}

// modules/studio/src/client/browser-entry.js
var browser_entry_exports2 = {};
__export(browser_entry_exports2, {
  apply: () => apply3,
  inject: () => inject3,
  name: () => name3
});
var import_react4 = __toESM(require("react"), 1);
var Primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);

// node_modules/crystra-ui-core/dist/index.js
var import_react3 = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var import_react_dom = require("react-dom");

// node_modules/d3-array/src/ascending.js
function ascending(a2, b2) {
  return a2 == null || b2 == null ? NaN : a2 < b2 ? -1 : a2 > b2 ? 1 : a2 >= b2 ? 0 : NaN;
}

// node_modules/d3-array/src/descending.js
function descending(a2, b2) {
  return a2 == null || b2 == null ? NaN : b2 < a2 ? -1 : b2 > a2 ? 1 : b2 >= a2 ? 0 : NaN;
}

// node_modules/d3-array/src/bisector.js
function bisector(f2) {
  let compare1, compare2, delta;
  if (f2.length !== 2) {
    compare1 = ascending;
    compare2 = (d2, x2) => ascending(f2(d2), x2);
    delta = (d2, x2) => f2(d2) - x2;
  } else {
    compare1 = f2 === ascending || f2 === descending ? f2 : zero;
    compare2 = f2;
    delta = f2;
  }
  function left(a2, x2, lo = 0, hi = a2.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a2[mid], x2) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function right(a2, x2, lo = 0, hi = a2.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a2[mid], x2) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function center(a2, x2, lo = 0, hi = a2.length) {
    const i2 = left(a2, x2, lo, hi - 1);
    return i2 > lo && delta(a2[i2 - 1], x2) > -delta(a2[i2], x2) ? i2 - 1 : i2;
  }
  return { left, center, right };
}
function zero() {
  return 0;
}

// node_modules/d3-array/src/number.js
function number(x2) {
  return x2 === null ? NaN : +x2;
}

// node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector(ascending);
var bisectRight = ascendingBisect.right;
var bisectLeft = ascendingBisect.left;
var bisectCenter = bisector(number).center;
var bisect_default = bisectRight;

// node_modules/internmap/src/index.js
var InternMap = class extends Map {
  constructor(entries, key = keyof) {
    super();
    Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
    if (entries != null) for (const [key2, value] of entries) this.set(key2, value);
  }
  get(key) {
    return super.get(intern_get(this, key));
  }
  has(key) {
    return super.has(intern_get(this, key));
  }
  set(key, value) {
    return super.set(intern_set(this, key), value);
  }
  delete(key) {
    return super.delete(intern_delete(this, key));
  }
};
function intern_get({ _intern, _key }, value) {
  const key = _key(value);
  return _intern.has(key) ? _intern.get(key) : value;
}
function intern_set({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key)) return _intern.get(key);
  _intern.set(key, value);
  return value;
}
function intern_delete({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key)) {
    value = _intern.get(key);
    _intern.delete(key);
  }
  return value;
}
function keyof(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}

// node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50);
var e5 = Math.sqrt(10);
var e2 = Math.sqrt(2);
function tickSpec(start2, stop, count) {
  const step = (stop - start2) / Math.max(0, count), power = Math.floor(Math.log10(step)), error = step / Math.pow(10, power), factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start2 * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start2) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start2 / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start2) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start2, stop, count * 2);
  return [i1, i2, inc];
}
function ticks(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  if (!(count > 0)) return [];
  if (start2 === stop) return [start2];
  const reverse = stop < start2, [i1, i2, inc] = reverse ? tickSpec(stop, start2, count) : tickSpec(start2, stop, count);
  if (!(i2 >= i1)) return [];
  const n2 = i2 - i1 + 1, ticks2 = new Array(n2);
  if (reverse) {
    if (inc < 0) for (let i3 = 0; i3 < n2; ++i3) ticks2[i3] = (i2 - i3) / -inc;
    else for (let i3 = 0; i3 < n2; ++i3) ticks2[i3] = (i2 - i3) * inc;
  } else {
    if (inc < 0) for (let i3 = 0; i3 < n2; ++i3) ticks2[i3] = (i1 + i3) / -inc;
    else for (let i3 = 0; i3 < n2; ++i3) ticks2[i3] = (i1 + i3) * inc;
  }
  return ticks2;
}
function tickIncrement(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  return tickSpec(start2, stop, count)[2];
}
function tickStep(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  const reverse = stop < start2, inc = reverse ? tickIncrement(stop, start2, count) : tickIncrement(start2, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

// node_modules/d3-array/src/range.js
function range(start2, stop, step) {
  start2 = +start2, stop = +stop, step = (n2 = arguments.length) < 2 ? (stop = start2, start2 = 0, 1) : n2 < 3 ? 1 : +step;
  var i2 = -1, n2 = Math.max(0, Math.ceil((stop - start2) / step)) | 0, range2 = new Array(n2);
  while (++i2 < n2) {
    range2[i2] = start2 + i2 * step;
  }
  return range2;
}

// node_modules/d3-dispatch/src/dispatch.js
var noop = { value: () => {
} };
function dispatch() {
  for (var i2 = 0, n2 = arguments.length, _ = {}, t2; i2 < n2; ++i2) {
    if (!(t2 = arguments[i2] + "") || t2 in _ || /[\s.]/.test(t2)) throw new Error("illegal type: " + t2);
    _[t2] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t2) {
    var name5 = "", i2 = t2.indexOf(".");
    if (i2 >= 0) name5 = t2.slice(i2 + 1), t2 = t2.slice(0, i2);
    if (t2 && !types.hasOwnProperty(t2)) throw new Error("unknown type: " + t2);
    return { type: t2, name: name5 };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T2 = parseTypenames(typename + "", _), t2, i2 = -1, n2 = T2.length;
    if (arguments.length < 2) {
      while (++i2 < n2) if ((t2 = (typename = T2[i2]).type) && (t2 = get(_[t2], typename.name))) return t2;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i2 < n2) {
      if (t2 = (typename = T2[i2]).type) _[t2] = set(_[t2], typename.name, callback);
      else if (callback == null) for (t2 in _) _[t2] = set(_[t2], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy2 = {}, _ = this._;
    for (var t2 in _) copy2[t2] = _[t2].slice();
    return new Dispatch(copy2);
  },
  call: function(type2, that) {
    if ((n2 = arguments.length - 2) > 0) for (var args = new Array(n2), i2 = 0, n2, t2; i2 < n2; ++i2) args[i2] = arguments[i2 + 2];
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (t2 = this._[type2], i2 = 0, n2 = t2.length; i2 < n2; ++i2) t2[i2].value.apply(that, args);
  },
  apply: function(type2, that, args) {
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (var t2 = this._[type2], i2 = 0, n2 = t2.length; i2 < n2; ++i2) t2[i2].value.apply(that, args);
  }
};
function get(type2, name5) {
  for (var i2 = 0, n2 = type2.length, c2; i2 < n2; ++i2) {
    if ((c2 = type2[i2]).name === name5) {
      return c2.value;
    }
  }
}
function set(type2, name5, callback) {
  for (var i2 = 0, n2 = type2.length; i2 < n2; ++i2) {
    if (type2[i2].name === name5) {
      type2[i2] = noop, type2 = type2.slice(0, i2).concat(type2.slice(i2 + 1));
      break;
    }
  }
  if (callback != null) type2.push({ name: name5, value: callback });
  return type2;
}
var dispatch_default = dispatch;

// node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

// node_modules/d3-selection/src/namespace.js
function namespace_default(name5) {
  var prefix = name5 += "", i2 = prefix.indexOf(":");
  if (i2 >= 0 && (prefix = name5.slice(0, i2)) !== "xmlns") name5 = name5.slice(i2 + 1);
  return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name5 } : name5;
}

// node_modules/d3-selection/src/creator.js
function creatorInherit(name5) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name5) : document2.createElementNS(uri, name5);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator_default(name5) {
  var fullname = namespace_default(name5);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

// node_modules/d3-selection/src/selector.js
function none() {
}
function selector_default(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

// node_modules/d3-selection/src/selection/select.js
function select_default(select) {
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, subgroup = subgroups[j2] = new Array(n2), node, subnode, i2 = 0; i2 < n2; ++i2) {
      if ((node = group[i2]) && (subnode = select.call(node, node.__data__, i2, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i2] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/array.js
function array(x2) {
  return x2 == null ? [] : Array.isArray(x2) ? x2 : Array.from(x2);
}

// node_modules/d3-selection/src/selectorAll.js
function empty() {
  return [];
}
function selectorAll_default(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

// node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
  return function() {
    return array(select.apply(this, arguments));
  };
}
function selectAll_default(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group[i2]) {
        subgroups.push(select.call(node, node.__data__, i2, group));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}

// node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
  return function() {
    return this.matches(selector);
  };
}
function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

// node_modules/d3-selection/src/selection/selectChild.js
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selectChild_default(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/selectChildren.js
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selectChildren_default(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/filter.js
function filter_default(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, subgroup = subgroups[j2] = [], node, i2 = 0; i2 < n2; ++i2) {
      if ((node = group[i2]) && match.call(node, node.__data__, i2, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
  return new Array(update.length);
}

// node_modules/d3-selection/src/selection/enter.js
function enter_default() {
  return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector) {
    return this._parent.querySelector(selector);
  },
  querySelectorAll: function(selector) {
    return this._parent.querySelectorAll(selector);
  }
};

// node_modules/d3-selection/src/constant.js
function constant_default(x2) {
  return function() {
    return x2;
  };
}

// node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group, enter, update, exit, data) {
  var i2 = 0, node, groupLength = group.length, dataLength = data.length;
  for (; i2 < dataLength; ++i2) {
    if (node = group[i2]) {
      node.__data__ = data[i2];
      update[i2] = node;
    } else {
      enter[i2] = new EnterNode(parent, data[i2]);
    }
  }
  for (; i2 < groupLength; ++i2) {
    if (node = group[i2]) {
      exit[i2] = node;
    }
  }
}
function bindKey(parent, group, enter, update, exit, data, key) {
  var i2, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i2 = 0; i2 < groupLength; ++i2) {
    if (node = group[i2]) {
      keyValues[i2] = keyValue = key.call(node, node.__data__, i2, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i2] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i2 = 0; i2 < dataLength; ++i2) {
    keyValue = key.call(parent, data[i2], i2, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i2] = node;
      node.__data__ = data[i2];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i2] = new EnterNode(parent, data[i2]);
    }
  }
  for (i2 = 0; i2 < groupLength; ++i2) {
    if ((node = group[i2]) && nodeByKeyValue.get(keyValues[i2]) === node) {
      exit[i2] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function data_default(value, key) {
  if (!arguments.length) return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
  if (typeof value !== "function") value = constant_default(value);
  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j2 = 0; j2 < m; ++j2) {
    var parent = parents[j2], group = groups[j2], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j2, parents)), dataLength = data.length, enterGroup = enter[j2] = new Array(dataLength), updateGroup = update[j2] = new Array(dataLength), exitGroup = exit[j2] = new Array(groupLength);
    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}

// node_modules/d3-selection/src/selection/exit.js
function exit_default() {
  return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
}

// node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove();
  else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

// node_modules/d3-selection/src/selection/merge.js
function merge_default(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j2 = 0; j2 < m; ++j2) {
    for (var group0 = groups0[j2], group1 = groups1[j2], n2 = group0.length, merge = merges[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group0[i2] || group1[i2]) {
        merge[i2] = node;
      }
    }
  }
  for (; j2 < m0; ++j2) {
    merges[j2] = groups0[j2];
  }
  return new Selection(merges, this._parents);
}

// node_modules/d3-selection/src/selection/order.js
function order_default() {
  for (var groups = this._groups, j2 = -1, m = groups.length; ++j2 < m; ) {
    for (var group = groups[j2], i2 = group.length - 1, next = group[i2], node; --i2 >= 0; ) {
      if (node = group[i2]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/sort.js
function sort_default(compare) {
  if (!compare) compare = ascending2;
  function compareNode(a2, b2) {
    return a2 && b2 ? compare(a2.__data__, b2.__data__) : !a2 - !b2;
  }
  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, sortgroup = sortgroups[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group[i2]) {
        sortgroup[i2] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending2(a2, b2) {
  return a2 < b2 ? -1 : a2 > b2 ? 1 : a2 >= b2 ? 0 : NaN;
}

// node_modules/d3-selection/src/selection/call.js
function call_default() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

// node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
  return Array.from(this);
}

// node_modules/d3-selection/src/selection/node.js
function node_default() {
  for (var groups = this._groups, j2 = 0, m = groups.length; j2 < m; ++j2) {
    for (var group = groups[j2], i2 = 0, n2 = group.length; i2 < n2; ++i2) {
      var node = group[i2];
      if (node) return node;
    }
  }
  return null;
}

// node_modules/d3-selection/src/selection/size.js
function size_default() {
  let size = 0;
  for (const node of this) ++size;
  return size;
}

// node_modules/d3-selection/src/selection/empty.js
function empty_default() {
  return !this.node();
}

// node_modules/d3-selection/src/selection/each.js
function each_default(callback) {
  for (var groups = this._groups, j2 = 0, m = groups.length; j2 < m; ++j2) {
    for (var group = groups[j2], i2 = 0, n2 = group.length, node; i2 < n2; ++i2) {
      if (node = group[i2]) callback.call(node, node.__data__, i2, group);
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/attr.js
function attrRemove(name5) {
  return function() {
    this.removeAttribute(name5);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name5, value) {
  return function() {
    this.setAttribute(name5, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name5, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null) this.removeAttribute(name5);
    else this.setAttribute(name5, v2);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v2);
  };
}
function attr_default(name5, value) {
  var fullname = namespace_default(name5);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}

// node_modules/d3-selection/src/window.js
function window_default(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

// node_modules/d3-selection/src/selection/style.js
function styleRemove(name5) {
  return function() {
    this.style.removeProperty(name5);
  };
}
function styleConstant(name5, value, priority) {
  return function() {
    this.style.setProperty(name5, value, priority);
  };
}
function styleFunction(name5, value, priority) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null) this.style.removeProperty(name5);
    else this.style.setProperty(name5, v2, priority);
  };
}
function style_default(name5, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name5, value, priority == null ? "" : priority)) : styleValue(this.node(), name5);
}
function styleValue(node, name5) {
  return node.style.getPropertyValue(name5) || window_default(node).getComputedStyle(node, null).getPropertyValue(name5);
}

// node_modules/d3-selection/src/selection/property.js
function propertyRemove(name5) {
  return function() {
    delete this[name5];
  };
}
function propertyConstant(name5, value) {
  return function() {
    this[name5] = value;
  };
}
function propertyFunction(name5, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (v2 == null) delete this[name5];
    else this[name5] = v2;
  };
}
function property_default(name5, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name5, value)) : this.node()[name5];
}

// node_modules/d3-selection/src/selection/classed.js
function classArray(string) {
  return string.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name5) {
    var i2 = this._names.indexOf(name5);
    if (i2 < 0) {
      this._names.push(name5);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name5) {
    var i2 = this._names.indexOf(name5);
    if (i2 >= 0) {
      this._names.splice(i2, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name5) {
    return this._names.indexOf(name5) >= 0;
  }
};
function classedAdd(node, names) {
  var list = classList(node), i2 = -1, n2 = names.length;
  while (++i2 < n2) list.add(names[i2]);
}
function classedRemove(node, names) {
  var list = classList(node), i2 = -1, n2 = names.length;
  while (++i2 < n2) list.remove(names[i2]);
}
function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}
function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}
function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}
function classed_default(name5, value) {
  var names = classArray(name5 + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i2 = -1, n2 = names.length;
    while (++i2 < n2) if (!list.contains(names[i2])) return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}

// node_modules/d3-selection/src/selection/text.js
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v2 = value.apply(this, arguments);
    this.textContent = v2 == null ? "" : v2;
  };
}
function text_default(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}

// node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v2 = value.apply(this, arguments);
    this.innerHTML = v2 == null ? "" : v2;
  };
}
function html_default(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

// node_modules/d3-selection/src/selection/raise.js
function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
  return this.each(raise);
}

// node_modules/d3-selection/src/selection/lower.js
function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
  return this.each(lower);
}

// node_modules/d3-selection/src/selection/append.js
function append_default(name5) {
  var create2 = typeof name5 === "function" ? name5 : creator_default(name5);
  return this.select(function() {
    return this.appendChild(create2.apply(this, arguments));
  });
}

// node_modules/d3-selection/src/selection/insert.js
function constantNull() {
  return null;
}
function insert_default(name5, before) {
  var create2 = typeof name5 === "function" ? name5 : creator_default(name5), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
  return this.select(function() {
    return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

// node_modules/d3-selection/src/selection/remove.js
function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}
function remove_default() {
  return this.each(remove);
}

// node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

// node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

// node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames2(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t2) {
    var name5 = "", i2 = t2.indexOf(".");
    if (i2 >= 0) name5 = t2.slice(i2 + 1), t2 = t2.slice(0, i2);
    return { type: t2, name: name5 };
  });
}
function onRemove(typename) {
  return function() {
    var on2 = this.__on;
    if (!on2) return;
    for (var j2 = 0, i2 = -1, m = on2.length, o2; j2 < m; ++j2) {
      if (o2 = on2[j2], (!typename.type || o2.type === typename.type) && o2.name === typename.name) {
        this.removeEventListener(o2.type, o2.listener, o2.options);
      } else {
        on2[++i2] = o2;
      }
    }
    if (++i2) on2.length = i2;
    else delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on2 = this.__on, o2, listener = contextListener(value);
    if (on2) for (var j2 = 0, m = on2.length; j2 < m; ++j2) {
      if ((o2 = on2[j2]).type === typename.type && o2.name === typename.name) {
        this.removeEventListener(o2.type, o2.listener, o2.options);
        this.addEventListener(o2.type, o2.listener = listener, o2.options = options);
        o2.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o2 = { type: typename.type, name: typename.name, value, listener, options };
    if (!on2) this.__on = [o2];
    else on2.push(o2);
  };
}
function on_default(typename, value, options) {
  var typenames = parseTypenames2(typename + ""), i2, n2 = typenames.length, t2;
  if (arguments.length < 2) {
    var on2 = this.node().__on;
    if (on2) for (var j2 = 0, m = on2.length, o2; j2 < m; ++j2) {
      for (i2 = 0, o2 = on2[j2]; i2 < n2; ++i2) {
        if ((t2 = typenames[i2]).type === o2.type && t2.name === o2.name) {
          return o2.value;
        }
      }
    }
    return;
  }
  on2 = value ? onAdd : onRemove;
  for (i2 = 0; i2 < n2; ++i2) this.each(on2(typenames[i2], value, options));
  return this;
}

// node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type2, params) {
  var window2 = window_default(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type2, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params) event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type2, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params);
  };
}
function dispatchFunction(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params.apply(this, arguments));
  };
}
function dispatch_default2(type2, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
}

// node_modules/d3-selection/src/selection/iterator.js
function* iterator_default() {
  for (var groups = this._groups, j2 = 0, m = groups.length; j2 < m; ++j2) {
    for (var group = groups[j2], i2 = 0, n2 = group.length, node; i2 < n2; ++i2) {
      if (node = group[i2]) yield node;
    }
  }
}

// node_modules/d3-selection/src/selection/index.js
var root = [null];
function Selection(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: select_default,
  selectAll: selectAll_default,
  selectChild: selectChild_default,
  selectChildren: selectChildren_default,
  filter: filter_default,
  data: data_default,
  enter: enter_default,
  exit: exit_default,
  join: join_default,
  merge: merge_default,
  selection: selection_selection,
  order: order_default,
  sort: sort_default,
  call: call_default,
  nodes: nodes_default,
  node: node_default,
  size: size_default,
  empty: empty_default,
  each: each_default,
  attr: attr_default,
  style: style_default,
  property: property_default,
  classed: classed_default,
  text: text_default,
  html: html_default,
  raise: raise_default,
  lower: lower_default,
  append: append_default,
  insert: insert_default,
  remove: remove_default,
  clone: clone_default,
  datum: datum_default,
  on: on_default,
  dispatch: dispatch_default2,
  [Symbol.iterator]: iterator_default
};
var selection_default = selection;

// node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

// node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format2) {
  var m, l2;
  format2 = (format2 + "").trim().toLowerCase();
  return (m = reHex.exec(format2)) ? (l2 = m[1].length, m = parseInt(m[1], 16), l2 === 6 ? rgbn(m) : l2 === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l2 === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l2 === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format2)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format2)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format2)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format2)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format2) ? rgbn(named[format2]) : format2 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n2) {
  return new Rgb(n2 >> 16 & 255, n2 >> 8 & 255, n2 & 255, 1);
}
function rgba(r2, g, b2, a2) {
  if (a2 <= 0) r2 = g = b2 = NaN;
  return new Rgb(r2, g, b2, a2);
}
function rgbConvert(o2) {
  if (!(o2 instanceof Color)) o2 = color(o2);
  if (!o2) return new Rgb();
  o2 = o2.rgb();
  return new Rgb(o2.r, o2.g, o2.b, o2.opacity);
}
function rgb(r2, g, b2, opacity) {
  return arguments.length === 1 ? rgbConvert(r2) : new Rgb(r2, g, b2, opacity == null ? 1 : opacity);
}
function Rgb(r2, g, b2, opacity) {
  this.r = +r2;
  this.g = +g;
  this.b = +b2;
  this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k2) {
    k2 = k2 == null ? brighter : Math.pow(brighter, k2);
    return new Rgb(this.r * k2, this.g * k2, this.b * k2, this.opacity);
  },
  darker(k2) {
    k2 = k2 == null ? darker : Math.pow(darker, k2);
    return new Rgb(this.r * k2, this.g * k2, this.b * k2, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a2 = clampa(this.opacity);
  return `${a2 === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a2 === 1 ? ")" : `, ${a2})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s2, l2, a2) {
  if (a2 <= 0) h = s2 = l2 = NaN;
  else if (l2 <= 0 || l2 >= 1) h = s2 = NaN;
  else if (s2 <= 0) h = NaN;
  return new Hsl(h, s2, l2, a2);
}
function hslConvert(o2) {
  if (o2 instanceof Hsl) return new Hsl(o2.h, o2.s, o2.l, o2.opacity);
  if (!(o2 instanceof Color)) o2 = color(o2);
  if (!o2) return new Hsl();
  if (o2 instanceof Hsl) return o2;
  o2 = o2.rgb();
  var r2 = o2.r / 255, g = o2.g / 255, b2 = o2.b / 255, min2 = Math.min(r2, g, b2), max2 = Math.max(r2, g, b2), h = NaN, s2 = max2 - min2, l2 = (max2 + min2) / 2;
  if (s2) {
    if (r2 === max2) h = (g - b2) / s2 + (g < b2) * 6;
    else if (g === max2) h = (b2 - r2) / s2 + 2;
    else h = (r2 - g) / s2 + 4;
    s2 /= l2 < 0.5 ? max2 + min2 : 2 - max2 - min2;
    h *= 60;
  } else {
    s2 = l2 > 0 && l2 < 1 ? 0 : h;
  }
  return new Hsl(h, s2, l2, o2.opacity);
}
function hsl(h, s2, l2, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s2, l2, opacity == null ? 1 : opacity);
}
function Hsl(h, s2, l2, opacity) {
  this.h = +h;
  this.s = +s2;
  this.l = +l2;
  this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k2) {
    k2 = k2 == null ? brighter : Math.pow(brighter, k2);
    return new Hsl(this.h, this.s, this.l * k2, this.opacity);
  },
  darker(k2) {
    k2 = k2 == null ? darker : Math.pow(darker, k2);
    return new Hsl(this.h, this.s, this.l * k2, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s2 = isNaN(h) || isNaN(this.s) ? 0 : this.s, l2 = this.l, m2 = l2 + (l2 < 0.5 ? l2 : 1 - l2) * s2, m1 = 2 * l2 - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a2 = clampa(this.opacity);
    return `${a2 === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a2 === 1 ? ")" : `, ${a2})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

// node_modules/d3-interpolate/src/basis.js
function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1, t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}
function basis_default(values) {
  var n2 = values.length - 1;
  return function(t2) {
    var i2 = t2 <= 0 ? t2 = 0 : t2 >= 1 ? (t2 = 1, n2 - 1) : Math.floor(t2 * n2), v1 = values[i2], v2 = values[i2 + 1], v0 = i2 > 0 ? values[i2 - 1] : 2 * v1 - v2, v3 = i2 < n2 - 1 ? values[i2 + 2] : 2 * v2 - v1;
    return basis((t2 - i2 / n2) * n2, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values) {
  var n2 = values.length;
  return function(t2) {
    var i2 = Math.floor(((t2 %= 1) < 0 ? ++t2 : t2) * n2), v0 = values[(i2 + n2 - 1) % n2], v1 = values[i2 % n2], v2 = values[(i2 + 1) % n2], v3 = values[(i2 + 2) % n2];
    return basis((t2 - i2 / n2) * n2, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/constant.js
var constant_default2 = (x2) => () => x2;

// node_modules/d3-interpolate/src/color.js
function linear(a2, d2) {
  return function(t2) {
    return a2 + t2 * d2;
  };
}
function exponential(a2, b2, y2) {
  return a2 = Math.pow(a2, y2), b2 = Math.pow(b2, y2) - a2, y2 = 1 / y2, function(t2) {
    return Math.pow(a2 + t2 * b2, y2);
  };
}
function gamma(y2) {
  return (y2 = +y2) === 1 ? nogamma : function(a2, b2) {
    return b2 - a2 ? exponential(a2, b2, y2) : constant_default2(isNaN(a2) ? b2 : a2);
  };
}
function nogamma(a2, b2) {
  var d2 = b2 - a2;
  return d2 ? linear(a2, d2) : constant_default2(isNaN(a2) ? b2 : a2);
}

// node_modules/d3-interpolate/src/rgb.js
var rgb_default = (function rgbGamma(y2) {
  var color2 = gamma(y2);
  function rgb2(start2, end) {
    var r2 = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b2 = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
    return function(t2) {
      start2.r = r2(t2);
      start2.g = g(t2);
      start2.b = b2(t2);
      start2.opacity = opacity(t2);
      return start2 + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
})(1);
function rgbSpline(spline) {
  return function(colors) {
    var n2 = colors.length, r2 = new Array(n2), g = new Array(n2), b2 = new Array(n2), i2, color2;
    for (i2 = 0; i2 < n2; ++i2) {
      color2 = rgb(colors[i2]);
      r2[i2] = color2.r || 0;
      g[i2] = color2.g || 0;
      b2[i2] = color2.b || 0;
    }
    r2 = spline(r2);
    g = spline(g);
    b2 = spline(b2);
    color2.opacity = 1;
    return function(t2) {
      color2.r = r2(t2);
      color2.g = g(t2);
      color2.b = b2(t2);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a2, b2) {
  if (!b2) b2 = [];
  var n2 = a2 ? Math.min(b2.length, a2.length) : 0, c2 = b2.slice(), i2;
  return function(t2) {
    for (i2 = 0; i2 < n2; ++i2) c2[i2] = a2[i2] * (1 - t2) + b2[i2] * t2;
    return c2;
  };
}
function isNumberArray(x2) {
  return ArrayBuffer.isView(x2) && !(x2 instanceof DataView);
}

// node_modules/d3-interpolate/src/array.js
function genericArray(a2, b2) {
  var nb = b2 ? b2.length : 0, na = a2 ? Math.min(nb, a2.length) : 0, x2 = new Array(na), c2 = new Array(nb), i2;
  for (i2 = 0; i2 < na; ++i2) x2[i2] = value_default(a2[i2], b2[i2]);
  for (; i2 < nb; ++i2) c2[i2] = b2[i2];
  return function(t2) {
    for (i2 = 0; i2 < na; ++i2) c2[i2] = x2[i2](t2);
    return c2;
  };
}

// node_modules/d3-interpolate/src/date.js
function date_default(a2, b2) {
  var d2 = /* @__PURE__ */ new Date();
  return a2 = +a2, b2 = +b2, function(t2) {
    return d2.setTime(a2 * (1 - t2) + b2 * t2), d2;
  };
}

// node_modules/d3-interpolate/src/number.js
function number_default(a2, b2) {
  return a2 = +a2, b2 = +b2, function(t2) {
    return a2 * (1 - t2) + b2 * t2;
  };
}

// node_modules/d3-interpolate/src/object.js
function object_default(a2, b2) {
  var i2 = {}, c2 = {}, k2;
  if (a2 === null || typeof a2 !== "object") a2 = {};
  if (b2 === null || typeof b2 !== "object") b2 = {};
  for (k2 in b2) {
    if (k2 in a2) {
      i2[k2] = value_default(a2[k2], b2[k2]);
    } else {
      c2[k2] = b2[k2];
    }
  }
  return function(t2) {
    for (k2 in i2) c2[k2] = i2[k2](t2);
    return c2;
  };
}

// node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero2(b2) {
  return function() {
    return b2;
  };
}
function one(b2) {
  return function(t2) {
    return b2(t2) + "";
  };
}
function string_default(a2, b2) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i2 = -1, s2 = [], q2 = [];
  a2 = a2 + "", b2 = b2 + "";
  while ((am = reA.exec(a2)) && (bm = reB.exec(b2))) {
    if ((bs = bm.index) > bi) {
      bs = b2.slice(bi, bs);
      if (s2[i2]) s2[i2] += bs;
      else s2[++i2] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s2[i2]) s2[i2] += bm;
      else s2[++i2] = bm;
    } else {
      s2[++i2] = null;
      q2.push({ i: i2, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b2.length) {
    bs = b2.slice(bi);
    if (s2[i2]) s2[i2] += bs;
    else s2[++i2] = bs;
  }
  return s2.length < 2 ? q2[0] ? one(q2[0].x) : zero2(b2) : (b2 = q2.length, function(t2) {
    for (var i3 = 0, o2; i3 < b2; ++i3) s2[(o2 = q2[i3]).i] = o2.x(t2);
    return s2.join("");
  });
}

// node_modules/d3-interpolate/src/value.js
function value_default(a2, b2) {
  var t2 = typeof b2, c2;
  return b2 == null || t2 === "boolean" ? constant_default2(b2) : (t2 === "number" ? number_default : t2 === "string" ? (c2 = color(b2)) ? (b2 = c2, rgb_default) : string_default : b2 instanceof color ? rgb_default : b2 instanceof Date ? date_default : isNumberArray(b2) ? numberArray_default : Array.isArray(b2) ? genericArray : typeof b2.valueOf !== "function" && typeof b2.toString !== "function" || isNaN(b2) ? object_default : number_default)(a2, b2);
}

// node_modules/d3-interpolate/src/round.js
function round_default(a2, b2) {
  return a2 = +a2, b2 = +b2, function(t2) {
    return Math.round(a2 * (1 - t2) + b2 * t2);
  };
}

// node_modules/d3-interpolate/src/transform/decompose.js
var degrees = 180 / Math.PI;
var identity = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose_default(a2, b2, c2, d2, e3, f2) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a2 * a2 + b2 * b2)) a2 /= scaleX, b2 /= scaleX;
  if (skewX = a2 * c2 + b2 * d2) c2 -= a2 * skewX, d2 -= b2 * skewX;
  if (scaleY = Math.sqrt(c2 * c2 + d2 * d2)) c2 /= scaleY, d2 /= scaleY, skewX /= scaleY;
  if (a2 * d2 < b2 * c2) a2 = -a2, b2 = -b2, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e3,
    translateY: f2,
    rotate: Math.atan2(b2, a2) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX,
    scaleY
  };
}

// node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
  if (value == null) return identity;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
  value = value.matrix;
  return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

// node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse, pxComma, pxParen, degParen) {
  function pop(s2) {
    return s2.length ? s2.pop() + " " : "";
  }
  function translate(xa, ya, xb, yb, s2, q2) {
    if (xa !== xb || ya !== yb) {
      var i2 = s2.push("translate(", null, pxComma, null, pxParen);
      q2.push({ i: i2 - 4, x: number_default(xa, xb) }, { i: i2 - 2, x: number_default(ya, yb) });
    } else if (xb || yb) {
      s2.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a2, b2, s2, q2) {
    if (a2 !== b2) {
      if (a2 - b2 > 180) b2 += 360;
      else if (b2 - a2 > 180) a2 += 360;
      q2.push({ i: s2.push(pop(s2) + "rotate(", null, degParen) - 2, x: number_default(a2, b2) });
    } else if (b2) {
      s2.push(pop(s2) + "rotate(" + b2 + degParen);
    }
  }
  function skewX(a2, b2, s2, q2) {
    if (a2 !== b2) {
      q2.push({ i: s2.push(pop(s2) + "skewX(", null, degParen) - 2, x: number_default(a2, b2) });
    } else if (b2) {
      s2.push(pop(s2) + "skewX(" + b2 + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s2, q2) {
    if (xa !== xb || ya !== yb) {
      var i2 = s2.push(pop(s2) + "scale(", null, ",", null, ")");
      q2.push({ i: i2 - 4, x: number_default(xa, xb) }, { i: i2 - 2, x: number_default(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s2.push(pop(s2) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a2, b2) {
    var s2 = [], q2 = [];
    a2 = parse(a2), b2 = parse(b2);
    translate(a2.translateX, a2.translateY, b2.translateX, b2.translateY, s2, q2);
    rotate(a2.rotate, b2.rotate, s2, q2);
    skewX(a2.skewX, b2.skewX, s2, q2);
    scale(a2.scaleX, a2.scaleY, b2.scaleX, b2.scaleY, s2, q2);
    a2 = b2 = null;
    return function(t2) {
      var i2 = -1, n2 = q2.length, o2;
      while (++i2 < n2) s2[(o2 = q2[i2]).i] = o2.x(t2);
      return s2.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

// node_modules/d3-timer/src/timer.js
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f2) {
  setTimeout(f2, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time) {
  var t2 = new Timer();
  t2.restart(callback, delay, time);
  return t2;
}
function timerFlush() {
  now();
  ++frame;
  var t2 = taskHead, e3;
  while (t2) {
    if ((e3 = clockNow - t2._time) >= 0) t2._call.call(void 0, e3);
    t2 = t2._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}
function sleep(time) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow;
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

// node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time) {
  var t2 = new Timer();
  delay = delay == null ? 0 : +delay;
  t2.restart((elapsed) => {
    t2.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t2;
}

// node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name5, id2, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id2 in schedules) return;
  create(node, id2, {
    name: name5,
    index,
    // For context during callback.
    group,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}
function set2(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}
function get2(node, id2) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
  return schedule;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule, 0, self.time);
  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed) start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i2, j2, n2, o2;
    if (self.state !== SCHEDULED) return stop();
    for (i2 in schedules) {
      o2 = schedules[i2];
      if (o2.name !== self.name) continue;
      if (o2.state === STARTED) return timeout_default(start2);
      if (o2.state === RUNNING) {
        o2.state = ENDED;
        o2.timer.stop();
        o2.on.call("interrupt", node, node.__data__, o2.index, o2.group);
        delete schedules[i2];
      } else if (+i2 < id2) {
        o2.state = ENDED;
        o2.timer.stop();
        o2.on.call("cancel", node, node.__data__, o2.index, o2.group);
        delete schedules[i2];
      }
    }
    timeout_default(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return;
    self.state = STARTED;
    tween = new Array(n2 = self.tween.length);
    for (i2 = 0, j2 = -1; i2 < n2; ++i2) {
      if (o2 = self.tween[i2].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j2] = o2;
      }
    }
    tween.length = j2 + 1;
  }
  function tick(elapsed) {
    var t2 = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i2 = -1, n2 = tween.length;
    while (++i2 < n2) {
      tween[i2].call(node, t2);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i2 in schedules) return;
    delete node.__transition;
  }
}

// node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name5) {
  var schedules = node.__transition, schedule, active, empty2 = true, i2;
  if (!schedules) return;
  name5 = name5 == null ? null : name5 + "";
  for (i2 in schedules) {
    if ((schedule = schedules[i2]).name !== name5) {
      empty2 = false;
      continue;
    }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i2];
  }
  if (empty2) delete node.__transition;
}

// node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default2(name5) {
  return this.each(function() {
    interrupt_default(this, name5);
  });
}

// node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id2, name5) {
  var tween0, tween1;
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i2 = 0, n2 = tween1.length; i2 < n2; ++i2) {
        if (tween1[i2].name === name5) {
          tween1 = tween1.slice();
          tween1.splice(i2, 1);
          break;
        }
      }
    }
    schedule.tween = tween1;
  };
}
function tweenFunction(id2, name5, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error();
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t2 = { name: name5, value }, i2 = 0, n2 = tween1.length; i2 < n2; ++i2) {
        if (tween1[i2].name === name5) {
          tween1[i2] = t2;
          break;
        }
      }
      if (i2 === n2) tween1.push(t2);
    }
    schedule.tween = tween1;
  };
}
function tween_default(name5, value) {
  var id2 = this._id;
  name5 += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i2 = 0, n2 = tween.length, t2; i2 < n2; ++i2) {
      if ((t2 = tween[i2]).name === name5) {
        return t2.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name5, value));
}
function tweenValue(transition2, name5, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule = set2(this, id2);
    (schedule.value || (schedule.value = {}))[name5] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name5];
  };
}

// node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default(a2, b2) {
  var c2;
  return (typeof b2 === "number" ? number_default : b2 instanceof color ? rgb_default : (c2 = color(b2)) ? (b2 = c2, rgb_default) : string_default)(a2, b2);
}

// node_modules/d3-transition/src/transition/attr.js
function attrRemove2(name5) {
  return function() {
    this.removeAttribute(name5);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name5, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name5);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrFunction2(name5, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name5);
    string0 = this.getAttribute(name5);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attr_default2(name5, value) {
  var fullname = namespace_default(name5), i2 = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
  return this.attrTween(name5, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i2, tweenValue(this, "attr." + name5, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i2, value));
}

// node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name5, i2) {
  return function(t2) {
    this.setAttribute(name5, i2.call(this, t2));
  };
}
function attrInterpolateNS(fullname, i2) {
  return function(t2) {
    this.setAttributeNS(fullname.space, fullname.local, i2.call(this, t2));
  };
}
function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0) t0 = (i0 = i2) && attrInterpolateNS(fullname, i2);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween(name5, value) {
  var t0, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0) t0 = (i0 = i2) && attrInterpolate(name5, i2);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween_default(name5, value) {
  var key = "attr." + name5;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  var fullname = namespace_default(name5);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

// node_modules/d3-transition/src/transition/delay.js
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function delay_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}

// node_modules/d3-transition/src/transition/duration.js
function durationFunction(id2, value) {
  return function() {
    set2(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set2(this, id2).duration = value;
  };
}
function duration_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}

// node_modules/d3-transition/src/transition/ease.js
function easeConstant(id2, value) {
  if (typeof value !== "function") throw new Error();
  return function() {
    set2(this, id2).ease = value;
  };
}
function ease_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}

// node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id2, value) {
  return function() {
    var v2 = value.apply(this, arguments);
    if (typeof v2 !== "function") throw new Error();
    set2(this, id2).ease = v2;
  };
}
function easeVarying_default(value) {
  if (typeof value !== "function") throw new Error();
  return this.each(easeVarying(this._id, value));
}

// node_modules/d3-transition/src/transition/filter.js
function filter_default2(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, subgroup = subgroups[j2] = [], node, i2 = 0; i2 < n2; ++i2) {
      if ((node = group[i2]) && match.call(node, node.__data__, i2, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/merge.js
function merge_default2(transition2) {
  if (transition2._id !== this._id) throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j2 = 0; j2 < m; ++j2) {
    for (var group0 = groups0[j2], group1 = groups1[j2], n2 = group0.length, merge = merges[j2] = new Array(n2), node, i2 = 0; i2 < n2; ++i2) {
      if (node = group0[i2] || group1[i2]) {
        merge[i2] = node;
      }
    }
  }
  for (; j2 < m0; ++j2) {
    merges[j2] = groups0[j2];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/on.js
function start(name5) {
  return (name5 + "").trim().split(/^|\s+/).every(function(t2) {
    var i2 = t2.indexOf(".");
    if (i2 >= 0) t2 = t2.slice(0, i2);
    return !t2 || t2 === "start";
  });
}
function onFunction(id2, name5, listener) {
  var on0, on1, sit = start(name5) ? init : set2;
  return function() {
    var schedule = sit(this, id2), on2 = schedule.on;
    if (on2 !== on0) (on1 = (on0 = on2).copy()).on(name5, listener);
    schedule.on = on1;
  };
}
function on_default2(name5, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name5) : this.each(onFunction(id2, name5, listener));
}

// node_modules/d3-transition/src/transition/remove.js
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i2 in this.__transition) if (+i2 !== id2) return;
    if (parent) parent.removeChild(this);
  };
}
function remove_default2() {
  return this.on("end.remove", removeFunction(this._id));
}

// node_modules/d3-transition/src/transition/select.js
function select_default2(select) {
  var name5 = this._name, id2 = this._id;
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, subgroup = subgroups[j2] = new Array(n2), node, subnode, i2 = 0; i2 < n2; ++i2) {
      if ((node = group[i2]) && (subnode = select.call(node, node.__data__, i2, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i2] = subnode;
        schedule_default(subgroup[i2], name5, id2, i2, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name5, id2);
}

// node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default2(select) {
  var name5 = this._name, id2 = this._id;
  if (typeof select !== "function") select = selectorAll_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group[i2]) {
        for (var children2 = select.call(node, node.__data__, i2, group), child, inherit2 = get2(node, id2), k2 = 0, l2 = children2.length; k2 < l2; ++k2) {
          if (child = children2[k2]) {
            schedule_default(child, name5, id2, k2, children2, inherit2);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name5, id2);
}

// node_modules/d3-transition/src/transition/selection.js
var Selection2 = selection_default.prototype.constructor;
function selection_default2() {
  return new Selection2(this._groups, this._parents);
}

// node_modules/d3-transition/src/transition/style.js
function styleNull(name5, interpolate) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name5), string1 = (this.style.removeProperty(name5), styleValue(this, name5));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name5) {
  return function() {
    this.style.removeProperty(name5);
  };
}
function styleConstant2(name5, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name5);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function styleFunction2(name5, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name5), value1 = value(this), string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name5), styleValue(this, name5));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name5) {
  var on0, on1, listener0, key = "style." + name5, event = "end." + key, remove2;
  return function() {
    var schedule = set2(this, id2), on2 = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name5)) : void 0;
    if (on2 !== on0 || listener0 !== listener) (on1 = (on0 = on2).copy()).on(event, listener0 = listener);
    schedule.on = on1;
  };
}
function style_default2(name5, value, priority) {
  var i2 = (name5 += "") === "transform" ? interpolateTransformCss : interpolate_default;
  return value == null ? this.styleTween(name5, styleNull(name5, i2)).on("end.style." + name5, styleRemove2(name5)) : typeof value === "function" ? this.styleTween(name5, styleFunction2(name5, i2, tweenValue(this, "style." + name5, value))).each(styleMaybeRemove(this._id, name5)) : this.styleTween(name5, styleConstant2(name5, i2, value), priority).on("end.style." + name5, null);
}

// node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name5, i2, priority) {
  return function(t2) {
    this.style.setProperty(name5, i2.call(this, t2), priority);
  };
}
function styleTween(name5, value, priority) {
  var t2, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0) t2 = (i0 = i2) && styleInterpolate(name5, i2, priority);
    return t2;
  }
  tween._value = value;
  return tween;
}
function styleTween_default(name5, value, priority) {
  var key = "style." + (name5 += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, styleTween(name5, value, priority == null ? "" : priority));
}

// node_modules/d3-transition/src/transition/text.js
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function text_default2(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}

// node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i2) {
  return function(t2) {
    this.textContent = i2.call(this, t2);
  };
}
function textTween(value) {
  var t0, i0;
  function tween() {
    var i2 = value.apply(this, arguments);
    if (i2 !== i0) t0 = (i0 = i2) && textInterpolate(i2);
    return t0;
  }
  tween._value = value;
  return tween;
}
function textTween_default(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, textTween(value));
}

// node_modules/d3-transition/src/transition/transition.js
function transition_default() {
  var name5 = this._name, id0 = this._id, id1 = newId();
  for (var groups = this._groups, m = groups.length, j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group[i2]) {
        var inherit2 = get2(node, id0);
        schedule_default(node, name5, id1, i2, group, {
          time: inherit2.time + inherit2.delay + inherit2.duration,
          delay: 0,
          duration: inherit2.duration,
          ease: inherit2.ease
        });
      }
    }
  }
  return new Transition(groups, this._parents, name5, id1);
}

// node_modules/d3-transition/src/transition/end.js
function end_default() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0) resolve();
    } };
    that.each(function() {
      var schedule = set2(this, id2), on2 = schedule.on;
      if (on2 !== on0) {
        on1 = (on0 = on2).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule.on = on1;
    });
    if (size === 0) resolve();
  });
}

// node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups, parents, name5, id2) {
  this._groups = groups;
  this._parents = parents;
  this._name = name5;
  this._id = id2;
}
function transition(name5) {
  return selection_default().transition(name5);
}
function newId() {
  return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: select_default2,
  selectAll: selectAll_default2,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: filter_default2,
  merge: merge_default2,
  selection: selection_default2,
  transition: transition_default,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: on_default2,
  attr: attr_default2,
  attrTween: attrTween_default,
  style: style_default2,
  styleTween: styleTween_default,
  text: text_default2,
  textTween: textTween_default,
  remove: remove_default2,
  tween: tween_default,
  delay: delay_default,
  duration: duration_default,
  ease: ease_default,
  easeVarying: easeVarying_default,
  end: end_default,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

// node_modules/d3-ease/src/cubic.js
function cubicInOut(t2) {
  return ((t2 *= 2) <= 1 ? t2 * t2 * t2 : (t2 -= 2) * t2 * t2 + 2) / 2;
}

// node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function transition_default2(name5) {
  var id2, timing;
  if (name5 instanceof Transition) {
    id2 = name5._id, name5 = name5._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name5 = name5 == null ? null : name5 + "";
  }
  for (var groups = this._groups, m = groups.length, j2 = 0; j2 < m; ++j2) {
    for (var group = groups[j2], n2 = group.length, node, i2 = 0; i2 < n2; ++i2) {
      if (node = group[i2]) {
        schedule_default(node, name5, id2, i2, group, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups, this._parents, name5, id2);
}

// node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default2;
selection_default.prototype.transition = transition_default2;

// node_modules/d3-brush/src/brush.js
var { abs, max, min } = Math;
function number1(e3) {
  return [+e3[0], +e3[1]];
}
function number2(e3) {
  return [number1(e3[0]), number1(e3[1])];
}
var X = {
  name: "x",
  handles: ["w", "e"].map(type),
  input: function(x2, e3) {
    return x2 == null ? null : [[+x2[0], e3[0][1]], [+x2[1], e3[1][1]]];
  },
  output: function(xy) {
    return xy && [xy[0][0], xy[1][0]];
  }
};
var Y = {
  name: "y",
  handles: ["n", "s"].map(type),
  input: function(y2, e3) {
    return y2 == null ? null : [[e3[0][0], +y2[0]], [e3[1][0], +y2[1]]];
  },
  output: function(xy) {
    return xy && [xy[0][1], xy[1][1]];
  }
};
var XY = {
  name: "xy",
  handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
  input: function(xy) {
    return xy == null ? null : number2(xy);
  },
  output: function(xy) {
    return xy;
  }
};
function type(t2) {
  return { type: t2 };
}

// node_modules/d3-format/src/formatDecimal.js
function formatDecimal_default(x2) {
  return Math.abs(x2 = Math.round(x2)) >= 1e21 ? x2.toLocaleString("en").replace(/,/g, "") : x2.toString(10);
}
function formatDecimalParts(x2, p) {
  if (!isFinite(x2) || x2 === 0) return null;
  var i2 = (x2 = p ? x2.toExponential(p - 1) : x2.toExponential()).indexOf("e"), coefficient = x2.slice(0, i2);
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x2.slice(i2 + 1)
  ];
}

// node_modules/d3-format/src/exponent.js
function exponent_default(x2) {
  return x2 = formatDecimalParts(Math.abs(x2)), x2 ? x2[1] : NaN;
}

// node_modules/d3-format/src/formatGroup.js
function formatGroup_default(grouping, thousands) {
  return function(value, width) {
    var i2 = value.length, t2 = [], j2 = 0, g = grouping[0], length = 0;
    while (i2 > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t2.push(value.substring(i2 -= g, i2 + g));
      if ((length += g + 1) > width) break;
      g = grouping[j2 = (j2 + 1) % grouping.length];
    }
    return t2.reverse().join(thousands);
  };
}

// node_modules/d3-format/src/formatNumerals.js
function formatNumerals_default(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i2) {
      return numerals[+i2];
    });
  };
}

// node_modules/d3-format/src/formatSpecifier.js
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}
formatSpecifier.prototype = FormatSpecifier.prototype;
function FormatSpecifier(specifier) {
  this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
  this.align = specifier.align === void 0 ? ">" : specifier.align + "";
  this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === void 0 ? void 0 : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === void 0 ? "" : specifier.type + "";
}
FormatSpecifier.prototype.toString = function() {
  return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

// node_modules/d3-format/src/formatTrim.js
function formatTrim_default(s2) {
  out: for (var n2 = s2.length, i2 = 1, i0 = -1, i1; i2 < n2; ++i2) {
    switch (s2[i2]) {
      case ".":
        i0 = i1 = i2;
        break;
      case "0":
        if (i0 === 0) i0 = i2;
        i1 = i2;
        break;
      default:
        if (!+s2[i2]) break out;
        if (i0 > 0) i0 = 0;
        break;
    }
  }
  return i0 > 0 ? s2.slice(0, i0) + s2.slice(i1 + 1) : s2;
}

// node_modules/d3-format/src/formatPrefixAuto.js
var prefixExponent;
function formatPrefixAuto_default(x2, p) {
  var d2 = formatDecimalParts(x2, p);
  if (!d2) return prefixExponent = void 0, x2.toPrecision(p);
  var coefficient = d2[0], exponent = d2[1], i2 = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1, n2 = coefficient.length;
  return i2 === n2 ? coefficient : i2 > n2 ? coefficient + new Array(i2 - n2 + 1).join("0") : i2 > 0 ? coefficient.slice(0, i2) + "." + coefficient.slice(i2) : "0." + new Array(1 - i2).join("0") + formatDecimalParts(x2, Math.max(0, p + i2 - 1))[0];
}

// node_modules/d3-format/src/formatRounded.js
function formatRounded_default(x2, p) {
  var d2 = formatDecimalParts(x2, p);
  if (!d2) return x2 + "";
  var coefficient = d2[0], exponent = d2[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

// node_modules/d3-format/src/formatTypes.js
var formatTypes_default = {
  "%": (x2, p) => (x2 * 100).toFixed(p),
  "b": (x2) => Math.round(x2).toString(2),
  "c": (x2) => x2 + "",
  "d": formatDecimal_default,
  "e": (x2, p) => x2.toExponential(p),
  "f": (x2, p) => x2.toFixed(p),
  "g": (x2, p) => x2.toPrecision(p),
  "o": (x2) => Math.round(x2).toString(8),
  "p": (x2, p) => formatRounded_default(x2 * 100, p),
  "r": formatRounded_default,
  "s": formatPrefixAuto_default,
  "X": (x2) => Math.round(x2).toString(16).toUpperCase(),
  "x": (x2) => Math.round(x2).toString(16)
};

// node_modules/d3-format/src/identity.js
function identity_default(x2) {
  return x2;
}

// node_modules/d3-format/src/locale.js
var map = Array.prototype.map;
var prefixes = ["y", "z", "a", "f", "p", "n", "\xB5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
function locale_default(locale2) {
  var group = locale2.grouping === void 0 || locale2.thousands === void 0 ? identity_default : formatGroup_default(map.call(locale2.grouping, Number), locale2.thousands + ""), currencyPrefix = locale2.currency === void 0 ? "" : locale2.currency[0] + "", currencySuffix = locale2.currency === void 0 ? "" : locale2.currency[1] + "", decimal = locale2.decimal === void 0 ? "." : locale2.decimal + "", numerals = locale2.numerals === void 0 ? identity_default : formatNumerals_default(map.call(locale2.numerals, String)), percent = locale2.percent === void 0 ? "%" : locale2.percent + "", minus = locale2.minus === void 0 ? "\u2212" : locale2.minus + "", nan = locale2.nan === void 0 ? "NaN" : locale2.nan + "";
  function newFormat(specifier, options) {
    specifier = formatSpecifier(specifier);
    var fill = specifier.fill, align = specifier.align, sign = specifier.sign, symbol = specifier.symbol, zero3 = specifier.zero, width = specifier.width, comma = specifier.comma, precision = specifier.precision, trim = specifier.trim, type2 = specifier.type;
    if (type2 === "n") comma = true, type2 = "g";
    else if (!formatTypes_default[type2]) precision === void 0 && (precision = 12), trim = true, type2 = "g";
    if (zero3 || fill === "0" && align === "=") zero3 = true, fill = "0", align = "=";
    var prefix = (options && options.prefix !== void 0 ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type2) ? "0" + type2.toLowerCase() : ""), suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type2) ? percent : "") + (options && options.suffix !== void 0 ? options.suffix : "");
    var formatType = formatTypes_default[type2], maybeSuffix = /[defgprs%]/.test(type2);
    precision = precision === void 0 ? 6 : /[gprs]/.test(type2) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));
    function format2(value) {
      var valuePrefix = prefix, valueSuffix = suffix, i2, n2, c2;
      if (type2 === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;
        var valueNegative = value < 0 || 1 / value < 0;
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);
        if (trim) value = formatTrim_default(value);
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;
        valuePrefix = (valueNegative ? sign === "(" ? sign : minus : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type2 === "s" && !isNaN(value) && prefixExponent !== void 0 ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");
        if (maybeSuffix) {
          i2 = -1, n2 = value.length;
          while (++i2 < n2) {
            if (c2 = value.charCodeAt(i2), 48 > c2 || c2 > 57) {
              valueSuffix = (c2 === 46 ? decimal + value.slice(i2 + 1) : value.slice(i2)) + valueSuffix;
              value = value.slice(0, i2);
              break;
            }
          }
        }
      }
      if (comma && !zero3) value = group(value, Infinity);
      var length = valuePrefix.length + value.length + valueSuffix.length, padding = length < width ? new Array(width - length + 1).join(fill) : "";
      if (comma && zero3) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
      switch (align) {
        case "<":
          value = valuePrefix + value + valueSuffix + padding;
          break;
        case "=":
          value = valuePrefix + padding + value + valueSuffix;
          break;
        case "^":
          value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
          break;
        default:
          value = padding + valuePrefix + value + valueSuffix;
          break;
      }
      return numerals(value);
    }
    format2.toString = function() {
      return specifier + "";
    };
    return format2;
  }
  function formatPrefix2(specifier, value) {
    var e3 = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k2 = Math.pow(10, -e3), f2 = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), { suffix: prefixes[8 + e3 / 3] });
    return function(value2) {
      return f2(k2 * value2);
    };
  }
  return {
    format: newFormat,
    formatPrefix: formatPrefix2
  };
}

// node_modules/d3-format/src/defaultLocale.js
var locale;
var format;
var formatPrefix;
defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});
function defaultLocale(definition) {
  locale = locale_default(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

// node_modules/d3-format/src/precisionFixed.js
function precisionFixed_default(step) {
  return Math.max(0, -exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionPrefix.js
function precisionPrefix_default(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionRound.js
function precisionRound_default(step, max2) {
  step = Math.abs(step), max2 = Math.abs(max2) - step;
  return Math.max(0, exponent_default(max2) - exponent_default(step)) + 1;
}

// node_modules/d3-scale/src/init.js
function initRange(domain, range2) {
  switch (arguments.length) {
    case 0:
      break;
    case 1:
      this.range(domain);
      break;
    default:
      this.range(range2).domain(domain);
      break;
  }
  return this;
}

// node_modules/d3-scale/src/ordinal.js
var implicit = Symbol("implicit");
function ordinal() {
  var index = new InternMap(), domain = [], range2 = [], unknown = implicit;
  function scale(d2) {
    let i2 = index.get(d2);
    if (i2 === void 0) {
      if (unknown !== implicit) return unknown;
      index.set(d2, i2 = domain.push(d2) - 1);
    }
    return range2[i2 % range2.length];
  }
  scale.domain = function(_) {
    if (!arguments.length) return domain.slice();
    domain = [], index = new InternMap();
    for (const value of _) {
      if (index.has(value)) continue;
      index.set(value, domain.push(value) - 1);
    }
    return scale;
  };
  scale.range = function(_) {
    return arguments.length ? (range2 = Array.from(_), scale) : range2.slice();
  };
  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };
  scale.copy = function() {
    return ordinal(domain, range2).unknown(unknown);
  };
  initRange.apply(scale, arguments);
  return scale;
}

// node_modules/d3-scale/src/band.js
function band() {
  var scale = ordinal().unknown(void 0), domain = scale.domain, ordinalRange = scale.range, r0 = 0, r1 = 1, step, bandwidth, round = false, paddingInner = 0, paddingOuter = 0, align = 0.5;
  delete scale.unknown;
  function rescale() {
    var n2 = domain().length, reverse = r1 < r0, start2 = reverse ? r1 : r0, stop = reverse ? r0 : r1;
    step = (stop - start2) / Math.max(1, n2 - paddingInner + paddingOuter * 2);
    if (round) step = Math.floor(step);
    start2 += (stop - start2 - step * (n2 - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round) start2 = Math.round(start2), bandwidth = Math.round(bandwidth);
    var values = range(n2).map(function(i2) {
      return start2 + step * i2;
    });
    return ordinalRange(reverse ? values.reverse() : values);
  }
  scale.domain = function(_) {
    return arguments.length ? (domain(_), rescale()) : domain();
  };
  scale.range = function(_) {
    return arguments.length ? ([r0, r1] = _, r0 = +r0, r1 = +r1, rescale()) : [r0, r1];
  };
  scale.rangeRound = function(_) {
    return [r0, r1] = _, r0 = +r0, r1 = +r1, round = true, rescale();
  };
  scale.bandwidth = function() {
    return bandwidth;
  };
  scale.step = function() {
    return step;
  };
  scale.round = function(_) {
    return arguments.length ? (round = !!_, rescale()) : round;
  };
  scale.padding = function(_) {
    return arguments.length ? (paddingInner = Math.min(1, paddingOuter = +_), rescale()) : paddingInner;
  };
  scale.paddingInner = function(_) {
    return arguments.length ? (paddingInner = Math.min(1, _), rescale()) : paddingInner;
  };
  scale.paddingOuter = function(_) {
    return arguments.length ? (paddingOuter = +_, rescale()) : paddingOuter;
  };
  scale.align = function(_) {
    return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
  };
  scale.copy = function() {
    return band(domain(), [r0, r1]).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
  };
  return initRange.apply(rescale(), arguments);
}
function pointish(scale) {
  var copy2 = scale.copy;
  scale.padding = scale.paddingOuter;
  delete scale.paddingInner;
  delete scale.paddingOuter;
  scale.copy = function() {
    return pointish(copy2());
  };
  return scale;
}
function point() {
  return pointish(band.apply(null, arguments).paddingInner(1));
}

// node_modules/d3-scale/src/constant.js
function constants(x2) {
  return function() {
    return x2;
  };
}

// node_modules/d3-scale/src/number.js
function number3(x2) {
  return +x2;
}

// node_modules/d3-scale/src/continuous.js
var unit = [0, 1];
function identity2(x2) {
  return x2;
}
function normalize(a2, b2) {
  return (b2 -= a2 = +a2) ? function(x2) {
    return (x2 - a2) / b2;
  } : constants(isNaN(b2) ? NaN : 0.5);
}
function clamper(a2, b2) {
  var t2;
  if (a2 > b2) t2 = a2, a2 = b2, b2 = t2;
  return function(x2) {
    return Math.max(a2, Math.min(b2, x2));
  };
}
function bimap(domain, range2, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range2[0], r1 = range2[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x2) {
    return r0(d0(x2));
  };
}
function polymap(domain, range2, interpolate) {
  var j2 = Math.min(domain.length, range2.length) - 1, d2 = new Array(j2), r2 = new Array(j2), i2 = -1;
  if (domain[j2] < domain[0]) {
    domain = domain.slice().reverse();
    range2 = range2.slice().reverse();
  }
  while (++i2 < j2) {
    d2[i2] = normalize(domain[i2], domain[i2 + 1]);
    r2[i2] = interpolate(range2[i2], range2[i2 + 1]);
  }
  return function(x2) {
    var i3 = bisect_default(domain, x2, 1, j2) - 1;
    return r2[i3](d2[i3](x2));
  };
}
function copy(source, target) {
  return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
}
function transformer() {
  var domain = unit, range2 = unit, interpolate = value_default, transform2, untransform, unknown, clamp = identity2, piecewise, output, input;
  function rescale() {
    var n2 = Math.min(domain.length, range2.length);
    if (clamp !== identity2) clamp = clamper(domain[0], domain[n2 - 1]);
    piecewise = n2 > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }
  function scale(x2) {
    return x2 == null || isNaN(x2 = +x2) ? unknown : (output || (output = piecewise(domain.map(transform2), range2, interpolate)))(transform2(clamp(x2)));
  }
  scale.invert = function(y2) {
    return clamp(untransform((input || (input = piecewise(range2, domain.map(transform2), number_default)))(y2)));
  };
  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number3), rescale()) : domain.slice();
  };
  scale.range = function(_) {
    return arguments.length ? (range2 = Array.from(_), rescale()) : range2.slice();
  };
  scale.rangeRound = function(_) {
    return range2 = Array.from(_), interpolate = round_default, rescale();
  };
  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity2, rescale()) : clamp !== identity2;
  };
  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };
  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };
  return function(t2, u2) {
    transform2 = t2, untransform = u2;
    return rescale();
  };
}
function continuous() {
  return transformer()(identity2, identity2);
}

// node_modules/d3-scale/src/tickFormat.js
function tickFormat(start2, stop, count, specifier) {
  var step = tickStep(start2, stop, count), precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start2), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix_default(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound_default(step, Math.max(Math.abs(start2), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed_default(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

// node_modules/d3-scale/src/linear.js
function linearish(scale) {
  var domain = scale.domain;
  scale.ticks = function(count) {
    var d2 = domain();
    return ticks(d2[0], d2[d2.length - 1], count == null ? 10 : count);
  };
  scale.tickFormat = function(count, specifier) {
    var d2 = domain();
    return tickFormat(d2[0], d2[d2.length - 1], count == null ? 10 : count, specifier);
  };
  scale.nice = function(count) {
    if (count == null) count = 10;
    var d2 = domain();
    var i0 = 0;
    var i1 = d2.length - 1;
    var start2 = d2[i0];
    var stop = d2[i1];
    var prestep;
    var step;
    var maxIter = 10;
    if (stop < start2) {
      step = start2, start2 = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    while (maxIter-- > 0) {
      step = tickIncrement(start2, stop, count);
      if (step === prestep) {
        d2[i0] = start2;
        d2[i1] = stop;
        return domain(d2);
      } else if (step > 0) {
        start2 = Math.floor(start2 / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start2 = Math.ceil(start2 * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }
    return scale;
  };
  return scale;
}
function linear2() {
  var scale = continuous();
  scale.copy = function() {
    return copy(scale, linear2());
  };
  initRange.apply(scale, arguments);
  return linearish(scale);
}

// node_modules/d3-zoom/src/transform.js
function Transform(k2, x2, y2) {
  this.k = k2;
  this.x = x2;
  this.y = y2;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k2) {
    return k2 === 1 ? this : new Transform(this.k * k2, this.x, this.y);
  },
  translate: function(x2, y2) {
    return x2 === 0 & y2 === 0 ? this : new Transform(this.k, this.x + this.k * x2, this.y + this.k * y2);
  },
  apply: function(point2) {
    return [point2[0] * this.k + this.x, point2[1] * this.k + this.y];
  },
  applyX: function(x2) {
    return x2 * this.k + this.x;
  },
  applyY: function(y2) {
    return y2 * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x2) {
    return (x2 - this.x) / this.k;
  },
  invertY: function(y2) {
    return (y2 - this.y) / this.k;
  },
  rescaleX: function(x2) {
    return x2.copy().domain(x2.range().map(this.invertX, this).map(x2.invert, x2));
  },
  rescaleY: function(y2) {
    return y2.copy().domain(y2.range().map(this.invertY, this).map(y2.invert, y2));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity3 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity3;
  return node.__zoom;
}

// node_modules/crystra-ui-core/dist/index.js
var v = Object.freeze({
  button: {
    appearance: "outline",
    tone: "neutral",
    size: "compact"
  },
  card: {
    level: "panel",
    border: "solid",
    padding: "regular"
  }
});
function y({ as: e3 = "span", variant: t2, family: n2, weight: r2, tone: i2, italic: a2 = false, underline: o2 = false, truncate: s2 = false, className: c2, ...l2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(e3, {
    className: ["crystra-typography", c2].filter(Boolean).join(" "),
    "data-family": n2,
    "data-italic": a2 || void 0,
    "data-tone": i2,
    "data-truncate": s2 || void 0,
    "data-underline": o2 || void 0,
    "data-variant": t2,
    "data-weight": r2,
    ...l2
  });
}
var b = (0, import_react3.forwardRef)(function({ appearance: e3 = v.button.appearance, tone: t2 = v.button.tone, size: n2 = v.button.size, selected: r2, startIcon: i2, endIcon: a2, children: o2, className: s2, type: c2 = "button", ...l2 }, f2) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
    ...l2,
    ref: f2,
    type: c2,
    "aria-pressed": e3 === "segment" ? r2 : l2["aria-pressed"],
    className: ["crystra-button", s2].filter(Boolean).join(" "),
    "data-appearance": e3,
    "data-size": n2,
    "data-tone": t2,
    children: [
      i2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "crystra-button-icon",
        "aria-hidden": "true",
        children: i2
      }),
      o2,
      a2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "crystra-button-icon",
        "aria-hidden": "true",
        children: a2
      })
    ]
  });
});
var x = (0, import_react3.forwardRef)(function({ "aria-label": e3, title: t2, children: n2, ...r2 }, i2) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(b, {
    ...r2,
    ref: i2,
    "aria-label": e3,
    title: t2 ?? e3,
    "data-icon-button": "true",
    children: n2
  });
});
function S({ segmented: e3 = false, className: t2, ...n2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: ["crystra-button-group", t2].filter(Boolean).join(" "),
    "data-segmented": e3 || void 0,
    role: e3 ? "group" : n2.role,
    ...n2
  });
}
function C({ as: e3 = "section", level: t2 = "section", border: n2 = "solid", className: r2, children: i2, ...a2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(e3, {
    className: ["crystra-surface", r2].filter(Boolean).join(" "),
    "data-border": n2,
    "data-level": t2,
    ...a2,
    children: i2
  });
}
function T({ inputKind: e3 = "search", className: t2, type: n2, ...r2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
    className: ["crystra-input", t2].filter(Boolean).join(" "),
    "data-input-kind": e3,
    type: n2 ?? e3,
    ...r2
  });
}
var E = {
  available: "primary",
  selected: "primary",
  partial: "warning",
  unavailable: "neutral",
  error: "danger"
};
function D({ status: e3, tone: t2 = E[e3], className: n2, ...r2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(k, {
    ...r2,
    tone: t2,
    className: ["crystra-status-badge", n2].filter(Boolean).join(" "),
    "data-status": e3
  });
}
function k({ tone: e3 = "neutral", appearance: t2 = "soft", size: n2 = "compact", className: r2, ...i2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    ...i2,
    className: ["crystra-chip", r2].filter(Boolean).join(" "),
    "data-tone": e3,
    "data-appearance": t2,
    "data-size": n2
  });
}
var A = Object.freeze({
  schemaVersion: "crystra.studio-design@1",
  typography: Object.freeze({
    h1: Object.freeze({
      size: "4xl",
      family: "sans",
      weight: "semibold"
    }),
    h2: Object.freeze({
      size: "xl",
      family: "sans",
      weight: "semibold"
    }),
    subtitle1: Object.freeze({
      size: "lg",
      family: "sans",
      weight: "semibold"
    }),
    body1: Object.freeze({
      size: "base",
      family: "sans",
      weight: "regular"
    }),
    body2: Object.freeze({
      size: "sm",
      family: "sans",
      weight: "regular"
    }),
    caption: Object.freeze({
      size: "xs",
      family: "sans",
      weight: "regular"
    }),
    overline: Object.freeze({
      size: "2xs",
      family: "sans",
      weight: "bold",
      transform: "uppercase"
    })
  }),
  buttons: Object.freeze({
    primary: Object.freeze({
      appearance: "solid",
      tone: "primary",
      size: "compact"
    }),
    secondary: Object.freeze({
      appearance: "outline",
      tone: "neutral",
      size: "compact"
    }),
    ghost: Object.freeze({
      appearance: "ghost",
      tone: "neutral",
      size: "compact"
    }),
    danger: Object.freeze({
      appearance: "solid",
      tone: "danger",
      size: "compact"
    }),
    segment: Object.freeze({
      appearance: "segment",
      tone: "primary",
      size: "compact"
    })
  }),
  inputs: Object.freeze({ search: Object.freeze({
    kind: "search",
    size: "compact",
    surface: "inset"
  }) }),
  statuses: Object.freeze({
    available: Object.freeze({
      tone: "primary",
      emphasis: "soft"
    }),
    selected: Object.freeze({
      tone: "primary",
      emphasis: "soft"
    }),
    partial: Object.freeze({
      tone: "warning",
      emphasis: "soft"
    }),
    unavailable: Object.freeze({
      tone: "neutral",
      emphasis: "soft"
    }),
    error: Object.freeze({
      tone: "danger",
      emphasis: "soft"
    })
  }),
  surfaces: Object.freeze({
    header: Object.freeze({
      level: "section",
      border: "solid",
      radius: "panel"
    }),
    section: Object.freeze({
      level: "section",
      border: "solid",
      radius: "panel"
    }),
    panel: Object.freeze({
      level: "panel",
      border: "solid",
      radius: "panel"
    }),
    inset: Object.freeze({
      level: "inset",
      border: "solid",
      radius: "control"
    }),
    notice: Object.freeze({
      level: "raised",
      border: "dashed",
      radius: "panel"
    })
  }),
  spacing: Object.freeze([
    "tight",
    "control",
    "cluster",
    "grid",
    "section"
  ]),
  pages: Object.freeze({
    select: Object.freeze([
      "header",
      "taskPopulation",
      "currentSelection"
    ]),
    dashboard: Object.freeze([
      "header",
      "panelCanvas",
      "traceNotice"
    ]),
    evidence: Object.freeze(["header", "evidenceContent"]),
    trace: Object.freeze([
      "header",
      "traceContext",
      "rendererNavigation",
      "renderer",
      "motion"
    ])
  })
});
function j({ children: e3, className: t2, density: n2, theme: r2 = "system", ...i2 }) {
  let a2 = typeof r2 == "string" ? r2 : r2.mode, o2 = n2 ?? (typeof r2 == "string" ? "comfortable" : r2.density), s2;
  if (typeof r2 != "string") {
    let e4 = { "--crystra-container-border-style": r2.containerBorderStyle }, t3 = (t4, n4) => {
      n4 !== void 0 && (e4[t4] = n4);
    }, n3 = r2.palette;
    t3("--crystra-surface-section", n3?.surface?.section), t3("--crystra-surface-panel", n3?.surface?.panel), t3("--crystra-surface-raised", n3?.surface?.raised), t3("--crystra-surface-inset", n3?.surface?.inset), t3("--content-primary", n3?.content?.primary), t3("--content-secondary", n3?.content?.secondary), t3("--content-muted", n3?.content?.muted), t3("--content-inverse", n3?.content?.inverse), t3("--border-default", n3?.border?.default), t3("--border-strong", n3?.border?.strong), t3("--interaction-accent", n3?.interaction?.accent), t3("--interaction-selection", n3?.interaction?.selection), t3("--interaction-disabled", n3?.interaction?.disabled), t3("--focus-ring", n3?.interaction?.focusRing), t3("--status-available", n3?.status?.available), t3("--status-attention", n3?.status?.attention), t3("--status-warning", n3?.status?.attention), t3("--status-unavailable", n3?.status?.unavailable), t3("--status-expired", n3?.status?.expired), t3("--status-incompatible", n3?.status?.incompatible), t3("--status-error", n3?.status?.error), n3?.data !== void 0 && Array.from({ length: 6 }, (e6, r3) => t3(`--data-series-${r3 + 1}`, n3.data?.[r3 % n3.data.length])), t3("--crystra-font-family", r2.typography?.fontFamily), t3("--crystra-code-font-family", r2.typography?.codeFontFamily), t3("--crystra-type-h1", r2.typography?.h1), t3("--crystra-type-h2", r2.typography?.h2), t3("--crystra-type-subtitle1", r2.typography?.subtitle1), t3("--crystra-type-body1", r2.typography?.body1), t3("--crystra-type-body2", r2.typography?.body2), t3("--crystra-type-caption", r2.typography?.caption), t3("--crystra-type-overline", r2.typography?.overline), s2 = e4;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    ...i2,
    className: ["crystra-bi", t2].filter(Boolean).join(" "),
    "data-density": o2,
    "data-theme": a2,
    style: s2,
    children: e3
  });
}
function N(e3) {
  let t2 = e3.startsWith("-"), n2 = (t2 ? e3.slice(1) : e3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return t2 ? `-${n2}` : n2;
}
function P(e3) {
  let [t2, n2] = e3.split("/");
  return [BigInt(t2), BigInt(n2 ?? "1")];
}
function F(e3) {
  let [t2, n2] = P(e3), r2 = t2 < 0n, i2 = (r2 ? -t2 : t2) * 10000n, a2 = i2 / n2;
  i2 % n2 * 2n >= n2 && (a2 += 1n);
  let o2 = a2 / 100n, s2 = String(a2 % 100n).padStart(2, "0");
  return `${r2 ? "-" : ""}${o2}.${s2}%`;
}
function I(e3) {
  let t2 = `${String(e3.value)} ${e3.unit}`;
  return e3.kind === "RATIO" ? {
    display: F(e3.value),
    exact: t2
  } : e3.kind === "BOOLEAN" ? {
    display: t2,
    exact: t2
  } : /^-?(?:0|[1-9][0-9]*)$/.test(e3.value) ? {
    display: `${N(e3.value)} ${e3.unit}`,
    exact: t2
  } : {
    display: t2,
    exact: t2
  };
}
var L = {
  status: "accepted",
  date: "2026-09-08",
  scope: "Accepted balanced typography, DSH-aligned five-family dark page colors and DeepSeek-calibrated icon sizes. Layout, complete icon artwork and light theme remain outside this package.",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  typography: {
    "page-title": {
      size: 24,
      lineHeight: 32,
      weight: 600,
      meaning: "\u9875\u9762\u4E3B\u6807\u9898"
    },
    "section-title": {
      size: 18,
      lineHeight: 26,
      weight: 600,
      meaning: "\u5DE5\u4F5C\u9762\u7126\u70B9\u3001\u5F53\u524D\u95EE\u9898\u3001\u5C55\u5F00\u89C6\u56FE\u6807\u9898"
    },
    "card-title": {
      size: 16,
      lineHeight: 24,
      weight: 600,
      meaning: "\u5361\u7247\u4E0E\u4FE1\u606F\u5206\u7EC4\u6807\u9898"
    },
    "item-title": {
      size: 14,
      lineHeight: 20,
      weight: 500,
      meaning: "\u5217\u8868\u3001\u8BC1\u636E\u5165\u53E3\u3001\u6B65\u9AA4\u7684\u4E3B\u6807\u9898"
    },
    body: {
      size: 14,
      lineHeight: 24,
      weight: 400,
      meaning: "\u8FDE\u7EED\u8BF4\u660E\u3001AI \u7406\u89E3\u3001Chat \u6B63\u6587"
    },
    "body-compact": {
      size: 14,
      lineHeight: 20,
      weight: 400,
      meaning: "\u68C0\u67E5\u6E05\u5355\u3001\u77ED\u4E8B\u5B9E\u3001\u7ED3\u6784\u5316\u5185\u5BB9"
    },
    "header-description": {
      size: 14,
      lineHeight: 22,
      weight: 400,
      meaning: "\u9875\u9762\u6807\u9898\u4E0B\u7684\u4E00\u884C\u8BF4\u660E"
    },
    description: {
      size: 12,
      lineHeight: 18,
      weight: 400,
      meaning: "\u5217\u8868\u526F\u6807\u9898\u3001\u5361\u7247\u8F85\u52A9\u8BF4\u660E"
    },
    meta: {
      size: 12,
      lineHeight: 18,
      weight: 400,
      meaning: "\u7248\u672C\u3001\u65F6\u95F4\u3001\u8BA1\u6570\u3001\u6765\u6E90\u4E0E\u72B6\u6001\u6807\u7B7E"
    },
    label: {
      size: 12,
      lineHeight: 18,
      weight: 600,
      meaning: "\u5206\u533A\u6807\u7B7E\u3001\u5B57\u6BB5\u7EC4\u63D0\u793A\u3001kicker"
    },
    control: {
      size: 14,
      lineHeight: 20,
      weight: 500,
      meaning: "\u5BFC\u822A\u3001\u83DC\u5355\u3001\u6309\u94AE\u3001\u8F93\u5165\u6587\u5B57"
    },
    code: {
      size: 12,
      lineHeight: 20,
      weight: 400,
      meaning: "\u4EE3\u7801\u3001\u8DEF\u5F84\u3001\u7CBE\u786E\u6807\u8BC6\u4E0E\u9884\u89C8"
    },
    metric: {
      size: 20,
      lineHeight: 28,
      weight: 500,
      meaning: "\u72EC\u7ACB\u6C47\u603B\u6307\u6807"
    },
    brand: {
      size: 20,
      lineHeight: 28,
      weight: 600,
      meaning: "\u54C1\u724C\u5B57\u6807\uFF1B\u72EC\u7ACB\u4E8E\u5185\u5BB9\u7B49\u7EA7"
    },
    badge: {
      size: 11,
      lineHeight: 14,
      weight: 500,
      meaning: "\u53D7\u7EA6\u675F\u7684\u8BA1\u6570\u5FBD\u6807\u3001\u6B65\u9AA4\u7F16\u53F7"
    },
    "graph-title": {
      size: 13,
      lineHeight: 18,
      weight: 500,
      meaning: "SVG \u8282\u70B9\u4E3B\u6807\u7B7E\uFF1BviewBox \u5355\u4F4D"
    },
    "graph-meta": {
      size: 11,
      lineHeight: 16,
      weight: 400,
      meaning: "SVG \u72B6\u6001\u4E0E\u8FB9\u6807\u7B7E\uFF1BviewBox \u5355\u4F4D"
    }
  },
  color: /* @__PURE__ */ JSON.parse('{"status":"accepted","default":"semantic","scope":"Page UI uses five families; charts own their palette and are excluded from page color overrides","families":{"neutral":{"base":"#151517","variants":{"base":"#151517","text":"#6e6e6f","strong-text":"#adadae","dark":"#0f0f10","darker":"#0b0b0c","shell":"#151517","sidebar":"#1b1b1c","card":"#232324","inset":"#2c2c2e","composer":"#2c2c2e","message":"#2c2c2e","floating":"#353638","primary":"#f9fafb","secondary":"#cfd3d6","muted":"#adb2b8","disabled":"#81858c","border-subtle":"#ffffff0f","border-default":"#ffffff1f","border-strong":"#ffffff29","hover":"#ffffff14","pressed":"#ffffff24","action":"#43454a","action-hover":"#353638","on-solid":"#ffffff","shadow":"#000000"},"derivation":{"base":"host(--dsw-alias-bg-base)","text":"mix(base, white, 0.38)","strong-text":"mix(base, white, 0.65)","dark":"mix(base, black, 0.3)","darker":"mix(base, black, 0.46)","shell":"host(--dsw-alias-bg-base)","sidebar":"host(--dsw-specific-sidebar-fill)","card":"host(--dsw-alias-bg-layer-1)","inset":"host(--dsw-alias-bg-layer-2)","composer":"host(--dsw-specific-input-major)","message":"host(--dsw-alias-bg-layer-2)","floating":"host(--dsw-alias-bg-layer-3)","primary":"host(--dsw-alias-label-primary)","secondary":"host(--dsw-alias-label-secondary)","muted":"host(--dsw-alias-label-tertiary)","disabled":"host(--dsw-alias-label-caption)","border-subtle":"host(--dsw-alias-border-l1)","border-default":"host(--dsw-alias-border-l2)","border-strong":"host(--dsw-alias-border-l3)","hover":"host(--dsw-alias-interactive-bg-hover)","pressed":"host(--dsw-alias-interactive-bg-active)","action":"host(--dsw-alias-button-elevated-fill)","action-hover":"host(--dsw-alias-button-floating-hover)","on-solid":"mix(base, white, 1)","shadow":"mix(base, black, 1)"}},"blue":{"base":"#679efe","variants":{"base":"#679efe","text":"#679efe","strong-text":"#679efe","dark":"#486fb2","darker":"#385589","surface":"#679efe1f","border":"#679efe94","primary":"#679efe","primary-hover":"#4176e6"},"derivation":{"base":"host(--dsw-alias-state-business-primary)","text":"host(--dsw-alias-state-business-primary)","strong-text":"host(--dsw-alias-state-business-primary)","dark":"mix(base, black, 0.3)","darker":"mix(base, black, 0.46)","surface":"base with alpha 0.12","border":"base with alpha 0.58","primary":"host(--dsw-alias-button-info-fill)","primary-hover":"host(--dsw-alias-button-info-hover)"}},"green":{"base":"#22c55e","variants":{"base":"#22c55e","text":"#22c55e","strong-text":"#22c55e","dark":"#188a42","darker":"#126a33","surface":"#22c55e1f","border":"#22c55e94"},"derivation":{"base":"host(--dsw-alias-state-success-primary)","text":"host(--dsw-alias-state-success-primary)","strong-text":"host(--dsw-alias-state-success-primary)","dark":"mix(base, black, 0.3)","darker":"mix(base, black, 0.46)","surface":"base with alpha 0.12","border":"base with alpha 0.58"}},"amber":{"base":"#f59e0b","variants":{"base":"#f59e0b","text":"#f59e0b","strong-text":"#f59e0b","dark":"#ac6f08","darker":"#845506","surface":"#f59e0b1f","border":"#f59e0b94"},"derivation":{"base":"host(--dsw-alias-state-warn-primary)","text":"host(--dsw-alias-state-warn-primary)","strong-text":"host(--dsw-alias-state-warn-primary)","dark":"mix(base, black, 0.3)","darker":"mix(base, black, 0.46)","surface":"base with alpha 0.12","border":"base with alpha 0.58"}},"red":{"base":"#f25a5a","variants":{"base":"#f25a5a","text":"#f25a5a","strong-text":"#f25a5a","dark":"#a93f3f","darker":"#833131","surface":"#f25a5a1f","border":"#f25a5a94"},"derivation":{"base":"host(--dsw-alias-state-error-primary)","text":"host(--dsw-alias-state-error-primary)","strong-text":"host(--dsw-alias-state-error-primary)","dark":"mix(base, black, 0.3)","darker":"mix(base, black, 0.46)","surface":"base with alpha 0.12","border":"base with alpha 0.58"}}},"roles":{"background-shell":{"ref":"neutral.shell","value":"#151517","family":"neutral","meaning":"\u6700\u5916\u5C42\u80CC\u666F"},"background-sidebar":{"ref":"neutral.sidebar","value":"#1b1b1c","family":"neutral","meaning":"Sidebar \u80CC\u666F"},"background-workspace":{"ref":"neutral.base","value":"#151517","family":"neutral","meaning":"\u5DE5\u4F5C\u533A\u80CC\u666F"},"background-card":{"ref":"neutral.card","value":"#232324","family":"neutral","meaning":"\u5361\u7247\u5E95\u8272"},"background-inset":{"ref":"neutral.inset","value":"#2c2c2e","family":"neutral","meaning":"\u5361\u5185\u6761\u76EE\u5E95\u8272"},"background-composer":{"ref":"neutral.composer","value":"#2c2c2e","family":"neutral","meaning":"\u8F93\u5165\u533A\u5E95\u8272"},"background-message":{"ref":"neutral.message","value":"#2c2c2e","family":"neutral","meaning":"Chat \u6D88\u606F\u5E95\u8272"},"background-canvas":{"ref":"neutral.sidebar","value":"#1b1b1c","family":"neutral","meaning":"\u56FE\u753B\u5E03\u80CC\u666F"},"background-surface":{"ref":"neutral.base","value":"#151517","family":"neutral","meaning":"\u666E\u901A\u5185\u5BB9\u9762"},"background-summary":{"ref":"neutral.card","value":"#232324","family":"neutral","meaning":"\u6458\u8981\u9762"},"background-floating":{"ref":"neutral.floating","value":"#353638","family":"neutral","meaning":"\u83DC\u5355/\u63D0\u793A/\u76EE\u5F55\u6D6E\u5C42"},"text-primary":{"ref":"neutral.primary","value":"#f9fafb","family":"neutral","meaning":"\u4E3B\u8981\u6B63\u6587"},"text-secondary":{"ref":"neutral.secondary","value":"#cfd3d6","family":"neutral","meaning":"\u6B21\u7EA7\u6B63\u6587"},"text-muted":{"ref":"neutral.muted","value":"#adb2b8","family":"neutral","meaning":"\u65F6\u95F4/\u7248\u672C/\u8F85\u52A9\u8BF4\u660E"},"text-disabled":{"ref":"neutral.disabled","value":"#81858c","family":"neutral","meaning":"\u4E0D\u53EF\u7528\u6587\u5B57"},"text-on-primary":{"ref":"neutral.on-solid","value":"#ffffff","family":"neutral","meaning":"\u5B9E\u8272\u4E3B\u6309\u94AE\u4E0A\u7684\u6587\u5B57"},"text-on-status":{"ref":"neutral.shell","value":"#151517","family":"neutral","meaning":"\u5B9E\u8272\u72B6\u6001\u5FBD\u6807\u4E0A\u7684\u6587\u5B57"},"border-subtle":{"ref":"neutral.border-subtle","value":"#ffffff0f","family":"neutral","meaning":"\u666E\u901A\u5206\u9694"},"border-default":{"ref":"neutral.border-default","value":"#ffffff1f","family":"neutral","meaning":"\u53EF\u89C1\u7EC4\u4EF6\u8FB9\u754C"},"border-strong":{"ref":"neutral.border-strong","value":"#ffffff29","family":"neutral","meaning":"\u52A0\u5F3A\u8FB9\u754C"},"border-focus":{"ref":"blue.text","value":"#679efe","family":"blue","meaning":"\u952E\u76D8\u7126\u70B9"},"interaction-hover":{"ref":"neutral.hover","value":"#ffffff14","family":"neutral","meaning":"\u666E\u901A\u60AC\u505C"},"interaction-pressed":{"ref":"neutral.pressed","value":"#ffffff24","family":"neutral","meaning":"\u666E\u901A\u6309\u4E0B"},"interaction-selected":{"ref":"blue.surface","value":"#679efe1f","family":"blue","meaning":"\u9009\u4E2D\u5E95\u8272"},"interaction-selected-text":{"ref":"blue.strong-text","value":"#679efe","family":"blue","meaning":"\u9009\u4E2D\u6587\u5B57"},"interaction-selected-border":{"ref":"blue.base","value":"#679efe","family":"blue","meaning":"\u9009\u4E2D\u8FB9\u6846"},"interaction-link":{"ref":"blue.text","value":"#679efe","family":"blue","meaning":"\u94FE\u63A5/\u53EF\u8FDB\u5165\u5165\u53E3"},"interaction-primary":{"ref":"blue.primary","value":"#679efe","family":"blue","meaning":"\u5B9E\u8272\u4E3B\u64CD\u4F5C"},"interaction-primary-hover":{"ref":"blue.primary-hover","value":"#4176e6","family":"blue","meaning":"\u4E3B\u64CD\u4F5C\u60AC\u505C"},"interaction-primary-pressed":{"ref":"blue.primary-hover","value":"#4176e6","family":"blue","meaning":"\u4E3B\u64CD\u4F5C\u6309\u4E0B"},"background-neutral-action":{"ref":"neutral.action","value":"#43454a","family":"neutral","meaning":"\u4E2D\u6027\u64CD\u4F5C\u5E95\u8272"},"background-neutral-action-hover":{"ref":"neutral.action-hover","value":"#353638","family":"neutral","meaning":"\u4E2D\u6027\u64CD\u4F5C\u60AC\u505C"},"brand":{"ref":"blue.text","value":"#679efe","family":"blue","meaning":"\u54C1\u724C\u56FE\u6807"},"status-success-text":{"ref":"green.text","value":"#22c55e","family":"green","meaning":"\u6210\u529F/\u6EE1\u8DB3/\u6709\u6548 \xB7 \u6587\u5B57"},"status-success-surface":{"ref":"green.surface","value":"#22c55e1f","family":"green","meaning":"\u6210\u529F/\u6EE1\u8DB3/\u6709\u6548 \xB7 \u63D0\u793A\u5E95\u8272"},"status-success-border":{"ref":"green.border","value":"#22c55e94","family":"green","meaning":"\u6210\u529F/\u6EE1\u8DB3/\u6709\u6548 \xB7 \u8FB9\u754C"},"status-success-solid":{"ref":"green.base","value":"#22c55e","family":"green","meaning":"\u6210\u529F/\u6EE1\u8DB3/\u6709\u6548 \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"status-warning-text":{"ref":"amber.text","value":"#f59e0b","family":"amber","meaning":"\u9700\u5173\u6CE8/\u8B66\u544A/\u5F85\u88C1\u51B3 \xB7 \u6587\u5B57"},"status-warning-surface":{"ref":"amber.surface","value":"#f59e0b1f","family":"amber","meaning":"\u9700\u5173\u6CE8/\u8B66\u544A/\u5F85\u88C1\u51B3 \xB7 \u63D0\u793A\u5E95\u8272"},"status-warning-border":{"ref":"amber.border","value":"#f59e0b94","family":"amber","meaning":"\u9700\u5173\u6CE8/\u8B66\u544A/\u5F85\u88C1\u51B3 \xB7 \u8FB9\u754C"},"status-warning-solid":{"ref":"amber.base","value":"#f59e0b","family":"amber","meaning":"\u9700\u5173\u6CE8/\u8B66\u544A/\u5F85\u88C1\u51B3 \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"status-error-text":{"ref":"red.text","value":"#f25a5a","family":"red","meaning":"\u5931\u8D25/\u9519\u8BEF/\u963B\u65AD \xB7 \u6587\u5B57"},"status-error-surface":{"ref":"red.surface","value":"#f25a5a1f","family":"red","meaning":"\u5931\u8D25/\u9519\u8BEF/\u963B\u65AD \xB7 \u63D0\u793A\u5E95\u8272"},"status-error-border":{"ref":"red.border","value":"#f25a5a94","family":"red","meaning":"\u5931\u8D25/\u9519\u8BEF/\u963B\u65AD \xB7 \u8FB9\u754C"},"status-error-solid":{"ref":"red.base","value":"#f25a5a","family":"red","meaning":"\u5931\u8D25/\u9519\u8BEF/\u963B\u65AD \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"status-info-text":{"ref":"blue.text","value":"#679efe","family":"blue","meaning":"\u8BF4\u660E/\u5F53\u524D AI \u7406\u89E3/\u53D8\u5316\u4FE1\u606F \xB7 \u6587\u5B57"},"status-info-surface":{"ref":"blue.surface","value":"#679efe1f","family":"blue","meaning":"\u8BF4\u660E/\u5F53\u524D AI \u7406\u89E3/\u53D8\u5316\u4FE1\u606F \xB7 \u63D0\u793A\u5E95\u8272"},"status-info-border":{"ref":"blue.border","value":"#679efe94","family":"blue","meaning":"\u8BF4\u660E/\u5F53\u524D AI \u7406\u89E3/\u53D8\u5316\u4FE1\u606F \xB7 \u8FB9\u754C"},"status-info-solid":{"ref":"blue.base","value":"#679efe","family":"blue","meaning":"\u8BF4\u660E/\u5F53\u524D AI \u7406\u89E3/\u53D8\u5316\u4FE1\u606F \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"status-running-text":{"ref":"blue.text","value":"#679efe","family":"blue","meaning":"\u6B63\u5728\u6267\u884C/\u8FD0\u884C\u524D\u6CBF \xB7 \u6587\u5B57"},"status-running-surface":{"ref":"blue.surface","value":"#679efe1f","family":"blue","meaning":"\u6B63\u5728\u6267\u884C/\u8FD0\u884C\u524D\u6CBF \xB7 \u63D0\u793A\u5E95\u8272"},"status-running-border":{"ref":"blue.border","value":"#679efe94","family":"blue","meaning":"\u6B63\u5728\u6267\u884C/\u8FD0\u884C\u524D\u6CBF \xB7 \u8FB9\u754C"},"status-running-solid":{"ref":"blue.base","value":"#679efe","family":"blue","meaning":"\u6B63\u5728\u6267\u884C/\u8FD0\u884C\u524D\u6CBF \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"status-paused-text":{"ref":"neutral.muted","value":"#adb2b8","family":"neutral","meaning":"\u6682\u505C/\u672A\u5F00\u59CB/\u975E\u6D3B\u52A8 \xB7 \u6587\u5B57"},"status-paused-surface":{"ref":"neutral.inset","value":"#2c2c2e","family":"neutral","meaning":"\u6682\u505C/\u672A\u5F00\u59CB/\u975E\u6D3B\u52A8 \xB7 \u63D0\u793A\u5E95\u8272"},"status-paused-border":{"ref":"neutral.border-default","value":"#ffffff1f","family":"neutral","meaning":"\u6682\u505C/\u672A\u5F00\u59CB/\u975E\u6D3B\u52A8 \xB7 \u8FB9\u754C"},"status-paused-solid":{"ref":"neutral.disabled","value":"#81858c","family":"neutral","meaning":"\u6682\u505C/\u672A\u5F00\u59CB/\u975E\u6D3B\u52A8 \xB7 \u72B6\u6001\u70B9/\u7EBF\u6761"},"shadow-panel":{"ref":"neutral.shadow","value":"0 18px 45px #0000003d","family":"neutral","meaning":"\u9762\u677F\u9634\u5F71"},"shadow-floating":{"ref":"neutral.shadow","value":"0 18px 56px #00000066","family":"neutral","meaning":"\u6D6E\u5C42\u9634\u5F71"},"overlay":{"ref":"neutral.shadow","value":"#00000055","family":"neutral","meaning":"\u906E\u7F69"}},"familyLimit":5,"chartScope":"data-color-scope=\\"chart\\"; retain source chart colors, gradients and effects","semanticDecision":{"date":"2026-09-08","basis":"\u7528\u6237\uFF1A\u8BED\u4E49\u65B9\u6848\u63A5\u53D7","scope":"five page families, role grouping and independent chart colors"},"appearanceStatus":"accepted DSH dark alignment","hostReference":"dsh-theme-reference.json","appearanceDecision":{"date":"2026-09-08","basis":"\u7528\u6237\uFF1A\u73B0\u5728\u7684\u65B9\u6848\u6211\u8BA4\u4E3A\u5F88\u4E0D\u9519\uFF0C\u53EF\u4EE5\u751F\u6210\u76F8\u5E94\u7684\u8D44\u4EA7","scope":"Current DSH-aligned dark page colors; chart palette remains independent"}}'),
  icon: {
    status: "accepted",
    selected: "dsh",
    roles: {
      disclosure: 12,
      "inline-action": 14,
      "content-marker": 14,
      navigation: 18,
      "primary-action": 18,
      "brand-slot": 24,
      "context-marker": 24,
      "widget-signal": 48
    },
    hitAreas: {
      tool: 28,
      primary: 36,
      rail: 40
    },
    hostReference: {
      package: "@deepseek-ai/dsh-client-ui-sidebar",
      source: "lib/client.js:214",
      component: "IconNewChatOutline16",
      expanded: 14,
      collapsed: 18,
      note: "Installed DSH source; same existing SVG shape. User prefers prominent but prioritizes host alignment."
    },
    contextMapping: {
      "new-task-expanded": "inline-action",
      "new-task-collapsed": "navigation"
    },
    hostOwnedExcluded: true
  }
};
var te = {
  prefix: "tabler",
  width: 24,
  height: 24,
  icons: /* @__PURE__ */ JSON.parse('{"activity":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12h4l3 8l4-16l3 8h4\\"/>"},"adjustments-horizontal":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 6h8m4 0h4M6 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0m-2 0h2m4 0h10m-5 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 18h11m4 0h1\\"/>"},"arrow-left":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M5 12h14M5 12l6 6m-6-6l6-6\\"/>"},"arrow-right":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M5 12h14m-6 6l6-6m-6-6l6 6\\"/>"},"arrow-up":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 5v14m6-8l-6-6m-6 6l6-6\\"/>"},"arrow-up-right":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M17 7L7 17M8 7h9v9\\"/>"},"arrows-exchange":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M7 10h14l-4-4m0 8H3l4 4\\"/>"},"chart-dots":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M3 3v18h18\\"/><path d=\\"M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0m10-2a2 2 0 1 0 4 0a2 2 0 1 0-4 0m-5 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0m-1.84-4.38l2.34 2.88m2.588-.172l2.837-4.586\\"/></g>"},"check":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"m5 12l5 5L20 7\\"/>"},"chevron-down":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"m6 9l6 6l6-6\\"/>"},"circle":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0\\"/>"},"circle-filled":{"body":"<path fill=\\"currentColor\\" d=\\"M7 3.34a10 10 0 1 1-4.995 8.984L2 12l.005-.324A10 10 0 0 1 7 3.34\\"/>"},"clipboard-list":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2\\"/><path d=\\"M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2m0 7h.01M13 12h2m-6 4h.01M13 16h2\\"/></g>"},"command":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M7 9a2 2 0 1 1 2-2v10a2 2 0 1 1-2-2h10a2 2 0 1 1-2 2V7a2 2 0 1 1 2 2z\\"/>"},"copy":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M7 9.667A2.667 2.667 0 0 1 9.667 7h8.666A2.667 2.667 0 0 1 21 9.667v8.666A2.667 2.667 0 0 1 18.333 21H9.667A2.667 2.667 0 0 1 7 18.333z\\"/><path d=\\"M4.012 16.737A2 2 0 0 1 3 15V5c0-1.1.9-2 2-2h10c.75 0 1.158.385 1.5 1\\"/></g>"},"diamond":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M6 5h12l3 5l-8.5 9.5a.7.7 0 0 1-1 0L3 10z\\"/><path d=\\"M10 12L8 9.8l.6-1\\"/></g>"},"diamond-filled":{"body":"<path fill=\\"currentColor\\" d=\\"M18 4a1 1 0 0 1 .783.378l.074.108l3 5a1 1 0 0 1-.032 1.078l-.08.103l-8.53 9.533a1.7 1.7 0 0 1-1.215.51c-.4 0-.785-.14-1.11-.417l-.135-.126l-8.5-9.5A1 1 0 0 1 2.083 9.6l.06-.115l3.013-5.022l.064-.09a1 1 0 0 1 .155-.154l.089-.064l.088-.05l.05-.023l.06-.025l.109-.032l.112-.02L6 4zM9.114 7.943a1 1 0 0 0-1.371.343l-.6 1l-.06.116a1 1 0 0 0 .177 1.07l2 2.2l.09.088a1 1 0 0 0 1.323-.02l.087-.09a1 1 0 0 0-.02-1.323l-1.501-1.65l.218-.363l.055-.103a1 1 0 0 0-.398-1.268\\"/>"},"dots":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0\\"/>"},"exclamation-mark":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 19v.01M12 15V5\\"/>"},"file":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M14 3v4a1 1 0 0 0 1 1h4\\"/><path d=\\"M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2\\"/></g>"},"git-branch":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M5 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 8v8m2 2h6a2 2 0 0 0 2-2v-5\\"/><path d=\\"m14 14l3-3l3 3\\"/></g>"},"help":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0m9 5v.01\\"/><path d=\\"M12 13.5a1.5 1.5 0 0 1 1-1.5a2.6 2.6 0 1 0-3-4\\"/></g>"},"layout-sidebar-left-collapse":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm5-2v16\\"/><path d=\\"m15 10l-2 2l2 2\\"/></g>"},"layout-sidebar-left-expand":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm5-2v16\\"/><path d=\\"m14 10l2 2l-2 2\\"/></g>"},"minus":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M5 12h14\\"/>"},"plus":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M12 5v14m-7-7h14\\"/>"},"refresh":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4\\"/>"},"search":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6\\"/>"},"settings":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065\\"/><path d=\\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0\\"/></g>"},"shield-lock":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21A12 12 0 0 1 3.5 6A12 12 0 0 0 12 3\\"/><path d=\\"M11 11a1 1 0 1 0 2 0a1 1 0 1 0-2 0m1 1v2.5\\"/></g>"},"square":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\\"/>"},"table":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm0 5h18M10 3v18\\"/>"},"target":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0\\"/><path d=\\"M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0\\"/><path d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0\\"/></g>"},"x":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M18 6L6 18M6 6l12 12\\"/>"},"circle-check":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0\\"/><path d=\\"m9 12l2 2l4-4\\"/></g>"},"circle-x":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0m7-2l4 4m0-4l-4 4\\"/>"},"clock":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0\\"/><path d=\\"M12 7v5l3 3\\"/></g>"},"triangle-filled":{"body":"<path fill=\\"currentColor\\" d=\\"M12 1.67a2.91 2.91 0 0 0-2.492 1.403L1.398 16.61a2.914 2.914 0 0 0 2.484 4.385h16.225a2.914 2.914 0 0 0 2.503-4.371L14.494 3.078A2.92 2.92 0 0 0 12 1.67\\"/>"},"triangle-inverted-filled":{"body":"<path fill=\\"currentColor\\" d=\\"M20.118 3H3.893A2.914 2.914 0 0 0 1.39 7.371L9.506 20.92a2.917 2.917 0 0 0 4.987.005l8.11-13.539A2.914 2.914 0 0 0 20.117 3z\\"/>"},"circle-arrow-up":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-4l-4 4m4-4v8m4-4l-4-4\\"/>"},"circle-minus":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0m6 0h6\\"/>"},"exclamation-circle":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0m9-3v4m0 3v.01\\"/>"},"calendar":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm12-4v4M8 3v4m-4 4h16m-9 4h1m0 0v3\\"/>"},"download":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5m-5-7v12\\"/>"},"upload":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5m-5-5v12\\"/>"},"coins":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M9 14c0 1.657 2.686 3 6 3s6-1.343 6-3s-2.686-3-6-3s-6 1.343-6 3\\"/><path d=\\"M9 14v4c0 1.656 2.686 3 6 3s6-1.344 6-3v-4M3 6c0 1.072 1.144 2.062 3 2.598s4.144.536 6 0S15 7.072 15 6s-1.144-2.062-3-2.598s-4.144-.536-6 0S3 4.928 3 6\\"/><path d=\\"M3 6v10c0 .888.772 1.45 2 2\\"/><path d=\\"M3 11c0 .888.772 1.45 2 2\\"/></g>"},"receipt":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2l-2 2l-2-2l-2 2l-2-2zM9 7h6m-6 4h6m-2 4h2\\"/>"},"binary":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M11 10V5h-1m8 14v-5h-1m-2-8.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5zm-5 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5zM6 10h.01M6 19h.01\\"/>"},"grip-vertical":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M8 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0m0 7a1 1 0 1 0 2 0a1 1 0 1 0-2 0m0 7a1 1 0 1 0 2 0a1 1 0 1 0-2 0m6-14a1 1 0 1 0 2 0a1 1 0 1 0-2 0m0 7a1 1 0 1 0 2 0a1 1 0 1 0-2 0m0 7a1 1 0 1 0 2 0a1 1 0 1 0-2 0\\"/>"},"trash":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3\\"/>"},"arrow-back-up":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"m9 14l-4-4l4-4\\"/><path d=\\"M5 10h11a4 4 0 1 1 0 8h-1\\"/></g>"},"arrow-forward-up":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"m15 14l4-4l-4-4\\"/><path d=\\"M19 10H8a4 4 0 1 0 0 8h1\\"/></g>"},"device-floppy":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M6 4h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2\\"/><path d=\\"M10 14a2 2 0 1 0 4 0a2 2 0 1 0-4 0m4-10v4H8V4\\"/></g>"},"message-plus":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M8 9h8m-8 4h6m-1.99 5.594L8 21v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5.5M16 19h6m-3-3v6\\"/>"},"code":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"m7 8l-4 4l4 4m10-8l4 4l-4 4M14 4l-4 16\\"/>"},"eye":{"body":"<g fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\"><path d=\\"M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0\\"/><path d=\\"M21 12q-3.6 6-9 6t-9-6q3.6-6 9-6t9 6\\"/></g>"},"layout-columns":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm8-2v16\\"/>"},"maximize":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m-4 12h2a2 2 0 0 0 2-2v-2\\"/>"},"pencil":{"body":"<path fill=\\"none\\" stroke=\\"currentColor\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4\\"/>"}}')
};
var R = L.icon.roles;
function z({ name: e3, size: t2 = "inline-action", "aria-label": n2, ...r2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
    ...r2,
    viewBox: "0 0 24 24",
    width: R[t2],
    height: R[t2],
    "data-icon-role": t2,
    "data-iconify": `tabler:${e3}`,
    "aria-label": n2,
    "aria-hidden": !n2 || void 0,
    role: n2 ? "img" : void 0,
    dangerouslySetInnerHTML: { __html: te.icons[e3].body }
  });
}
var ne = {
  status: {
    label: "\u72B6\u6001\u4FE1\u53F7",
    sizes: ["1x1"]
  },
  value: {
    label: "\u5F53\u524D\u91CF\u503C",
    sizes: ["1x1"]
  },
  progress: {
    label: "\u8FDB\u5EA6\u4E0E\u5BB9\u91CF",
    sizes: [
      "1x1",
      "1x2",
      "1x3",
      "2x2"
    ]
  },
  comparison: {
    label: "\u57FA\u51C6\u5BF9\u6BD4",
    sizes: ["1x2", "1x3"]
  },
  trend: {
    label: "\u65F6\u95F4\u8D8B\u52BF",
    sizes: [
      "1x2",
      "1x3",
      "2x3",
      "3x3"
    ]
  },
  breakdown: {
    label: "\u7EC4\u6210\u4E0E\u5206\u5E03",
    sizes: [
      "2x2",
      "2x3",
      "3x3"
    ]
  },
  history: {
    label: "\u72B6\u6001\u5386\u53F2",
    sizes: ["2x3", "3x3"]
  },
  records: {
    label: "\u8BB0\u5F55\u660E\u7EC6",
    sizes: ["2x3", "3x3"]
  }
};
var B = (e3) => e3 * 160 + (e3 - 1) * 16;
function se({ category: e3, size: t2, title: n2, subtitle: r2, leading: i2, status: a2, primary: o2, visualization: s2, supporting: c2, footer: l2, actions: f2, className: p, ...m }) {
  if (!ne[e3].sizes.includes(t2)) throw Error(`Unsupported ${e3} widget size: ${t2}`);
  let [h, g] = t2.split("x").map(Number), _ = n2 != null || r2 != null || i2 != null || a2 != null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
    ...m,
    className: [
      "widget",
      "crystra-monitoring-widget",
      p
    ].filter(Boolean).join(" "),
    "data-category": e3,
    "data-size": t2,
    style: {
      width: B(g),
      height: B(h)
    },
    children: [
      _ && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
        className: "crystra-monitoring-widget-header",
        children: [
          i2,
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [n2 != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
            className: "title crystra-monitoring-widget-title",
            children: n2
          }), r2 != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "muted crystra-monitoring-widget-subtitle",
            children: r2
          })] }),
          a2
        ]
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "content crystra-monitoring-widget-content",
        children: [
          o2,
          s2,
          c2
        ]
      }),
      (l2 != null || f2 != null) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
        className: "crystra-monitoring-widget-footer",
        children: [l2 != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: l2 }), f2]
      })
    ]
  });
}
function V({ text: e3, children: t2, className: n2, focusable: o2 = true }) {
  let p = (0, import_react3.useId)(), m = (0, import_react3.useRef)(null), h = (0, import_react3.useRef)(null), g = (0, import_react3.useRef)(void 0), [_, v2] = (0, import_react3.useState)(false), y2 = () => clearTimeout(g.current), b2 = () => {
    y2(), v2(true);
  }, x2 = () => {
    y2(), g.current = setTimeout(() => v2(false), 100);
  };
  return (0, import_react3.useEffect)(() => () => clearTimeout(g.current), []), (0, import_react3.useLayoutEffect)(() => {
    if (!_ || !m.current || !h.current) return;
    let e4 = m.current.getBoundingClientRect(), t3 = h.current.getBoundingClientRect();
    h.current.style.left = `${Math.max(8, Math.min(e4.left + (e4.width - t3.width) / 2, window.innerWidth - t3.width - 8))}px`, h.current.style.top = `${Math.max(8, e4.top - t3.height - 8 >= 8 ? e4.top - t3.height - 8 : Math.min(e4.bottom + 8, window.innerHeight - t3.height - 8))}px`;
  }, [_, e3]), (0, import_react3.useEffect)(() => {
    if (!_) return;
    let e4 = () => v2(false), t3 = (t4) => {
      t4.key === "Escape" && (t4.stopPropagation(), e4());
    };
    return window.addEventListener("scroll", e4, true), window.addEventListener("resize", e4), document.addEventListener("keydown", t3, true), () => {
      window.removeEventListener("scroll", e4, true), window.removeEventListener("resize", e4), document.removeEventListener("keydown", t3, true);
    };
  }, [_]), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    ref: m,
    className: n2,
    tabIndex: o2 ? 0 : void 0,
    "aria-label": o2 ? e3 : void 0,
    "aria-describedby": _ ? p : void 0,
    onMouseEnter: b2,
    onMouseLeave: x2,
    onFocus: b2,
    onBlur: () => {
      y2(), v2(false);
    },
    onClickCapture: () => {
      y2(), v2(false);
    },
    children: t2
  }), _ && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    ref: h,
    id: p,
    role: "tooltip",
    className: "crystra-widget-tooltip",
    onMouseEnter: y2,
    onMouseLeave: x2,
    children: e3
  }), document.body)] });
}
function H({ coordinate: e3, title: t2, beforeLabel: n2 = "\u57FA\u51C6", afterLabel: r2 = "\u5BF9\u7167", before: i2, after: a2, beforeError: o2, afterError: s2, delta: c2, onEvidence: l2, onExplain: f2, onRetryFailedSide: p, ownsFailedSide: m = true }) {
  let h = [{
    key: "left",
    label: n2,
    role: "\u57FA\u51C6",
    slice: i2,
    error: o2
  }, {
    key: "right",
    label: r2,
    role: "\u5BF9\u7167",
    slice: a2,
    error: s2
  }], g = c2.state === "AVAILABLE" && c2.value !== void 0, _ = g ? I(c2.value).display : "\u4E0D\u53EF\u6BD4\u8F83", v2 = c2.direction === "INCREASE" ? "\u589E\u52A0" : c2.direction === "DECREASE" ? "\u51CF\u5C11" : "\u4E0D\u53D8";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(se, {
    category: "comparison",
    size: "1x3",
    className: "comparison-widget",
    "aria-label": `Compare ${e3}`,
    title: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(V, {
      text: e3,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t2 ?? e3 })
    }),
    status: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
      name: "arrows-exchange",
      size: "navigation"
    }),
    primary: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "comparison-values",
      children: [h.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "comparison-value",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
          className: "comparison-label",
          children: [
            e4.role,
            " \xB7",
            " ",
            e4.label === e4.role ? "\u672A\u6307\u5B9A\u5BF9\u8C61" : e4.label
          ]
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(V, {
          text: e4.error ? `${e4.error.code}: ${e4.error.detail}` : e4.slice?.value ? `\u7CBE\u786E\u503C ${I(e4.slice.value).exact} \xB7 ${e4.slice.state}` : e4.slice?.state ?? "\u6CA1\u6709\u5339\u914D\u6570\u636E",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
            className: "comparison-number",
            children: e4.slice?.state === "AVAILABLE" && e4.slice.value ? I(e4.slice.value).display : e4.error ? "\u8BFB\u53D6\u5931\u8D25" : e4.slice?.state ?? "\u65E0\u6570\u636E"
          })
        })]
      }, e4.key)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "comparison-value comparison-change",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "comparison-label",
          children: "\u53D8\u5316 \xB7 \u5BF9\u7167 \u2212 \u57FA\u51C6"
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(V, {
          text: g ? `\u7CBE\u786E\u5DEE\u503C ${I(c2.value).exact} \xB7 ${v2}\uFF1B\u4E0D\u4EE3\u8868\u597D\u574F` : c2.withholding_reason ?? c2.state,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
            className: "comparison-number comparison-delta-number",
            children: [
              g && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
                className: "comparison-direction",
                "data-direction": c2.direction,
                name: c2.direction === "INCREASE" ? "triangle-filled" : c2.direction === "DECREASE" ? "triangle-inverted-filled" : "minus",
                size: "inline-action",
                "aria-label": c2.direction === "INCREASE" ? "\u4E0A\u6DA8" : c2.direction === "DECREASE" ? "\u4E0B\u8DCC" : "\u6301\u5E73"
              }),
              g && c2.direction === "INCREASE" ? "+" : "",
              c2.value?.kind === "RATIO" ? _.replace("%", "") : _,
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: g && c2.value?.kind === "RATIO" ? " pp" : "" })
            ]
          })
        })]
      })]
    }),
    footer: g ? c2.value?.kind === "RATIO" ? "pp = \u767E\u5206\u70B9 \xB7 \u975E\u76F8\u5BF9\u589E\u957F\u7387" : `${v2} \xB7 \u4E0D\u4EE3\u8868\u597D\u574F` : "\u7F3A\u5C11\u53EF\u6BD4\u8F83\u7ED3\u679C\uFF0C\u4E0D\u751F\u6210\u5DEE\u503C",
    actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
      className: "comparison-actions",
      children: h.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: "comparison-side-actions",
        children: [
          l2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(V, {
            text: `${e4.label}\u7684\u8BC1\u636E`,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
              size: "compact",
              appearance: "ghost",
              "aria-label": `\u67E5\u770B${e4.role}\u8BC1\u636E`,
              onClick: (t3) => l2(e4.key, t3.currentTarget),
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, { name: "file" })
            })
          }),
          f2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(V, {
            text: `${e4.label}\u7684\u6307\u6807\u8BF4\u660E`,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
              size: "compact",
              appearance: "ghost",
              "aria-label": `\u67E5\u770B${e4.role}\u8BF4\u660E`,
              onClick: (t3) => f2(e4.key, t3.currentTarget),
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, { name: "help" })
            })
          }),
          e4.error?.retryable && m && p && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
            type: "button",
            onClick: p,
            children: ["\u91CD\u8BD5", e4.role]
          })
        ]
      }, e4.key))
    })
  });
}
var ce = {
  "role-template-rework-rate@2.0.0": {
    definition: "Role-template rework rate",
    valueSemantics: "Ratio of covered terminal Delivery/template exposures with at least one recorded FINDING_FIX relationship.",
    eligibility: "Terminal Delivery with an accepted Manifest and recorded C30 binding the exercised role template.",
    exclusions: [
      "Missing or incompatible Manifest coordinate",
      "Unavailable repair relationship input",
      "Expired records outside the current population"
    ],
    limits: "Repair association is descriptive. Do not infer template, reviewer, or writer causality; do not merge Deliveries in one Task."
  },
  "role-template-trajectory-partial-cost@2.0.0": {
    definition: "Role-template trajectory partial cost",
    valueSemantics: "Reported compatible money Usage for terminal Delivery/template exposures.",
    eligibility: "Terminal Delivery with exact Manifest-bound role template exposure and compatible reported money Usage.",
    exclusions: ["Incompatible Usage kind, unit, source, or source_id"],
    limits: "Do not label as total cost; do not estimate, price, or convert Usage."
  },
  "role-model-task-outcome-rate@2.0.0": {
    definition: "Role-model task outcome rate",
    valueSemantics: "Outcome ratio for eligible attributed terminal Tasks.",
    eligibility: "Unique terminal Task outcome and complete canonical model-role tuple.",
    exclusions: ["Open or mixed-outcome Task", "Incomplete attribution"],
    limits: "Outcome difference is descriptive; do not infer model causality."
  },
  "operational-latency-ms@2.0.0": {
    definition: "Operational latency",
    valueSemantics: "Native model-call Span duration in milliseconds.",
    eligibility: "Native host-reported finite nonnegative duration.",
    exclusions: ["Absent or invalid duration", "Incompatible provider or runtime cohort"],
    limits: "Operational latency is not Delivery elapsed time. Do not substitute C55 or infer causality."
  },
  "trajectory-partial-cost@2.0.0": {
    definition: "Trajectory partial cost",
    valueSemantics: "Partial sum of compatible reported money Usage linked to a Delivery.",
    eligibility: "Exact Delivery linkage and exact Usage kind, unit, source, and source_id.",
    exclusions: ["Incompatible Usage kind, unit, source, or source_id"],
    limits: "Do not label as total cost; do not estimate, price, or convert Usage."
  },
  "task-cohort-comparison-eligibility@2.0.0": {
    definition: "Task cohort comparison eligibility",
    valueSemantics: "Ratio of defined Tasks ready for compatible cohort comparison.",
    eligibility: "Task passes the Metric Catalog Task eligibility rules.",
    exclusions: [
      "Open Delivery",
      "Mixed Delivery outcomes",
      "Undefined Task membership",
      "Missing Task identity or cohort coordinates"
    ],
    limits: "Eligibility measures evidence readiness, not outcome quality. Excluded Tasks stay in the denominator."
  },
  "delivery-stage-reach@2.0.0": {
    definition: "Delivery stage reach",
    valueSemantics: "Per-stage ratio over linked terminal Deliveries with direct C56 readings.",
    eligibility: "Linked terminal Delivery with a valid direct C56 value.",
    exclusions: ["Absent or invalid C56 from the reached-stage numerator"],
    limits: "Stage identity does not prove unobserved traversal; do not infer from Workflow order."
  },
  "delivery-terminal-outcome-rate@2.0.0": {
    definition: "Delivery terminal outcome rate",
    valueSemantics: "Per-outcome ratio over explicitly terminated Deliveries.",
    eligibility: "Exact terminal Delivery identity and supported outcome.",
    exclusions: ["Open or non-terminal Delivery", "Unsupported outcome"],
    limits: "Delivery outcome is not Task outcome; do not infer a Task-level outcome."
  },
  "delivery-cycle-time-ms@2.0.0": {
    definition: "Delivery cycle time",
    valueSemantics: "Owner-reported direct C55 Delivery elapsed time in milliseconds.",
    eligibility: "Terminal Delivery with finite nonnegative C55.",
    exclusions: ["Absent or invalid C55"],
    limits: "Do not derive from arrival time or substitute model-call latency or zero."
  },
  "operational-token-usage@2.0.0": {
    definition: "Operational token usage",
    valueSemantics: "Compatible reported input or output token measurements.",
    eligibility: "Reported compatible token measurement for an exact model call.",
    exclusions: ["Absent or incompatible measurement"],
    limits: "Values are partial attributable Usage; do not synthesize total tokens."
  },
  "operational-attributable-cost@2.0.0": {
    definition: "Operational attributable cost",
    valueSemantics: "Reported money Usage bound to an exact model call.",
    eligibility: "Trace/Span context binds Usage to the exact call with compatible kind, unit, source, and source_id.",
    exclusions: [
      "Missing call linkage",
      "Incompatible Usage",
      "Incomplete attribution"
    ],
    limits: "Do not label as total cost; do not estimate, price, or convert Usage."
  },
  "operational-usage-availability@2.0.0": {
    definition: "Operational usage availability",
    valueSemantics: "Ratio of eligible model calls with reported compatible Usage.",
    eligibility: "Eligible exact model-call identity.",
    exclusions: ["Unsupported call identity or compatibility context"],
    limits: "Availability does not state Usage amount; do not turn missing Usage into zero."
  }
};
var le = /* @__PURE__ */ new Set([
  "AVAILABLE",
  "LOWER_BOUND",
  "NOT_APPLICABLE",
  "UNAVAILABLE",
  "EXPIRED",
  "INCOMPATIBLE"
]);
var ue = /* @__PURE__ */ new Set([
  "COUNT",
  "QUANTITY",
  "RATIO",
  "MONEY",
  "DURATION_MS",
  "BOOLEAN"
]);
var de = /* @__PURE__ */ new Set([
  "SAMPLE_INSUFFICIENT",
  "MISSING_INPUT",
  "NO_APPLICABLE_POPULATION",
  "OPEN_TASK",
  "MIXED_TASK_OUTCOMES",
  "EXPIRED_INPUT",
  "INCOMPATIBLE_INPUT"
]);
var fe = /* @__PURE__ */ new Set([
  "NO_POPULATION",
  "NO_COVERAGE",
  "PARTIAL",
  "FULL"
]);
var U = (e3) => typeof e3 == "object" && !!e3 && !Array.isArray(e3);
var pe = (e3) => Array.isArray(e3) && e3.every((e4) => typeof e4 == "string");
function W(e3) {
  return !U(e3) || typeof e3.metric_id != "string" || e3.metric_id.length === 0 || e3.metric_version !== "2.0.0" || !Array.isArray(e3.slices) ? false : e3.slices.every((e4) => {
    let t2 = typeof e4 == "object" && !!e4 && (e4.coverage === null || U(e4.coverage) && typeof e4.coverage.numerator == "string" && typeof e4.coverage.denominator == "string" && (e4.coverage.raw_ratio === null || typeof e4.coverage.raw_ratio == "string") && typeof e4.coverage.state == "string" && fe.has(e4.coverage.state) && (e4.coverage.alert === null || e4.coverage.alert === "LOW_COVERAGE"));
    return !U(e4) || !U(e4.slice_key) || typeof e4.state != "string" || !le.has(e4.state) || !U(e4.measures) || !U(e4.compatibility) || !pe(e4.exclusions) || !pe(e4.missing_inputs) || !pe(e4.provenance_refs) || !t2 || e4.numerator !== void 0 && typeof e4.numerator != "string" || e4.denominator !== void 0 && typeof e4.denominator != "string" || e4.contributing_count !== void 0 && typeof e4.contributing_count != "string" || e4.reading !== void 0 && typeof e4.reading != "string" ? false : e4.value === void 0 ? typeof e4.withholding_reason == "string" && de.has(e4.withholding_reason) : !U(e4.value) || typeof e4.value.kind != "string" || !ue.has(e4.value.kind) || typeof e4.value.unit != "string" ? false : e4.value.kind === "BOOLEAN" ? typeof e4.value.value == "boolean" : typeof e4.value.value == "string" ? e4.value.kind === "RATIO" ? /^-?(?:0|[1-9][0-9]*)(?:\/[1-9][0-9]*)?$/u.test(e4.value.value) : /^-?(?:0|[1-9][0-9]*)$/u.test(e4.value.value) || e4.value.kind === "MONEY" || e4.value.kind === "QUANTITY" : false;
  });
}
var G = (e3) => e3;
var me = {
  "numeric-card@1": G({
    id: "numeric-card@1",
    arity: "ONE_SLICE",
    channels: ["value"],
    kinds: [
      "COUNT",
      "QUANTITY",
      "RATIO",
      "MONEY",
      "DURATION_MS"
    ],
    authoritativeDomain: "NONE",
    missingTolerance: "TRUTH_STATE",
    compare: "SEPARATE_SIDES",
    fallback: "table@1",
    transforms: ["DISPLAY_ROUNDING", "RATIO_TO_PERCENT"]
  }),
  "badge@1": G({
    id: "badge@1",
    arity: "ONE_SLICE",
    channels: ["value"],
    kinds: ["BOOLEAN"],
    authoritativeDomain: "NONE",
    missingTolerance: "TRUTH_STATE",
    compare: "SEPARATE_SIDES",
    fallback: "table@1",
    transforms: []
  }),
  "ratio-bar@1": G({
    id: "ratio-bar@1",
    arity: "ONE_SLICE",
    channels: ["value", "domain"],
    kinds: ["RATIO"],
    authoritativeDomain: "NONE",
    missingTolerance: "TRUTH_STATE",
    compare: "SEPARATE_SIDES",
    fallback: "table@1",
    transforms: ["RATIO_TO_PERCENT", "SCALE_LAYOUT"]
  }),
  "table@1": G({
    id: "table@1",
    arity: "ANY",
    channels: ["published-result"],
    kinds: "ANY",
    authoritativeDomain: "NONE",
    missingTolerance: "ROWS",
    compare: "SUPPORTED",
    fallback: "table@1",
    transforms: [
      "DISPLAY_ROUNDING",
      "RATIO_TO_PERCENT",
      "STABLE_AUTHORITATIVE_SORT"
    ]
  })
};
function K(e3) {
  if (e3.value === void 0) return ["numeric-card@1", "table@1"];
  let t2 = [];
  return e3.value.kind === "BOOLEAN" ? t2.push("badge@1") : t2.push("numeric-card@1"), e3.value.kind === "RATIO" && e3.value.unit === "ratio" && t2.push("ratio-bar@1"), t2.push("table@1"), t2;
}
function he(e3) {
  if (e3.slices.length !== 1) return "table@1";
  let t2 = e3.slices[0]?.value;
  return t2?.kind === "BOOLEAN" ? "badge@1" : t2?.kind === "RATIO" && t2.unit === "ratio" ? "ratio-bar@1" : "numeric-card@1";
}
var ge = {
  "zh-CN": {
    AVAILABLE: {
      label: "\u53EF\u7528",
      description: "\u5F53\u524D\u7ED3\u679C\u53EF\u7528\u3002"
    },
    LOWER_BOUND: {
      label: "\u4EC5\u4E0B\u754C",
      description: "\u5F53\u524D\u6570\u503C\u4EC5\u8868\u793A\u4E0B\u754C\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u5B8C\u6574\u7ED3\u679C\u3002"
    },
    NOT_APPLICABLE: {
      label: "\u4E0D\u9002\u7528",
      description: "\u5F53\u524D\u8303\u56F4\u4E0D\u9002\u7528\u6B64\u6307\u6807\u3002"
    },
    UNAVAILABLE: {
      label: "\u4E0D\u53EF\u7528",
      description: "\u5F53\u524D\u65E0\u6CD5\u63D0\u4F9B\u8BE5\u6307\u6807\u7ED3\u679C\u3002"
    },
    EXPIRED: {
      label: "\u5DF2\u8FC7\u671F",
      description: "\u5F53\u524D\u7ED3\u679C\u5DF2\u8FC7\u671F\u3002"
    },
    INCOMPATIBLE: {
      label: "\u4E0D\u517C\u5BB9",
      description: "\u5F53\u524D\u7ED3\u679C\u4E0D\u6EE1\u8DB3\u517C\u5BB9\u6027\u8981\u6C42\u3002"
    }
  },
  en: {
    AVAILABLE: {
      label: "Available",
      description: "The current result is available."
    },
    LOWER_BOUND: {
      label: "Lower bound",
      description: "The value is a lower bound, not a complete result."
    },
    NOT_APPLICABLE: {
      label: "Not applicable",
      description: "The metric does not apply to the current scope."
    },
    UNAVAILABLE: {
      label: "Unavailable",
      description: "The metric result is currently unavailable."
    },
    EXPIRED: {
      label: "Expired",
      description: "The current result has expired."
    },
    INCOMPATIBLE: {
      label: "Incompatible",
      description: "The result does not meet compatibility requirements."
    }
  }
};
var _e = {
  AVAILABLE: {
    label: "Available",
    marker: "circle-check",
    tone: "available"
  },
  LOWER_BOUND: {
    label: "Lower bound",
    marker: "circle-arrow-up",
    tone: "attention"
  },
  NOT_APPLICABLE: {
    label: "Not applicable",
    marker: "circle-minus",
    tone: "unavailable"
  },
  UNAVAILABLE: {
    label: "Unavailable",
    marker: "circle-x",
    tone: "unavailable"
  },
  EXPIRED: {
    label: "Expired",
    marker: "clock",
    tone: "expired"
  },
  INCOMPATIBLE: {
    label: "Incompatible",
    marker: "exclamation-circle",
    tone: "incompatible"
  }
};
function ve({ state: e3, withholdingReason: t2, reading: n2, detail: r2 = "full", locale: i2 = "en" }) {
  let a2 = _e[e3];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "status-stack",
    "data-state": e3,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: `status-label status-${a2.tone}`,
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          "aria-hidden": "true",
          className: "status-label-marker",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
            name: a2.marker,
            size: "content-marker"
          })
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "status-label-text",
          children: ge[i2][e3].label
        })]
      }),
      r2 === "label" || t2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: "status-reason",
        children: ["Reason: ", t2]
      }),
      r2 === "label" || n2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "status-reading",
        children: n2
      })
    ]
  });
}
var ye = {
  NO_POPULATION: "No applicable population",
  NO_COVERAGE: "No coverage",
  PARTIAL: "Partial coverage",
  FULL: "Full coverage"
};
var be = {
  NO_POPULATION: {
    marker: "circle",
    tone: "unavailable"
  },
  NO_COVERAGE: {
    marker: "circle",
    tone: "attention"
  },
  PARTIAL: {
    marker: "exclamation-mark",
    tone: "attention"
  },
  FULL: {
    marker: "circle-filled",
    tone: "available"
  }
};
function xe({ coverage: e3 }) {
  if (e3 === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "coverage-label",
    "data-coverage": "UNAVAILABLE",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
      className: "status-label status-unavailable",
      children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
        name: "circle",
        size: "content-marker"
      }), "Coverage unavailable"]
    })
  });
  let t2 = be[e3.state];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "coverage-label",
    "data-coverage": e3.state,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: `status-label status-${t2.tone}`,
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          "aria-hidden": "true",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
            name: t2.marker,
            size: "content-marker"
          })
        }), ye[e3.state]]
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: "numeric-exact",
        children: [
          e3.numerator,
          " / ",
          e3.denominator
        ]
      }),
      e3.alert === "LOW_COVERAGE" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "status-reason",
        children: "Low coverage"
      }) : null
    ]
  });
}
var Se = (e3) => e3.toLowerCase().replaceAll("_", " ");
function Ce(e3) {
  if (e3.traceState !== void 0) {
    let t3 = e3.traceState === "PARTIAL" ? "partial recorded data" : Se(e3.traceState), n2 = e3.traceState === "AVAILABLE" ? "available" : e3.traceState === "EXPIRED" ? "expired" : e3.traceState === "PARTIAL" ? "attention" : "unavailable";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
      className: `status-label status-${n2}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
          name: "diamond",
          size: "content-marker"
        }),
        "Trace: ",
        t3
      ]
    });
  }
  let { truth: t2 } = e3;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "lifecycle-grid",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Completeness: ", Se(t2.completeness ?? "UNSPECIFIED")] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Availability: ", Se(t2.availability)] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Expiry: ", Se(t2.expiry)] })
    ]
  });
}
function q({ title: e3, detail: t2, correlation: n2, retryable: r2, onRetry: i2, announce: a2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-live": a2,
    className: "scoped-error",
    role: a2 === "assertive" ? "alert" : "status",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
        className: "text-heading",
        children: e3
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "text-body",
        children: t2
      }),
      n2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
        className: "text-code",
        children: ["Correlation: ", n2]
      }),
      r2 && i2 !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
        className: "action-control",
        onClick: i2,
        type: "button",
        children: "Retry"
      }) : null
    ]
  });
}
function Te({ slice: e3 }) {
  if (e3.value === void 0) return null;
  let t2 = I(e3.value), n2 = ` ${e3.value.unit}`, r2 = t2.display.endsWith(n2) ? t2.display.slice(0, -n2.length) : t2.display;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "metric-value",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "metric-number",
        children: r2
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className: "metric-unit",
        children: e3.value.unit
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
        className: "numeric-exact",
        children: ["Exact value: ", t2.exact]
      })
    ]
  });
}
function Ee({ slice: e3 }) {
  let t2 = Object.entries(e3.measures), n2 = [
    ["Numerator", e3.numerator],
    ["Denominator", e3.denominator],
    ["Contributing", e3.contributing_count]
  ].filter((e4) => e4[1] !== void 0);
  return t2.length === 0 && n2.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
    className: "metric-measures",
    children: [t2.map(([e4, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: e4 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
      className: "numeric-exact",
      children: t3
    })] }, e4)), n2.map(([e4, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: e4 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
      className: "numeric-exact",
      children: t3
    })] }, e4))]
  });
}
function De({ slice: e3 }) {
  let t2 = Object.entries(e3.compatibility);
  return e3.state !== "INCOMPATIBLE" || t2.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": "Incompatible coordinates",
    className: "status-reading",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Mismatch coordinates" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: t2.map(([e4, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: [
        e4,
        "=",
        t3
      ]
    }) }, e4)) })]
  });
}
function Oe({ coordinate: e3, content: t2, visualization: n2, onExplain: r2, onEvidence: i2, onRecover: a2, focusEvidenceAction: o2 = false, recoveryLabel: s2 = "Recover result" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
    "aria-label": e3,
    className: "metric-frame",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
      className: "metric-frame-header",
      children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
        className: "text-heading metric-coordinate",
        children: e3
      }), t2.tag === "RESULT" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ve, {
        reading: t2.slice.reading,
        state: t2.slice.state,
        withholdingReason: t2.slice.withholding_reason
      }) : null]
    }), t2.tag === "LOADING" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
      "aria-live": "polite",
      className: "loading-state",
      role: "status",
      children: "Loading metric\u2026"
    }) : t2.tag === "ERROR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
      announce: "assertive",
      detail: t2.detail,
      onRetry: t2.onRetry,
      retryable: t2.retryable,
      title: "Metric request failed"
    }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Te, { slice: t2.slice }),
      t2.slice.value === void 0 ? null : n2,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ee, { slice: t2.slice }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(De, { slice: t2.slice }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(xe, { coverage: t2.slice.coverage }),
      t2.slice.missing_inputs.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
        className: "status-reading",
        children: ["Missing inputs: ", t2.slice.missing_inputs.join(", ")]
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
        className: "metric-actions",
        children: [
          t2.slice.value !== void 0 || a2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
            className: "action-control",
            onClick: a2,
            type: "button",
            children: s2
          }),
          r2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
            className: "action-control",
            onClick: (e4) => r2(e4.currentTarget),
            type: "button",
            children: "Metric explanation"
          }),
          i2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
            autoFocus: o2,
            className: "action-control",
            onClick: (e4) => i2(e4.currentTarget),
            type: "button",
            children: "View evidence"
          })
        ]
      })
    ] })]
  });
}
function je({ onExplain: e3, onEvidence: t2, focusEvidenceAction: n2 = false }) {
  return e3 === void 0 && t2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
    className: "metric-actions",
    children: [e3 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
      className: "action-control",
      onClick: (t3) => e3(t3.currentTarget),
      type: "button",
      children: "Metric explanation"
    }), t2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
      autoFocus: n2,
      className: "action-control",
      onClick: (e4) => t2(e4.currentTarget),
      type: "button",
      children: "View evidence"
    })]
  });
}
function Me({ coordinate: e3, slices: t2, label: n2 = "Result data" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "bounded-table",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      "aria-label": `${n2}: ${e3}`,
      className: "visual-data-table",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("caption", { children: n2 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Slice"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "State"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Exact value"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Result population"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Measures"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Coverage"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Compatibility"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Limitations"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Provenance"
          })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: t2.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: JSON.stringify(e4.slice_key)
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e4.state }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: e4.value === void 0 ? e4.withholding_reason : I(e4.value).exact
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
            className: "numeric-exact",
            children: [e4.numerator === void 0 || e4.denominator === void 0 ? "Not published" : `${e4.numerator} / ${e4.denominator}`, e4.contributing_count === void 0 ? null : ` \xB7 Contributing: ${e4.contributing_count}`]
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: Object.keys(e4.measures).length === 0 ? "None" : JSON.stringify(e4.measures)
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: e4.coverage === null ? "Unavailable" : `${e4.coverage.state} \xB7 ${e4.coverage.numerator} / ${e4.coverage.denominator} \xB7 ${e4.coverage.raw_ratio ?? "not applicable"}${e4.coverage.alert === null ? "" : ` \xB7 ${e4.coverage.alert}`}`
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: Object.keys(e4.compatibility).length === 0 ? "None" : JSON.stringify(e4.compatibility)
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: [
            ...e4.exclusions.map((e6) => `Excluded: ${e6}`),
            ...e4.missing_inputs.map((e6) => `Missing: ${e6}`),
            ...e4.reading === void 0 ? [] : [e4.reading]
          ].join(" \xB7 ") || "None" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "numeric-exact",
            children: e4.provenance_refs.join(", ") || "None"
          })
        ] }, JSON.stringify(e4.slice_key))) })
      ]
    })
  });
}
function Ne(e3) {
  let [t2, n2 = "1"] = e3.split("/");
  try {
    let e4 = BigInt(t2), r2 = BigInt(n2);
    return r2 > 0n && e4 >= 0n && e4 <= r2;
  } catch {
    return false;
  }
}
function Pe({ slice: e3 }) {
  if (e3.value?.kind !== "RATIO") return null;
  let [t2, n2] = e3.value.value.split("/"), r2 = BigInt(n2 ?? "1"), i2 = Number(BigInt(t2) * 10000n / r2), a2 = linear2().domain([0, 1e4]).range([8, 198])(i2), o2 = I(e3.value);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "visual-with-fallback",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
      "aria-label": "Ratio bar",
      className: "visual-preview text-data-series-1",
      role: "img",
      viewBox: "0 0 206 70",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `${o2.display}; exact ${o2.exact}` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
          className: "stroke-border-default",
          d: "M8 35 H198",
          fill: "none"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
          className: "fill-current",
          height: "18",
          width: Math.max(0, a2 - 8),
          x: "8",
          y: "26"
        })
      ]
    }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      "aria-label": "Ratio bar data",
      className: "visual-data-table",
      children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("caption", { children: "Ratio bar data" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
        scope: "row",
        children: "Exact ratio"
      }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
        className: "numeric-exact",
        children: e3.value.value
      })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
        scope: "row",
        children: "Display percent"
      }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: o2.display })] })] })]
    })]
  });
}
function Fe({ slice: e3 }) {
  return e3.value?.kind === "BOOLEAN" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
    "aria-label": "Boolean result",
    className: "status-label",
    role: "status",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(z, {
        name: e3.value.value ? "check" : "circle",
        size: "content-marker"
      }),
      " ",
      e3.value.value ? "True" : "False"
    ]
  }) : null;
}
function Ie({ coordinate: e3, slices: t2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "bounded-table",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      "aria-label": `Dashboard result preview: ${e3}`,
      className: "visual-data-table dashboard-result-table",
      children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
          scope: "col",
          children: "Slice"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
          scope: "col",
          children: "State"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
          scope: "col",
          children: "Exact value"
        })
      ] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: t2.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
          className: "numeric-exact",
          children: JSON.stringify(e4.slice_key)
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e4.state }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
          className: "numeric-exact",
          children: e4.value === void 0 ? e4.withholding_reason : I(e4.value).exact
        })
      ] }, JSON.stringify(e4.slice_key))) })]
    })
  });
}
function Le({ result: e3, visualizer: t2, size: n2, onEvidence: r2 }) {
  if (!W(e3)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
    className: "panel-card",
    "data-presentation": "dashboard",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
      announce: "assertive",
      detail: "The supplied value does not satisfy the formal Metric Result 2.0.0 contract.",
      retryable: false,
      title: "Metric Result incompatible"
    })
  });
  let i2 = `${e3.metric_id}@${e3.metric_version}`, a2 = Object.hasOwn(ce, i2) ? ce[i2].definition : i2, o2 = t2 ?? he(e3), s2 = e3.slices[0];
  if (o2 === "table@1" || e3.slices.length !== 1) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
    "aria-label": a2,
    className: "dashboard-metric-panel",
    "data-metric-coordinate": i2,
    "data-panel-size": n2,
    "data-presentation": "dashboard",
    "data-visualizer": o2,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
        className: "dashboard-panel-head",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: a2 })
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ie, {
        coordinate: i2,
        slices: e3.slices
      }),
      r2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
        className: "dashboard-panel-actions",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(b, {
          onClick: (e4) => r2(e4.currentTarget),
          type: "button",
          children: "View evidence"
        })
      })
    ]
  });
  if (s2 === void 0) return null;
  let c2 = s2.value === void 0 ? void 0 : I(s2.value), l2 = s2.value?.kind === "RATIO" && Ne(s2.value.value) ? Number(BigInt(s2.value.value.split("/")[0]) * 10000n / BigInt(s2.value.value.split("/")[1] ?? "1")) / 100 : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
    "aria-label": a2,
    className: "dashboard-metric-panel",
    "data-metric-coordinate": i2,
    "data-panel-size": n2,
    "data-presentation": "dashboard",
    "data-scrollable": o2 === "numeric-card@1" ? "false" : void 0,
    "data-visualizer": o2,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
        className: "dashboard-panel-head",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
          className: "dashboard-panel-title",
          children: a2
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ve, {
          detail: "label",
          reading: s2.reading,
          state: s2.state,
          withholdingReason: s2.withholding_reason
        })]
      }),
      s2.value === void 0 ? s2.coverage === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
        className: "dashboard-panel-meta",
        children: [
          s2.coverage.state === "NO_POPULATION" ? "No applicable population" : s2.coverage.state.toLowerCase().replaceAll("_", " "),
          " ",
          "\xB7 ",
          s2.coverage.numerator,
          " / ",
          s2.coverage.denominator
        ]
      }) : o2 === "badge@1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fe, { slice: s2 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "metric-value",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "metric-number",
          children: c2?.display
        }), o2 === "ratio-bar@1" || o2 === "numeric-card@1" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
          className: "numeric-exact",
          children: ["Exact value: ", c2?.exact]
        })]
      }),
      o2 === "ratio-bar@1" && l2 !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
        "aria-label": `${a2}: ${c2?.display}; exact ${c2?.exact}`,
        className: "dashboard-ratio",
        role: "img",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { style: { width: `${l2}%` } })
      }) : null,
      n2 === "SMALL" || o2 === "numeric-card@1" || s2.numerator === void 0 || s2.denominator === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
        className: "dashboard-panel-meta",
        children: [
          s2.numerator,
          " / ",
          s2.denominator,
          " exact"
        ]
      }),
      r2 === void 0 ? null : o2 === "numeric-card@1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
        className: "dashboard-panel-actions",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
          appearance: "ghost",
          "aria-label": "View evidence",
          onClick: (e4) => r2(e4.currentTarget),
          type: "button",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
            "aria-hidden": "true",
            className: "dashboard-evidence-icon icon-[tabler--file-search]"
          })
        })
      }) : n2 === "SMALL" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
        className: "dashboard-panel-actions",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(b, {
          onClick: (e4) => r2(e4.currentTarget),
          type: "button",
          children: "View evidence"
        })
      })
    ]
  });
}
function Re({ result: e3, visualizer: t2, onExplain: n2, onEvidence: r2, focusEvidenceAction: i2 = false }) {
  if (!W(e3)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
    className: "panel-card",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
      announce: "assertive",
      detail: "The supplied value does not satisfy the formal Metric Result 2.0.0 contract.",
      retryable: false,
      title: "Metric Result incompatible"
    })
  });
  let a2 = t2 ?? he(e3), o2 = `${e3.metric_id}@${e3.metric_version}`;
  return e3.slices.every((e4) => e4.value === void 0 || K(e4).includes(a2) && (a2 !== "ratio-bar@1" || e4.value.kind === "RATIO" && Ne(e4.value.value))) ? a2 === "table@1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    className: "panel-card",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Me, {
      coordinate: o2,
      slices: e3.slices
    }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(je, {
      focusEvidenceAction: i2,
      onEvidence: r2,
      onExplain: n2
    })]
  }) : e3.slices.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Oe, {
    content: {
      tag: "RESULT",
      slice: e4
    },
    coordinate: o2,
    onEvidence: r2,
    onExplain: n2,
    focusEvidenceAction: i2,
    visualization: a2 === "ratio-bar@1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pe, { slice: e4 }) : a2 === "badge@1" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fe, { slice: e4 }) : void 0
  }, JSON.stringify(e4.slice_key))) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    className: "panel-card",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
        announce: "polite",
        detail: `${a2} cannot consume the published Result shape without inventing a domain or value.`,
        retryable: false,
        title: "Visualizer binding incompatible"
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Me, {
        coordinate: o2,
        label: "Fallback result data",
        slices: e3.slices
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(je, {
        focusEvidenceAction: i2,
        onEvidence: r2,
        onExplain: n2
      })
    ]
  });
}
function ze({ label: e3, coordinate: t2, slice: n2, error: r2, ownsError: i2, onRetry: a2, onExplain: o2, onEvidence: s2, focusEvidenceAction: c2, visualizer: l2 }) {
  let f2 = t2.lastIndexOf("@"), p = n2 === void 0 ? void 0 : {
    metric_id: t2.slice(0, f2),
    metric_version: "2.0.0",
    slices: [n2]
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": `${e3} result`,
    className: "compare-side",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
      className: "text-label",
      children: e3
    }), p === void 0 ? r2 !== void 0 && i2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
      announce: "assertive",
      detail: `${r2.code}: ${r2.detail}`,
      onRetry: a2,
      retryable: r2.retryable,
      title: `${e3} unavailable`
    }) : r2 === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
      className: "empty-state",
      children: "No matching slice on this side."
    }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
      className: "status-reading",
      children: [
        e3,
        " side unresolved: ",
        r2.code
      ]
    }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Re, {
      result: p,
      visualizer: l2,
      focusEvidenceAction: c2,
      onEvidence: s2,
      onExplain: o2
    })]
  });
}
function Be({ delta: e3 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": "Delta result",
    className: "compare-delta",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
      className: "text-label",
      children: "Delta"
    }), e3.state === "AVAILABLE" && e3.value !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "status-stack",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "metric-number",
          children: I(e3.value).display
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "status-reading",
          children: e3.direction === "INCREASE" ? "Increase" : e3.direction === "DECREASE" ? "Decrease" : "No change"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
          className: "numeric-exact",
          children: ["Exact delta: ", I(e3.value).exact]
        })
      ]
    }) : e3.state === "SIDE_UNRESOLVED" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
      className: "status-reading",
      children: "Delta unavailable until both sides resolve"
    }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
      className: "status-reading",
      children: ["Delta withheld: ", e3.withholding_reason]
    })]
  });
}
function Ve({ title: e3, beforeLabel: t2, afterLabel: n2, coordinate: r2, before: i2, after: a2, beforeError: o2, afterError: s2, delta: c2, onRetryFailedSide: l2, ownsFailedSide: f2 = true, focusEvidenceSide: p, onExplain: m, onEvidence: h, visualizer: g = "numeric-card@1", monitoring: _ = false }) {
  return _ ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(H, {
    coordinate: r2,
    title: e3,
    beforeLabel: t2,
    afterLabel: n2,
    before: i2,
    after: a2,
    beforeError: o2,
    afterError: s2,
    delta: c2,
    onRetryFailedSide: l2,
    ownsFailedSide: f2,
    focusEvidenceSide: p,
    onExplain: m,
    onEvidence: h
  }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
    "aria-label": `Compare ${r2}`,
    className: "compare-result",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ze, {
        coordinate: r2,
        error: o2,
        focusEvidenceAction: p === "left",
        label: "Before",
        ownsError: f2,
        onEvidence: h === void 0 ? void 0 : (e4) => h("left", e4),
        onExplain: m === void 0 ? void 0 : (e4) => m("left", e4),
        onRetry: o2 === void 0 ? void 0 : l2,
        slice: i2,
        visualizer: g
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ze, {
        coordinate: r2,
        error: s2,
        focusEvidenceAction: p === "right",
        label: "After",
        ownsError: f2,
        onEvidence: h === void 0 ? void 0 : (e4) => h("right", e4),
        onExplain: m === void 0 ? void 0 : (e4) => m("right", e4),
        onRetry: s2 === void 0 ? void 0 : l2,
        slice: a2,
        visualizer: g
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Be, { delta: c2 })
    ]
  });
}
function He(e3, t2) {
  return !(e3.i === t2.i || e3.x + e3.w <= t2.x || e3.x >= t2.x + t2.w || e3.y + e3.h <= t2.y || e3.y >= t2.y + t2.h);
}
function Ue(e3, t2) {
  for (let n2 = 0; n2 < e3.length; n2++) {
    let r2 = e3[n2];
    if (r2 !== void 0 && He(r2, t2)) return r2;
  }
}
function We(e3) {
  return [...e3].sort((e4, t2) => e4.y === t2.y ? e4.x - t2.x : e4.y - t2.y);
}
function Ge(e3) {
  return [...e3].sort((e4, t2) => e4.x === t2.x ? e4.y - t2.y : e4.x - t2.x);
}
function Ke(e3) {
  let t2 = 0;
  for (let n2 = 0; n2 < e3.length; n2++) {
    let r2 = e3[n2];
    if (r2 !== void 0) {
      let e4 = r2.y + r2.h;
      e4 > t2 && (t2 = e4);
    }
  }
  return t2;
}
function qe(e3) {
  return e3.filter((e4) => e4.static === true);
}
function Je(e3) {
  return {
    i: e3.i,
    x: e3.x,
    y: e3.y,
    w: e3.w,
    h: e3.h,
    minW: e3.minW,
    maxW: e3.maxW,
    minH: e3.minH,
    maxH: e3.maxH,
    moved: !!e3.moved,
    static: !!e3.static,
    isDraggable: e3.isDraggable,
    isResizable: e3.isResizable,
    resizeHandles: e3.resizeHandles,
    constraints: e3.constraints,
    isBounded: e3.isBounded
  };
}
function Ye(e3) {
  let t2 = Array(e3.length);
  for (let n2 = 0; n2 < e3.length; n2++) {
    let r2 = e3[n2];
    r2 !== void 0 && (t2[n2] = Je(r2));
  }
  return t2;
}
function Qe(e3, t2, n2, r2, i2) {
  let a2 = r2 === "x" ? "w" : "h";
  t2[r2] += 1;
  let o2 = e3.findIndex((e4) => e4.i === t2.i), s2 = i2 ?? qe(e3).length > 0;
  for (let i3 = o2 + 1; i3 < e3.length; i3++) {
    let o3 = e3[i3];
    if (o3 !== void 0 && !o3.static) {
      if (!s2 && o3.y > t2.y + t2.h) break;
      He(t2, o3) && Qe(e3, o3, n2 + t2[a2], r2, s2);
    }
  }
  t2[r2] = n2;
}
function $e(e3, t2, n2, r2) {
  for (t2.x = Math.max(t2.x, 0), t2.y = Math.max(t2.y, 0), t2.y = Math.min(r2, t2.y); t2.y > 0 && !Ue(e3, t2); ) t2.y--;
  let i2;
  for (; (i2 = Ue(e3, t2)) !== void 0; ) Qe(n2, t2, i2.y + i2.h, "y");
  return t2.y = Math.max(t2.y, 0), t2;
}
function et(e3, t2, n2, r2) {
  for (t2.x = Math.max(t2.x, 0), t2.y = Math.max(t2.y, 0); t2.x > 0 && !Ue(e3, t2); ) t2.x--;
  let i2;
  for (; (i2 = Ue(e3, t2)) !== void 0; ) if (Qe(r2, t2, i2.x + i2.w, "x"), t2.x + t2.w > n2) for (t2.x = n2 - t2.w, t2.y++; t2.x > 0 && !Ue(e3, t2); ) t2.x--;
  return t2.x = Math.max(t2.x, 0), t2;
}
var tt = {
  type: "vertical",
  allowOverlap: false,
  compact(e3, t2) {
    let n2 = qe(e3), r2 = Ke(n2), i2 = We(e3), a2 = Array(e3.length);
    for (let t3 = 0; t3 < i2.length; t3++) {
      let o2 = i2[t3];
      if (o2 === void 0) continue;
      let s2 = Je(o2);
      s2.static || (s2 = $e(n2, s2, i2, r2), r2 = Math.max(r2, s2.y + s2.h), n2.push(s2));
      let c2 = e3.indexOf(o2);
      a2[c2] = s2, s2.moved = false;
    }
    return a2;
  }
};
var nt = {
  type: "horizontal",
  allowOverlap: false,
  compact(e3, t2) {
    let n2 = qe(e3), r2 = Ge(e3), i2 = Array(e3.length);
    for (let a2 = 0; a2 < r2.length; a2++) {
      let o2 = r2[a2];
      if (o2 === void 0) continue;
      let s2 = Je(o2);
      s2.static || (s2 = et(n2, s2, t2, r2), n2.push(s2));
      let c2 = e3.indexOf(o2);
      i2[c2] = s2, s2.moved = false;
    }
    return i2;
  }
};
var rt = {
  type: null,
  allowOverlap: false,
  compact(e3, t2) {
    return Ye(e3);
  }
};
({ ...tt }, { ...nt }), { ...rt };
var at = [
  "role-template-rework-rate@2.0.0",
  "role-template-trajectory-partial-cost@2.0.0",
  "role-model-task-outcome-rate@2.0.0",
  "operational-latency-ms@2.0.0",
  "trajectory-partial-cost@2.0.0",
  "task-cohort-comparison-eligibility@2.0.0",
  "delivery-stage-reach@2.0.0",
  "delivery-terminal-outcome-rate@2.0.0",
  "delivery-cycle-time-ms@2.0.0",
  "operational-token-usage@2.0.0",
  "operational-attributable-cost@2.0.0",
  "operational-usage-availability@2.0.0"
];
new TextEncoder();
var ut = (e3, t2) => ({
  panel_id: e3.slice(0, e3.lastIndexOf("@")),
  metric_coordinate: e3,
  visualizer: "table@1",
  size: "WIDE",
  channels: { "published-result": "slices" },
  transforms: [
    "DISPLAY_ROUNDING",
    "RATIO_TO_PERCENT",
    "STABLE_AUTHORITATIVE_SORT"
  ],
  grid: t2
});
ut("delivery-stage-reach@2.0.0", {
  x: 0,
  y: 2,
  w: 3,
  h: 2
}), ut("operational-token-usage@2.0.0", {
  x: 0,
  y: 4,
  w: 3,
  h: 2
}), at.map((e3, t2) => ut(e3, {
  x: 0,
  y: t2 * 2,
  w: 3,
  h: 2
}));
function yt({ values: e3 }) {
  let t2 = Object.entries(e3);
  return t2.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "None" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t2.map(([e4, t3]) => `${e4}=${t3}`).join(", ") });
}
function bt({ membership: e3 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
      className: "text-code",
      children: e3.delivery_id
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Recorded ", e3.recorded_at] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Observation profile ", e3.profile_version] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Source ", e3.source_identity]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Manifest ", e3.manifest_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Accepted ", e3.accepted_digest]
    })
  ] });
}
function St({ population: e3 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
    className: "text-heading",
    children: "Task population"
  }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
    className: "detail-rows",
    children: e3.map((e4) => {
      let t2 = e4.display_name?.trim();
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t2 || e4.task_id }),
        t2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
          className: "text-code",
          children: e4.task_id
        }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [e4.memberships.length, " Delivery memberships"] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Cohort: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(yt, { values: e4.cohort_coordinates })] }),
        e4.terminal_reading === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Terminal reading: ", e4.terminal_reading] }),
        e4.exclusions.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Exclusions: ", e4.exclusions.join(", ")] }),
        e4.memberships.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
          className: "detail-rows",
          children: e4.memberships.map((e6) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(bt, { membership: e6 }, e6.delivery_id))
        })
      ] }, e4.task_id);
    })
  })] });
}
function Ct({ resolution: e3 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e3.state }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: [
        e3.package_name,
        "@",
        e3.exact_package_version
      ]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
      "Workflow ",
      e3.workflow_id,
      "@",
      e3.workflow_version
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Snapshot ", e3.snapshot_id] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Snapshot digest ", e3.snapshot_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Package digest ", e3.package_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Manifest ", e3.manifest_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Manifest projection ", e3.manifest_projection_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Accepted ", e3.accepted_digest]
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Observation profile ", e3.profile_version] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Source ", e3.source_identity]
    }),
    e3.matched_source_id === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e3.matched_source_id }),
    e3.matched_source_index === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Matched source index ", e3.matched_source_index] }),
    e3.matched_repository === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
      className: "text-code",
      children: e3.matched_repository
    }),
    e3.validated_archive_digest === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Validated archive ", e3.validated_archive_digest]
    }),
    e3.validated_package_digest === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Validated package ", e3.validated_package_digest]
    }),
    e3.validated_snapshot_digest === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
      className: "text-code",
      children: ["Validated snapshot ", e3.validated_snapshot_digest]
    }),
    e3.attempts.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
      className: "detail-rows",
      children: e3.attempts.map((e4, t2) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.code }),
        e4.source_id === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.source_id }),
        e4.source_index === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Source index ", e4.source_index] }),
        e4.message === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.message }),
        e4.omitted_count === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Omitted attempts ", e4.omitted_count] })
      ] }, `${e4.source_id ?? "unknown"}:${e4.code}:${t2}`))
    })
  ] });
}
function wt({ receipt: e3, side: t2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    className: "detail-view",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
          className: "text-label text-content-muted",
          children: [t2, " result"]
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
          className: "text-heading",
          children: "Evaluation receipt"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "text-body",
          children: "This response audit record describes Evolution\u2019s resolved read set. It is not proof of causation and is not a pre-created manifest."
        })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
        className: "detail-list",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Context / selection versions" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
            e3.context_version,
            " / ",
            e3.selection.selection_version
          ] })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Canonical task selection" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
            className: "numeric-exact",
            children: e3.selection.task_ids.join(", ")
          })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Population state" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: e3.population_state })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Logical cutoff" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
            className: "numeric-exact",
            children: e3.as_of
          })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Resolved at" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
            className: "numeric-exact",
            children: e3.resolved_at
          })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Catalog" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
            className: "numeric-exact",
            children: [
              e3.catalog.catalog_id,
              "@",
              e3.catalog.version
            ]
          })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Catalog semantic digest" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
            className: "numeric-exact",
            children: e3.catalog.semantic_digest
          })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "Catalog observation profile" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: e3.catalog.observation_profile })] })
        ]
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(St, { population: e3.task_population }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
        className: "text-heading",
        children: "Evidence bindings"
      }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
        className: "detail-rows",
        children: e3.evidence_bindings.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
            className: "text-code",
            children: e4.route
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Filter: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(yt, { values: e4.canonical_filter })] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Contract revision ", e4.contract_revision] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Observation profile ", e4.observation_profile] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Read model revision ", e4.read_model_revision] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.completion_state }),
          e4.error_state === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.error_state }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
            className: "text-code",
            children: e4.route_snapshot
          })
        ] }, `${e4.route}:${e4.route_snapshot}`))
      })] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
        className: "text-heading",
        children: "Resolved input references"
      }), e3.input_refs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "text-body",
        children: "No input references."
      }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
        className: "detail-rows",
        children: e3.input_refs.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.kind }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
            className: "text-code",
            children: e4.identity
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
            className: "text-code",
            children: e4.provenance_ref
          })
        ] }, `${e4.kind}:${e4.identity}`))
      })] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
        className: "text-heading",
        children: "Workflow resolutions"
      }), e3.workflow_resolutions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "text-body",
        children: "No Workflow resolutions."
      }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
        className: "detail-rows",
        children: e3.workflow_resolutions.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ct, { resolution: e4 }, e4.manifest_digest))
      })] })
    ]
  });
}
var Tt = [
  {
    id: "result",
    label: "Result evidence"
  },
  {
    id: "related",
    label: "Related Facts"
  },
  {
    id: "read-set",
    label: "Resolved read set"
  }
];
var Et = {
  result: "Exact provenance identities cited by this Metric Result; non-Fact detail may remain unresolved.",
  related: "Related Facts match the context but are not claimed as calculation contributors.",
  "read-set": "Every bounded identity recorded by this receipt; this view only hydrates matching Fact rows."
};
function Dt({ rows: e3 }) {
  return e3.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "table-scroll",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      "aria-label": "Receipt identities",
      className: "evidence-table",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("caption", { children: "Receipt identities" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Kind"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Identity"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Provenance"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Detail state"
          })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: e3.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e4.kind }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "text-code",
            children: e4.identity
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
            className: "text-code",
            children: e4.provenance
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e4.loadedAsFact ? "Loaded as Fact row" : "Identity retained; detail not loaded by Facts query" })
        ] }, `${e4.kind}:${e4.identity}:${e4.provenance}`)) })
      ]
    })
  });
}
function Ot({ scope: e3, rows: t2, focusedFactId: n2, onOpenTrace: r2 }) {
  let i2 = Tt.find((t3) => t3.id === e3).label;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "table-scroll",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      className: "evidence-table",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("caption", { children: [i2, " Facts"] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Fact"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Coordinates"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Provenance and lifecycle"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
            scope: "col",
            children: "Recorded Trace"
          })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: t2.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
          "aria-current": n2 === e4.factId ? "true" : void 0,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
              className: "text-code",
              children: e4.factId
            }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e4.factClass })] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: Object.entries(e4.coordinates).map(([e6, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
              className: "text-code",
              children: [
                e6,
                "=",
                t3
              ]
            }, e6)) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
              className: "text-code",
              children: e4.provenance
            }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ce, { truth: e4.truth })] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: e4.trace === void 0 ? "No Trace reference" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [e4.trace.state === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Trace lifecycle not loaded" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ce, { traceState: e4.trace.state }), r2 === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
              className: "text-code",
              children: [e4.trace.traceId, e4.trace.spanId === void 0 ? "" : ` / ${e4.trace.spanId}`]
            }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
              className: "link-control",
              onClick: () => r2(e4.trace.traceId, e4.trace.spanId),
              type: "button",
              children: [
                "Open ",
                e4.trace.traceId,
                e4.trace.spanId === void 0 ? "" : ` / ${e4.trace.spanId}`
              ]
            })] }) })
          ]
        }, e4.factId)) })
      ]
    })
  });
}
function kt({ scope: e3, state: t2, rows: n2, references: r2 = [], focusedFactId: i2, onScopeChange: a2, onOpenTrace: o2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    className: "evidence-console",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
        className: "text-heading",
        children: "Evidence Console"
      }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "text-body",
        children: "Read-only Fact and recorded Trace drill-down."
      })] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
        "aria-label": "Evidence scope",
        className: "scope-tabs",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: Tt.map((t3) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
          "aria-current": e3 === t3.id ? "page" : void 0,
          className: "scope-tab",
          onClick: () => a2?.(t3.id),
          type: "button",
          children: t3.label
        }) }, t3.id)) })
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "scope-note",
        children: Et[e3]
      }),
      t2.tag === "LOADING" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        "aria-live": "polite",
        role: "status",
        children: "Loading Evidence\u2026"
      }) : t2.tag === "ERROR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
        announce: "assertive",
        detail: t2.detail,
        onRetry: t2.onRetry,
        retryable: t2.onRetry !== void 0,
        title: "Evidence query failed"
      }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        t2.tag === "EMPTY" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "empty-state",
          children: "No Evidence in this scope"
        }) : null,
        t2.tag === "PARTIAL" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "status-banner status-attention",
          children: "Partial Evidence data"
        }) : null,
        t2.tag === "EXPIRED" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "status-banner status-expired",
          children: "Evidence detail expired"
        }) : null,
        n2.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ot, {
          focusedFactId: i2,
          onOpenTrace: o2,
          rows: n2,
          scope: e3
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dt, { rows: r2 })
      ] })
    ]
  });
}
var jt = (0, import_react3.memo)(function({ model: e3 }) {
  let t2 = /* @__PURE__ */ new Map();
  for (let n3 of e3.depthGroups) {
    let e4 = n3.nodes.map((e6) => e6.endpointId ?? e6.id), r3 = point().domain(e4).range([80, 880]);
    for (let e6 of n3.nodes) {
      let i2 = e6.endpointId ?? e6.id;
      t2.set(i2, {
        x: r3(i2) ?? 480,
        y: 60 + n3.depth * 120
      });
    }
  }
  let n2 = Math.max(120, e3.depthGroups.length * 120), r2 = (e4, n3) => {
    let r3 = t2.get(e4.sourceId), i2 = t2.get(e4.targetId);
    return r3 === void 0 || i2 === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
      className: `recorded-graph-${n3}`,
      "data-kind": n3 === "parent" ? "PARENT_EDGE" : "LINK",
      x1: r3.x,
      x2: i2.x,
      y1: r3.y,
      y2: i2.y
    }, `${n3}:${e4.id}`);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: "recorded-graph-frame",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
      "aria-label": "Recorded parent structure graph",
      className: "recorded-graph",
      role: "img",
      viewBox: `0 0 960 ${n2}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: "Recorded parent structure graph" }),
        e3.parentEdges.map((e4) => r2(e4, "parent")),
        e3.links.map((e4) => r2(e4, "link")),
        e3.depthGroups.flatMap((e4) => e4.nodes.map((e6) => {
          let n3 = t2.get(e6.endpointId ?? e6.id);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
            transform: `translate(${n3.x} ${n3.y})`,
            children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
              className: "recorded-graph-node",
              r: "10"
            }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
              className: "recorded-graph-label",
              textAnchor: "middle",
              y: "28",
              children: e6.label
            })]
          }, e6.endpointId ?? e6.id);
        }))
      ]
    })
  });
}, Mt);
function Mt(e3, t2) {
  return e3.model.depthGroups === t2.model.depthGroups && e3.model.parentEdges === t2.model.parentEdges && e3.model.links === t2.model.links;
}
var Lt = {
  "zh-CN": {
    identity: "\u7CBE\u786E\u6807\u8BC6",
    startEnd: "\u5F00\u59CB\uFF0F\u7ED3\u675F\u65F6\u95F4",
    duration: "\u8C03\u7528\u8017\u65F6",
    truth: "\u72B6\u6001\uFF0F\u4E8B\u5B9E\u5B8C\u6574\u6027",
    relationships: "\u7236\u8C03\u7528\uFF0F\u5B50\u8C03\u7528",
    flags: "\u6807\u5FD7\uFF0FTrace \u72B6\u6001",
    fields: "\u8BB0\u5F55\u5B57\u6BB5",
    search: "\u641C\u7D22\u8C03\u7528",
    searchPlaceholder: "\u641C\u7D22\u8C03\u7528\u540D\u79F0\u6216\u7CBE\u786E\u6807\u8BC6\u2026",
    expandAll: "\u5C55\u5F00\u5168\u90E8\u8C03\u7528",
    collapseAll: "\u6536\u8D77\u5168\u90E8\u8C03\u7528",
    resetFocus: "\u91CD\u7F6E\u7126\u70B9",
    fitTree: "\u9002\u5E94\u753B\u5E03",
    zoomOut: "\u7F29\u5C0F",
    zoomIn: "\u653E\u5927",
    ancestors: "\u7956\u5148\u8C03\u7528",
    descendants: "\u540E\u4EE3\u8C03\u7528",
    clearLens: "\u6E05\u9664\u9AD8\u4EAE",
    cameraControls: "\u8C03\u7528\u6811\u89C6\u53E3\u64CD\u4F5C",
    spanActions: "\u8C03\u7528\u5C42\u7EA7\u64CD\u4F5C",
    lensNone: "\u9009\u62E9\u7956\u5148\u6216\u540E\u4EE3\u8C03\u7528\uFF0C\u89C2\u5BDF\u5DF2\u8BB0\u5F55\u7684\u7236\u5B50\u5173\u7CFB\u3002",
    lensCount: "\u4E2A\u8C03\u7528 \xB7 \u4EC5\u663E\u793A\u5DF2\u8BB0\u5F55\u7684\u7236\u5B50\u5173\u7CFB",
    minimapTitle: "\u8C03\u7528\u7F29\u7565\u56FE",
    minimapHint: "\u62D6\u52A8\u8C03\u6574\u8303\u56F4",
    depthLabel: "\u6DF1\u5EA6",
    waterfallTitle: "\u8C03\u7528\u65F6\u95F4\u7EBF",
    waterfallCompactTitle: "\u8C03\u7528\u65F6\u95F4\u7EBF \xB7 \u8017\u65F6",
    treeTitle: "\u8C03\u7528\u5173\u7CFB\u6811",
    treeDescription: "\u9009\u62E9\u8C03\u7528\u8282\u70B9\u6216\u5173\u7CFB\uFF0C\u67E5\u770B\u8BE6\u60C5"
  },
  en: {
    identity: "Identity",
    startEnd: "Recorded start / end",
    duration: "Recorded duration",
    truth: "Status / truth",
    relationships: "Parent / children",
    flags: "Flags / trace state",
    fields: "Recorded fields",
    search: "Search recorded spans",
    searchPlaceholder: "Search span name or exact identity",
    expandAll: "Expand all spans",
    collapseAll: "Collapse all spans",
    resetFocus: "Reset focus",
    fitTree: "Fit tree",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    ancestors: "Ancestors",
    descendants: "Descendants",
    clearLens: "Clear lens",
    cameraControls: "Tree camera controls",
    spanActions: "Span tree actions",
    lensNone: "Choose a lens to inspect recorded parent relationships.",
    lensCount: "spans \xB7 recorded parent relationships only",
    minimapTitle: "Trace minimap",
    minimapHint: "Drag to zoom",
    depthLabel: "depth",
    waterfallTitle: "Call timeline",
    waterfallCompactTitle: "Call timeline \xB7 duration",
    treeTitle: "Call tree",
    treeDescription: "Select a call or relationship to inspect its details"
  }
};
function Rt({ label: e3, appearance: t2 = "surface", hideLabel: n2 = false, leading: r2, trailing: a2, size: o2 = "regular", id: s2, ...c2 }) {
  let l2 = (0, import_react3.useId)();
  return t2 === "surface" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "crystra-search-field",
    "data-size": o2,
    "data-disabled": c2.disabled || void 0,
    children: [!n2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
      htmlFor: s2 ?? l2,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
        variant: "label",
        children: e3
      })
    }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "crystra-search-surface",
      onClick: (e4) => {
        e4.target === e4.currentTarget && e4.currentTarget.querySelector("input")?.focus();
      },
      children: [
        r2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "crystra-search-leading",
          children: r2
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
          "aria-label": n2 ? e3 : void 0,
          ...c2,
          id: s2 ?? l2,
          type: "search"
        }),
        a2
      ]
    })]
  }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
    className: "crystra-field",
    "data-size": o2,
    htmlFor: s2 ?? l2,
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
      variant: "label",
      children: e3
    }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
      ...c2,
      id: s2 ?? l2,
      type: "search"
    })]
  });
}
var Gt = (e3, t2) => e3 < t2 ? -1 : +(e3 > t2);
var Kt = 6;
var qt = /* @__PURE__ */ new Set();
function Jt(e3, t2) {
  let n2 = BigInt(t2);
  return n2 <= 0n ? 0 : Number(BigInt(e3) * 10000n / n2) / 100;
}
function J(e3) {
  let t2 = BigInt(e3);
  return t2 >= 1000000000n ? `${Number(t2 / 1000000n) / 1e3} s` : t2 >= 1000000n ? `${Number(t2 / 1000n) / 1e3} ms` : t2 >= 1000n ? `${Number(t2) / 1e3} \u03BCs` : `${e3} ns`;
}
function Xt(e3, t2) {
  return String(BigInt(e3) * BigInt(Math.round(t2 * 100)) / 10000n);
}
function Zt(e3) {
  let t2 = BigInt(e3) / 1000000n;
  return t2 < 86400000n ? J(e3) : new Date(Number(t2)).toISOString().slice(11, 23);
}
function Qt(e3) {
  return e3.length <= 12 ? e3 : `${e3.slice(0, 8)}\u2026${e3.slice(-4)}`;
}
function $t(e3, t2) {
  return e3.nodes.filter((e4) => e4.parentId === t2.id);
}
function en() {
  let e3 = "(max-width: 40rem)", [t2, n2] = (0, import_react3.useState)(() => typeof matchMedia == "function" && matchMedia(e3).matches);
  return (0, import_react3.useEffect)(() => {
    if (typeof matchMedia != "function") return;
    let t3 = matchMedia(e3), r2 = () => n2(t3.matches);
    return r2(), t3.addEventListener("change", r2), () => t3.removeEventListener("change", r2);
  }, []), t2;
}
var tn = 32;
var nn = 48;
var rn = 800;
var an = 384;
var on = 3;
var sn = 6;
var cn = 7;
var ln = 6;
var un = 7;
var dn = 280;
function fn(e3, t2, n2) {
  return n2 - t2 >= sn + e3.length * cn;
}
function pn(e3, t2) {
  let n2 = Math.max(0, t2 - 12), r2 = Math.floor(n2 / un);
  return e3.length <= r2 ? e3 : r2 <= 0 ? "" : r2 === 1 ? "\u2026" : `${e3.slice(0, r2 - 1)}\u2026`;
}
function mn(e3, t2, n2, r2) {
  let i2 = t2 * n2[0] / 100, a2 = t2 * n2[1] / 100, o2 = Number(e3.startOffsetNano), s2 = o2 + Number(e3.durationNano), c2 = Math.max(o2, i2), l2 = Math.min(s2, a2), u2 = l2 > c2 && a2 > i2, d2 = linear2([i2, a2], [0, r2]), f2 = u2 ? d2(c2) : 0;
  return {
    visible: u2,
    width: u2 ? Math.max(1, d2(l2) - f2) : 0,
    x: f2
  };
}
function hn(e3) {
  return e3 > 32 ? 0.5 : e3 > 16 ? 1 : 2;
}
function gn(e3) {
  let t2 = (0, import_react3.useRef)(null), [n2, i2] = (0, import_react3.useState)(e3);
  return (0, import_react3.useEffect)(() => {
    let e4 = t2.current;
    if (e4 === null) return;
    let n3 = () => {
      let t3 = e4.getBoundingClientRect().width;
      t3 > 0 && i2(t3);
    };
    if (n3(), typeof ResizeObserver != "function") return;
    let r2 = new ResizeObserver(n3);
    return r2.observe(e4), () => r2.disconnect();
  }, []), [t2, n2];
}
function _n({ node: e3, locale: t2 = "zh-CN", trace: n2, children: r2 }) {
  let i2 = Lt[t2], a2 = Object.fromEntries(e3.fields.map(({ field: e4, value: t3 }) => [e4, t3])), o2 = n2 === void 0 ? [] : $t(n2, e3), s2 = n2 === void 0 ? [] : n2.links.filter((t3) => t3.from.span_id === e3.id || t3.to.span_id === e3.id);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": "Span passport",
    className: "span-passport",
    "data-testid": "span-passport",
    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
      className: "trace-passport-head",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "trace-passport-title",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          "aria-hidden": "true",
          className: `trace-passport-sigil trace-kind-${e3.kind.toLowerCase()}${e3.status === "ERROR" ? " trace-status-error" : ""}`,
          children: e3.kind === "CLIENT" ? "\u2197" : "\u25C6"
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
          as: "h2",
          variant: "body2",
          weight: "bold",
          className: "trace-passport-name",
          children: e3.label
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: `${e3.kind} \xB7 ${i2.depthLabel} ${e3.depth}` })] })]
      })
    }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "trace-passport-body",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
          className: "trace-passport-grid",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.identity }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
              className: "text-code",
              children: `${e3.endpoint.trace_id} / ${e3.endpoint.span_id}`
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.startEnd }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
              className: "numeric-exact",
              children: `${e3.startTimeUnixNano} \u2192 ${e3.endTimeUnixNano} ns`
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.duration }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
              className: "numeric-exact",
              children: `${J(e3.durationNano)} \xB7 ${e3.durationNano} ns exact`
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.truth }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: `${e3.status} \xB7 ${e3.truth.completeness ?? "UNKNOWN"} \xB7 ${e3.truth.availability}` }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.relationships }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: `${e3.parentId ?? "root"} \u2192 ${o2.map(({ label: e4 }) => e4).join(", ") || "no recorded child"}` }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.flags }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
              className: "text-code",
              children: `${e3.flags} \xB7 ${e3.traceState ?? "none"}`
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: i2.fields }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
              className: "text-code",
              children: JSON.stringify(a2)
            })
          ]
        }),
        s2.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "trace-link-receipt",
          children: `${s2.length} independent recorded LINK${s2.length === 1 ? "" : "s"}. LINK does not change tree depth.`
        }),
        r2
      ]
    })]
  });
}
function vn({ trace: e3 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(q, {
    announce: "polite",
    detail: e3.errors.join(" \xB7 ") || "Recorded Trace IR is invalid.",
    retryable: false,
    title: "Recorded Trace unavailable"
  });
}
function yn({ trace: e3, node: t2 }) {
  let n2 = t2 ? e3.links.filter((e4) => e4.from.span_id === t2.id || e4.to.span_id === t2.id) : e3.links;
  return n2.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
    "aria-label": "Recorded span links",
    className: "trace-link-list trace-sr-only",
    children: n2.map((e4) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
      className: "text-code",
      children: `Recorded LINK \u2192 ${e4.to.trace_id}:${e4.to.span_id}`
    }, e4.id))
  });
}
var bn = (0, import_react3.memo)(function({ node: e3, selected: t2, hasChildren: n2, collapsed: r2, onToggle: i2, onSelect: a2, positionInSet: o2, setSize: s2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "aria-level": e3.depth + 1,
    "aria-posinset": o2,
    "aria-selected": t2,
    "aria-setsize": s2,
    className: `trace-waterfall-row${t2 ? " is-selected" : ""}`,
    "data-testid": "trace-waterfall-row",
    "data-timeline-span-id": e3.id,
    "data-trace-node-id": e3.id,
    "data-virtual-row": o2 - 1,
    onClick: () => a2(e3.id),
    role: "treeitem",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "trace-node-label",
      children: [
        n2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
          "aria-label": `${r2 ? "Expand" : "Collapse"} ${e3.label} descendants`,
          className: "trace-collapse-control",
          "data-testid": "trace-waterfall-collapse",
          "data-trace-node-id": e3.id,
          onClick: (t3) => {
            t3.stopPropagation(), a2(e3.id), i2(e3.id);
          },
          type: "button",
          children: r2 ? "\u25B8" : "\u25BE"
        }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          "aria-hidden": "true",
          className: "trace-collapse-placeholder"
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          "aria-hidden": "true",
          className: "trace-indent-items",
          "data-indent-depth": e3.depth,
          children: Array.from({ length: e3.depth }, (t3, n3) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
            className: "trace-indent-item",
            "data-guide-depth": n3 % Kt,
            "data-guide-owner-id": e3.id,
            "data-testid": "trace-waterfall-indent-guide",
            "data-trace-depth": n3
          }, `${e3.id}:indent:${n3}`))
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
          "aria-label": `${e3.label}, ${e3.durationNano} nanoseconds`,
          className: "recorded-node trace-node-main",
          "data-testid": "trace-waterfall-node",
          "data-trace-node-id": e3.id,
          onClick: (t3) => {
            t3.stopPropagation(), a2(e3.id);
          },
          type: "button",
          children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
            className: "trace-node-title-line",
            children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
              className: `trace-glyph trace-kind-${e3.kind.toLowerCase()}`,
              children: e3.kind === "CLIENT" ? "\u2197" : "\u25C6"
            }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: e3.label })]
          }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: `${e3.kind} \xB7 ${Qt(e3.id)}` })]
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: e3.status === "ERROR" ? "trace-error" : "numeric-exact",
          children: J(e3.durationNano)
        })
      ]
    })
  });
});
function xn({ trace: e3, locale: t2 = "zh-CN", reducedMotion: a2 = false, viewNavigation: l2, showSummary: f2 = true, fillHeight: m = false }) {
  let h = Lt[t2], g = (0, import_react3.useRef)(null), [_, v2] = (0, import_react3.useState)(an);
  (0, import_react3.useEffect)(() => {
    let e4 = g.current;
    if (!m || !e4 || typeof ResizeObserver != "function") return;
    let t3 = () => v2(Math.max(1, e4.clientHeight - tn)), n2 = new ResizeObserver(t3);
    return n2.observe(e4), t3(), () => n2.disconnect();
  }, [m]);
  let [b2, C2] = (0, import_react3.useState)(), [w, T2] = (0, import_react3.useState)(""), [E2, D2] = (0, import_react3.useState)(0), [O, k2] = (0, import_react3.useState)(() => /* @__PURE__ */ new Set()), [A2, j2] = (0, import_react3.useState)([0, 100]), M = (0, import_react3.useRef)([0, 100]), [ee, N2] = (0, import_react3.useState)(() => /* @__PURE__ */ new Map()), P2 = (0, import_react3.useRef)(/* @__PURE__ */ new Map()), F2 = (0, import_react3.useId)().replace(/[^a-zA-Z0-9_-]/g, ""), I2 = (0, import_react3.useRef)(void 0), L2 = en(), [te2, R2] = gn(rn), z2 = (0, import_react3.useCallback)((e4) => C2(e4), []), ne2 = (0, import_react3.useMemo)(() => {
    let t3 = /* @__PURE__ */ new Map(), n2 = /* @__PURE__ */ new Set(), r2 = 0;
    for (let i2 of e3.nodes) t3.set(i2.id, i2), i2.parentId !== void 0 && n2.add(i2.parentId), i2.status === "ERROR" && (r2 += 1);
    return {
      errorCount: r2,
      nodeById: t3,
      nodesWithChildren: n2
    };
  }, [e3.nodes]), re2 = (0, import_react3.useMemo)(() => w.trim().toLocaleLowerCase(), [w]), ie = (0, import_react3.useMemo)(() => re2 === "" ? e3.nodes : e3.nodes.filter((e4) => e4.label.toLocaleLowerCase().includes(re2) || e4.id.toLocaleLowerCase().includes(re2)), [re2, e3.nodes]), B2 = (0, import_react3.useMemo)(() => re2 !== "" || O.size === 0 ? ie : ie.filter((e4) => {
    let t3 = e4.parentId;
    for (; t3 !== void 0; ) {
      if (O.has(t3)) return false;
      t3 = ne2.nodeById.get(t3)?.parentId;
    }
    return true;
  }), [
    O,
    ie,
    re2,
    ne2.nodeById
  ]), ae = (0, import_react3.useMemo)(() => e3.durationNano === void 0 ? [] : e3.nodes.map((t3, n2) => {
    let r2 = Jt(t3.startOffsetNano, e3.durationNano), i2 = Math.min(100, r2 + Jt(t3.durationNano, e3.durationNano)), a3 = n2 + 0.5;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
      className: `trace-minimap-span trace-kind-${t3.kind.toLowerCase()}${t3.status === "ERROR" ? " trace-status-error" : ""}`,
      "data-color-index": t3.depth % Kt,
      "data-minimap-row": n2,
      "data-testid": "trace-waterfall-minimap-span",
      "data-trace-node-id": t3.id,
      strokeWidth: hn(e3.nodes.length),
      x1: r2,
      x2: i2,
      y1: a3,
      y2: a3
    }, t3.id);
  }), [e3.durationNano, e3.nodes]);
  if ((0, import_react3.useEffect)(() => () => {
    for (let e4 of P2.current.values()) window.clearTimeout(e4);
  }, []), e3.status !== "READY" || e3.durationNano === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(vn, { trace: e3 });
  let oe = ne2.nodeById.get(b2 ?? "") ?? e3.nodes[0], { errorCount: se2, nodesWithChildren: V2 } = ne2, H2 = (t3, n2) => {
    let r2 = M.current;
    if (n2 && t3[0] !== r2[0] && !a2) {
      let n3 = t3[0] < r2[0] ? "right" : "left", i2 = [];
      e3.nodes.forEach((a3, o2) => {
        let s2 = mn(a3, Number(e3.durationNano), r2, R2), c2 = mn(a3, Number(e3.durationNano), t3, R2);
        if (s2.visible === c2.visible) return;
        let l3 = c2.visible ? "enter" : "exit", u2 = l3 === "enter" ? c2 : s2;
        i2.push([a3.id, {
          direction: n3,
          phase: l3,
          width: u2.width,
          x: u2.x
        }]);
        let d2 = P2.current.get(a3.id);
        d2 !== void 0 && window.clearTimeout(d2);
        let f3 = window.setTimeout(() => {
          P2.current.delete(a3.id), N2((e4) => {
            if (!e4.has(a3.id)) return e4;
            let t4 = new Map(e4);
            return t4.delete(a3.id), t4;
          });
        }, dn + o2 * 18 + 80);
        P2.current.set(a3.id, f3);
      }), i2.length > 0 && N2((e4) => {
        let t4 = new Map(e4);
        for (let [e6, n4] of i2) t4.set(e6, n4);
        return t4;
      });
    }
    M.current = t3, j2(t3);
  }, ce2 = (e4, t3) => {
    let n2 = I2.current;
    if (n2 === void 0) return;
    let r2 = e4.currentTarget.getBoundingClientRect(), i2 = Math.max(0, Math.min(100, (e4.clientX - r2.left) / r2.width * 100));
    if (n2.mode === "move") {
      let e6 = n2.zoomStart[1] - n2.zoomStart[0], t4 = Math.max(0, Math.min(100 - e6, n2.zoomStart[0] + i2 - n2.pointerStart));
      H2([t4, t4 + e6], true);
    } else if (n2.mode === "resize-left") H2([Math.min(i2, n2.zoomStart[1] - 1), n2.zoomStart[1]], false);
    else if (n2.mode === "resize-right") H2([n2.zoomStart[0], Math.max(i2, n2.zoomStart[0] + 1)], false);
    else if (n2.mode === "select") {
      let e6 = [Math.min(n2.anchor, i2), Math.max(n2.anchor, i2)];
      e6[1] - e6[0] >= 1 && H2(e6, false);
    }
    t3 && (I2.current = void 0);
  }, le2 = [
    0,
    25,
    50,
    75,
    100
  ], ue2 = Number(e3.durationNano), de2 = ue2 * A2[0] / 100, fe2 = ue2 * A2[1] / 100, U2 = linear2([de2, fe2], [0, R2]), pe2 = U2.ticks(Math.max(2, Math.floor(R2 / 96))), W2 = B2.length * nn, G2 = m ? _ : Math.min(an, W2), me2 = Math.min(E2, Math.max(0, W2 - G2)), K2 = Math.max(0, Math.floor(me2 / nn) - on), he2 = Math.min(B2.length, Math.ceil((me2 + G2) / nn) + on), ge2 = B2.slice(K2, he2).map((e4, t3) => ({
    node: e4,
    row: K2 + t3
  })), _e2 = tn + G2, ve2 = ge2.map(({ node: e4, row: t3 }) => {
    let n2 = mn(e4, ue2, A2, R2), r2 = ee.get(e4.id), i2 = !n2.visible && r2?.phase === "exit" ? r2 : n2;
    return {
      ...n2,
      displayedWidth: i2.width,
      displayedX: i2.x,
      label: pn(e4.label, i2.width),
      motion: r2,
      node: e4,
      row: t3,
      y: tn + t3 * nn - me2
    };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": "Recorded trace waterfall",
    className: "trace-view trace-waterfall",
    "data-motion": a2 ? "off" : "zoom-transition",
    "data-testid": "trace-waterfall",
    "data-trace-renderer": "waterfall",
    children: [
      l2,
      f2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
        className: "trace-summary trace-summary-dense trace-view-header",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "trace-summary-identity trace-view-header-copy",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                variant: "overline",
                children: "Exact recorded timeline"
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "strong",
                variant: "h2",
                children: e3.nodes[0]?.label ?? e3.traceId
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                variant: "caption",
                children: e3.traceId
              })
            ]
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            "aria-hidden": "true",
            className: "trace-view-header-spacer"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "trace-summary-metrics trace-view-header-metrics",
            children: [
              [
                "Duration",
                J(e3.durationNano),
                "default"
              ],
              [
                "Start",
                Zt(e3.startTimeUnixNano),
                "default"
              ],
              [
                "Spans",
                String(e3.nodes.length),
                "default"
              ],
              [
                "Errors",
                String(se2),
                se2 > 0 ? "error" : "success"
              ]
            ].map(([e4, t3, n2]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
              className: "trace-summary-stat trace-view-header-stat",
              "data-tone": n2,
              children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "small",
                variant: "caption",
                children: e4
              }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "strong",
                className: "numeric-exact",
                variant: "h2",
                children: t3
              })]
            }, e4))
          })
        ]
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "trace-workbench",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "trace-waterfall-main",
          children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
            "aria-label": "Recorded trace minimap",
            className: "trace-minimap",
            children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
              className: "trace-minimap-copy",
              children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "strong",
                variant: "body2",
                weight: "bold",
                children: h.minimapTitle
              }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "small",
                variant: "caption",
                children: h.minimapHint
              })]
            }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
              "aria-label": "Trace minimap zoom window",
              "aria-valuemax": 100,
              "aria-valuemin": 0,
              "aria-valuetext": `${J(Xt(e3.durationNano, A2[0]))} to ${J(Xt(e3.durationNano, A2[1]))}`,
              className: "trace-minimap-track",
              "data-testid": "trace-waterfall-data-zoom",
              onPointerDown: (e4) => {
                let t3 = e4.currentTarget.getBoundingClientRect(), n2 = Math.max(0, Math.min(100, (e4.clientX - t3.left) / t3.width * 100)), r2 = e4.target instanceof Element && e4.target.closest(".trace-minimap-window") !== null, i2 = (e4.target instanceof Element ? e4.target.closest(".trace-minimap-resize-handle") : null)?.dataset.edge;
                I2.current = i2 === "left" || i2 === "right" ? {
                  mode: `resize-${i2}`,
                  zoomStart: A2
                } : r2 ? {
                  mode: "move",
                  pointerStart: n2,
                  zoomStart: A2
                } : {
                  mode: "select",
                  anchor: n2
                }, r2 || H2([n2, n2], false), e4.currentTarget.setPointerCapture?.(e4.pointerId);
              },
              onKeyDown: (e4) => {
                if (![
                  "ArrowLeft",
                  "ArrowRight",
                  "Home"
                ].includes(e4.key)) return;
                if (e4.preventDefault(), e4.key === "Home") {
                  H2([0, 100], true);
                  return;
                }
                let t3 = e4.key === "ArrowLeft" ? -5 : 5;
                if (e4.shiftKey) H2([A2[0], Math.max(A2[0] + 1, Math.min(100, A2[1] + t3))], true);
                else {
                  let e6 = A2[1] - A2[0], n2 = Math.max(0, Math.min(100 - e6, A2[0] + t3));
                  H2([n2, n2 + e6], true);
                }
              },
              onPointerMove: (e4) => ce2(e4, false),
              onPointerUp: (e4) => ce2(e4, true),
              role: "slider",
              tabIndex: 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  "aria-hidden": "true",
                  className: "trace-minimap-ruler",
                  "data-testid": "trace-waterfall-data-zoom-ruler",
                  children: le2.map((t3) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    "data-time-percent": t3,
                    style: { insetInlineStart: `${t3}%` },
                    children: J(Xt(e3.durationNano, t3))
                  }, t3))
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                  "aria-hidden": "true",
                  className: "trace-minimap-overview",
                  "data-testid": "trace-waterfall-minimap-overview",
                  preserveAspectRatio: "none",
                  viewBox: `0 0 100 ${Math.max(1, e3.nodes.length)}`,
                  children: ae
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                  className: "trace-minimap-window",
                  "data-full": A2[0] === 0 && A2[1] === 100 ? "true" : "false",
                  "data-testid": "trace-waterfall-data-zoom-window",
                  style: {
                    insetInlineStart: `${A2[0]}%`,
                    width: `${A2[1] - A2[0]}%`
                  },
                  children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    "aria-label": "Resize trace zoom start",
                    className: "trace-minimap-resize-handle",
                    "data-edge": "left",
                    "data-testid": "trace-waterfall-data-zoom-handle-left",
                    role: "separator",
                    tabIndex: 0
                  }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    "aria-label": "Resize trace zoom end",
                    className: "trace-minimap-resize-handle",
                    "data-edge": "right",
                    "data-testid": "trace-waterfall-data-zoom-handle-right",
                    role: "separator",
                    tabIndex: 0
                  })]
                })
              ]
            })]
          }), L2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
            className: "trace-waterfall-mobile",
            children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { children: h.waterfallCompactTitle }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
              "aria-label": "Recorded waterfall span outline",
              "data-testid": "trace-waterfall-span-tree",
              role: "tree",
              children: B2.map((t3) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(An, {
                node: t3,
                onSelect: z2,
                trace: e3
              }, t3.id))
            })]
          }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
            className: "trace-waterfall-canvas",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
                className: "trace-waterfall-toolbar",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                    className: "trace-waterfall-heading",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                      as: "h2",
                      variant: "body2",
                      weight: "bold",
                      children: h.waterfallTitle
                    })
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rt, {
                    label: h.search,
                    hideLabel: true,
                    size: "compact",
                    "aria-label": h.search,
                    onChange: (e4) => T2(e4.currentTarget.value),
                    placeholder: h.searchPlaceholder,
                    value: w
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(S, {
                    "aria-label": h.spanActions,
                    className: "trace-waterfall-actions",
                    role: "group",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                        appearance: "ghost",
                        "aria-label": h.expandAll,
                        onClick: () => k2(/* @__PURE__ */ new Set()),
                        type: "button",
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                          "aria-hidden": "true",
                          viewBox: "0 0 16 16",
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 6 8 2l4 4M4 10l4 4 4-4" })
                        })
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                        appearance: "ghost",
                        "aria-label": h.collapseAll,
                        onClick: () => k2(new Set(V2)),
                        type: "button",
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                          "aria-hidden": "true",
                          viewBox: "0 0 16 16",
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 2 4 4 4-4M4 14l4-4 4 4" })
                        })
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                        appearance: "ghost",
                        "aria-label": h.resetFocus,
                        onClick: () => {
                          C2(e3.nodes[0]?.id), N2(/* @__PURE__ */ new Map()), H2([0, 100], false);
                        },
                        type: "button",
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                          "aria-hidden": "true",
                          viewBox: "0 0 16 16",
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 5V2l-2 2A5 5 0 1 0 13 9" })
                        })
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                ref: g,
                className: "trace-waterfall-table",
                children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                  className: "trace-waterfall-label-pane",
                  children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                    className: "trace-waterfall-column-head",
                    children: "Span / exact identity"
                  }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                    className: "trace-waterfall-scroll-viewport",
                    "data-testid": "trace-waterfall-scroll-viewport",
                    "data-total-rows": B2.length,
                    "data-virtual-end": he2,
                    "data-virtual-start": K2,
                    onScroll: (e4) => D2(e4.currentTarget.scrollTop),
                    style: { height: G2 },
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                      className: "trace-waterfall-scroll-space",
                      style: { height: W2 },
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                        "aria-label": "Recorded waterfall span outline",
                        className: "trace-waterfall-label-rows",
                        "data-testid": "trace-waterfall-span-tree",
                        role: "tree",
                        style: { transform: `translateY(${K2 * nn}px)` },
                        children: ge2.map(({ node: e4, row: t3 }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(bn, {
                          collapsed: O.has(e4.id),
                          hasChildren: V2.has(e4.id),
                          node: e4,
                          onSelect: z2,
                          onToggle: (e6) => k2((t4) => {
                            let n2 = new Set(t4);
                            return n2.has(e6) ? n2.delete(e6) : n2.add(e6), n2;
                          }),
                          positionInSet: t3 + 1,
                          selected: oe.id === e4.id,
                          setSize: B2.length
                        }, e4.id))
                      })
                    })
                  })]
                }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
                  "aria-label": "Recorded waterfall timeline chart",
                  className: "trace-waterfall-chart",
                  "data-total-rows": B2.length,
                  "data-testid": "trace-waterfall-chart",
                  "data-virtual-end": he2,
                  "data-virtual-start": K2,
                  height: _e2,
                  ref: te2,
                  role: "img",
                  width: "100%",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: ve2.map(({ displayedWidth: e4, displayedX: t3, node: n2, row: r2, y: i2 }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("clipPath", {
                      id: `${F2}-timeline-label-${r2}`,
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
                        height: 18,
                        rx: 4,
                        width: e4,
                        x: t3,
                        y: i2 + 15
                      })
                    }, `${n2.id}:label-clip`)) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
                      className: "trace-waterfall-axis-line",
                      x1: 0,
                      x2: R2,
                      y1: 31,
                      y2: 31
                    }),
                    ve2.map(({ displayedWidth: e4, displayedX: t3, motion: n2, node: r2, row: i2, visible: a3, y: o2 }) => {
                      let s2 = oe.id === r2.id;
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
                        "aria-label": `${r2.label}, ${J(r2.durationNano)}`,
                        "aria-pressed": s2,
                        className: "trace-waterfall-lane",
                        "data-selected": s2,
                        "data-testid": "trace-waterfall-lane",
                        "data-trace-node-id": r2.id,
                        "data-virtual-row": i2,
                        onClick: () => z2(r2.id),
                        onKeyDown: (e6) => {
                          (e6.key === "Enter" || e6.key === " ") && (e6.preventDefault(), z2(r2.id));
                        },
                        role: "button",
                        tabIndex: 0,
                        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
                          className: "trace-waterfall-lane-hit-target",
                          height: nn,
                          width: R2,
                          x: 0,
                          y: o2
                        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
                          className: "trace-waterfall-timeline",
                          "data-motion-direction": n2?.direction,
                          "data-motion-phase": n2?.phase,
                          "data-testid": "trace-waterfall-timeline",
                          "data-trace-node-id": r2.id,
                          "data-visible": a3,
                          style: { animationDelay: `${(i2 - K2) * 18}ms` },
                          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
                            className: `trace-timeline-bar trace-kind-${r2.kind.toLowerCase()}${r2.status === "ERROR" ? " trace-status-error" : ""}`,
                            "data-color-index": r2.depth % Kt,
                            "data-testid": "trace-waterfall-bar",
                            "data-trace-node-id": r2.id,
                            height: 18,
                            rx: 4,
                            width: e4,
                            x: t3,
                            y: o2 + 15,
                            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: r2.label })
                          })
                        })]
                      }, r2.id);
                    }),
                    pe2.map((e4, t3) => {
                      let n2 = U2(e4), r2 = J(String(Math.round(e4))), i2 = pe2[t3 + 1], a3 = fn(r2, n2, i2 === void 0 ? R2 : U2(i2));
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
                        className: "trace-waterfall-axis-tick",
                        "data-testid": "trace-waterfall-axis-tick",
                        transform: `translate(${n2} 0)`,
                        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
                          className: "trace-waterfall-gridline",
                          y1: 0,
                          y2: _e2
                        }), a3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
                          textAnchor: "start",
                          x: sn,
                          y: 22,
                          children: r2
                        }) : null]
                      }, e4);
                    }),
                    ve2.map(({ displayedWidth: e4, displayedX: t3, label: n2, motion: r2, node: i2, row: a3, y: o2 }) => e4 <= 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
                      clipPath: `url(#${F2}-timeline-label-${a3})`,
                      className: "trace-timeline-label",
                      "data-motion-direction": r2?.direction,
                      "data-motion-phase": r2?.phase,
                      "data-testid": "trace-waterfall-label",
                      "data-trace-node-id": i2.id,
                      dominantBaseline: "middle",
                      style: { animationDelay: `${(a3 - K2) * 18}ms` },
                      x: t3 + ln,
                      y: o2 + nn / 2,
                      children: n2
                    }, `${i2.id}:label`))
                  ]
                })]
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(yn, { trace: e3 })
            ]
          })]
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_n, {
          locale: t2,
          node: oe,
          trace: e3
        })]
      })
    ]
  });
}
function Sn(e3) {
  let t2 = new Map(e3.nodes.map((e4) => [e4.id, e4])), n2 = /* @__PURE__ */ new Map(), r2 = (e4, i3 = /* @__PURE__ */ new Set()) => {
    let a2 = n2.get(e4.id);
    if (a2 !== void 0) return a2;
    if (e4.parentId === void 0 || i3.has(e4.id)) return 0;
    let o2 = t2.get(e4.parentId);
    if (o2 === void 0) return 0;
    let s2 = new Set(i3).add(e4.id), c2 = r2(o2, s2) + 1;
    return n2.set(e4.id, c2), c2;
  }, i2 = /* @__PURE__ */ new Map();
  for (let t3 of e3.nodes) {
    let e4 = r2(t3), n3 = i2.get(e4) ?? [];
    n3.push(t3), i2.set(e4, n3);
  }
  return [...i2.entries()].flatMap(([e4, t3]) => [...t3].sort((e6, t4) => Gt(e6.startTimeUnixNano, t4.startTimeUnixNano) || Gt(e6.id, t4.id)).map((n3, r3) => ({
    node: n3,
    column: e4,
    x: 60 + e4 * 330,
    y: t3.length === 1 ? 240 : t3.length === 2 ? 110 + r3 * 245 : 47 + r3 * (368 / (t3.length - 1))
  })));
}
var Y2 = 980;
var X2 = 560;
var Z = 190;
var Q = 70;
var Cn = {
  x: 0,
  y: 0,
  width: Y2,
  height: X2
};
function wn(e3) {
  let t2 = Math.min(Y2, Math.max(392, e3.width)), n2 = Math.min(X2, Math.max(224, e3.height));
  return {
    x: Math.round(Math.max(0, Math.min(Y2 - t2, e3.x)) * 1e3) / 1e3,
    y: Math.round(Math.max(0, Math.min(X2 - n2, e3.y)) * 1e3) / 1e3,
    width: Math.round(t2 * 1e3) / 1e3,
    height: Math.round(n2 * 1e3) / 1e3
  };
}
function Tn(e3, t2) {
  let n2 = e3.width * t2, r2 = e3.height * t2;
  return wn({
    x: e3.x + (e3.width - n2) / 2,
    y: e3.y + (e3.height - r2) / 2,
    width: n2,
    height: r2
  });
}
function En(e3) {
  return `${e3.x} ${e3.y} ${e3.width} ${e3.height}`;
}
function Dn(e3, t2, n2) {
  let r2 = Math.min(e3 / n2.width, t2 / n2.height);
  return {
    scale: r2,
    offsetX: (e3 - n2.width * r2) / 2,
    offsetY: (t2 - n2.height * r2) / 2
  };
}
function On(e3, t2, n2, r2) {
  let i2 = e3.x + Z, a2 = e3.y + Q / 2, o2 = t2?.x ?? 950, s2 = t2 === void 0 ? Math.min(520, a2 + 80) : t2.y + Q / 2;
  return {
    startX: i2,
    startY: a2,
    middleX: (i2 + o2) / 2,
    endX: o2,
    endY: s2,
    kind: n2,
    focused: r2
  };
}
function kn(e3, t2) {
  let n2 = Math.abs(e3.middleX - e3.startX), r2 = Math.abs(e3.endY - e3.startY), i2 = Math.abs(e3.endX - e3.middleX), a2 = t2 * (n2 + r2 + i2), o2 = (e4, t3, n3) => e4 + (t3 - e4) * n3;
  return a2 <= n2 ? {
    x: o2(e3.startX, e3.middleX, n2 === 0 ? 1 : a2 / n2),
    y: e3.startY
  } : (a2 -= n2, a2 <= r2 ? {
    x: e3.middleX,
    y: o2(e3.startY, e3.endY, r2 === 0 ? 1 : a2 / r2)
  } : (a2 -= r2, {
    x: o2(e3.middleX, e3.endX, i2 === 0 ? 1 : a2 / i2),
    y: e3.endY
  }));
}
function $(e3, t2, n2) {
  let r2 = getComputedStyle(e3).getPropertyValue(t2).trim();
  return r2 === "" ? n2 : r2;
}
var An = (0, import_react3.memo)(function({ node: e3, trace: t2, onSelect: n2, layout: r2, showLinks: i2 = true, compact: a2 = false }) {
  let o2 = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
    "aria-label": `${e3.label}, ${J(e3.durationNano)}`,
    "aria-level": (r2?.column ?? e3.depth) + 1,
    "data-tree-x": r2?.x,
    "data-tree-y": r2?.y,
    "data-testid": "trace-tree-node",
    "data-trace-node-id": e3.id,
    onClick: () => n2(e3.id),
    role: "treeitem",
    type: "button",
    children: a2 ? e3.label : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: e3.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: J(e3.durationNano) })] })
  });
  return a2 ? o2 : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    style: { paddingInlineStart: `${e3.depth * 1.5}rem` },
    children: [o2, i2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(yn, {
      node: e3,
      trace: t2
    }) : null]
  });
});
var jn = (0, import_react3.memo)(function({ trace: e3, locale: t2 = "zh-CN", reducedMotion: i2 = false, viewNavigation: a2, showSummary: l2 = true }) {
  let f2 = Lt[t2], [p, m] = (0, import_react3.useState)(), [h, g] = (0, import_react3.useState)("none"), [_, v2] = (0, import_react3.useState)(Cn), b2 = (0, import_react3.useRef)(null), C2 = (0, import_react3.useRef)(null), w = (0, import_react3.useRef)(false), T2 = (0, import_react3.useCallback)((e4) => m(e4), []), E2 = en(), D2 = (0, import_react3.useMemo)(() => e3.status === "READY" ? Sn(e3) : [], [e3]), O = (0, import_react3.useMemo)(() => new Map(D2.map((e4) => [e4.node.id, e4])), [D2]), k2 = (0, import_react3.useMemo)(() => new Map(e3.nodes.map((e4) => [e4.id, e4])), [e3.nodes]), A2 = (0, import_react3.useMemo)(() => {
    let t3 = /* @__PURE__ */ new Map();
    for (let n2 of e3.nodes) {
      if (n2.parentId === void 0) continue;
      let e4 = t3.get(n2.parentId);
      e4 === void 0 ? t3.set(n2.parentId, [n2]) : e4.push(n2);
    }
    return t3;
  }, [e3.nodes]), j2 = k2.get(p ?? "") ?? e3.nodes[0], M = (0, import_react3.useRef)(j2?.id);
  (0, import_react3.useEffect)(() => {
    M.current = j2?.id;
  }, [j2?.id]);
  let ee = i2 ? j2?.id : void 0, N2 = (0, import_react3.useMemo)(() => {
    if (j2 === void 0) return /* @__PURE__ */ new Set();
    if (h === "none") return qt;
    let e4 = /* @__PURE__ */ new Set([j2.id]);
    if (h === "ancestors") {
      let t3 = j2;
      for (; t3.parentId !== void 0; ) {
        e4.add(t3.parentId);
        let n2 = k2.get(t3.parentId);
        if (n2 === void 0) break;
        t3 = n2;
      }
    }
    if (h === "descendants") {
      let t3 = [j2.id];
      for (; t3.length > 0; ) {
        let n2 = t3.shift();
        for (let r2 of A2.get(n2) ?? []) e4.add(r2.id), t3.push(r2.id);
      }
    }
    return e4;
  }, [
    A2,
    h,
    k2,
    j2
  ]), P2 = (0, import_react3.useMemo)(() => D2.flatMap((e4) => {
    if (e4.node.parentId === void 0) return [];
    let t3 = O.get(e4.node.parentId);
    return t3 === void 0 ? [] : [On(t3, e4, "parent", h === "none" || N2.has(t3.node.id) && N2.has(e4.node.id))];
  }), [
    O,
    D2,
    h,
    N2
  ]), F2 = (0, import_react3.useMemo)(() => e3.links.flatMap((e4) => {
    let t3 = O.get(e4.from.span_id);
    return t3 === void 0 ? [] : [On(t3, O.get(e4.to.span_id), "link", h === "none")];
  }), [
    O,
    h,
    e3.links
  ]), I2 = (0, import_react3.useMemo)(() => [...P2, ...F2], [F2, P2]), L2 = P2.length > 128, te2 = (0, import_react3.useMemo)(() => {
    let e4 = I2.filter((e6) => e6.focused);
    return L2 ? e4.slice(0, 8) : e4;
  }, [L2, I2]);
  if ((0, import_react3.useEffect)(() => {
    let t3 = b2.current;
    if (t3 === null || window.CanvasRenderingContext2D === void 0) return;
    let n2 = t3.getContext("2d");
    if (n2 === null) return;
    let r2 = "", a3 = "", o2 = "", s2 = "", c2 = "", l3 = "", u2 = "", d2 = "", f3 = "", p2 = "", m2 = () => {
      r2 = $(t3, "--surface-raised", "#17212d"), a3 = $(t3, "--border-strong", "#607084"), o2 = $(t3, "--content-primary", "#f1f5f9"), s2 = $(t3, "--content-secondary", "#a9b4c2"), c2 = $(t3, "--data-series-1", "#38bdf8"), l3 = $(t3, "--data-series-2", "#2dd4bf"), u2 = $(t3, "--status-error", "#fb7185"), d2 = $(t3, "--interaction-accent", "#38bdf8"), f3 = $(t3, "--border-strong", "#607084"), p2 = $(t3, "--status-warning", "#fbbf24");
    };
    m2();
    let g2 = e3.durationNano ?? "0", v3 = 0, y2, x2, S2 = (e4) => {
      n2.save(), n2.globalAlpha = e4.focused ? 1 : 0.2, n2.strokeStyle = e4.kind === "link" ? p2 : f3, n2.lineWidth = 2, n2.setLineDash(e4.kind === "link" ? [7, 6] : []), n2.beginPath(), n2.moveTo(e4.startX, e4.startY), n2.lineTo(e4.middleX, e4.startY), n2.lineTo(e4.middleX, e4.endY), n2.lineTo(e4.endX, e4.endY), n2.stroke(), n2.setLineDash([]), n2.fillStyle = e4.kind === "link" ? p2 : f3;
      let t4 = e4.endX >= e4.startX ? 1 : -1;
      n2.beginPath(), n2.moveTo(e4.endX, e4.endY), n2.lineTo(e4.endX - t4 * 9, e4.endY - 5), n2.lineTo(e4.endX - t4 * 9, e4.endY + 5), n2.closePath(), n2.fill(), n2.restore();
    }, C3 = (e4) => {
      let m3 = t3.getBoundingClientRect(), y3 = m3.width || Y2, b3 = m3.height || X2, x3 = Math.max(1, window.devicePixelRatio || 1), w2 = Math.round(y3 * x3), T3 = Math.round(b3 * x3);
      (t3.width !== w2 || t3.height !== T3) && (t3.width = w2, t3.height = T3), t3.dataset.pixelRatio = String(x3), t3.dataset.backingSize = `${w2}x${T3}`, n2.resetTransform(), n2.clearRect(0, 0, w2, T3);
      let E3 = Dn(y3, b3, _);
      if (n2.setTransform(E3.scale * x3, 0, 0, E3.scale * x3, (E3.offsetX - _.x * E3.scale) * x3, (E3.offsetY - _.y * E3.scale) * x3), L2) for (let e6 of ["parent", "link"]) {
        let t4 = I2.filter((t5) => t5.kind === e6);
        if (t4.length !== 0) {
          n2.save(), n2.strokeStyle = e6 === "link" ? p2 : f3, n2.lineWidth = 2, n2.setLineDash(e6 === "link" ? [7, 6] : []), n2.beginPath();
          for (let e7 of t4) n2.moveTo(e7.startX, e7.startY), n2.lineTo(e7.middleX, e7.startY), n2.lineTo(e7.middleX, e7.endY), n2.lineTo(e7.endX, e7.endY);
          n2.stroke(), n2.restore();
        }
      }
      else I2.forEach(S2);
      i2 || te2.forEach((t4, r3) => {
        let i3 = kn(t4, ((e4 / 1600 + r3 * 0.17) % 1 + 1) % 1);
        n2.save(), n2.fillStyle = t4.kind === "link" ? p2 : d2, n2.shadowBlur = L2 ? 0 : 10, n2.shadowColor = n2.fillStyle, n2.beginPath(), n2.arc(i3.x, i3.y, 4, 0, Math.PI * 2), n2.fill(), n2.restore();
      }), D2.forEach(({ node: e6, x: t4, y: i3 }) => {
        let f4 = h === "none" || N2.has(e6.id);
        if (n2.save(), n2.globalAlpha = f4 ? 1 : 0.28, n2.fillStyle = r2, n2.strokeStyle = e6.status === "ERROR" ? u2 : M.current === e6.id ? d2 : a3, n2.lineWidth = M.current === e6.id ? 2.5 : 1.2, L2) {
          n2.fillRect(t4, i3, Z, Q), n2.strokeRect(t4, i3, Z, Q), n2.fillStyle = e6.kind === "CLIENT" ? l3 : c2, n2.fillRect(t4, i3, 4, Q), n2.restore();
          return;
        }
        n2.beginPath(), n2.moveTo(t4, i3), n2.lineTo(t4 + Z - 9, i3), n2.quadraticCurveTo(t4 + Z, i3, t4 + Z, i3 + 9), n2.lineTo(t4 + Z, i3 + Q - 9), n2.quadraticCurveTo(t4 + Z, i3 + Q, t4 + Z - 9, i3 + Q), n2.lineTo(t4, i3 + Q), n2.closePath(), n2.fill(), n2.stroke(), n2.save(), n2.clip(), n2.fillStyle = e6.kind === "CLIENT" ? l3 : c2, n2.fillRect(t4, i3, 4, Q), n2.restore(), n2.fillStyle = s2, n2.font = "10px ui-monospace, monospace", n2.fillText(e6.kind, t4 + 14, i3 + 17), n2.textAlign = "right", n2.fillText(e6.status, t4 + 176, i3 + 17), n2.textAlign = "left", n2.fillStyle = o2, n2.font = "650 12px system-ui", n2.fillText(e6.label, t4 + 14, i3 + 37, 160), L2 ? (n2.fillStyle = s2, n2.font = "10px ui-monospace, monospace", n2.textAlign = "right", n2.fillText(J(e6.durationNano), t4 + 176, i3 + 54), n2.textAlign = "left") : (n2.fillStyle = s2, n2.font = "10px ui-monospace, monospace", n2.fillText(`+${J(e6.startOffsetNano)} \xB7 ${Qt(e6.id)}`, t4 + 14, i3 + 53, 120), n2.textAlign = "right", n2.fillText(J(e6.durationNano), t4 + 176, i3 + 53), n2.textAlign = "left", n2.fillStyle = a3, n2.fillRect(t4 + 14, i3 + 61, 160, 3), n2.fillStyle = e6.kind === "CLIENT" ? l3 : c2, n2.fillRect(t4 + 14 + Jt(e6.startOffsetNano, g2) * 1.6, i3 + 61, Math.max(2, Jt(e6.durationNano, g2) * 1.6), 3)), n2.restore();
      }), n2.resetTransform(), i2 || (v3 = window.requestAnimationFrame(C3));
    };
    return C3(performance.now()), i2 && typeof ResizeObserver < "u" && (y2 = new ResizeObserver(() => C3(performance.now())), y2.observe(t3)), typeof MutationObserver < "u" && (x2 = new MutationObserver(() => {
      m2(), i2 && C3(performance.now());
    }), x2.observe(t3.closest(".crystra-bi") ?? t3, {
      attributeFilter: [
        "class",
        "data-theme",
        "style"
      ],
      attributes: true,
      subtree: true
    })), () => {
      window.cancelAnimationFrame(v3), y2?.disconnect(), x2?.disconnect();
    };
  }, [
    _,
    L2,
    I2,
    te2,
    D2,
    h,
    N2,
    i2,
    ee,
    e3.durationNano
  ]), (0, import_react3.useEffect)(() => {
    let e4 = C2.current;
    if (e4 === null || window.CanvasRenderingContext2D === void 0) return;
    let t3 = e4.getContext("2d");
    if (t3 === null) return;
    let n2 = "", r2 = "", i3 = "", a3 = "", o2 = "", s2 = () => {
      n2 = $(e4, "--data-series-1", "#38bdf8"), r2 = $(e4, "--data-series-2", "#2dd4bf"), i3 = $(e4, "--status-error", "#fb7185"), a3 = $(e4, "--border-strong", "#607084"), o2 = $(e4, "--status-warning", "#fbbf24");
    };
    s2();
    let c2 = () => {
      let s3 = e4.getBoundingClientRect(), c3 = s3.width || 140, l4 = s3.height || 80, u3 = Math.max(1, window.devicePixelRatio || 1), d2 = Math.round(c3 * u3), f3 = Math.round(l4 * u3);
      (e4.width !== d2 || e4.height !== f3) && (e4.width = d2, e4.height = f3), t3.resetTransform(), t3.clearRect(0, 0, d2, f3), t3.setTransform(d2 / Y2, 0, 0, f3 / X2, 0, 0), t3.lineWidth = 5, I2.forEach((e6) => {
        t3.strokeStyle = e6.kind === "link" ? o2 : a3, t3.setLineDash(e6.kind === "link" ? [14, 12] : []), t3.beginPath(), t3.moveTo(e6.startX, e6.startY), t3.lineTo(e6.middleX, e6.startY), t3.lineTo(e6.middleX, e6.endY), t3.lineTo(e6.endX, e6.endY), t3.stroke();
      }), t3.setLineDash([]), D2.forEach(({ node: e6, x: a4, y: o3 }) => {
        t3.fillStyle = e6.status === "ERROR" ? i3 : e6.kind === "CLIENT" ? r2 : n2, t3.fillRect(a4, o3, Z, Q);
      }), t3.resetTransform();
    };
    c2();
    let l3 = typeof ResizeObserver > "u" ? void 0 : new ResizeObserver(c2);
    l3?.observe(e4);
    let u2 = typeof MutationObserver > "u" ? void 0 : new MutationObserver(() => {
      s2(), c2();
    });
    return u2?.observe(e4.closest(".crystra-bi") ?? e4, {
      attributeFilter: [
        "class",
        "data-theme",
        "style"
      ],
      attributes: true,
      subtree: true
    }), () => {
      l3?.disconnect(), u2?.disconnect();
    };
  }, [I2, D2]), e3.status !== "READY" || j2 === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(vn, { trace: e3 });
  let R2 = h === "none" ? f2.lensNone : `${h === "ancestors" ? f2.ancestors : f2.descendants} \xB7 ${N2.size} ${f2.lensCount}`, z2 = (e4) => {
    let t3 = e4.currentTarget.getBoundingClientRect();
    if (t3.width <= 0 || t3.height <= 0) return;
    let n2 = (e4.clientX - t3.left) / t3.width * Y2, r2 = (e4.clientY - t3.top) / t3.height * X2;
    v2((e6) => wn({
      ...e6,
      x: n2 - e6.width / 2,
      y: r2 - e6.height / 2
    }));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
    "aria-label": "Recorded trace tree",
    className: "trace-view trace-tree-graph",
    "data-lens": h,
    "data-motion": i2 ? "off" : "edge-flow",
    "data-testid": "trace-tree",
    "data-trace-renderer": "tree",
    children: [
      l2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
        className: "trace-summary trace-summary-dense trace-tree-context trace-view-header",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "trace-summary-identity trace-view-header-copy",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                variant: "overline",
                children: "Exact recorded call graph"
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "strong",
                variant: "h2",
                children: e3.nodes[0]?.label ?? e3.traceId
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                variant: "caption",
                children: e3.traceId
              })
            ]
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            "aria-hidden": "true",
            className: "trace-view-header-spacer"
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "trace-summary-metrics trace-view-header-metrics",
            children: [
              ["Exact spans", e3.nodes.length],
              ["PARENT_EDGE", e3.parentEdges.length],
              ["LINK", e3.links.length]
            ].map(([e4, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
              className: "trace-summary-stat trace-view-header-stat",
              children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "small",
                variant: "caption",
                children: e4
              }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "strong",
                className: "numeric-exact",
                variant: "h2",
                children: t3
              })]
            }, e4))
          })
        ]
      }),
      a2,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "trace-workbench",
        children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
          className: "trace-tree-canvas-shell",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
              className: "trace-tree-canvas-head",
              children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "h2",
                variant: "subtitle1",
                children: f2.treeTitle
              }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                as: "p",
                variant: "caption",
                children: f2.treeDescription
              })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(S, {
                "aria-label": f2.cameraControls,
                className: "trace-tree-actions",
                role: "group",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                    appearance: "ghost",
                    "aria-label": f2.fitTree,
                    onClick: () => v2(Cn),
                    type: "button",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                      "aria-hidden": "true",
                      viewBox: "0 0 16 16",
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" })
                    })
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                    appearance: "ghost",
                    "aria-label": f2.zoomOut,
                    disabled: _.width === Y2,
                    onClick: () => v2((e4) => Tn(e4, 1.25)),
                    type: "button",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                      "aria-hidden": "true",
                      viewBox: "0 0 16 16",
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 8h10" })
                    })
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(x, {
                    appearance: "ghost",
                    "aria-label": f2.zoomIn,
                    disabled: _.width <= 392,
                    onClick: () => v2((e4) => Tn(e4, 0.8)),
                    type: "button",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
                      "aria-hidden": "true",
                      viewBox: "0 0 16 16",
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 8h10M8 3v10" })
                    })
                  })
                ]
              })]
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
              "aria-label": "Trace tree legend",
              className: "trace-tree-legend",
              children: [
                ["internal", "INTERNAL"],
                ["client", "CLIENT"],
                ["error", "ERROR"],
                ["parent", "PARENT_EDGE"],
                ["link", "LINK"],
                ["flow", "Request flow"]
              ].map(([e4, t3]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
                "aria-hidden": "true",
                "data-legend-kind": e4
              }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t3 })] }, e4))
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
              className: "trace-tree-canvas",
              "data-narrow": E2,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
                  "aria-label": "Recorded span call tree graph",
                  className: "trace-tree-canvas-surface",
                  "data-camera-view": En(_),
                  "data-edge-flow-count": i2 ? 0 : te2.length,
                  "data-edge-routing": "orthogonal",
                  "data-geometry-detail": L2 ? "batched" : "complete",
                  "data-link-count": F2.length,
                  "data-layout": "call-graph",
                  "data-node-shape": "flat-left-rounded-right",
                  "data-parent-edge-count": P2.length,
                  "data-resolution-mode": "device-pixel-ratio",
                  "data-render-detail": L2 ? "summary" : "complete",
                  "data-testid": "trace-tree-canvas",
                  height: X2,
                  onPointerDown: (e4) => {
                    let t3 = e4.currentTarget.getBoundingClientRect();
                    if (t3.width <= 0 || t3.height <= 0) return;
                    let n2 = Dn(t3.width, t3.height, _), r2 = _.x + (e4.clientX - t3.left - n2.offsetX) / n2.scale, i3 = _.y + (e4.clientY - t3.top - n2.offsetY) / n2.scale, a3 = [...D2].reverse().find((e6) => r2 >= e6.x && r2 <= e6.x + Z && i3 >= e6.y && i3 <= e6.y + Q);
                    a3 !== void 0 && T2(a3.node.id);
                  },
                  onWheel: (e4) => {
                    e4.preventDefault(), v2((t3) => Tn(t3, e4.deltaY > 0 ? 1.25 : 0.8));
                  },
                  ref: b2,
                  role: "img",
                  width: Y2
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  "aria-label": "Recorded trace call tree",
                  className: "trace-tree-outline",
                  "data-detail": E2 ? "rows" : "compact",
                  role: "tree",
                  children: e3.nodes.map((t3) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(An, {
                    compact: !E2,
                    layout: O.get(t3.id),
                    node: t3,
                    onSelect: T2,
                    showLinks: false,
                    trace: e3
                  }, t3.id))
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
                  "aria-label": "Tree minimap navigation",
                  className: "trace-camera-map",
                  onPointerCancel: () => {
                    w.current = false;
                  },
                  onPointerDown: (e4) => {
                    w.current = true, e4.currentTarget.setPointerCapture?.(e4.pointerId), z2(e4);
                  },
                  onPointerMove: (e4) => {
                    w.current && z2(e4);
                  },
                  onPointerUp: (e4) => {
                    w.current && z2(e4), w.current = false, e4.currentTarget.releasePointerCapture?.(e4.pointerId);
                  },
                  role: "region",
                  children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(y, {
                    as: "strong",
                    variant: "caption",
                    children: "Tree minimap"
                  }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                    className: "trace-camera-map-viewport",
                    children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
                      "aria-hidden": "true",
                      height: 80,
                      ref: C2,
                      width: 140
                    }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      "aria-hidden": "true",
                      "data-camera-width": _.width,
                      "data-testid": "trace-tree-minimap-viewport",
                      style: {
                        height: `${_.height / X2 * 100}%`,
                        insetInlineStart: `${_.x / Y2 * 100}%`,
                        insetBlockStart: `${_.y / X2 * 100}%`,
                        width: `${_.width / Y2 * 100}%`
                      }
                    })]
                  })]
                })
              ]
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(yn, { trace: e3 })
          ]
        }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(_n, {
          locale: t2,
          node: j2,
          trace: e3,
          children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "trace-focus-receipt",
            children: R2
          }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "trace-passport-actions",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
                onClick: () => g("ancestors"),
                type: "button",
                children: f2.ancestors
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
                onClick: () => g("descendants"),
                type: "button",
                children: f2.descendants
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
                onClick: () => g("none"),
                type: "button",
                children: f2.clearLens
              })
            ]
          })]
        })]
      })
    ]
  });
});
function Rn(e3) {
  return Object.freeze({
    ...e3.surface === void 0 ? {} : { surface: Object.freeze({ ...e3.surface }) },
    ...e3.content === void 0 ? {} : { content: Object.freeze({ ...e3.content }) },
    ...e3.border === void 0 ? {} : { border: Object.freeze({ ...e3.border }) },
    ...e3.interaction === void 0 ? {} : { interaction: Object.freeze({ ...e3.interaction }) },
    ...e3.status === void 0 ? {} : { status: Object.freeze({ ...e3.status }) },
    ...e3.data === void 0 ? {} : { data: Object.freeze([...e3.data]) }
  });
}
function zn({ mode: e3, density: t2 = "comfortable", containerBorderStyle: n2 = "solid", palette: r2, typography: i2 }) {
  return Object.freeze({
    mode: e3,
    density: t2,
    containerBorderStyle: n2,
    ...r2 === void 0 ? {} : { palette: Rn(r2) },
    ...i2 === void 0 ? {} : { typography: Object.freeze({ ...i2 }) }
  });
}
var Gn = ({ trace_id: e3, span_id: t2 }) => `${e3}:${t2}`;
var Kn = (e3, t2) => e3 < t2 ? -1 : +(e3 > t2);
function qn(e3) {
  return {
    schemaVersion: "crystra.trace-view@1",
    status: "INVALID",
    nodes: [],
    parentEdges: [],
    links: [],
    errors: [...new Set(e3)].sort(Kn)
  };
}
function Jn(e3) {
  let t2 = [], n2 = /* @__PURE__ */ new Map(), r2 = /* @__PURE__ */ new Map(), i2 = [], a2 = [], o2 = /* @__PURE__ */ new Set();
  for (let s3 of e3) {
    if (s3.kind === "NODE") {
      let e4 = Gn({
        trace_id: s3.trace_id,
        span_id: s3.node.span_id
      });
      o2.add(s3.trace_id), n2.has(e4) ? t2.push(`duplicate NODE ${e4}`) : n2.set(e4, s3);
      try {
        BigInt(s3.node.end_time_unix_nano) < BigInt(s3.node.start_time_unix_nano) && t2.push(`negative recorded duration for ${e4}`);
      } catch {
        t2.push(`invalid recorded time for ${e4}`);
      }
      continue;
    }
    if (s3.kind === "PARENT_EDGE") {
      let e4 = Gn(s3.edge.from), n3 = Gn(s3.edge.to), a3 = r2.get(e4);
      a3 !== void 0 && a3 !== n3 ? t2.push(`multiple recorded parents for ${e4}`) : r2.set(e4, n3), i2.push({
        id: s3.id,
        from: { ...s3.edge.from },
        to: { ...s3.edge.to },
        truth: { ...s3.truth },
        recordedAt: s3.recorded_at,
        source: { ...s3.source }
      });
      continue;
    }
    a2.push({
      id: s3.id,
      from: { ...s3.edge.from },
      to: { ...s3.edge.to },
      flags: s3.edge.flags,
      traceState: s3.edge.trace_state,
      truth: { ...s3.truth },
      recordedAt: s3.recorded_at,
      source: { ...s3.source }
    });
  }
  o2.size > 1 && t2.push("multiple NODE trace identities");
  let s2 = /* @__PURE__ */ new Map(), c2 = /* @__PURE__ */ new Set(), l2 = (e4) => {
    let i3 = s2.get(e4);
    if (i3 !== void 0) return i3;
    if (c2.has(e4)) {
      t2.push(`recorded parent cycle at ${e4}`);
      return;
    }
    let a3 = r2.get(e4);
    if (a3 === void 0) return s2.set(e4, 0), 0;
    if (!n2.has(a3)) {
      t2.push(`missing recorded parent ${a3} for ${e4}`);
      return;
    }
    c2.add(e4);
    let o3 = l2(a3);
    if (c2.delete(e4), o3 !== void 0) return s2.set(e4, o3 + 1), o3 + 1;
  };
  for (let e4 of [...n2.keys()].sort(Kn)) l2(e4);
  if (t2.length > 0) return qn(t2);
  let u2 = [...n2.values()].sort((e4, t3) => {
    let n3 = BigInt(e4.node.start_time_unix_nano) - BigInt(t3.node.start_time_unix_nano);
    return n3 === 0n ? Kn(e4.recorded_at, t3.recorded_at) || Kn(e4.id, t3.id) : n3 < 0n ? -1 : 1;
  });
  if (u2.length === 0) return qn(["recorded trace has no NODE"]);
  let d2 = u2.reduce((e4, t3) => BigInt(t3.node.start_time_unix_nano) < e4 ? BigInt(t3.node.start_time_unix_nano) : e4, BigInt(u2[0].node.start_time_unix_nano)), f2 = u2.reduce((e4, t3) => BigInt(t3.node.end_time_unix_nano) > e4 ? BigInt(t3.node.end_time_unix_nano) : e4, BigInt(u2[0].node.end_time_unix_nano));
  return {
    schemaVersion: "crystra.trace-view@1",
    status: "READY",
    traceId: [...o2][0],
    startTimeUnixNano: d2.toString(),
    endTimeUnixNano: f2.toString(),
    durationNano: (f2 - d2).toString(),
    nodes: u2.map((e4) => {
      let t3 = {
        trace_id: e4.trace_id,
        span_id: e4.node.span_id
      }, i3 = r2.get(Gn(t3));
      return {
        id: e4.node.span_id,
        endpoint: t3,
        label: e4.node.span_name,
        kind: e4.node.span_kind,
        status: e4.node.span_status,
        startTimeUnixNano: e4.node.start_time_unix_nano,
        endTimeUnixNano: e4.node.end_time_unix_nano,
        durationNano: (BigInt(e4.node.end_time_unix_nano) - BigInt(e4.node.start_time_unix_nano)).toString(),
        startOffsetNano: (BigInt(e4.node.start_time_unix_nano) - d2).toString(),
        flags: e4.node.span_flags,
        traceState: e4.node.trace_state,
        fields: e4.node.fields.map((e6) => ({ ...e6 })),
        truth: { ...e4.truth },
        depth: s2.get(Gn(t3)),
        ...i3 === void 0 ? {} : { parentId: n2.get(i3).node.span_id },
        evidenceId: e4.id,
        recordedAt: e4.recorded_at,
        source: { ...e4.source }
      };
    }),
    parentEdges: i2.sort((e4, t3) => Kn(e4.id, t3.id)),
    links: a2.sort((e4, t3) => Kn(e4.id, t3.id)),
    errors: []
  };
}
var er = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

// node_modules/crystra-ui-core/dist/styles.css
var styles_default = `/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial}}}.crystra-bi{--card-surface-border:var(--color-border-subtle,#ffffff0f)}.crystra-bi :is(.browser-task-card,[data-section-id][class*=bg-panel][class*=rounded],.crystra-card,.crystra-widget,.crystra-monitoring-widget,.trace-waterfall-canvas,.trace-tree-canvas-shell,.trace-minimap,.span-passport):not([data-host-owned],[data-host-owned] *){border:1px solid var(--card-surface-border);border-radius:var(--shape-panel,12px);box-shadow:var(--card-surface-shadow)}:root.crystra-bi[data-palette],.crystra-bi[data-crystra-theme=dark]{--card-surface-border:var(--color-border-subtle,#ffffff0f)}:is(:root.crystra-bi[data-palette],.crystra-bi[data-crystra-theme=dark]) :is(.browser-task-card,[data-section-id][class*=bg-panel][class*=rounded],.crystra-card,.crystra-widget,.crystra-monitoring-widget,.trace-waterfall-canvas,.trace-tree-canvas-shell,.trace-minimap,.span-passport):not([data-host-owned],[data-host-owned] *):not([data-tone]:not([data-tone=neutral]),[aria-selected=true],[data-selected=true],:focus-visible){border-color:var(--card-surface-border)!important}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button{border-style:var(--tw-border-style);--recipe-tone:var(--color-text-primary);--recipe-soft:var(--color-background-neutral-action);--recipe-border:var(--color-border-strong);min-height:var(--component-control-height-compact);justify-content:center;align-items:center;gap:var(--component-control-gap);padding:var(--component-control-padding-block-compact) var(--component-padding-compact);border-radius:var(--shape-control);transition:background-color var(--component-motion-duration) var(--component-motion-ease), border-color var(--component-motion-duration) var(--component-motion-ease), color var(--component-motion-duration) var(--component-motion-ease);border-width:1px;font-size:14px;font-weight:500;line-height:20px;display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-size=regular]{min-height:var(--component-control-height-regular);padding:var(--component-control-padding-block-regular) var(--component-padding-regular)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=outline]{background:var(--color-background-inset);border-color:var(--recipe-border);color:var(--recipe-tone)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=ghost]{color:var(--recipe-tone);background:0 0;border-color:#0000}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=solid]{background:var(--recipe-tone);border-color:var(--recipe-tone);color:var(--color-text-on-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=solid][data-tone=neutral]{background:var(--color-background-neutral-action);border-color:var(--color-border-strong);color:var(--color-text-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=segment]{color:var(--color-text-secondary);background:0 0;border-color:#0000}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=segment][aria-pressed=true]{background:var(--recipe-soft);border-color:var(--recipe-border);color:var(--recipe-tone)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button:enabled:hover{filter:brightness(1.12)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-appearance=ghost]:enabled:hover{background:var(--color-interaction-hover)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button:enabled:active{filter:brightness(.94)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button:focus-visible{outline:var(--border-emphasis) solid var(--color-border-focus);outline-offset:2px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button:disabled{opacity:.45;cursor:not-allowed;filter:none}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-icon-button=true]{width:28px;min-width:var(--component-icon-hit-compact);height:28px;padding:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-icon-button=true][data-size=regular]{width:36px;min-width:var(--component-icon-hit-regular);height:36px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button-icon{flex-shrink:0;display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button-icon svg,.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-icon-button=true] svg{width:14px;height:14px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button[data-size=regular] svg{width:18px;height:18px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-surface{border:var(--border-hairline) solid var(--color-border-default);border-radius:var(--shape-panel);border-color:var(--color-border-default);background:var(--color-background-card)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-surface[data-level=section]{background:var(--color-background-workspace)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-surface[data-level=inset]{border-radius:var(--shape-control);background:var(--color-background-inset)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-surface[data-level=raised]{background:var(--color-background-floating)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card{padding:var(--component-padding-regular)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card[data-padding=compact]{padding:var(--component-padding-compact)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card[data-padding=none]{padding:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card[data-tone]:not([data-tone=neutral]){border-color:var(--recipe-border);background:var(--recipe-soft)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card-header{align-items:flex-start;gap:var(--component-content-gap);margin-bottom:var(--component-content-gap);display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card-copy{flex:1;min-width:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card-actions{align-items:center;gap:var(--component-control-gap);flex-shrink:0;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card-content{min-width:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-card-footer{margin-top:var(--component-content-gap)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-chip{--recipe-tone:var(--color-text-secondary);--recipe-soft:var(--color-interaction-hover);--recipe-border:var(--color-border-default);border:var(--border-hairline) solid transparent;border-radius:var(--shape-pill);white-space:nowrap;align-items:center;padding:2px 8px;font-size:12px;line-height:16px;display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-chip[data-size=regular]{padding:4px 10px;font-size:14px;line-height:20px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-chip[data-appearance=soft]{color:var(--recipe-tone);background:var(--recipe-soft)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-chip[data-appearance=outline]{color:var(--recipe-tone);border-color:var(--recipe-border);background:0 0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-chip[data-appearance=solid]{color:var(--color-text-on-primary);background:var(--recipe-tone)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-divider{background:var(--color-border-default)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-divider[data-orientation=vertical]{align-self:stretch;width:1px;min-width:1px;height:auto}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-family=mono],.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-variant=code]{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-weight=regular]{font-weight:400}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-weight=medium]{font-weight:500}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-weight=semibold]{font-weight:600}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-typography[data-weight=bold]{font-weight:700}@media (prefers-reduced-motion:reduce){.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-button{transition:none}}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *)[data-tone=primary]{--recipe-tone:var(--color-interaction-primary);--recipe-soft:var(--color-interaction-selected);--recipe-border:var(--color-interaction-selected-border)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *)[data-tone=success]{--recipe-tone:var(--color-status-success-text);--recipe-soft:var(--color-status-success-surface);--recipe-border:var(--color-status-success-border)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *)[data-tone=warning]{--recipe-tone:var(--color-status-warning-text);--recipe-soft:var(--color-status-warning-surface);--recipe-border:var(--color-status-warning-border)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *)[data-tone=danger]{--recipe-tone:var(--color-status-error-text);--recipe-soft:var(--color-status-error-surface);--recipe-border:var(--color-status-error-border)}.crystra-bi[data-crystra-theme=dark] .crystra-surface[data-border=none]:not([data-host-owned],[data-host-owned] *){border-width:0}.crystra-bi[data-crystra-theme=dark] .crystra-surface[data-border=dashed]:not([data-host-owned],[data-host-owned] *){border-style:dashed}.crystra-bi[data-crystra-theme=dark] .crystra-button[data-icon-button=true]:not([data-host-owned],[data-host-owned] *){min-height:var(--component-icon-hit-compact)}.crystra-bi[data-crystra-theme=dark] .crystra-button[data-icon-button=true][data-size=regular]:not([data-host-owned],[data-host-owned] *){min-height:var(--component-control-height-regular)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list{gap:var(--component-detail-gap);flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-item{align-items:center;gap:var(--component-control-gap);border-radius:var(--shape-control);min-width:0;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-main{align-items:center;gap:var(--component-content-gap);min-width:0;padding:var(--component-padding-compact);border:var(--border-hairline) solid transparent;border-radius:var(--shape-control);color:var(--color-text-primary);text-align:left;background:0 0;flex:1;text-decoration:none;display:flex}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-size=compact] :not([data-host-owned],[data-host-owned] *).crystra-list-main{padding:var(--component-row-padding-block) var(--component-padding-compact)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-copy{gap:var(--component-detail-gap);overflow-wrap:anywhere;flex-direction:column;flex:1;min-width:0;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-leading{color:var(--color-text-secondary);flex-shrink:0;display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-meta{color:var(--color-text-muted);font-size:var(--crystra-type-meta-size);flex-shrink:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-list-actions{align-items:center;gap:var(--component-control-gap);flex-shrink:0;padding-right:8px;display:flex}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-divided=true] :not([data-host-owned],[data-host-owned] *).crystra-list-item+.crystra-list-item{border-top:var(--border-hairline) solid var(--color-border-default)}.crystra-bi[data-crystra-theme=dark] .crystra-list-item[data-selected=true]>:not([data-host-owned],[data-host-owned] *).crystra-list-main{background:var(--color-interaction-selected);border-color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab-list{align-items:center;gap:var(--component-detail-gap);padding:var(--component-detail-gap);border-radius:var(--shape-control);background:var(--color-background-inset);display:flex;overflow-x:auto}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab{justify-content:center;align-items:center;gap:var(--component-control-gap);min-height:var(--component-control-height-regular);padding:var(--component-control-padding-block-regular) var(--component-padding-compact);border:var(--border-hairline) solid transparent;border-radius:var(--shape-control);color:var(--color-text-secondary);font-size:var(--crystra-type-control-size);background:0 0;flex-shrink:0;line-height:20px;display:inline-flex}.crystra-bi[data-crystra-theme=dark] .crystra-tabs[data-size=compact] :not([data-host-owned],[data-host-owned] *).crystra-tab{min-height:var(--component-control-height-compact);padding-block:var(--component-control-padding-block-compact)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab[aria-selected=true]{color:var(--color-interaction-primary);background:var(--color-interaction-selected);border-color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] .crystra-tabs[data-appearance=underline] :not([data-host-owned],[data-host-owned] *).crystra-tab{background:0 0;border-width:0 0 2px;border-radius:0}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab-panel{margin-top:12px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu{display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-panel{z-index:100;min-width:var(--overlay-menu-min-width);max-width:calc(100vw - 16px);padding:var(--component-detail-gap);border:var(--border-hairline) solid var(--color-border-strong);border-radius:var(--shape-control);background:var(--color-background-floating);position:fixed;overflow-y:auto;box-shadow:0 8px 24px #0006}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-item{align-items:center;gap:var(--component-control-gap);width:100%;padding:var(--component-row-padding-block) var(--component-padding-compact);text-align:left;border-radius:var(--shape-detail);color:var(--color-text-primary);font-size:var(--crystra-type-control-size);background:0 0;border:0;line-height:20px;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-item[data-tone=danger]{color:var(--color-status-error-solid)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *):is(button.crystra-list-main,a.crystra-list-main,.crystra-tab,.crystra-menu-item){cursor:pointer;transition:background-color var(--component-motion-duration) var(--component-motion-ease)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *):is(button.crystra-list-main,a.crystra-list-main,.crystra-tab,.crystra-menu-item):hover:not(:disabled){background:var(--color-background-neutral-action)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *):is(.crystra-list-main,.crystra-tab,.crystra-menu-item,.crystra-tab-panel):focus-visible{outline:var(--border-emphasis) solid var(--color-interaction-primary);outline-offset:-2px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *):is(.crystra-list-main,.crystra-tab,.crystra-menu-item):disabled{opacity:.45;cursor:default}@media (prefers-reduced-motion:reduce){.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *):is(.crystra-list-main,.crystra-tab,.crystra-menu-item){transition:none}}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab:has(input:checked){color:var(--color-interaction-primary);background:var(--color-interaction-selected);border-color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-tab:has(input:focus-visible){outline:var(--border-emphasis) solid var(--color-interaction-primary);outline-offset:-2px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-item[data-tone=primary]{color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-item[data-tone=success]{color:var(--color-status-success-solid)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-menu-item[data-tone=warning]{color:var(--color-status-warning-solid)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-field{gap:var(--component-control-gap);flex-direction:column;min-width:0;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-field>:is(input,select){min-height:var(--component-control-height-regular);padding:var(--component-control-padding-block-regular) var(--component-padding-compact);border:var(--border-hairline) solid var(--color-border-strong);border-radius:var(--shape-control);background:var(--color-background-inset);color:var(--color-text-primary);font:inherit;font-size:14px;line-height:20px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-field[data-size=compact]>:is(input,select){min-height:var(--component-control-height-compact);padding-block:var(--component-control-padding-block-compact)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-field>:is(input,select):focus-visible{outline:var(--border-emphasis) solid var(--color-interaction-primary);outline-offset:2px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-selection{align-items:center;gap:var(--component-control-gap);min-height:var(--component-control-height-compact);cursor:pointer;display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-selection>input{width:16px;height:16px;accent-color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-field>:disabled{opacity:.45}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-selection:has(:disabled){opacity:.45;cursor:default}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-popover{display:inline-flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-popover-panel{z-index:100;gap:var(--component-content-gap);min-width:var(--overlay-popover-min-width);max-width:calc(100vw - 16px);padding:var(--component-padding-regular);background:var(--color-background-floating);border:var(--border-hairline) solid var(--color-border-strong);border-radius:var(--shape-panel);flex-direction:column;display:flex;position:fixed;overflow-y:auto;box-shadow:0 8px 24px #0006}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-empty{min-height:var(--component-card-min-height);justify-content:center;align-items:center;gap:var(--component-content-gap);flex-direction:column;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-empty-skeleton{align-items:center;gap:var(--component-control-gap);opacity:.25;color:var(--color-text-secondary);flex-direction:column;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-empty-skeleton>span{border-radius:var(--shape-detail);background:currentColor;width:96px;height:6px;display:block}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-empty-skeleton>span:last-child{width:64px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-bench-viewer{gap:var(--component-content-gap);min-height:min(var(--component-card-min-height), 100%);min-width:0;height:100%;max-height:100%;padding:var(--component-padding-regular);border:var(--border-hairline) solid var(--color-border-default);border-radius:var(--shape-panel);background:var(--color-background-card);flex-direction:column;display:flex;overflow:hidden}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-viewer-header{justify-content:space-between;align-items:center;gap:var(--component-content-gap);flex-shrink:0;display:flex}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-viewer-preview{min-height:0;overflow:hidden}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-viewer-scroll{overscroll-behavior:contain;flex:1;min-height:0;overflow-y:auto}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-progress-notice{right:var(--overlay-notice-offset);bottom:var(--overlay-notice-offset);z-index:90;width:var(--overlay-notice-width);max-width:calc(100vw - 48px);padding:var(--component-padding-regular);gap:var(--component-control-gap);background:var(--color-background-floating);border:var(--border-hairline) solid var(--color-border-strong);border-radius:var(--shape-panel);flex-direction:column;display:flex;position:fixed;box-shadow:0 8px 24px #0006}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-progress-notice>progress{width:100%;height:8px;accent-color:var(--color-interaction-primary)}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-widget{--widget-unit:160px;--widget-columns:1;--widget-rows:1;box-sizing:border-box;width:calc(var(--widget-columns) * var(--widget-unit));height:calc(var(--widget-rows) * var(--widget-unit));border:var(--border-hairline) solid var(--color-border-default);border-radius:var(--shape-panel);background:var(--color-background-card);color:var(--color-text-primary);flex-direction:column;gap:12px;padding:12px;display:flex;overflow:hidden}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-widget[data-size="2x2"]{--widget-columns:2;--widget-rows:2;gap:16px;padding:16px}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-widget[data-size="3x3"]{--widget-columns:3;--widget-rows:3;gap:16px;padding:16px}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *):is(.crystra-widget-header,.crystra-widget-footer){flex-shrink:0;justify-content:space-between;align-items:center;gap:8px;min-width:0;display:flex}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *).crystra-widget-title{text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *):is(.crystra-widget-status,.crystra-widget-footer){color:var(--color-text-secondary);font-size:12px;line-height:16px}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *).crystra-widget-body{flex-direction:column;flex:1;justify-content:center;gap:16px;min-height:0;display:flex;overflow:hidden}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *).crystra-widget-primary{overflow-wrap:anywhere;font-size:24px;font-weight:600;line-height:32px}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *).crystra-widget-secondary{color:var(--color-text-secondary);white-space:pre-line;overflow-wrap:anywhere;font-size:14px;line-height:24px}.crystra-bi[data-crystra-theme=dark] .crystra-widget :not([data-host-owned],[data-host-owned] *).crystra-widget-actions{color:var(--color-interaction-primary);margin-left:auto}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-widget[data-size="1x2"]{--widget-columns:2}.crystra-bi[data-crystra-theme=dark] :not([data-host-owned],[data-host-owned] *).crystra-widget[data-size="1x3"]{--widget-columns:3}.crystra-bi[data-crystra-theme=dark] .crystra-widget:is([data-size="1x2"],[data-size="1x3"]) :not([data-host-owned],[data-host-owned] *).crystra-widget-body{flex-direction:row;justify-content:flex-start;align-items:center}.crystra-bi[data-crystra-theme=dark] .crystra-widget:is([data-size="1x2"],[data-size="1x3"]) :not([data-host-owned],[data-host-owned] *).crystra-widget-primary{flex-shrink:0}.crystra-bi[data-crystra-theme=dark] .crystra-widget:is([data-size="1x2"],[data-size="1x3"]) :not([data-host-owned],[data-host-owned] *).crystra-widget-secondary{flex:1;min-width:0}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-item{transition:background-color var(--component-motion-duration) var(--component-motion-ease)}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-item:is(:hover,[data-selected=true]){background:var(--color-background-neutral-action,#353538)}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-item>.crystra-list-main,.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-item>.crystra-list-main:is(:hover,:focus-visible){box-shadow:none;background:0 0;border:0;outline:none}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-item:has(:focus-visible){background:var(--color-background-neutral-action,#353538);box-shadow:inset 3px 0 0 var(--color-text-secondary,#aaa)}.crystra-bi[data-crystra-theme=dark] .crystra-list[data-selection-appearance=surface] .crystra-list-actions{padding-right:6px}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}.crystra-bi[data-crystra-theme=dark]{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark;color:var(--color-text-primary);--color-background-shell:#151517;--color-background-sidebar:#1b1b1c;--color-background-workspace:#151517;--color-background-card:#232324;--color-background-inset:#2c2c2e;--color-background-composer:#2c2c2e;--color-background-message:#2c2c2e;--color-background-canvas:#1b1b1c;--color-background-surface:#151517;--color-background-summary:#232324;--color-background-floating:#353638;--color-text-primary:#f9fafb;--color-text-secondary:#cfd3d6;--color-text-muted:#adb2b8;--color-text-disabled:#81858c;--color-text-on-primary:#fff;--color-text-on-status:#151517;--color-border-subtle:#ffffff0f;--color-border-default:#ffffff1f;--color-border-strong:#ffffff29;--color-border-focus:#679efe;--color-interaction-hover:#ffffff14;--color-interaction-pressed:#ffffff24;--color-interaction-selected:#679efe1f;--color-interaction-selected-text:#679efe;--color-interaction-selected-border:#679efe;--color-interaction-link:#679efe;--color-interaction-primary:#679efe;--color-interaction-primary-hover:#4176e6;--color-interaction-primary-pressed:#4176e6;--color-background-neutral-action:#43454a;--color-background-neutral-action-hover:#353638;--color-brand:#679efe;--color-status-success-text:#22c55e;--color-status-success-surface:#22c55e1f;--color-status-success-border:#22c55e94;--color-status-success-solid:#22c55e;--color-status-warning-text:#f59e0b;--color-status-warning-surface:#f59e0b1f;--color-status-warning-border:#f59e0b94;--color-status-warning-solid:#f59e0b;--color-status-error-text:#f25a5a;--color-status-error-surface:#f25a5a1f;--color-status-error-border:#f25a5a94;--color-status-error-solid:#f25a5a;--color-status-info-text:#679efe;--color-status-info-surface:#679efe1f;--color-status-info-border:#679efe94;--color-status-info-solid:#679efe;--color-status-running-text:#679efe;--color-status-running-surface:#679efe1f;--color-status-running-border:#679efe94;--color-status-running-solid:#679efe;--color-status-paused-text:#adb2b8;--color-status-paused-surface:#2c2c2e;--color-status-paused-border:#ffffff1f;--color-status-paused-solid:#81858c;--color-shadow-panel:0 18px 45px #0000003d;--color-shadow-floating:0 18px 56px #0006;--color-overlay:#0005;--surface-section:var(--color-background-workspace);--surface-panel:var(--color-background-card);--surface-inset:var(--color-background-inset);--surface-raised:var(--color-background-floating);--content-primary:var(--color-text-primary);--content-secondary:var(--color-text-secondary);--content-muted:var(--color-text-muted);--border-default:var(--color-border-default);--border-strong:var(--color-border-strong);--interaction-accent:var(--color-interaction-primary);--interaction-selection:var(--color-interaction-selected);--status-error:var(--color-status-error-solid);--status-attention:var(--color-status-warning-solid);--status-available:var(--color-status-success-solid);--crystra-type-page-title-size:24px;--crystra-type-page-title-line:32px;--crystra-type-page-title-weight:600;--crystra-type-section-title-size:18px;--crystra-type-section-title-line:26px;--crystra-type-section-title-weight:600;--crystra-type-card-title-size:16px;--crystra-type-card-title-line:24px;--crystra-type-card-title-weight:600;--crystra-type-item-title-size:14px;--crystra-type-item-title-line:20px;--crystra-type-item-title-weight:500;--crystra-type-body-size:14px;--crystra-type-body-line:24px;--crystra-type-body-weight:400;--crystra-type-body-compact-size:14px;--crystra-type-body-compact-line:20px;--crystra-type-body-compact-weight:400;--crystra-type-header-description-size:14px;--crystra-type-header-description-line:22px;--crystra-type-header-description-weight:400;--crystra-type-description-size:12px;--crystra-type-description-line:18px;--crystra-type-description-weight:400;--crystra-type-meta-size:12px;--crystra-type-meta-line:18px;--crystra-type-meta-weight:400;--crystra-type-label-size:12px;--crystra-type-label-line:18px;--crystra-type-label-weight:600;--crystra-type-control-size:14px;--crystra-type-control-line:20px;--crystra-type-control-weight:500;--crystra-type-code-size:12px;--crystra-type-code-line:20px;--crystra-type-code-weight:400;--crystra-type-metric-size:20px;--crystra-type-metric-line:28px;--crystra-type-metric-weight:500;--crystra-type-brand-size:20px;--crystra-type-brand-line:28px;--crystra-type-brand-weight:600;--crystra-type-badge-size:11px;--crystra-type-badge-line:14px;--crystra-type-badge-weight:500;--crystra-type-graph-title-size:13px;--crystra-type-graph-title-line:18px;--crystra-type-graph-title-weight:500;--crystra-type-graph-meta-size:11px;--crystra-type-graph-meta-line:16px;--crystra-type-graph-meta-weight:400;--layout-bench-inset-inline:20px;--layout-bench-inset-block:16px;--layout-section-gap:12px;--layout-card-gap:12px;--layout-input-min-width:360px;--layout-bench-min-width:680px;--layout-files-min-width:320px;--layout-bench-inset-end:20px;--shape-panel:12px;--shape-control:8px;--shape-detail:4px;--shape-pill:999px;--border-hairline:1px;--border-emphasis:2px;--component-padding-compact:12px;--component-padding-regular:16px;--component-content-gap:12px;--component-control-gap:8px;--component-detail-gap:4px;--component-row-padding-block:8px;--component-control-padding-block-compact:5px;--component-control-padding-block-regular:7px;--component-control-height-compact:32px;--component-control-height-regular:36px;--component-icon-hit-compact:28px;--component-icon-hit-regular:36px;--component-card-min-height:120px;--overlay-menu-min-width:192px;--overlay-popover-min-width:240px;--overlay-notice-width:320px;--overlay-notice-offset:24px;--component-motion-duration:.15s;--component-motion-ease:ease;--motion-sidebar-duration:.34s;--motion-sidebar-ease:cubic-bezier(.22, .68, .2, 1);--layout-comparison-card-min:480px;--layout-comparison-card-max:640px;--layout-comparison-break-lg:1044px;--layout-comparison-break-xl:1566px;--layout-comparison-break-2xl:2080px;--layout-comparison-gap-min:16px;--layout-comparison-gap-max:32px;--layout-comparison-gap-ratio:.02;--layout-comparison-sidebar-inner:300px;--layout-comparison-sidebar-width:324px;--layout-comparison-sidebar-gap:24px;--layout-observation-editor-list:210px;--layout-observation-editor-controls:280px;--layout-observation-editor-gap:24px;--layout-observation-editor-list-compact:170px;--layout-observation-editor-controls-compact:240px;--layout-observation-editor-gap-compact:16px;--layout-observation-editor-max:1840px;--layout-observation-dialog-inset:48px;--layout-observation-dialog-width:600px;--layout-observation-dataset-width:740px;--motion-observation-sidebar-duration:.34s;--motion-observation-sidebar-ease:cubic-bezier(.22, 1, .36, 1);--overlay-observation-backdrop:#0009;--overlay-observation-blur:2px;--component-trace-zoom-inset:6px;--card-surface-shadow:0 4px 12px 0 #00000005, 0 2px 8px 0 #0000000a}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=page-title]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-page-title-size);line-height:var(--crystra-type-page-title-line);font-weight:var(--crystra-type-page-title-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=section-title]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-section-title-size);line-height:var(--crystra-type-section-title-line);font-weight:var(--crystra-type-section-title-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=card-title]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-card-title-size);line-height:var(--crystra-type-card-title-line);font-weight:var(--crystra-type-card-title-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=item-title]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-item-title-size);line-height:var(--crystra-type-item-title-line);font-weight:var(--crystra-type-item-title-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=body]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-body-size);line-height:var(--crystra-type-body-line);font-weight:var(--crystra-type-body-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=body-compact]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-body-compact-size);line-height:var(--crystra-type-body-compact-line);font-weight:var(--crystra-type-body-compact-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=header-description]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-header-description-size);line-height:var(--crystra-type-header-description-line);font-weight:var(--crystra-type-header-description-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=description]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-description-size);line-height:var(--crystra-type-description-line);font-weight:var(--crystra-type-description-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=meta]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-meta-size);line-height:var(--crystra-type-meta-line);font-weight:var(--crystra-type-meta-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=label]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-label-size);line-height:var(--crystra-type-label-line);font-weight:var(--crystra-type-label-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=control]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-control-size);line-height:var(--crystra-type-control-line);font-weight:var(--crystra-type-control-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=code]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-code-size);line-height:var(--crystra-type-code-line);font-weight:var(--crystra-type-code-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=metric]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-metric-size);line-height:var(--crystra-type-metric-line);font-weight:var(--crystra-type-metric-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=brand]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-brand-size);line-height:var(--crystra-type-brand-line);font-weight:var(--crystra-type-brand-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=badge]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-badge-size);line-height:var(--crystra-type-badge-line);font-weight:var(--crystra-type-badge-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=graph-title]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-graph-title-size);line-height:var(--crystra-type-graph-title-line);font-weight:var(--crystra-type-graph-title-weight);letter-spacing:0;text-transform:none}.crystra-bi[data-crystra-theme=dark] .crystra-typography[data-variant=graph-meta]:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-type-graph-meta-size);line-height:var(--crystra-type-graph-meta-line);font-weight:var(--crystra-type-graph-meta-weight);letter-spacing:0;text-transform:none}.crystra-bi .crystra-typography{color:var(--content-primary);margin:0}.crystra-bi .crystra-typography[data-variant=h1]{font-size:var(--type-h1-size);--tw-leading:var(--leading-tight,1.25);line-height:var(--leading-tight,1.25);--tw-font-weight:var(--font-weight-semibold,600);font-weight:var(--font-weight-semibold,600)}.crystra-bi .crystra-typography[data-variant=h2]{font-size:var(--type-heading-size);--tw-leading:var(--leading-snug,1.375);line-height:var(--leading-snug,1.375);--tw-font-weight:var(--font-weight-semibold,600);font-weight:var(--font-weight-semibold,600)}.crystra-bi .crystra-typography[data-variant=subtitle1]{font-size:var(--type-subtitle-size);--tw-leading:var(--leading-snug,1.375);line-height:var(--leading-snug,1.375);--tw-font-weight:var(--font-weight-semibold,600);font-weight:var(--font-weight-semibold,600)}.crystra-bi .crystra-typography[data-variant=body1]{font-size:var(--type-body-size);--tw-leading:var(--leading-relaxed,1.625);line-height:var(--leading-relaxed,1.625)}.crystra-bi .crystra-typography[data-variant=body2]{font-size:var(--type-body-small-size);--tw-leading:var(--leading-relaxed,1.625);line-height:var(--leading-relaxed,1.625)}.crystra-bi .crystra-typography[data-variant=caption]{font-size:var(--type-caption-size);color:var(--content-secondary)}.crystra-bi .crystra-typography[data-variant=overline]{font-size:var(--type-overline-size);--tw-font-weight:var(--font-weight-bold,700);font-weight:var(--font-weight-bold,700);--tw-tracking:var(--tracking-widest,.1em);letter-spacing:var(--tracking-widest,.1em);color:var(--content-secondary);text-transform:uppercase}.crystra-bi .crystra-typography[data-family=mono]{font-family:var(--type-code-family)}.crystra-bi .crystra-typography[data-weight=regular]{--tw-font-weight:var(--font-weight-normal,400);font-weight:var(--font-weight-normal,400)}.crystra-bi .crystra-typography[data-weight=medium]{--tw-font-weight:var(--font-weight-medium,500);font-weight:var(--font-weight-medium,500)}.crystra-bi .crystra-typography[data-weight=semibold]{--tw-font-weight:var(--font-weight-semibold,600);font-weight:var(--font-weight-semibold,600)}.crystra-bi .crystra-typography[data-weight=bold]{--tw-font-weight:var(--font-weight-bold,700);font-weight:var(--font-weight-bold,700)}.crystra-bi .crystra-typography[data-tone=primary]{color:var(--content-primary)}.crystra-bi .crystra-typography[data-tone=secondary]{color:var(--content-secondary)}.crystra-bi .crystra-typography[data-tone=muted]{color:var(--content-muted)}.crystra-bi .crystra-typography[data-tone=inverse]{color:var(--content-inverse)}.crystra-bi .crystra-typography[data-tone=error]{color:var(--status-error)}.crystra-bi .crystra-typography[data-tone=warning]{color:var(--status-attention)}.crystra-bi .crystra-typography[data-tone=success]{color:var(--status-available)}.crystra-bi .crystra-typography[data-italic]{font-style:italic}.crystra-bi .crystra-typography[data-underline]{text-decoration-line:underline}.crystra-bi .crystra-typography[data-truncate]{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.crystra-bi .crystra-button{min-height:calc(var(--spacing,.25rem) * 8);justify-content:center;align-items:center;gap:calc(var(--spacing,.25rem) * 1.5);border-radius:var(--shape-control);border-style:var(--tw-border-style);padding-inline:calc(var(--spacing,.25rem) * 2.5);padding-block:calc(var(--spacing,.25rem) * 1.5);font-size:var(--type-label-size);color:var(--content-primary);border-width:1px;display:inline-flex}.crystra-bi .crystra-button[data-appearance=outline]{border-color:var(--border-strong);background-color:var(--surface-raised)}.crystra-bi .crystra-button[data-appearance=ghost]{color:var(--content-secondary);background-color:#0000;border-color:#0000}.crystra-bi .crystra-button[data-appearance=solid][data-tone=primary]{border-color:var(--interaction-accent);background-color:var(--interaction-selection)}.crystra-bi .crystra-button[data-appearance=solid][data-tone=danger]{border-color:var(--status-error);background-color:var(--status-error-surface);color:var(--status-error)}.crystra-bi .crystra-button[data-appearance=segment]{min-height:calc(var(--spacing,.25rem) * 7);background-color:#0000;border-color:#0000}.crystra-bi .crystra-button[data-appearance=segment][aria-pressed=true]{border-color:var(--interaction-accent);background-color:var(--interaction-selection)}.crystra-bi .crystra-button:disabled{cursor:not-allowed;opacity:.5}.crystra-bi .crystra-button[data-icon-button=true]{min-height:calc(var(--spacing,.25rem) * 7);width:calc(var(--spacing,.25rem) * 7);min-width:calc(var(--spacing,.25rem) * 7);padding:0}.crystra-bi .crystra-button[data-icon-button=true] svg{height:calc(var(--spacing,.25rem) * 3.5);width:calc(var(--spacing,.25rem) * 3.5);fill:none;stroke:currentColor;stroke-width:1.35px;stroke-linecap:round;stroke-linejoin:round}.crystra-bi .crystra-button-group{align-items:center;gap:calc(var(--spacing,.25rem) * 1.5);flex-wrap:wrap;display:flex}.crystra-bi .crystra-button-group[data-segmented]{gap:var(--spacing,.25rem);border-radius:var(--shape-control);border-style:var(--tw-border-style);border-width:1px;border-color:var(--border-default);background-color:var(--surface-inset);padding:calc(var(--spacing,.25rem) * .5)}.crystra-bi .crystra-surface{border-radius:var(--shape-panel);border-style:var(--tw-border-style);border-width:1px;border-color:var(--border-default);background-color:var(--surface-section);min-width:0}.crystra-bi .crystra-surface[data-level=panel]{background-color:var(--surface-panel)}.crystra-bi .crystra-surface[data-level=inset]{border-radius:var(--shape-control);background-color:var(--surface-inset)}.crystra-bi .crystra-surface[data-level=raised]{background-color:var(--surface-raised)}.crystra-bi .crystra-surface[data-border=dashed]{--tw-border-style:dashed;border-style:dashed}.crystra-bi .crystra-surface[data-border=none]{border-style:var(--tw-border-style);border-width:0}.crystra-bi .crystra-divider{border-style:var(--tw-border-style);background-color:var(--border-default);border-width:0;width:100%;height:1px;margin:0}.crystra-bi .crystra-input{min-height:calc(var(--spacing,.25rem) * 8);border-radius:var(--shape-control);border-style:var(--tw-border-style);border-width:1px;border-color:var(--border-strong);background-color:var(--surface-inset);min-width:0;padding-inline:calc(var(--spacing,.25rem) * 2.5);font-size:var(--type-label-size);color:var(--content-primary);--tw-outline-style:none;outline-style:none}.crystra-bi .crystra-input:focus{border-color:var(--interaction-accent)}.crystra-bi .crystra-status-badge{padding-inline:calc(var(--spacing,.25rem) * 2);padding-block:calc(var(--spacing,.25rem) * .5);font-size:var(--type-overline-size);--tw-font-weight:var(--font-weight-bold,700);font-weight:var(--font-weight-bold,700);text-transform:uppercase;border-radius:2147483647px;align-items:center;display:inline-flex}.crystra-bi .crystra-status-badge[data-status=available],.crystra-bi .crystra-status-badge[data-status=selected]{background-color:var(--interaction-selection);color:var(--interaction-accent)}.crystra-bi .crystra-status-badge[data-status=partial]{background-color:var(--status-attention-surface);color:var(--status-attention)}.crystra-bi .crystra-status-badge[data-status=unavailable]{background-color:var(--surface-raised);color:var(--content-secondary)}.crystra-bi .crystra-status-badge[data-status=error]{background-color:var(--status-error-surface);color:var(--status-error)}@property --tw-leading{syntax:"*";inherits:false}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-tracking{syntax:"*";inherits:false}.crystra-bi{--component-trace-zoom-inset:6px;--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light;--crystra-surface-panel:oklch(100% 0 0);--crystra-surface-section:var(--crystra-surface-panel);--crystra-surface-raised:oklch(99% .004 250);--crystra-surface-inset:oklch(94.5% .01 250);--crystra-shape-panel:.625rem;--crystra-shape-control:.4375rem;--crystra-type-h1:2.25rem;--crystra-type-h2:1.25rem;--crystra-type-subtitle1:1.125rem;--crystra-type-body1:1rem;--crystra-type-body2:.875rem;--crystra-type-caption:.75rem;--crystra-type-overline:.5625rem;--trace-indent-column:0;--trace-indent-columns:1;--surface-canvas:oklch(97.5% .006 250);--surface-base:var(--surface-canvas);--surface-section:var(--crystra-surface-section,var(--crystra-surface-panel));--surface-panel:var(--crystra-surface-panel,oklch(100% 0 0));--surface-raised:var(--crystra-surface-raised,oklch(99% .004 250));--surface-inset:var(--crystra-surface-inset,oklch(94.5% .01 250));--content-primary:oklch(23% .025 255);--content-secondary:oklch(42% .025 255);--content-muted:oklch(54% .02 255);--content-inverse:oklch(99% 0 0);--border-default:oklch(86% .015 250);--border-strong:oklch(67% .025 250);--interaction-accent:oklch(49% .18 244);--interaction-selection:oklch(90% .05 244);--interaction-disabled:oklch(70% .01 250);--focus-ring:oklch(57% .17 244);--status-available:oklch(42% .12 155);--status-available-surface:oklch(94% .05 155);--status-attention:oklch(50% .13 75);--status-warning:var(--status-attention);--status-attention-surface:oklch(95% .055 85);--status-unavailable:oklch(45% .025 255);--status-unavailable-surface:oklch(94% .012 250);--status-expired:oklch(48% .1 305);--status-expired-surface:oklch(95% .035 305);--status-incompatible:oklch(48% .13 28);--status-incompatible-surface:oklch(95% .045 28);--status-error:oklch(47% .17 25);--status-error-surface:oklch(95% .05 25);--data-series-1:oklch(50% .17 244);--data-series-2:oklch(58% .15 185);--data-series-3:oklch(62% .16 300);--data-series-4:oklch(65% .16 75);--data-series-5:oklch(55% .16 25);--data-series-6:oklch(52% .1 215);--space-page:1.5rem;--space-grid:1rem;--space-cluster:.75rem;--space-control:.625rem;--space-tight:.375rem;--density-row:2.75rem;--density-control:2.5rem;--shape-panel:var(--crystra-shape-panel,.625rem);--shape-control:var(--crystra-shape-control,.4375rem);--shape-pill:999px;--type-h1-size:var(--crystra-type-h1,2.25rem);--type-heading-size:var(--crystra-type-h2,1.25rem);--type-subtitle-size:var(--crystra-type-subtitle1,1.125rem);--type-body-size:var(--crystra-type-body1,1rem);--type-body-small-size:var(--crystra-type-body2,.875rem);--type-caption-size:var(--crystra-type-caption,.75rem);--type-overline-size:var(--crystra-type-overline,.5625rem);--type-label-size:var(--crystra-type-body2,.875rem);--type-code-size:var(--crystra-type-caption,.75rem);--type-code-family:var(--crystra-code-font-family,ui-monospace, SFMono-Regular, Consolas, monospace);--type-value-size:1.5rem;--type-numeric-size:1.5rem;--layout-table-max-height:32rem;--layout-visual-preview-height:6rem;--dashboard-grid-column-width:10rem;--dashboard-grid-gap:0px;--dashboard-grid-inline-padding:0px;--motion-finite-duration:.32s;--crystra-container-border-style:solid;box-sizing:border-box;min-width:0;color:var(--content-primary);font-family:var(--crystra-font-family,Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)}.crystra-bi[data-theme=dark]{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark;--crystra-surface-panel:oklch(22.5% .025 255);--crystra-surface-section:var(--crystra-surface-panel);--crystra-surface-raised:oklch(25.5% .025 255);--crystra-surface-inset:oklch(16% .02 255);--surface-canvas:oklch(18% .02 255);--surface-section:var(--crystra-surface-section,var(--crystra-surface-panel));--surface-panel:var(--crystra-surface-panel,oklch(22.5% .025 255));--surface-raised:var(--crystra-surface-raised,oklch(25.5% .025 255));--surface-inset:var(--crystra-surface-inset,oklch(16% .02 255));--content-primary:oklch(94% .01 250);--content-secondary:oklch(76% .018 250);--content-muted:oklch(64% .02 250);--content-inverse:oklch(18% .02 255);--border-default:oklch(34% .025 250);--border-strong:oklch(49% .03 250);--interaction-accent:oklch(76% .13 235);--interaction-selection:oklch(32% .07 244);--interaction-disabled:oklch(48% .018 250);--focus-ring:oklch(73% .14 235);--status-available:oklch(79% .12 153);--status-available-surface:oklch(31% .07 155);--status-attention:oklch(84% .12 82);--status-attention-surface:oklch(32% .06 76);--status-unavailable:oklch(72% .025 250);--status-unavailable-surface:oklch(28% .02 250);--status-expired:oklch(79% .1 305);--status-expired-surface:oklch(31% .06 305);--status-incompatible:oklch(82% .13 35);--status-incompatible-surface:oklch(31% .07 28);--status-error:oklch(80% .14 25);--status-error-surface:oklch(31% .08 25);--data-series-1:oklch(75% .14 235);--data-series-2:oklch(77% .12 185);--data-series-3:oklch(78% .13 300);--data-series-4:oklch(82% .13 80);--data-series-5:oklch(77% .13 28);--data-series-6:oklch(74% .1 210)}.crystra-bi[data-density=compact]{--space-page:1rem;--space-grid:.75rem;--space-cluster:.5rem;--space-control:.375rem;--space-tight:.25rem;--density-control:2.75rem}.crystra-bi *,.crystra-bi :before,.crystra-bi :after{box-sizing:inherit}.crystra-bi :focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}.crystra-bi .dashboard-grid-shell{min-width:0;overflow:auto hidden}.crystra-bi .dashboard-grid-shell[data-editing=true]{border-radius:var(--shape-panel);background-color:var(--surface-inset);background-image:linear-gradient(to right, var(--border-default) 1px, transparent 1px), linear-gradient(to bottom, var(--border-default) 1px, transparent 1px);background-position:var(--dashboard-grid-inline-padding) 0;background-size:calc(var(--dashboard-grid-column-width) + var(--dashboard-grid-gap)) 176px}.crystra-bi .dashboard-grid{transition:height var(--motion-finite-duration) ease;position:relative}.crystra-bi .dashboard-grid>.react-grid-item{min-width:0;transition:transform .18s,width .18s,height .18s}.crystra-bi .dashboard-grid>.react-grid-item>.dashboard-metric-panel{height:100%;overflow:auto}.crystra-bi .dashboard-grid-shell[data-editing=true] .dashboard-grid>.react-grid-item:not(.react-grid-placeholder){cursor:grab;outline:1px dashed var(--interaction-accent);outline-offset:2px}.crystra-bi .dashboard-grid>.react-grid-item.react-draggable-dragging{z-index:3;cursor:grabbing;transition:none}.crystra-bi .dashboard-grid>.react-grid-placeholder{z-index:2;border-radius:var(--shape-panel);background:var(--interaction-selection);outline:2px solid var(--interaction-accent);opacity:.72}.crystra-bi .dashboard-grid .react-resizable-handle{cursor:se-resize;width:1.25rem;height:1.25rem;position:absolute;bottom:.25rem;right:.25rem}.crystra-bi .dashboard-grid-shell[data-editing=false] .react-resizable-handle{display:none}.crystra-bi .dashboard-grid .react-resizable-handle:after{border-right:2px solid var(--interaction-accent);border-bottom:2px solid var(--interaction-accent);content:"";width:.5rem;height:.5rem;position:absolute;bottom:.1875rem;right:.1875rem}.crystra-bi .dashboard-import-input{clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.crystra-bi .dashboard-actions{justify-content:end}.crystra-bi .dashboard-actions .crystra-button[data-appearance=ghost],.crystra-bi .dashboard-widget-delete.crystra-button{border:0}.crystra-bi .dashboard-action-error{max-width:16rem;color:var(--status-error);font-size:var(--type-caption-size)}.crystra-bi .dashboard-widget-delete{z-index:4;background:var(--surface-raised);border:0;position:absolute;inset-block-start:var(--space-tight);inset-inline-end:var(--space-tight)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .dashboard-widget-delete{background:color-mix(in oklch, var(--surface-raised) 88%, transparent)}}.crystra-bi .dashboard-widget-delete{color:var(--content-secondary)}.crystra-bi .dashboard-widget-delete.crystra-button:is(:hover,:focus-visible){background:var(--status-error-surface);color:var(--status-error);border:0}.crystra-bi .dashboard-remove-icon{width:1em;height:1em;-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);mask-image:var(--svg);--svg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M18 6L6 18M6 6l12 12'/%3E%3C/svg%3E");background-color:currentColor;width:1rem;height:1rem;display:inline-block;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}.crystra-bi .dashboard-confirm-icon{width:1em;height:1em;-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);mask-image:var(--svg);--svg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m5 12l5 5L20 7'/%3E%3C/svg%3E");background-color:currentColor;width:1rem;height:1rem;display:inline-block;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}.crystra-bi .panel-card,.crystra-bi .metric-frame,.crystra-bi .dashboard-metric-panel,.crystra-bi .bi-card{gap:var(--space-grid);min-width:0;padding:var(--space-page);border:1px var(--crystra-container-border-style) var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);flex-direction:column;display:flex}.crystra-bi .dashboard-metric-panel{gap:var(--space-cluster);padding:var(--space-cluster);container:dashboard-panel/inline-size}.crystra-bi .dashboard-grid>.react-grid-item>.dashboard-metric-panel[data-visualizer=numeric-card\\@1]{overflow:hidden}.crystra-bi .dashboard-panel-head{justify-content:space-between;align-items:flex-start;gap:var(--space-control);display:flex}.crystra-bi .dashboard-panel-head h3,.crystra-bi .dashboard-panel-meta{margin:0}.crystra-bi .dashboard-panel-actions{justify-content:flex-end;margin-top:auto;display:flex}.crystra-bi .dashboard-panel-head h3{font-size:var(--type-label-size);line-height:1.35}.crystra-bi .dashboard-metric-panel[data-visualizer=numeric-card\\@1] .dashboard-panel-title{font-size:var(--type-caption-size)}.crystra-bi .dashboard-evidence-icon{width:1em;height:1em;-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);-webkit-mask-image:var(--svg);mask-image:var(--svg);--svg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cg fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'%3E%3Cpath d='M14 3v4a1 1 0 0 0 1 1h4'/%3E%3Cpath d='M12 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v4.5'/%3E%3Cpath d='M14 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0m4.5 2L21 22'/%3E%3C/g%3E%3C/svg%3E");background-color:currentColor;width:1rem;height:1rem;display:inline-block;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}.crystra-bi .dashboard-panel-meta{color:var(--content-secondary);font-size:var(--type-caption-size)}.crystra-bi .dashboard-ratio{border-radius:var(--shape-pill);background:var(--surface-inset);height:.5rem;overflow:hidden}.crystra-bi .dashboard-ratio i{background:var(--interaction-accent);height:100%;display:block}.crystra-bi .bi-section{gap:var(--space-grid);min-width:0;display:grid}.crystra-bi .metric-frame-header,.crystra-bi .metric-actions{justify-content:space-between;align-items:center;gap:var(--space-cluster);flex-wrap:wrap;display:flex}.crystra-bi .metric-value,.crystra-bi .status-stack{gap:var(--space-tight);display:grid}.crystra-bi .metric-number{font-size:var(--type-numeric-size);font-variant-numeric:tabular-nums;font-weight:650}.crystra-bi .numeric-exact,.crystra-bi .text-code{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--type-code-size);font-variant-numeric:tabular-nums}.crystra-bi .text-heading{font-size:var(--type-heading-size);margin:0;font-weight:650}.crystra-bi .text-label{font-size:var(--type-label-size);letter-spacing:.08em;text-transform:uppercase;font-weight:700}.crystra-bi .status-label{align-items:center;gap:var(--space-tight);width:fit-content;padding:var(--space-tight) var(--space-cluster);border-radius:var(--shape-pill);font-size:var(--type-label-size);border:1px solid;font-weight:700;display:inline-flex}.crystra-bi .status-available{background:var(--status-available-surface);color:var(--status-available)}@container dashboard-panel (width<=12rem){.dashboard-panel-head .status-available{border-radius:50%;justify-content:center;width:1.5rem;height:1.5rem;padding:0}.dashboard-panel-head .status-available .status-label-text{display:none}}.crystra-bi .status-attention{background:var(--status-attention-surface);color:var(--status-attention)}.crystra-bi .status-unavailable{background:var(--status-unavailable-surface);color:var(--status-unavailable)}.crystra-bi .status-expired{background:var(--status-expired-surface);color:var(--status-expired)}.crystra-bi .status-incompatible{background:var(--status-incompatible-surface);color:var(--status-incompatible)}.crystra-bi .status-error{background:var(--status-error-surface);color:var(--status-error)}.crystra-bi .action-control,.crystra-bi .recorded-node,.crystra-bi .recorded-relation{min-height:var(--density-control);padding:var(--space-control);border:1px solid var(--border-strong);border-radius:var(--shape-control);background:var(--surface-raised);color:var(--content-primary);font:inherit;cursor:pointer}.crystra-bi .visual-with-fallback,.crystra-bi .compare-result,.crystra-bi .recorded-structure{gap:var(--space-grid);min-width:0;display:grid}.crystra-bi .compare-result{grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))}.crystra-bi .visual-preview{width:100%;height:var(--layout-visual-preview-height)}.crystra-bi .fill-current{fill:currentColor}.crystra-bi .text-data-series-1{color:var(--data-series-1)}.crystra-bi .stroke-border-default{stroke:var(--border-default)}.crystra-bi .visual-data-table{table-layout:fixed;border-collapse:collapse;width:100%;max-width:100%;font-size:var(--type-label-size)}.crystra-bi .visual-data-table th,.crystra-bi .visual-data-table td{padding:var(--space-tight);border-block-end:1px solid var(--border-default);overflow-wrap:anywhere;text-align:start}.crystra-bi .bounded-table,.crystra-bi .recorded-graph-frame{max-width:100%;overflow:auto}.crystra-bi .recorded-graph{width:100%;min-width:40rem}.crystra-bi .recorded-graph-parent{stroke:var(--border-strong)}.crystra-bi .recorded-graph-link{stroke:var(--interaction-accent);stroke-dasharray:5 4}.crystra-bi .recorded-graph-node{fill:var(--surface-panel);stroke:var(--interaction-accent)}.crystra-bi .recorded-graph-label{fill:var(--content-primary);font-size:var(--type-label-size)}.crystra-bi .trace-view,.crystra-bi .trace-tree,.crystra-bi .trace-tree-row{gap:var(--space-grid);min-width:0;display:grid}.crystra-bi .trace-summary,.crystra-bi .trace-waterfall-row,.crystra-bi .trace-node-label,.crystra-bi .trace-tree-row>.recorded-node{justify-content:space-between;align-items:center;gap:var(--space-cluster);min-width:0;display:flex}.crystra-bi .trace-waterfall-row{grid-template-columns:minmax(10rem,.35fr) minmax(16rem,1fr);display:grid}.crystra-bi .trace-timeline-track{min-height:var(--density-row);border:1px solid var(--border-default);border-radius:var(--shape-control);background:var(--surface-inset);position:relative;overflow:hidden}.crystra-bi .trace-timeline-bar{inset-block:var(--space-tight);border-radius:var(--shape-control);background:var(--data-series-1);transform-origin:0;min-width:2px;animation:trace-recorded-reveal var(--motion-finite-duration) ease-out both;position:absolute}.crystra-bi [data-motion=off] .trace-timeline-bar{animation:none}.crystra-bi .trace-passport-grid{gap:var(--space-tight) var(--space-grid);grid-template-columns:minmax(9rem,auto) minmax(0,1fr);margin:0;display:grid}.crystra-bi .trace-passport-grid dt{color:var(--content-secondary);font-weight:650}.crystra-bi .trace-passport-grid dd{overflow-wrap:anywhere;min-width:0;margin:0}.crystra-bi .trace-link-list{color:var(--content-secondary);margin:0}.crystra-bi .trace-sr-only{clip:rect(0 0 0 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}@keyframes trace-recorded-reveal{0%{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}@media (width<=40rem){.crystra-bi .trace-waterfall-row{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.crystra-bi{--motion-finite-duration:0s}}.crystra-bi .trace-view{gap:var(--space-grid);min-width:0;display:grid}.crystra-bi .trace-summary-dense{align-items:center;gap:var(--space-grid);padding:var(--space-grid);border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);grid-template-columns:minmax(12rem,1fr) repeat(4,auto);display:grid}.crystra-bi .trace-summary-dense>span{color:var(--content-secondary);font:var(--type-code-size) var(--type-code-family)}.crystra-bi .trace-overline{color:var(--content-secondary);font-size:var(--type-overline-size);letter-spacing:.08em;text-transform:uppercase;font-weight:700;display:block}.crystra-bi .trace-view-tools,.crystra-bi .trace-passport-head{justify-content:space-between;align-items:center;gap:var(--space-cluster);flex-wrap:wrap;display:flex}.crystra-bi .trace-view-tools input{min-width:min(100%,18rem);margin-inline-start:auto}.crystra-bi .trace-minimap{gap:var(--space-tight);min-height:3.75rem;padding:var(--space-tight) var(--space-grid);border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-inset);display:grid;overflow:hidden}.crystra-bi .trace-minimap-track{border:1px solid var(--interaction-accent);border-radius:var(--shape-control);min-height:1.75rem;position:relative}.crystra-bi .trace-workbench{gap:var(--space-grid);grid-template-columns:minmax(0,1fr) minmax(16rem,19rem);min-width:0;display:grid}.crystra-bi .trace-waterfall-canvas,.crystra-bi .trace-tree-canvas-shell,.crystra-bi .span-passport{border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);min-width:0;overflow:hidden}.crystra-bi .trace-waterfall-row{border-block-end:1px solid var(--border-default);min-height:3rem;display:flex}.crystra-bi .trace-node-label{gap:var(--space-tight);text-align:start;background:0 0;border:0;border-radius:0;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;display:grid}.crystra-bi .trace-node-copy{min-width:0}.crystra-bi .trace-node-copy strong,.crystra-bi .trace-node-copy small{text-overflow:ellipsis;white-space:nowrap;display:block;overflow:hidden}.crystra-bi .trace-node-copy small{color:var(--content-secondary);font:var(--type-caption-size) var(--type-code-family)}.crystra-bi .trace-glyph{border-radius:var(--shape-control);width:1.4rem;height:1.4rem;color:var(--data-series-1);border:1px solid;place-items:center;display:grid}.crystra-bi .trace-kind-client{color:var(--data-series-2)}.crystra-bi .trace-error{color:var(--status-error)}.crystra-bi .trace-timeline-track{border:0;border-inline-start:1px solid var(--border-default);background-color:var(--surface-inset);background-image:linear-gradient(90deg, transparent 24.8%, var(--border-default) 25%, transparent 25.2%, transparent 49.8%, var(--border-default) 50%, transparent 50.2%, transparent 74.8%, var(--border-default) 75%, transparent 75.2%);border-radius:0;min-height:3rem;position:relative;overflow:hidden}.crystra-bi .trace-timeline-bar{min-width:2px;padding-inline:var(--space-tight);border:1px solid var(--data-series-1);border-radius:var(--shape-control);background:var(--data-series-1);display:block;position:absolute;inset-block:.85rem;overflow:hidden}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-timeline-bar{background:color-mix(in srgb, var(--data-series-1) 45%, var(--surface-panel))}}.crystra-bi .trace-timeline-bar{color:var(--content-primary);font-size:var(--type-caption-size);text-overflow:ellipsis;white-space:nowrap;transform-origin:0;animation:trace-recorded-reveal var(--motion-finite-duration) ease-out both}.crystra-bi .trace-timeline-bar.trace-kind-client{border-color:var(--data-series-2);background:var(--data-series-2)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-timeline-bar.trace-kind-client{background:color-mix(in srgb, var(--data-series-2) 40%, var(--surface-panel))}}.crystra-bi .trace-timeline-bar.trace-status-error{border-color:var(--status-error);background:var(--status-error)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-timeline-bar.trace-status-error{background:color-mix(in srgb, var(--status-error) 35%, var(--surface-panel))}}.crystra-bi .trace-passport-head{justify-content:space-between;align-items:center;gap:var(--space-cluster);border-block-end:1px solid var(--border-default);min-height:2.75rem;padding:12px;display:flex}.crystra-bi .trace-passport-body{padding:.8125rem}.crystra-bi .trace-passport-title{align-items:center;gap:.5625rem;min-width:0;margin:0;display:flex}.crystra-bi .trace-passport-title>div{min-width:0}.crystra-bi .trace-passport-name{overflow-wrap:anywhere;font-size:var(--type-body-size);margin:0;display:block}.crystra-bi .trace-passport-title small{color:var(--content-muted);margin-block-start:.1875rem;font-size:12px;line-height:18px;display:block}.crystra-bi .trace-passport-sigil{border:1px solid var(--data-series-1);background:var(--data-series-1);border-radius:.4375rem;flex:none;place-items:center;width:1.8125rem;height:1.8125rem;display:grid}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-passport-sigil{background:color-mix(in srgb, var(--data-series-1) 16%, var(--surface-panel))}}.crystra-bi .trace-passport-sigil{color:var(--data-series-1);font-size:.5rem;font-weight:800}.crystra-bi .trace-passport-sigil.trace-kind-client{border-color:var(--data-series-2);background:var(--data-series-2)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-passport-sigil.trace-kind-client{background:color-mix(in srgb, var(--data-series-2) 16%, var(--surface-panel))}}.crystra-bi .trace-passport-sigil.trace-kind-client{color:var(--data-series-2)}.crystra-bi .trace-passport-sigil.trace-status-error{border-color:var(--status-error);background:var(--status-error)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-passport-sigil.trace-status-error{background:color-mix(in srgb, var(--status-error) 16%, var(--surface-panel))}}.crystra-bi .trace-passport-sigil.trace-status-error{color:var(--status-error)}.crystra-bi .trace-passport-grid{grid-template-columns:1fr;gap:.6875rem;display:grid}.crystra-bi .trace-passport-grid dt{color:var(--content-muted);letter-spacing:.1em;text-transform:uppercase;margin:0;font-size:.5rem}.crystra-bi .trace-passport-grid dd{font-size:var(--type-caption-size);margin-block-start:.1875rem;line-height:1.45}.crystra-bi .trace-passport-grid .text-code,.crystra-bi .trace-passport-grid .numeric-exact{font-size:.5rem}.crystra-bi .trace-link-receipt,.crystra-bi .trace-focus-receipt{margin-block:var(--space-grid);border-radius:var(--shape-control);color:var(--content-secondary);font-family:var(--type-code-family);font-size:var(--type-caption-size);text-align:start;padding:.65rem;line-height:1.5}.crystra-bi .trace-link-receipt{border-inline-start:3px solid var(--status-warning);background:var(--status-warning)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-link-receipt{background:color-mix(in srgb, var(--status-warning) 16%, var(--surface-panel))}}.crystra-bi .trace-tree-canvas{background-color:var(--surface-inset);background-image:radial-gradient(var(--border-default) 1px, transparent 1px);background-size:1.25rem 1.25rem;min-height:36rem;position:relative;overflow:hidden}.crystra-bi .trace-tree-canvas-surface{cursor:pointer;touch-action:none;width:100%;height:100%;display:block;position:absolute;inset:0}.crystra-bi .trace-camera-map{z-index:2;width:9.5rem;padding:var(--space-tight);border:1px solid var(--border-strong);border-radius:var(--shape-control);background:var(--surface-base);position:absolute;inset-block-end:var(--space-grid);inset-inline-start:var(--space-grid)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-camera-map{background:color-mix(in srgb, var(--surface-base) 90%, transparent)}}.crystra-bi .trace-camera-map{cursor:crosshair;touch-action:none;-webkit-user-select:none;user-select:none}.crystra-bi .trace-camera-map>strong{color:var(--content-secondary);text-transform:uppercase}.crystra-bi .trace-camera-map-viewport{border-radius:calc(var(--shape-control) / 2);background:var(--surface-inset);height:5rem;margin-block-start:var(--space-tight);position:relative;overflow:hidden}.crystra-bi .trace-camera-map-viewport canvas{width:100%;height:100%;display:block}.crystra-bi .trace-camera-map-viewport>span{border:1px solid var(--interaction-accent);background:var(--interaction-accent);position:absolute}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-camera-map-viewport>span{background:color-mix(in srgb, var(--interaction-accent) 15%, transparent)}}.crystra-bi .trace-camera-map-viewport>span{pointer-events:none}.crystra-bi .trace-tree-outline{clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.crystra-bi .trace-tree-outline>div>button{justify-content:space-between;width:100%;display:flex}.crystra-bi .trace-statistics-summary{gap:var(--space-grid);grid-template-columns:repeat(4,minmax(0,1fr));margin:0;display:grid}.crystra-bi .trace-statistics-summary>div{min-width:0}.crystra-bi .trace-statistics-summary dt{color:var(--content-secondary)}.crystra-bi .trace-statistics-summary dd{margin:var(--space-grid) 0 0;font-size:var(--type-value-size)}@media (width<=64rem){.crystra-bi .trace-workbench{grid-template-columns:1fr}.crystra-bi .span-passport{display:none}.crystra-bi .trace-summary-dense{grid-template-columns:minmax(12rem,1fr) repeat(2,auto)}.crystra-bi .trace-summary-dense>span:nth-last-child(-n+2){display:none}}@media (width<=40rem){.crystra-bi .trace-summary-dense,.crystra-bi .trace-statistics-summary{grid-template-columns:1fr}.crystra-bi .trace-minimap,.crystra-bi .trace-waterfall-canvas,.crystra-bi .trace-tree-canvas-surface,.crystra-bi .trace-camera-map{display:none}.crystra-bi .trace-tree-canvas{min-height:auto}.crystra-bi .trace-tree-outline{clip-path:none;white-space:normal;width:auto;height:auto;position:static;overflow:visible}.crystra-bi .trace-tree-outline>div{min-width:0;min-height:var(--density-row);border-block-end:1px solid var(--border-default)}.crystra-bi .trace-tree-graph,.crystra-bi .trace-tree-canvas-shell,.crystra-bi .trace-tree-outline,.crystra-bi .trace-tree-outline>div>button,.crystra-bi .trace-tree-outline>div>button>span{min-width:0;max-width:100%}.crystra-bi .trace-tree-outline>div>button>span{overflow-wrap:anywhere}.crystra-bi .trace-view-tools input{order:2;width:100%;margin:0}}.crystra-bi .trace-view{gap:.75rem}.crystra-bi .trace-view button{border:1px solid var(--border-strong);border-radius:var(--shape-control);background:var(--surface-raised);min-height:2rem;color:var(--content-primary);font:inherit;font-size:var(--type-label-size);cursor:pointer;padding:0 .7rem}.crystra-bi .trace-view button[aria-pressed=true]{border-color:var(--interaction-accent);background:var(--interaction-selection)}.crystra-bi .trace-summary-dense{padding:.75rem .9rem}.crystra-bi .trace-summary-dense>div>strong{font-size:var(--type-heading-size);margin-block-start:.2rem;display:block}.crystra-bi .trace-node-label{padding-block:.35rem}.crystra-bi .trace-workbench{grid-template-columns:minmax(0,1fr) minmax(17rem,18.75rem);gap:.75rem}.crystra-bi .trace-tree-canvas-head{align-items:center;gap:var(--space-grid);border-block-end:1px solid var(--border-default);grid-template-columns:minmax(0,1fr) auto;min-height:3rem;padding:.45rem .75rem;display:grid}.crystra-bi .trace-tree-canvas-head>div:first-child{gap:.15rem;min-width:0;display:grid}.crystra-bi .trace-tree-canvas-head h2,.crystra-bi .trace-tree-canvas-head p{margin:0}.crystra-bi .trace-tree-canvas-head h2{font-size:var(--type-label-size)}.crystra-bi .trace-tree-canvas-head p{color:var(--content-muted);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-tree-canvas-head [role=group]{gap:var(--space-tight);display:flex}.crystra-bi .trace-tree-canvas-head button{min-height:1.65rem}.crystra-bi .trace-tree-actions{justify-self:end}.crystra-bi .trace-tree-actions .crystra-button[data-icon-button=true]:is(:hover,:focus-visible){border-color:var(--interaction-accent);background:var(--interaction-selection);color:var(--interaction-accent)}.crystra-bi .trace-tree-legend{border-block-end:1px solid var(--border-default);background:var(--surface-panel);min-height:2rem;color:var(--content-secondary);font-size:var(--type-caption-size);flex-wrap:wrap;align-items:center;gap:.4rem 1rem;margin:0;padding:.35rem .75rem;list-style:none;display:flex}.crystra-bi .trace-tree-legend li{white-space:nowrap;align-items:center;gap:.35rem;display:inline-flex}.crystra-bi .trace-tree-legend i{background:var(--data-series-1);border-radius:0 .25rem .25rem 0;flex:none;block-size:.45rem;inline-size:1rem;display:inline-block;position:relative}.crystra-bi .trace-tree-legend i[data-legend-kind=client]{background:var(--data-series-2)}.crystra-bi .trace-tree-legend i[data-legend-kind=error]{background:var(--status-error)}.crystra-bi .trace-tree-legend i[data-legend-kind=parent],.crystra-bi .trace-tree-legend i[data-legend-kind=link]{border-block-start:1px solid var(--content-secondary);background:0 0;border-radius:0;block-size:0}.crystra-bi .trace-tree-legend i[data-legend-kind=link]{border-block-start-style:dashed;border-block-start-color:var(--status-warning)}.crystra-bi .trace-tree-legend i[data-legend-kind=parent]:after,.crystra-bi .trace-tree-legend i[data-legend-kind=link]:after{content:"";border-block-start:1px solid;border-inline-end:1px solid;block-size:.3rem;inline-size:.3rem;position:absolute;inset-block-start:-.2rem;inset-inline-end:-.05rem;transform:rotate(45deg)}.crystra-bi .trace-tree-legend i[data-legend-kind=flow]{background:var(--interaction-accent);block-size:.4rem;inline-size:.4rem;box-shadow:0 0 .35rem var(--interaction-accent);border-radius:50%}.crystra-bi .trace-focus-receipt{border-inline-start:3px solid var(--interaction-accent);background:var(--interaction-accent)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-focus-receipt{background:color-mix(in srgb, var(--interaction-accent) 14%, var(--surface-panel))}}.crystra-bi .trace-passport-actions{gap:var(--space-tight);flex-wrap:wrap;display:flex}.crystra-bi .trace-waterfall-mobile{border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);overflow:hidden}.crystra-bi .trace-waterfall-mobile>header{border-block-end:1px solid var(--border-default);font-size:var(--type-label-size);text-transform:uppercase;padding:.65rem .75rem;font-weight:700}.crystra-bi .trace-waterfall-mobile [role=treeitem]{border-block-end:1px solid var(--border-default);min-width:0}.crystra-bi .trace-waterfall-mobile [role=treeitem]>button{text-align:start;background:0 0;border:0;border-radius:0;grid-template-columns:minmax(0,1fr) auto;width:100%;min-height:3rem;display:grid}.crystra-bi .trace-statistics-intro{border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);grid-template-columns:minmax(15rem,1fr) auto;align-items:center;gap:clamp(1rem,2.5vw,2.5rem);padding:.8rem .9rem;display:grid}.crystra-bi .trace-statistics-heading{gap:.2rem;min-width:0;display:grid}.crystra-bi .trace-statistics-intro h2,.crystra-bi .trace-statistics-intro p,.crystra-bi .trace-statistics-grid h3{margin:0}.crystra-bi .trace-statistics-intro h2{font-size:var(--type-heading-size)}.crystra-bi .trace-statistics-intro p{color:var(--content-secondary);font-size:var(--type-caption-size)}.crystra-bi .trace-statistics-intro .trace-statistics-summary{grid-template-columns:repeat(4,minmax(4.5rem,auto));align-items:center;gap:clamp(.8rem,1.8vw,1.75rem)}.crystra-bi .trace-statistics-summary>div{gap:.2rem;display:grid}.crystra-bi .trace-statistics-summary dt{font-size:var(--type-caption-size);white-space:nowrap}.crystra-bi .trace-statistics-summary dd{color:var(--content-primary);font-size:var(--type-heading-size);white-space:nowrap;margin:0;font-weight:650}.crystra-bi .trace-statistics-grid{gap:var(--space-grid);grid-template-columns:repeat(3,minmax(0,1fr));display:grid}.crystra-bi .trace-duration-distribution{grid-column:1/-1}.crystra-bi .trace-statistics-donut-layout{align-items:center;gap:var(--space-grid);grid-template-columns:minmax(7rem,.4fr) minmax(8rem,1fr);display:grid}.crystra-bi .trace-statistics-donut,.crystra-bi .trace-statistics-pie{width:min(100%,8rem);margin-inline:auto;display:block;overflow:visible}.crystra-bi .trace-statistics-pie-segment{fill:var(--trace-statistics-color);stroke:var(--surface-panel);stroke-width:.5px}.crystra-bi .trace-statistics-donut circle{fill:none;stroke-width:6px}.crystra-bi .trace-statistics-donut-track{stroke:var(--surface-inset)}.crystra-bi .trace-statistics-donut-segment{stroke:var(--trace-statistics-color);transform-origin:50%;transform:rotate(-90deg)}.crystra-bi .trace-statistics-donut text{fill:var(--content-primary);font:650 .42rem var(--type-code-family);text-anchor:middle}.crystra-bi .trace-statistics-donut .trace-statistics-donut-caption{fill:var(--content-muted);text-transform:uppercase;font-size:.22rem;font-weight:500}.crystra-bi .trace-statistics-legend{gap:.55rem;margin:0;padding:0;list-style:none;display:grid}.crystra-bi .trace-statistics-legend li{grid-template-columns:.55rem minmax(0,1fr) auto;align-items:center;gap:.45rem;display:grid}.crystra-bi .trace-statistics-legend li>i{background:var(--trace-statistics-color);border-radius:50%;width:.55rem;height:.55rem}.crystra-bi .crystra-typography.trace-statistics-value.trace-statistics-color{color:var(--trace-statistics-color)}.crystra-bi .trace-statistics-color,.crystra-bi .trace-statistics-color[data-color-index="0"]{--trace-statistics-color:var(--data-series-1)}.crystra-bi .trace-statistics-color[data-color-index="1"]{--trace-statistics-color:var(--data-series-2)}.crystra-bi .trace-statistics-color[data-color-index="2"]{--trace-statistics-color:var(--data-series-3)}.crystra-bi .trace-statistics-color[data-color-index="3"]{--trace-statistics-color:var(--data-series-4)}.crystra-bi .trace-statistics-color[data-color-index="4"]{--trace-statistics-color:var(--data-series-5)}.crystra-bi .trace-statistics-color[data-color-index="5"]{--trace-statistics-color:var(--data-series-6)}.crystra-bi .trace-statistics-color[data-category=status-ok]{--trace-statistics-color:var(--status-available)}.crystra-bi .trace-statistics-color[data-category=status-error]{--trace-statistics-color:var(--status-error)}.crystra-bi .trace-statistics-color[data-category=status-unset]{--trace-statistics-color:var(--status-unavailable)}.crystra-bi .trace-statistics-kind-bars{align-content:center;align-items:center;gap:var(--space-cluster);flex:1;grid-template-columns:minmax(4.5rem,auto) minmax(0,1fr);min-width:0;display:grid}.crystra-bi .trace-statistics-kind-bar-row{display:contents}.crystra-bi .trace-statistics-kind-bar-track{border-radius:var(--shape-control);background:var(--surface-inset);height:2rem;overflow:hidden}.crystra-bi .trace-statistics-kind-bar-fill{min-width:2rem;height:100%;padding-inline:var(--space-tight);border-radius:var(--shape-control);background:var(--trace-statistics-color);color:var(--content-inverse);justify-content:flex-end;align-items:center;display:flex;overflow:hidden}.crystra-bi .trace-statistics-kind-bar-fill>span{font:650 var(--type-caption-size) var(--type-code-family);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-duration-distribution-body{align-items:start;gap:var(--space-grid);grid-template-columns:minmax(0,1.2fr) minmax(15rem,.8fr);display:grid}.crystra-bi .trace-duration-breakdowns{gap:var(--space-grid);border-inline-start:1px solid var(--border-default);grid-template-columns:repeat(2,minmax(0,1fr));padding-inline-start:var(--space-grid);display:grid}.crystra-bi .trace-duration-breakdown{gap:var(--space-tight);min-width:0;display:grid}.crystra-bi .trace-duration-breakdown-title{color:var(--trace-statistics-color);margin:0}.crystra-bi .trace-duration-breakdown .trace-statistics-donut-layout{gap:var(--space-tight);grid-template-columns:4.75rem minmax(0,1fr)}.crystra-bi .trace-duration-breakdown .trace-statistics-donut{width:4.75rem}.crystra-bi .trace-duration-breakdown .trace-statistics-legend{gap:var(--space-tight)}.crystra-bi .trace-duration-breakdown .trace-statistics-legend li{gap:var(--space-tight);grid-template-columns:.45rem minmax(0,1fr) auto}.crystra-bi .trace-duration-breakdown .trace-statistics-legend li>i{width:.45rem;height:.45rem}.crystra-bi .trace-duration-breakdown .trace-statistics-legend .crystra-typography{font-size:var(--type-caption-size)}.crystra-bi .trace-duration-chart{align-items:end;gap:var(--space-cluster);grid-template-columns:repeat(auto-fit,minmax(5rem,1fr));min-width:0;padding-block-start:.35rem;display:grid}.crystra-bi .trace-duration-column{gap:var(--space-tight);text-align:center;grid-template-rows:11rem minmax(2.5rem,auto);min-width:0;display:grid}.crystra-bi .trace-duration-column-plot{border-block-end:1px solid var(--border-default);justify-content:center;align-items:flex-end;min-width:0;height:11rem;display:flex}.crystra-bi .trace-duration-column-fill{width:min(100%,4.5rem);min-height:1.75rem;padding:var(--space-tight) .2rem;border-radius:var(--shape-control) var(--shape-control) 0 0;background:var(--trace-statistics-color);color:var(--content-inverse);justify-content:center;align-items:flex-start;display:flex;overflow:hidden}.crystra-bi .trace-duration-column-fill>span{font:650 var(--type-caption-size) var(--type-code-family);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-duration-column-label{min-width:0;color:var(--content-secondary);text-overflow:ellipsis;overflow:hidden}@media (width<=64rem){.crystra-bi .trace-workbench{grid-template-columns:1fr}.crystra-bi .trace-statistics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.crystra-bi .trace-duration-distribution-body{grid-template-columns:1fr}.crystra-bi .trace-duration-breakdowns{border-block-start:1px solid var(--border-default);border-inline-start:0;padding-block-start:var(--space-grid);padding-inline-start:0}}@media (width<=40rem){.crystra-bi,.crystra-bi .trace-view,.crystra-bi .trace-view>*{inline-size:100%;min-inline-size:0;max-inline-size:100%}.crystra-bi .trace-view{overflow:hidden}.crystra-bi .trace-tree-context,.crystra-bi .trace-tree-canvas-head{grid-template-columns:1fr}.crystra-bi .trace-tree-canvas-head p{display:none}.crystra-bi .trace-tree-outline>div>button{gap:var(--space-tight);background:0 0;border:0;border-radius:0;grid-template-columns:minmax(0,1fr) auto;min-height:3rem;display:grid}.crystra-bi .trace-statistics-grid,.crystra-bi .trace-statistics-intro{grid-template-columns:1fr}.crystra-bi .trace-statistics-intro .trace-statistics-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.crystra-bi .trace-duration-distribution{grid-column:auto}.crystra-bi .trace-statistics-donut-layout{grid-template-columns:minmax(6rem,.35fr) minmax(8rem,1fr)}.crystra-bi .trace-duration-breakdowns{grid-template-columns:1fr}}.crystra-bi .trace-summary-dense{grid-template-columns:minmax(16rem,1fr) auto;padding:.75rem .9rem}.crystra-bi .trace-summary-identity{gap:.18rem;min-width:0;display:grid}.crystra-bi .trace-summary-identity>strong{font-size:var(--type-heading-size)}.crystra-bi .trace-summary-identity>code{color:var(--content-muted);font:var(--type-caption-size) var(--type-code-family);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-summary-metrics{justify-content:flex-end;align-items:center;gap:clamp(1rem,2.4vw,2.25rem);display:flex}.crystra-bi .trace-summary-stat{gap:.2rem;min-width:4rem;display:grid}.crystra-bi .trace-summary-stat small{color:var(--content-muted);font-size:var(--type-caption-size)}.crystra-bi .trace-summary-stat strong{color:var(--content-primary);font:650 var(--type-heading-size) var(--type-code-family)}.crystra-bi .trace-summary-stat>.crystra-typography{font-size:var(--type-heading-size)}.crystra-bi .trace-summary-stat[data-tone=error] strong{color:var(--status-error)}.crystra-bi .trace-summary-stat[data-tone=success] strong{color:var(--status-available)}.crystra-bi .trace-view-header{align-items:center;gap:var(--space-grid);border:1px solid var(--border-default);border-radius:var(--shape-panel);background:var(--surface-panel);flex-direction:row;min-width:0;padding:.75rem .9rem;display:flex}.crystra-bi .trace-view-header-copy{flex-direction:column;flex:0 auto;gap:.2rem;min-width:14rem;display:flex}.crystra-bi .trace-view-header-spacer{min-width:var(--space-grid);flex:auto}.crystra-bi .trace-view-header-metrics{flex-direction:row;flex:none;align-items:center;gap:clamp(1rem,2.4vw,2.25rem);min-width:0;margin:0;display:flex}.crystra-bi .trace-view-header-stat{flex-direction:column;gap:.2rem;min-width:4rem;display:flex}.crystra-bi .trace-view-header-copy>.crystra-typography[data-variant=overline]{color:var(--content-secondary);font-size:var(--type-overline-size);font-weight:700}.crystra-bi .trace-view-header-copy>.crystra-typography[data-variant=caption]{color:var(--content-muted);font-size:var(--type-caption-size);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-view-header-stat>.crystra-typography[data-variant=caption]{color:var(--content-muted);font-size:var(--type-caption-size);white-space:nowrap}.crystra-bi .trace-view-header-stat>.crystra-typography[data-variant=h2]{color:var(--content-primary);font-size:var(--type-heading-size);white-space:nowrap;margin:0;font-weight:650}.crystra-bi .trace-minimap{grid-template-columns:minmax(8rem,10rem) minmax(25rem,1fr);align-items:stretch;gap:0;min-height:3.25rem;padding:0}.crystra-bi .trace-minimap-copy{border-inline-end:1px solid var(--border-default);background:var(--surface-panel);align-content:center;gap:.15rem;padding-inline:.85rem;display:grid}.crystra-bi .trace-minimap-copy>strong{font-size:var(--type-label-size)}.crystra-bi .trace-minimap-copy>small{color:var(--content-muted);font-size:var(--type-caption-size)}.crystra-bi .trace-minimap-track{background:var(--surface-inset);cursor:crosshair;touch-action:none;border:0;border-radius:0;min-height:3.25rem;overflow:hidden}.crystra-bi .trace-minimap-overview{z-index:1;pointer-events:none;width:100%;height:calc(100% - 1.25rem);position:absolute;inset:.25rem 0 1rem;overflow:hidden}.crystra-bi .trace-minimap-overview .trace-minimap-span{--trace-waterfall-color:var(--data-series-1);stroke:var(--trace-waterfall-color)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-overview .trace-minimap-span{stroke:color-mix(in srgb, var(--trace-waterfall-color) 45%, var(--surface-panel))}}.crystra-bi .trace-minimap-overview .trace-minimap-span{stroke-linecap:round;vector-effect:non-scaling-stroke}.crystra-bi .trace-minimap-overview .trace-minimap-span[data-color-index="1"]{--trace-waterfall-color:var(--data-series-2)}.crystra-bi .trace-minimap-overview .trace-minimap-span[data-color-index="2"]{--trace-waterfall-color:var(--data-series-3)}.crystra-bi .trace-minimap-overview .trace-minimap-span[data-color-index="3"]{--trace-waterfall-color:var(--data-series-4)}.crystra-bi .trace-minimap-overview .trace-minimap-span[data-color-index="4"]{--trace-waterfall-color:var(--data-series-5)}.crystra-bi .trace-minimap-overview .trace-minimap-span[data-color-index="5"]{--trace-waterfall-color:var(--data-series-6)}.crystra-bi .trace-minimap-overview .trace-minimap-span.trace-status-error{stroke:var(--status-error)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-overview .trace-minimap-span.trace-status-error{stroke:color-mix(in srgb, var(--status-error) 35%, var(--surface-panel))}}.crystra-bi .trace-minimap-ruler{z-index:3;pointer-events:none;position:absolute;inset:0}.crystra-bi .trace-minimap-ruler>span{background:var(--surface-inset);padding-inline:.15rem;position:absolute;inset-block-end:.18rem}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-ruler>span{background:color-mix(in srgb, var(--surface-inset) 86%, transparent)}}.crystra-bi .trace-minimap-ruler>span{color:var(--content-muted);font:normal var(--type-caption-size) var(--type-code-family);white-space:nowrap;line-height:1.2;transform:translate(-50%)}.crystra-bi .trace-minimap-ruler>span:before{border-inline-start:1px solid var(--border-strong);content:"";height:.24rem;position:absolute;inset-block-end:calc(100% + .08rem);inset-inline-start:50%}.crystra-bi .trace-minimap-ruler>span:first-child{transform:none}.crystra-bi .trace-minimap-ruler>span:first-child:before{inset-inline-start:0}.crystra-bi .trace-minimap-ruler>span:last-child{transform:translate(-100%)}.crystra-bi .trace-minimap-ruler>span:last-child:before{inset-inline-start:100%}.crystra-bi .trace-minimap-window{z-index:2;border-block:1px solid var(--status-warning);min-width:2px;position:absolute;inset-block:.25rem}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-window{border-block:1px solid color-mix(in srgb, var(--status-warning) 82%, transparent)}}.crystra-bi .trace-minimap-window{background:var(--status-warning)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-window{background:color-mix(in srgb, var(--status-warning) 14%, transparent)}}.crystra-bi .trace-minimap-window{box-shadow:inset 0 0 0 1px var(--status-warning)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-minimap-window{box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--status-warning) 28%, transparent)}}.crystra-bi .trace-minimap-window{cursor:grab}.crystra-bi .trace-minimap-resize-handle{z-index:1;cursor:ew-resize;pointer-events:auto;width:.75rem;position:absolute;inset-block:0}.crystra-bi .trace-minimap-resize-handle:before{background:var(--status-warning);content:"";border-radius:99px;width:2px;position:absolute;inset-block:28%;inset-inline-start:calc(50% - 1px)}.crystra-bi .trace-minimap-resize-handle[data-edge=left]{inset-inline-start:-.375rem}.crystra-bi .trace-minimap-resize-handle[data-edge=right]{inset-inline-end:-.375rem}.crystra-bi .trace-minimap-window[data-full=true]{pointer-events:none;background:0 0;border:0}.crystra-bi .trace-waterfall-toolbar{align-items:center;gap:var(--space-grid);border-block-end:1px solid var(--border-default);grid-template-columns:minmax(7rem,1fr) minmax(15rem,21rem) minmax(7rem,1fr);min-height:3rem;padding:.45rem .75rem;display:grid}.crystra-bi .trace-waterfall-heading,.crystra-bi .trace-waterfall-actions{align-items:center;gap:var(--space-tight);display:flex}.crystra-bi .trace-waterfall-actions{justify-self:end}.crystra-bi .trace-waterfall-heading>strong{font-size:var(--type-label-size);margin-inline-end:.4rem}.crystra-bi .trace-waterfall-actions button{min-height:1.65rem}.crystra-bi .trace-waterfall-actions .crystra-button[data-icon-button=true]:is(:hover,:focus-visible){border-color:var(--interaction-accent);background:var(--interaction-selection);color:var(--interaction-accent)}.crystra-bi .trace-waterfall-toolbar input{width:100%;min-height:2rem}.crystra-bi .trace-waterfall-table{grid-template-columns:minmax(16rem,19rem) minmax(0,1fr);align-items:start;min-width:0;display:grid}.crystra-bi .trace-waterfall-label-pane{border-inline-end:1px solid var(--border-strong);min-width:0}.crystra-bi .trace-waterfall-column-head{border-block-end:1px solid var(--border-default);height:2rem;color:var(--content-secondary);font-size:var(--type-caption-size);text-transform:uppercase;align-items:center;padding-inline:.85rem;font-weight:700;display:flex}.crystra-bi .trace-waterfall-label-rows{flex-direction:column;min-width:0;display:flex;position:absolute;inset-block-start:0;inset-inline:0}.crystra-bi .trace-waterfall-scroll-viewport{overscroll-behavior:contain;scrollbar-gutter:stable;overflow:hidden auto}.crystra-bi .trace-waterfall-scroll-space{min-width:0;position:relative}.crystra-bi .trace-waterfall-row{cursor:pointer;align-items:stretch;height:3rem;min-height:3rem;display:flex}.crystra-bi .trace-node-label{align-items:stretch;gap:.3rem;width:100%;min-width:0;padding:0 .65rem 0 0;display:flex}.crystra-bi .trace-indent-items{flex:none;align-self:stretch;display:flex}.crystra-bi .trace-indent-item{--trace-indent-color:var(--data-series-1);background:var(--trace-indent-color);width:.65rem;display:block}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-indent-item{background:color-mix(in srgb, var(--trace-indent-color) 24%, transparent)}}.crystra-bi .trace-indent-item[data-guide-depth="1"]{--trace-indent-color:var(--data-series-2)}.crystra-bi .trace-indent-item[data-guide-depth="2"]{--trace-indent-color:var(--data-series-3)}.crystra-bi .trace-indent-item[data-guide-depth="3"]{--trace-indent-color:var(--data-series-4)}.crystra-bi .trace-indent-item[data-guide-depth="4"]{--trace-indent-color:var(--data-series-5)}.crystra-bi .trace-indent-item[data-guide-depth="5"]{--trace-indent-color:var(--data-series-6)}.crystra-bi .trace-collapse-control,.crystra-bi .trace-collapse-placeholder{align-self:center;width:1.25rem;height:1.25rem}.crystra-bi .trace-view .trace-collapse-control{min-height:0;color:var(--content-secondary);background:0 0;border:0;place-items:center;padding:0;font-size:1rem;display:grid}.crystra-bi .trace-view .trace-node-main{text-align:start;background:0 0;border:0;border-radius:0;flex:auto;align-content:center;gap:.15rem;min-width:0;min-height:0;padding:0;display:grid}.crystra-bi .trace-node-title-line{align-items:center;gap:.4rem;min-width:0;display:flex}.crystra-bi .trace-node-title-line>strong{font-size:var(--type-label-size);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.crystra-bi .trace-node-main>small{color:var(--content-muted);font:var(--type-caption-size) var(--type-code-family);text-overflow:ellipsis;white-space:nowrap;padding-inline-start:0;overflow:hidden}.crystra-bi .trace-waterfall-row{border-block-end:0}.crystra-bi .trace-waterfall-row:nth-child(2n){background:var(--surface-raised)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-waterfall-row:nth-child(2n){background:color-mix(in srgb, var(--surface-raised) 42%, var(--surface-panel))}}.crystra-bi .trace-waterfall-row.is-selected{background:var(--interaction-selection)}.crystra-bi .trace-waterfall-chart{background:var(--surface-inset);min-width:0;display:block;overflow:hidden}.crystra-bi .trace-waterfall-axis-line,.crystra-bi .trace-waterfall-gridline{stroke:var(--border-strong);stroke-width:1px;vector-effect:non-scaling-stroke}.crystra-bi .trace-waterfall-gridline{opacity:.64}.crystra-bi .trace-waterfall-axis-tick{pointer-events:none}.crystra-bi .trace-waterfall-axis-tick text{fill:var(--content-muted);font:normal var(--type-caption-size) var(--type-code-family)}.crystra-bi .trace-waterfall-lane{cursor:pointer;outline:none}.crystra-bi .trace-waterfall-lane-hit-target{fill:#0000}.crystra-bi .trace-waterfall-lane[data-selected=true] .trace-waterfall-lane-hit-target{fill:var(--interaction-selection)}.crystra-bi .trace-waterfall-lane:focus-visible .trace-waterfall-lane-hit-target{stroke:var(--focus-ring);stroke-width:2px;vector-effect:non-scaling-stroke}.crystra-bi .trace-waterfall-chart .trace-timeline-bar{--trace-waterfall-color:var(--data-series-1);fill:var(--trace-waterfall-color)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-waterfall-chart .trace-timeline-bar{fill:color-mix(in srgb, var(--trace-waterfall-color) 45%, var(--surface-panel))}}.crystra-bi .trace-waterfall-chart .trace-timeline-bar{stroke:var(--trace-waterfall-color);stroke-width:1px;vector-effect:non-scaling-stroke}.crystra-bi .trace-waterfall-chart .trace-timeline-bar[data-color-index="1"]{--trace-waterfall-color:var(--data-series-2)}.crystra-bi .trace-waterfall-chart .trace-timeline-bar[data-color-index="2"]{--trace-waterfall-color:var(--data-series-3)}.crystra-bi .trace-waterfall-chart .trace-timeline-bar[data-color-index="3"]{--trace-waterfall-color:var(--data-series-4)}.crystra-bi .trace-waterfall-chart .trace-timeline-bar[data-color-index="4"]{--trace-waterfall-color:var(--data-series-5)}.crystra-bi .trace-waterfall-chart .trace-timeline-bar[data-color-index="5"]{--trace-waterfall-color:var(--data-series-6)}.crystra-bi .trace-waterfall-chart .trace-timeline-bar.trace-status-error{fill:var(--status-error)}@supports (color:color-mix(in lab, red, red)){.crystra-bi .trace-waterfall-chart .trace-timeline-bar.trace-status-error{fill:color-mix(in srgb, var(--status-error) 35%, var(--surface-panel))}}.crystra-bi .trace-waterfall-chart .trace-timeline-bar.trace-status-error{stroke:var(--status-error)}.crystra-bi .trace-waterfall-lane[data-selected=true] .trace-timeline-bar{stroke-width:2px}.crystra-bi .trace-waterfall-chart .trace-timeline-label{fill:var(--content-primary);font-size:var(--type-label-size);pointer-events:none;font-weight:650}.crystra-bi :is(.trace-waterfall-timeline,.trace-timeline-label)[data-motion-phase]{transform-box:fill-box;transform-origin:50%;animation-duration:.28s;animation-timing-function:cubic-bezier(.22,1,.36,1);animation-fill-mode:both}.crystra-bi :is(.trace-waterfall-timeline,.trace-timeline-label)[data-motion-phase=enter][data-motion-direction=right]{animation-name:trace-timeline-enter-right}.crystra-bi :is(.trace-waterfall-timeline,.trace-timeline-label)[data-motion-phase=enter][data-motion-direction=left]{animation-name:trace-timeline-enter-left}.crystra-bi :is(.trace-waterfall-timeline,.trace-timeline-label)[data-motion-phase=exit][data-motion-direction=right]{animation-name:trace-timeline-exit-right}.crystra-bi :is(.trace-waterfall-timeline,.trace-timeline-label)[data-motion-phase=exit][data-motion-direction=left]{animation-name:trace-timeline-exit-left}.crystra-bi[data-motion=off] :is(.trace-waterfall-timeline,.trace-timeline-label){animation:none}@keyframes trace-timeline-enter-right{0%{opacity:0;transform:translate(-1.5rem)}to{opacity:1;transform:translate(0)}}@keyframes trace-timeline-enter-left{0%{opacity:0;transform:translate(1.5rem)}to{opacity:1;transform:translate(0)}}@keyframes trace-timeline-exit-right{0%{opacity:1;transform:translate(0)}to{opacity:0;transform:translate(1.5rem)}}@keyframes trace-timeline-exit-left{0%{opacity:1;transform:translate(0)}to{opacity:0;transform:translate(-1.5rem)}}.crystra-bi .trace-node-label>.numeric-exact,.crystra-bi .trace-node-label>.trace-error{font-size:var(--type-caption-size);align-self:center}@media (width<=64rem){.crystra-bi .trace-summary-dense{grid-template-columns:1fr}.crystra-bi .trace-summary-metrics{justify-content:flex-start}}@media (width<=40rem){.crystra-bi .trace-summary-metrics{grid-template-columns:repeat(2,minmax(0,1fr));display:grid}.crystra-bi .trace-minimap{display:none}.crystra-bi .trace-waterfall-toolbar{grid-template-columns:1fr}.crystra-bi .trace-waterfall-actions{justify-self:start}}.crystra-bi .trace-waterfall-main{gap:var(--space-grid);flex-direction:column;min-width:0;min-height:0;display:flex}.crystra-bi .trace-minimap-track{margin-inline-end:var(--component-trace-zoom-inset);margin-block:var(--component-trace-zoom-inset)}.comparison-widget .comparison-values{grid-template-columns:1fr 1fr 1.15fr;align-items:start;gap:16px;display:grid}.comparison-widget .comparison-value{flex-direction:column;gap:4px;min-width:0;display:flex}.comparison-widget .comparison-label{color:var(--color-text-secondary,#aaa);white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:18px;overflow:hidden}.comparison-widget .comparison-number{white-space:nowrap;text-overflow:ellipsis;max-width:100%;font-size:24px;font-weight:400;line-height:32px;display:block;overflow:hidden}.comparison-widget .comparison-number small{font-size:12px}.comparison-widget .comparison-change{border-left:1px solid var(--color-border-default,#424242);color:var(--color-interaction-primary,#679efe);padding-left:16px}.comparison-widget .comparison-actions,.comparison-widget .comparison-side-actions{align-items:center;gap:4px;display:flex}.comparison-widget .comparison-side-actions+.comparison-side-actions{border-left:1px solid var(--color-border-default,#424242);padding-left:4px}.comparison-widget .crystra-monitoring-widget-footer{font-size:11px}.comparison-widget{--comparison-up:var(--color-status-error-solid,#ef4444);--comparison-down:var(--color-status-success-solid,#22c55e)}.comparison-widget .comparison-delta-number{align-items:center;gap:4px;display:flex}.comparison-widget .comparison-direction{flex-shrink:0}.comparison-widget .comparison-direction[data-direction=INCREASE]{color:var(--comparison-up)}.comparison-widget .comparison-direction[data-direction=DECREASE]{color:var(--comparison-down)}.comparison-widget .comparison-direction[data-direction=NO_CHANGE]{color:var(--color-text-secondary,#aaa)}.crystra-monitoring-widget:not([data-host-owned],[data-host-owned] *){box-sizing:border-box;background:var(--crystra-widget-surface,var(--color-background-card,#232323));color:var(--crystra-widget-text,var(--color-text-primary,#eee));border:1px solid var(--crystra-widget-border,var(--color-border-default,#424242));border-radius:12px;flex-direction:column;flex-shrink:0;gap:12px;padding:12px;font:14px/1.5 system-ui,sans-serif;display:flex;overflow:hidden}.crystra-monitoring-widget-header:not([data-host-owned],[data-host-owned] *),.crystra-monitoring-widget-footer:not([data-host-owned],[data-host-owned] *){flex-shrink:0;justify-content:space-between;align-items:center;gap:8px;min-width:0;display:flex}.crystra-monitoring-widget-header>div:not([data-host-owned],[data-host-owned] *){min-width:0}.crystra-monitoring-widget-title:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-widget-title-size,14px);line-height:var(--crystra-widget-title-line,20px);font-weight:var(--crystra-widget-title-weight,400)}.crystra-monitoring-widget-subtitle:not([data-host-owned],[data-host-owned] *){color:var(--crystra-widget-secondary,var(--color-text-secondary,#aaa));font-size:12px}.crystra-monitoring-widget-content:not([data-host-owned],[data-host-owned] *){flex-direction:column;flex:1;justify-content:center;gap:12px;min-width:0;min-height:0;display:flex}.crystra-monitoring-widget-footer:not([data-host-owned],[data-host-owned] *){color:var(--crystra-widget-muted,var(--color-text-muted,#888));font-size:12px}.crystra-monitoring-widget[data-size="1x1"] .crystra-monitoring-widget-content:not([data-host-owned],[data-host-owned] *){text-align:center}.crystra-widget-tooltip{z-index:10000;box-sizing:border-box;color:#f9fafb;overflow-wrap:anywhere;white-space:normal;background:#353638;border:1px solid #ffffff29;border-radius:8px;width:max-content;max-width:min(320px,100vw - 16px);padding:8px 12px;font:12px/18px system-ui,sans-serif;position:fixed;top:8px;left:8px;box-shadow:0 8px 24px #0005}.crystra-bi .crystra-search-field{flex-direction:column;gap:8px;width:100%;min-width:0;display:flex}.crystra-bi .crystra-search-surface{color:#a4a4ab;cursor:text;background:#29292c;border:1px solid #ffffff0f;border-radius:12px;align-items:center;gap:8px;min-height:40px;padding:0 12px;transition:background-color .16s,box-shadow .16s,color .16s;display:flex;box-shadow:0 4px 12px #00000005,0 2px 8px #0000000a}.crystra-bi .crystra-search-field[data-size=compact] .crystra-search-surface{min-height:36px}.crystra-bi .crystra-search-field:not([data-disabled]) .crystra-search-surface:hover{background:#303034}.crystra-bi .crystra-search-field:not([data-disabled]) .crystra-search-surface:focus-within{color:#f0f0f3;background:#3b3b40;box-shadow:0 4px 12px #00000014,0 2px 8px #00000014}.crystra-bi .crystra-search-surface>input,.crystra-bi .crystra-search-surface>input:is(:focus,:focus-visible){appearance:none;width:100%;min-width:0;height:34px;box-shadow:none;color:#f4f4f5;font:inherit;caret-color:#f4f4f5;background:0 0;border:0;border-radius:0;outline:none;flex:1;padding:0;font-size:14px;line-height:20px}.crystra-bi .crystra-search-surface input::placeholder{color:#a4a4ab;opacity:1}.crystra-bi .crystra-search-leading{flex:0 auto;align-items:center;min-width:0;max-width:45%;font-size:12px;display:flex;overflow:hidden}.crystra-bi .crystra-search-field[data-disabled]{opacity:.45}.crystra-bi .crystra-search-field[data-disabled] .crystra-search-surface{cursor:not-allowed}@media (prefers-reduced-motion:reduce){.crystra-bi .crystra-search-surface{transition:none}}.crystra-bi .crystra-expandable-search{--search-motion:.34s cubic-bezier(.22, 1, .36, 1);width:100%;height:38px;position:relative}.crystra-bi .crystra-expandable-search-title{color:#a4a4ab;transition:opacity var(--search-motion), transform var(--search-motion);background:#ffffff06;border-radius:8px;align-items:center;gap:6px;padding:0 12px;font-size:11px;font-weight:600;display:flex;position:absolute;inset:0}.crystra-bi .crystra-expandable-search-content{clip-path:inset(0 0 0 calc(100% - 36px) round 12px);opacity:0;transition:clip-path var(--search-motion), opacity var(--search-motion)}.crystra-bi .crystra-expandable-search[data-open=true] .crystra-expandable-search-content{clip-path:inset(-12px round 12px);opacity:1}.crystra-bi .crystra-expandable-search[data-open=true] .crystra-expandable-search-title{opacity:0;pointer-events:none;transform:translate(-8px)}.crystra-bi .crystra-expandable-search-spacer{visibility:hidden;align-items:center;min-width:14px;min-height:14px;display:flex}.crystra-bi .crystra-expandable-search-trigger{transition:left var(--search-motion), transform var(--search-motion), color .16s ease;position:absolute;top:5px;left:calc(100% - 4px);transform:translate(-100%)}.crystra-bi .crystra-expandable-search[data-open=true] .crystra-expandable-search-trigger{left:6px;transform:translate(0)}.crystra-bi .crystra-search-dismiss,.crystra-bi .crystra-expandable-search-trigger{width:28px;height:28px;box-shadow:none;color:#a4a4ab;cursor:pointer;background:0 0;border:0;outline:none;flex-shrink:0;place-items:center;padding:0;display:grid}.crystra-bi .crystra-search-dismiss:is(:hover,:focus-visible),.crystra-bi .crystra-expandable-search-trigger:is(:hover,:focus-visible){box-shadow:none;color:#fff;background:0 0;border:0;outline:none}.crystra-bi .crystra-search-dismiss:focus-visible svg,.crystra-bi .crystra-expandable-search-trigger:focus-visible svg{stroke-width:2.5px}.crystra-bi .crystra-expandable-search[data-open=true]:focus-within .crystra-expandable-search-trigger{color:#f0f0f3}@media (prefers-reduced-motion:reduce){.crystra-bi .crystra-expandable-search{--search-motion:0s}}.crystra-bi .crystra-expandable-search[data-disabled] .crystra-expandable-search-trigger{opacity:.45;cursor:not-allowed}:root.crystra-bi[data-palette] .crystra-search-surface{border-color:#ffffff0f!important}:root.crystra-bi[data-palette] .crystra-search-surface>input{border:0!important}.crystra-bi .crystra-expandable-search-trigger{width:max-content;min-width:28px;font:inherit;padding-inline:7px;font-size:12px}.crystra-bi .crystra-search-leading .crystra-field[data-appearance=embedded]{gap:0;width:auto;margin:0;display:flex}.crystra-bi .crystra-field[data-appearance=embedded] select,.crystra-bi .crystra-field[data-appearance=embedded] select:is(:hover,:focus,:focus-visible){width:auto;min-width:0;height:30px;min-height:0;color:inherit;cursor:pointer;border-radius:0;outline:none;padding:0 20px 0 0;font-size:12px;box-shadow:none!important;background:0 0!important;border:0!important}.crystra-bi .crystra-field[data-appearance=embedded] select:focus-visible{color:var(--color-text-primary,#fff)}.crystra-bi[data-crystra-theme=dark] .crystra-field[data-appearance=embedded] select::picker-icon{content:"";color:#a4a4ab;border-bottom:1.5px solid;border-right:1.5px solid;flex-shrink:0;align-self:center;width:7px;height:7px;margin-inline:auto 2px;transition:transform .22s,color .16s;transform:translateY(-2px)rotate(45deg)}.crystra-bi[data-crystra-theme=dark] .crystra-field[data-appearance=embedded] select:is(:hover,:focus-visible)::picker-icon{color:#f0f0f3}.crystra-bi[data-crystra-theme=dark] .crystra-field[data-appearance=embedded] select:open::picker-icon{transform:translateY(2px)rotate(225deg)}@media (prefers-reduced-motion:reduce){.crystra-bi .crystra-field[data-appearance=embedded] select::picker-icon{transition:none}}.crystra-bi .crystra-search-leading:has(.crystra-field[data-appearance=embedded]){gap:8px}.crystra-bi .crystra-search-leading:has(.crystra-field[data-appearance=embedded]):after{content:"";background:#ffffff18;flex-shrink:0;width:1px;height:16px}.crystra-bi .crystra-search-leading .crystra-field[data-appearance=embedded]{flex:1;min-width:0}.crystra-bi .crystra-search-leading .crystra-field[data-appearance=embedded] select{white-space:nowrap;gap:4px;width:100%;padding-inline:0!important}.crystra-bi .crystra-search-leading>*{min-width:0;max-width:100%}.crystra-bi[data-crystra-theme=dark] select:not([multiple]):not([data-host-owned] *){appearance:base-select}.crystra-bi[data-crystra-theme=dark] select:not([multiple]):not([data-host-owned] *)::picker(select){appearance:base-select}.crystra-bi[data-crystra-theme=dark] select:not([multiple]):not([data-host-owned] *)::picker(select){position-area:block-end span-inline-end;position-try-fallbacks:none;position-try-order:normal;max-block-size:-webkit-fill-available;max-block-size:-moz-available;max-block-size:stretch;min-inline-size:anchor-size(self-inline);border:1px solid var(--color-border-strong,#ffffff29);background:var(--color-background-floating,#353638);color:var(--color-text-primary,#f9fafb);border-radius:8px;place-self:start;margin:4px 8px 8px 0;padding:4px;inset:auto;overflow-y:auto;box-shadow:0 8px 24px #0006}.crystra-bi[data-crystra-theme=dark] select:not([multiple]):not([data-host-owned] *) option{min-height:32px;font:inherit;border-radius:4px;padding:8px 12px}.crystra-bi[data-crystra-theme=dark] select:not([multiple]):not([data-host-owned] *) option:checked{color:var(--color-interaction-primary,#679efe);background:var(--color-interaction-selected,#679efe1f)}.crystra-bi[data-crystra-theme=dark] select[data-menu-placement=top]:not([multiple]):not([data-host-owned] *)::picker(select){position-area:block-start span-inline-end;position-try-fallbacks:flip-block;align-self:end;margin:8px 8px 4px 0}.monitoring-metric .monitoring-title:not([data-host-owned],[data-host-owned] *){-webkit-line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.monitoring-signal:not([data-host-owned],[data-host-owned] *){font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap;font-size:32px;font-weight:600;line-height:1.2;overflow:hidden}.monitoring-empty:not([data-host-owned],[data-host-owned] *){color:var(--color-text-muted,#aaa);font-size:18px}.monitoring-truth:not([data-host-owned],[data-host-owned] *){text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:10px;display:block;overflow:hidden}.monitoring-metric .crystra-monitoring-widget-footer>span:not([data-host-owned],[data-host-owned] *){min-width:0}.monitoring-ratio:not([data-host-owned],[data-host-owned] *){background:var(--color-background-inset,#414141);border-radius:4px;flex-shrink:0;height:6px;overflow:hidden}.monitoring-ratio i:not([data-host-owned],[data-host-owned] *){background:var(--color-interaction-primary,#6698ff);height:100%;display:block}.monitoring-records:not([data-host-owned],[data-host-owned] *){flex:1;min-height:0;font-size:12px;overflow:auto}.monitoring-records table:not([data-host-owned],[data-host-owned] *){border-collapse:collapse;width:100%}.monitoring-records th:not([data-host-owned],[data-host-owned] *),.monitoring-records td:not([data-host-owned],[data-host-owned] *){border-bottom:1px solid var(--color-border-default,#424242);text-align:left;padding:8px}.monitoring-bi .monitoring-row:not([data-host-owned],[data-host-owned] *){flex-wrap:wrap;align-items:flex-start;gap:20px;display:flex}.monitoring-bi .panel-card:not([data-host-owned],[data-host-owned] *),.monitoring-bi .compare-side:not([data-host-owned],[data-host-owned] *),.monitoring-bi .compare-delta:not([data-host-owned],[data-host-owned] *){background:var(--color-background-card,#232323);border-color:var(--color-border-default,#424242);border-radius:12px}.monitoring-bi .compare-result:not([data-host-owned],[data-host-owned] *){flex-wrap:wrap;align-items:flex-start;gap:20px;display:flex}.monitoring-bi .compare-side:not([data-host-owned],[data-host-owned] *){background:0 0;border:0;padding:0}.monitoring-bi .metric-navigator ul:not([data-host-owned],[data-host-owned] *){flex-wrap:wrap;gap:12px;padding:0;display:flex}.monitoring-bi .metric-nav-item:not([data-host-owned],[data-host-owned] *){border-radius:8px}.monitoring-bi .owned-inspector:not([data-host-owned],[data-host-owned] *){background:var(--color-background-card,#232323);border-radius:12px}.monitoring-bi .inspector-header:not([data-host-owned],[data-host-owned] *){border-bottom:1px solid var(--color-border-default,#424242)}.monitoring-bi .action-control:not([data-host-owned],[data-host-owned] *),.monitoring-bi .control-field:not([data-host-owned],[data-host-owned] *){border-radius:8px}.dashboard-grid-shell[data-exact-widgets=true] .dashboard-panel:not([data-host-owned],[data-host-owned] *){box-shadow:none;background:0 0;border:0;padding:0;overflow:visible}.dashboard-grid-shell[data-exact-widgets=true]{max-width:100%;overflow-x:auto}.monitoring-bi.crystra-bi[data-crystra-theme=dark]:not([data-host-owned],[data-host-owned] *){--crystra-surface-section:var(--color-background-workspace);--crystra-surface-panel:var(--color-background-card);--crystra-surface-raised:var(--color-background-floating);--crystra-surface-inset:var(--color-background-inset);--surface-canvas:var(--color-background-workspace);--status-expired:var(--color-text-muted);--status-incompatible:var(--color-status-error-solid)}.monitoring-signal small:not([data-host-owned],[data-host-owned] *){font-size:12px;font-weight:400}.monitoring-empty:not([data-host-owned],[data-host-owned] *){white-space:normal;overflow-wrap:anywhere;line-height:1.3}.monitoring-bi .status-label:not([data-host-owned],[data-host-owned] *){border-radius:6px;font-size:12px;font-weight:500}.monitoring-bi .status-expired:not([data-host-owned],[data-host-owned] *){color:var(--color-text-muted);background:var(--color-background-inset);border-color:var(--color-border-default)}.monitoring-bi .status-incompatible:not([data-host-owned],[data-host-owned] *){color:var(--color-status-error-text);background:var(--color-status-error-surface);border-color:var(--color-status-error-border)}.monitoring-bi .monitoring-foundations:not([data-host-owned],[data-host-owned] *){padding:20px}.monitoring-bi .monitoring-foundations>div:not([data-host-owned],[data-host-owned] *){max-width:none}.monitoring-bi .monitoring-foundations h1:not([data-host-owned],[data-host-owned] *){font-size:24px}.monitoring-bi .monitoring-foundations h2:not([data-host-owned],[data-host-owned] *){font-size:18px}.monitoring-bi .library-visualizers:not([data-host-owned],[data-host-owned] *){flex-wrap:wrap;align-items:flex-start;gap:24px;display:flex}.monitoring-signal>svg:not([data-host-owned],[data-host-owned] *){vertical-align:middle;margin-right:8px;display:inline-block}.monitoring-available:not([data-host-owned],[data-host-owned] *){color:var(--color-status-success-text,#22c55e);align-items:center;display:inline-flex}.monitoring-title-icon:not([data-host-owned],[data-host-owned] *){width:100%;min-width:0;color:var(--color-text-secondary,#aaa);align-items:center;gap:8px;display:inline-flex}.monitoring-boolean:not([data-host-owned],[data-host-owned] *){color:var(--color-text-primary,#eee);justify-content:center;align-items:center;display:flex}.monitoring-metric[data-visualizer=badge\\@1] .crystra-monitoring-widget-footer:not([data-host-owned],[data-host-owned] *){justify-content:flex-end}.monitoring-title-icon:focus-visible:not([data-host-owned],[data-host-owned] *),.monitoring-boolean:focus-visible:not([data-host-owned],[data-host-owned] *){outline:2px solid var(--color-border-focus,#679efe);outline-offset:3px;border-radius:4px}.monitoring-title-icon>svg:not([data-host-owned],[data-host-owned] *){flex-shrink:0}.monitoring-short-title:not([data-host-owned],[data-host-owned] *){text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.monitoring-boolean:not([data-host-owned],[data-host-owned] *){gap:8px}.monitoring-boolean>svg:not([data-host-owned],[data-host-owned] *){flex-shrink:0}.monitoring-boolean-label:not([data-host-owned],[data-host-owned] *){text-overflow:ellipsis;font-size:24px;font-weight:600;line-height:32px;overflow:hidden}.monitoring-metric[data-size="1x1"]:not([data-host-owned],[data-host-owned] *){gap:4px}.monitoring-metric[data-size="1x1"] .monitoring-short-title:not([data-host-owned],[data-host-owned] *),.monitoring-metric[data-size="1x1"] .monitoring-signal:not([data-host-owned],[data-host-owned] *),.monitoring-metric[data-size="1x1"] .monitoring-boolean-label:not([data-host-owned],[data-host-owned] *){font-weight:400}.monitoring-title-icon>svg:not([data-host-owned],[data-host-owned] *),.monitoring-boolean>svg:not([data-host-owned],[data-host-owned] *){color:var(--color-interaction-primary,#679efe)}.monitoring-title-icon>svg [stroke-width]:not([data-host-owned],[data-host-owned] *),.monitoring-boolean>svg [stroke-width]:not([data-host-owned],[data-host-owned] *){stroke-width:1.5px}.monitoring-metric .monitoring-title:not([data-host-owned],[data-host-owned] *),.monitoring-metric .monitoring-short-title:not([data-host-owned],[data-host-owned] *){font-size:var(--crystra-widget-title-size,14px);line-height:var(--crystra-widget-title-line,20px);font-weight:var(--crystra-widget-title-weight,400)}.monitoring-metric[data-size="1x1"] .monitoring-title-icon:not([data-host-owned],[data-host-owned] *){justify-content:center}.monitoring-metric[data-size="1x1"] .crystra-monitoring-widget-header>div:not([data-host-owned],[data-host-owned] *){display:none}.dashboard-grid-shell[data-exact-widgets=true] .dashboard-panel{transition:width .24s,height .24s,transform .24s}.dashboard-grid-shell[data-exact-widgets=true] .crystra-monitoring-widget{transition:width .24s,height .24s}@media (prefers-reduced-motion:reduce){.dashboard-grid-shell[data-exact-widgets=true] .dashboard-panel,.dashboard-grid-shell[data-exact-widgets=true] .crystra-monitoring-widget{transition:none}}.dashboard-size-menu{z-index:10000;min-width:160px;max-width:calc(100vw - 16px);position:fixed}.dashboard-size-menu-heading{color:var(--color-text-muted);padding:8px 12px;font-size:12px}.dashboard-size-menu-mark{width:14px;display:inline-flex}.dashboard-size-menu .crystra-menu-item{align-items:center;gap:8px;display:flex}.dashboard-custom-size{border-bottom:1px solid var(--color-border-default,#424242);grid-template-columns:1fr 1fr;gap:8px;padding:8px 12px 12px;display:grid}.dashboard-custom-size label{color:var(--color-text-secondary,#aaa);gap:4px;font-size:11px;display:grid}.dashboard-custom-size input{border:1px solid var(--color-border-default,#424242);background:var(--color-background-workspace,#191919);width:62px;height:30px;color:var(--color-text-primary,#eee);border-radius:6px;padding:4px 7px}.dashboard-custom-size small,.dashboard-custom-size>button{grid-column:1/-1}.dashboard-custom-size small{color:var(--color-text-muted,#888)}.dashboard-custom-size>button{border:1px solid var(--color-border-default,#424242);background:var(--color-background-card,#242426);height:30px;color:var(--color-text-primary,#eee);cursor:pointer;border-radius:6px}.dashboard-custom-size>button:disabled{opacity:.45;cursor:default}.crystra-bi .dashboard-grid-shell[data-exact-widgets=true][data-editing=true]{background-color:#0000;background-image:none}.crystra-bi .dashboard-grid-shell[data-exact-widgets=true][data-editing=true] .dashboard-grid>.react-grid-item:not(.react-grid-placeholder){outline:none}.crystra-bi .dashboard-grid-shell[data-exact-widgets=true] .dashboard-grid>.react-grid-placeholder{z-index:1;opacity:1;pointer-events:none;background:#303030;border:1px solid #414141;border-radius:12px;outline:none}.crystra-bi .dashboard-grid-shell[data-exact-widgets=true] .dashboard-panel.react-draggable-dragging{z-index:3;opacity:1;transition:none}.crystra-bi .dashboard-grid-shell[data-exact-widgets=true] .dashboard-grid>.react-grid-placeholder{transition:none}.monitoring-state-mark{align-items:center;display:inline-flex}.monitoring-state-mark [data-truth-state=AVAILABLE]{color:var(--color-status-success-solid,#30b870)}.monitoring-state-mark [data-truth-state=LOWER_BOUND],.monitoring-state-mark [data-truth-state=EXPIRED]{color:var(--color-status-warning-solid,#e7ad44)}.monitoring-state-mark [data-truth-state=INCOMPATIBLE]{color:var(--color-status-error-solid,#ef4444)}.monitoring-state-mark [data-truth-state=NOT_APPLICABLE],.monitoring-state-mark [data-truth-state=UNAVAILABLE]{color:var(--color-text-secondary,#aaa)}.monitoring-state-mark{--widget-status-icon-size:18px}.monitoring-state-mark svg[data-truth-state]{width:var(--widget-status-icon-size);height:var(--widget-status-icon-size)}.crystra-bi[data-crystra-theme=dark] .crystra-toggle-switch{--switch-width:48px;--switch-height:26px;--switch-inset:3px;--switch-radius:999px;--switch-thumb-radius:999px;cursor:pointer;border-radius:var(--switch-radius);min-height:36px;color:var(--color-text-primary);background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:4px 0;display:inline-flex}.crystra-bi .crystra-toggle-switch[data-size=regular]{--switch-width:56px;--switch-height:32px;min-height:40px}.crystra-bi .crystra-toggle-switch[data-shape=square]{--switch-radius:6px;--switch-thumb-radius:3px}.crystra-bi .crystra-toggle-switch[data-icon-placement=track]{--switch-width:64px;--switch-height:32px}.crystra-bi .crystra-toggle-switch[data-icon-placement=track][data-size=regular]{--switch-width:76px;--switch-height:36px}.crystra-switch-track{width:var(--switch-width);height:var(--switch-height);border-radius:var(--switch-radius);background:var(--color-background-neutral-action);box-shadow:inset 0 0 0 1px var(--color-border-strong);transition:background-color .18s;display:block;position:relative}.crystra-switch-thumb{z-index:1;left:var(--switch-inset);top:var(--switch-inset);width:calc(var(--switch-height) - var(--switch-inset) * 2);height:calc(var(--switch-height) - var(--switch-inset) * 2);border-radius:var(--switch-thumb-radius);background:var(--color-text-primary);color:var(--color-background-inset);place-items:center;transition:transform .18s cubic-bezier(.22,.68,.2,1),background-color .18s;display:grid;position:absolute;box-shadow:0 1px 4px #0003}.crystra-toggle-switch[data-checked=true] .crystra-switch-track{background:var(--color-interaction-primary);box-shadow:none}.crystra-toggle-switch[data-checked=true] .crystra-switch-thumb{transform:translateX(calc(var(--switch-width) - var(--switch-height)))}.crystra-toggle-switch:focus-visible{outline:2px solid var(--color-interaction-primary);outline-offset:3px}.crystra-toggle-switch:disabled{opacity:.4;cursor:not-allowed}.crystra-toggle-switch:not(:disabled):hover .crystra-switch-track{filter:brightness(1.12)}.crystra-switch-thumb svg{width:14px;height:14px}.crystra-toggle-switch[data-size=regular] .crystra-switch-thumb svg{width:18px;height:18px}.crystra-toggle-switch[data-icon-placement=track] .crystra-switch-thumb{width:calc((var(--switch-width) - var(--switch-inset) * 2) / 2)}.crystra-toggle-switch[data-icon-placement=track][data-checked=true] .crystra-switch-thumb{transform:translate(100%)}.crystra-toggle-switch[data-mode=choice] .crystra-switch-track{background:var(--color-background-neutral-action);box-shadow:inset 0 0 0 1px var(--color-border-strong)}.crystra-toggle-switch[data-mode=choice] .crystra-switch-thumb{background:var(--color-interaction-primary)}.crystra-switch-symbols{inset:var(--switch-inset);z-index:2;pointer-events:none;grid-template-columns:1fr 1fr;display:grid;position:absolute}.crystra-switch-symbols>span{color:var(--color-text-secondary);place-items:center;display:grid}.crystra-switch-symbols svg{width:16px;height:16px}.crystra-toggle-switch[data-checked=false] .crystra-switch-symbols>span:first-child,.crystra-toggle-switch[data-checked=true] .crystra-switch-symbols>span:last-child{color:var(--color-text-on-primary)}@media (prefers-reduced-motion:reduce){.crystra-switch-track,.crystra-switch-thumb{transition:none}}
/*$vite$:1*/`;

// modules/studio/src/client/evaluate-model.js
var STORAGE_KEY = "crystra.studio.location@1";
var EVIDENCE_TARGET_STORAGE_KEY = "crystra.studio.exact-evidence@1";
var TRACE_TARGET_STORAGE_KEY = "crystra.studio.exact-trace@1";
var MAX_URL_BYTES = 8 * 1024;
var TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/u;
var TRACE_ID = /^[a-f0-9]{32}$/u;
var SPAN_ID = /^[a-f0-9]{16}$/u;
var encoder = new TextEncoder();
function validIds(ids) {
  return Array.isArray(ids) && ids.length >= 1 && ids.length <= 24 && ids.every((id2) => typeof id2 === "string" && TASK_ID.test(id2)) && new Set(ids).size === ids.length;
}
function canonicalIds(ids) {
  if (!validIds(ids)) throw new Error("INVALID_SELECTION");
  return [...ids].sort((left, right) => {
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const length = Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < length; index += 1) {
      const difference = leftBytes[index] - rightBytes[index];
      if (difference !== 0) return difference;
    }
    return leftBytes.length - rightBytes.length;
  });
}
function selectionParams(selection2) {
  if (selection2.mode === "single") return [["task", canonicalIds(selection2.taskIds)]];
  if (selection2.mode === "compare") return [
    ["mode", ["compare"]],
    ["left_task", canonicalIds(selection2.leftTaskIds)],
    ["right_task", canonicalIds(selection2.rightTaskIds)]
  ];
  throw new Error("INVALID_SELECTION");
}
function appendSelection(params, selection2) {
  params.set("v", "1");
  for (const [key, values] of selectionParams(selection2)) for (const value of values) params.append(key, value);
}
function bounded(value) {
  if (encoder.encode(value).byteLength > MAX_URL_BYTES) throw new Error("STUDIO_URL_BOUND_EXCEEDED");
  return value;
}
function serializeStudioLocation(route) {
  if (route.page === "select") return "/evaluate";
  const params = new URLSearchParams();
  appendSelection(params, route.selection);
  if (route.page === "results") return bounded(`/evaluate?${params}`);
  if (route.page === "receipt") return bounded(`/evaluate/receipt?${params}`);
  if (route.page === "facts") {
    params.set("metric", route.metric);
    params.set("scope", route.scope);
    if (route.side !== void 0) params.set("side", route.side);
    return bounded(`/evaluate/facts?${params}`);
  }
  if (route.page === "trace" && TRACE_ID.test(route.traceId) && (route.spanId === void 0 || SPAN_ID.test(route.spanId))) {
    if (route.spanId !== void 0) params.set("span", route.spanId);
    return bounded(`/evaluate/trace/${route.traceId}?${params}`);
  }
  throw new Error("UNKNOWN_STUDIO_ROUTE");
}
function parseSelection(params) {
  if (params.get("v") !== "1" || params.getAll("v").length !== 1) return void 0;
  if (params.get("mode") === "compare") {
    const leftTaskIds = params.getAll("left_task");
    const rightTaskIds = params.getAll("right_task");
    return validIds(leftTaskIds) && validIds(rightTaskIds) ? { mode: "compare", leftTaskIds: canonicalIds(leftTaskIds), rightTaskIds: canonicalIds(rightTaskIds) } : void 0;
  }
  if (params.has("mode")) return void 0;
  const taskIds = params.getAll("task");
  return validIds(taskIds) ? { mode: "single", taskIds: canonicalIds(taskIds) } : void 0;
}
function only(params, keys) {
  const allowed = new Set(keys);
  return [...params.keys()].every((key) => allowed.has(key));
}
function parseStudioLocation(relativeUrl) {
  if (typeof relativeUrl !== "string" || encoder.encode(relativeUrl).byteLength > MAX_URL_BYTES) {
    return { page: "invalid", reason: "STUDIO_URL_BOUND_EXCEEDED" };
  }
  let url;
  try {
    url = new URL(relativeUrl, "http://studio.local");
  } catch {
    return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
  }
  if (url.origin !== "http://studio.local" || url.hash !== "") return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
  if (url.pathname === "/evaluate" && url.search === "") return { page: "select" };
  if (url.pathname !== "/evaluate" && url.pathname !== "/evaluate/receipt" && url.pathname !== "/evaluate/facts" && !url.pathname.startsWith("/evaluate/trace/")) return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
  const selection2 = parseSelection(url.searchParams);
  if (selection2 === void 0) return { page: "invalid", reason: "INVALID_SELECTION" };
  const baseKeys = selection2.mode === "single" ? ["v", "task"] : ["v", "mode", "left_task", "right_task"];
  if (url.pathname === "/evaluate" && only(url.searchParams, baseKeys)) return { page: "results", selection: selection2 };
  if (url.pathname === "/evaluate/receipt" && only(url.searchParams, baseKeys)) return { page: "receipt", selection: selection2 };
  if (url.pathname === "/evaluate/facts" && only(url.searchParams, [...baseKeys, "metric", "scope", "side"])) {
    const metric = url.searchParams.get("metric");
    const scope = url.searchParams.get("scope");
    const side2 = url.searchParams.get("side") ?? void 0;
    if (metric !== null && metric.length <= 256 && ["result", "related", "read-set"].includes(scope) && (side2 === void 0 || selection2.mode === "compare" && ["left", "right"].includes(side2) || selection2.mode === "single" && side2 === "single")) {
      return { page: "facts", selection: selection2, metric, scope, ...side2 === void 0 ? {} : { side: side2 } };
    }
  }
  if (url.pathname.startsWith("/evaluate/trace/") && only(url.searchParams, [...baseKeys, "span"])) {
    const traceId = url.pathname.slice("/evaluate/trace/".length);
    const spanId = url.searchParams.get("span") ?? void 0;
    if (TRACE_ID.test(traceId) && (spanId === void 0 || SPAN_ID.test(spanId))) return { page: "trace", selection: selection2, traceId, ...spanId === void 0 ? {} : { spanId } };
  }
  return { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" };
}
function sideResults(result) {
  if (result?.mode === "SINGLE" && result.result?.tag === "SIDE_RESULT") {
    return [{ side: "single", value: result.result }];
  }
  if (result?.mode !== "COMPARE") return [];
  return [
    ...result.left?.tag === "SIDE_RESULT" ? [{ side: "left", value: result.left }] : [],
    ...result.right?.tag === "SIDE_RESULT" ? [{ side: "right", value: result.right }] : []
  ];
}
function projectStudioPresentation(snapshot) {
  const sides = sideResults(snapshot.result);
  const metrics = /* @__PURE__ */ new Map();
  for (const { side: side2, value } of sides) {
    for (const metric of value.metric_results ?? []) {
      const coordinate = `${metric.metric_id}@${metric.metric_version}`;
      const current = metrics.get(coordinate) ?? { coordinate, sides: [] };
      current.sides.push({ side: side2, slices: metric.slices ?? [] });
      metrics.set(coordinate, current);
    }
  }
  return Object.freeze({
    mode: snapshot.result?.mode === "COMPARE" ? "compare" : snapshot.result?.mode === "SINGLE" ? "single" : "empty",
    phase: snapshot.phase,
    page: snapshot.route?.page ?? "select",
    metrics: Object.freeze([...metrics.values()]),
    deltas: Object.freeze(snapshot.result?.mode === "COMPARE" ? [...snapshot.result.deltas ?? []] : []),
    receipts: Object.freeze(sides.map(({ side: side2, value }) => ({ side: side2, receipt: value.receipt }))),
    facts: Object.freeze([...snapshot.drilldown?.facts ?? []]),
    trace: Object.freeze([...snapshot.drilldown?.trace ?? []]),
    drilldownError: snapshot.drilldown?.error
  });
}
function bodyFor(selection2) {
  if (selection2.mode === "single") return {
    api_version: 1,
    mode: "SINGLE",
    selection: { selection_version: 1, task_ids: canonicalIds(selection2.taskIds) }
  };
  return {
    api_version: 1,
    mode: "COMPARE",
    left: { selection_version: 1, task_ids: canonicalIds(selection2.leftTaskIds) },
    right: { selection_version: 1, task_ids: canonicalIds(selection2.rightTaskIds) }
  };
}
var incompatibleResponse = Object.freeze({
  code: "incompatible-response",
  message: "Studio received an incompatible formal API response"
});
function validTaskPage(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && value.contract?.name === "evidence.query" && value.contract?.revision === "1.0.0" && value.observation_profile === "2.0.0" && value.read_model_revision === "2.0.0" && typeof value.snapshot === "string" && value.snapshot !== "" && Array.isArray(value.items) && value.items.length <= 200 && value.items.every((item) => item !== null && typeof item === "object" && TASK_ID.test(item.task_id)) && (value.next_cursor === null || typeof value.next_cursor === "string");
}
function side(value, catalogCoordinates) {
  return value?.tag === "SIDE_RESULT" ? Array.isArray(value.metric_results) && value.receipt !== null && typeof value.receipt === "object" && (catalogCoordinates === void 0 || value.metric_results.length === catalogCoordinates.length && value.metric_results.every((metric, index) => `${metric.metric_id}@${metric.metric_version}` === catalogCoordinates[index])) : value?.tag === "SIDE_ERROR" && typeof value.code === "string";
}
function validComputeResponse(value, catalogCoordinates) {
  if (value?.api_version !== 1) return false;
  if (value.mode === "SINGLE") return side(value.result, catalogCoordinates) && value.result.tag === "SIDE_RESULT";
  return value.mode === "COMPARE" && ["FULL_COMPARE", "PARTIAL_COMPARE"].includes(value.status) && side(value.left, catalogCoordinates) && side(value.right, catalogCoordinates) && Array.isArray(value.deltas);
}
function initialRoute(storage, context) {
  const saved = storage?.getItem(STORAGE_KEY);
  if (saved !== null && saved !== void 0) {
    const parsed = parseStudioLocation(saved);
    if (parsed.page !== "invalid") return parsed;
  }
  return context?.taskId !== void 0 && TASK_ID.test(context.taskId) ? { page: "results", selection: { mode: "single", taskIds: [context.taskId] } } : { page: "select" };
}
function storedExactTarget(storage, key, page, selection2) {
  const saved = storage?.getItem(key);
  if (saved === null || saved === void 0 || selection2 === void 0) return void 0;
  const parsed = parseStudioLocation(saved);
  return parsed.page === page && JSON.stringify(parsed.selection) === JSON.stringify(selection2) ? { ...parsed, status: "available" } : void 0;
}
function clearStoredExactTargets(storage) {
  storage?.setItem(EVIDENCE_TARGET_STORAGE_KEY, "");
  storage?.setItem(TRACE_TARGET_STORAGE_KEY, "");
}
function createEvaluateController({ gateway, storage, initialContext, catalogCoordinates } = {}) {
  if (gateway === void 0 || typeof gateway.call !== "function") throw new Error("STUDIO_GATEWAY_REQUIRED");
  const route = initialRoute(storage, initialContext);
  const storedEvidence = storedExactTarget(storage, EVIDENCE_TARGET_STORAGE_KEY, "facts", route.selection);
  const storedTrace = storedExactTarget(storage, TRACE_TARGET_STORAGE_KEY, "trace", route.selection);
  const initialExactTargets = {
    ...storedEvidence === void 0 && route.page !== "facts" ? {} : { evidence: storedEvidence ?? { ...route, status: "available" } },
    ...storedTrace === void 0 && route.page !== "trace" ? {} : { trace: storedTrace ?? { ...route, status: "available" } }
  };
  let snapshot = {
    phase: "idle",
    route,
    selection: route.selection,
    recentSelection: route.selection,
    taskList: { phase: "idle", items: [] },
    drilldown: { phase: "idle", facts: [], trace: [] },
    exactTargets: initialExactTargets,
    result: void 0,
    error: void 0,
    refreshing: false
  };
  const listeners = /* @__PURE__ */ new Set();
  const publish = (change) => {
    snapshot = { ...snapshot, ...change };
    for (const listener of listeners) listener();
  };
  const persist2 = (nextRoute) => {
    snapshot = { ...snapshot, route: nextRoute };
    storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
    for (const listener of listeners) listener();
  };
  const controller = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSelection(selection2) {
      bodyFor(selection2);
      publish({ selection: selection2, recentSelection: selection2, route: { page: "results", selection: selection2 }, phase: "idle", error: void 0, exactTargets: {} });
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation({ page: "results", selection: selection2 }));
    },
    clearSelection() {
      const nextRoute = { page: "select" };
      snapshot = {
        ...snapshot,
        phase: "idle",
        route: nextRoute,
        selection: void 0,
        result: void 0,
        error: void 0,
        refreshing: false,
        drilldown: { phase: "idle", facts: [], trace: [] },
        exactTargets: {}
      };
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
      for (const listener of listeners) listener();
    },
    async loadTasks(cursor) {
      publish({ taskList: { ...snapshot.taskList, phase: "loading", error: void 0 } });
      const answer = await gateway.call("tasks/list", { limit: 100, ...cursor === void 0 ? {} : { cursor } });
      if (!answer.ok) {
        publish({ taskList: { ...snapshot.taskList, phase: "error", error: answer.error } });
        return;
      }
      if (!validTaskPage(answer.value)) {
        publish({ taskList: { ...snapshot.taskList, phase: "error", error: incompatibleResponse } });
        return;
      }
      const prior = cursor === void 0 ? [] : snapshot.taskList.items;
      const byId = new Map([...prior, ...answer.value.items].map((item) => [item.task_id, item]));
      const items = [...byId.values()].sort((left, right) => canonicalIds([left.task_id, right.task_id])[0] === left.task_id ? -1 : 1);
      publish({ taskList: { phase: "ready", items, page: answer.value } });
    },
    async evaluate() {
      if (snapshot.selection === void 0) throw new Error("INVALID_SELECTION");
      const retaining = snapshot.result !== void 0;
      publish({ phase: retaining ? snapshot.phase : "loading", refreshing: retaining, error: void 0 });
      const answer = await gateway.call("evaluations/compute", bodyFor(snapshot.selection));
      if (!answer.ok) {
        publish({ phase: retaining ? "degraded" : "error", refreshing: false, error: answer.error });
        return;
      }
      if (!validComputeResponse(answer.value, catalogCoordinates)) {
        publish({ phase: retaining ? "degraded" : "error", refreshing: false, error: incompatibleResponse });
        return;
      }
      const phase = answer.value?.mode === "COMPARE" && answer.value.status === "PARTIAL_COMPARE" ? "partial" : "ready";
      const nextRoute = { page: "results", selection: snapshot.selection };
      snapshot = {
        ...snapshot,
        phase,
        refreshing: false,
        error: void 0,
        result: answer.value,
        route: nextRoute,
        drilldown: { phase: "idle", facts: [], trace: [] },
        exactTargets: {}
      };
      clearStoredExactTargets(storage);
      storage?.setItem(STORAGE_KEY, serializeStudioLocation(nextRoute));
      for (const listener of listeners) listener();
    },
    async refresh() {
      await controller.evaluate();
    },
    async loadFacts(filters) {
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: void 0 } });
      const answer = await gateway.call("facts/read", filters);
      if (!answer.ok) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
          exactTargets: snapshot.route.page === "facts" ? { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } } : snapshot.exactTargets
        });
        return;
      }
      const facts = answer.value.items ?? [];
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", facts, error: void 0 },
        exactTargets: snapshot.route.page === "facts" ? { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: facts.length === 0 ? "unavailable" : "available" } } : snapshot.exactTargets
      });
    },
    async loadMetricFacts(metricCoordinate, scope = "result", side2) {
      if (!["result", "related", "read-set"].includes(scope) || snapshot.result === void 0) return;
      const sides = sideResults(snapshot.result).filter((candidate) => side2 === void 0 || candidate.side === side2);
      const metric = sides.flatMap(({ value }) => value.metric_results ?? []).find((candidate) => `${candidate.metric_id}@${candidate.metric_version}` === metricCoordinate);
      if (metric === void 0) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: incompatibleResponse },
          exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } }
        });
        return;
      }
      const deliveryIds = [...new Set(sides.flatMap(({ value }) => value.receipt?.task_population ?? []).flatMap((task) => task.memberships ?? []).map((membership) => membership.delivery_id).filter((id2) => boundedText(id2, 256)))].sort();
      const resultRefs = new Set((metric.slices ?? []).flatMap((slice) => slice.provenance_refs ?? []));
      const readSetRefs = new Set(sides.flatMap(({ value }) => value.receipt?.input_refs ?? []).filter((reference) => reference.kind === "FACT").flatMap((reference) => [reference.identity, reference.provenance_ref]));
      const wanted = scope === "read-set" ? readSetRefs : resultRefs;
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: void 0 } });
      const facts = [];
      for (const delivery_id of deliveryIds) {
        const answer = await gateway.call("facts/read", { delivery_id, limit: 200 });
        if (!answer.ok) {
          publish({
            drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
            exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } }
          });
          return;
        }
        if (!Array.isArray(answer.value?.items)) {
          publish({
            drilldown: { ...snapshot.drilldown, phase: "error", error: incompatibleResponse },
            exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: "unavailable" } }
          });
          return;
        }
        facts.push(...answer.value.items);
      }
      const matches = (fact) => [fact?.id, fact?.provenance?.accepted_digest].some((identity4) => wanted.has(identity4));
      const selected = scope === "related" ? facts.filter((fact) => !matches(fact)) : facts.filter(matches);
      const returned = new Set(facts.flatMap((fact) => [fact?.id, fact?.provenance?.accepted_digest]));
      const references = [...wanted].sort().map((identity4) => ({ identity: identity4, loadedAsFact: returned.has(identity4) }));
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", facts: selected, references, error: void 0 },
        exactTargets: { ...snapshot.exactTargets, evidence: { ...snapshot.exactTargets.evidence, status: selected.length === 0 ? "unavailable" : "available" } }
      });
    },
    async loadTrace(filters) {
      publish({ drilldown: { ...snapshot.drilldown, phase: "loading", error: void 0 } });
      const answer = await gateway.call("traces/read", filters);
      if (!answer.ok) {
        publish({
          drilldown: { ...snapshot.drilldown, phase: "error", error: answer.error },
          exactTargets: { ...snapshot.exactTargets, trace: { ...snapshot.exactTargets.trace, status: "unavailable" } }
        });
        return;
      }
      const trace = answer.value.items ?? [];
      publish({
        drilldown: { ...snapshot.drilldown, phase: "ready", trace, error: void 0 },
        exactTargets: { ...snapshot.exactTargets, trace: { ...snapshot.exactTargets.trace, status: trace.length === 0 ? "unavailable" : "available" } }
      });
    },
    openReceipt() {
      if (snapshot.selection === void 0 || snapshot.result === void 0) return;
      persist2({ page: "receipt", selection: snapshot.selection });
    },
    openFacts(metric, scope = "result", side2) {
      if (snapshot.selection === void 0) return;
      const nextRoute = { page: "facts", selection: snapshot.selection, metric, scope, ...side2 === void 0 ? {} : { side: side2 } };
      snapshot = { ...snapshot, exactTargets: { ...snapshot.exactTargets, evidence: { ...nextRoute, status: "available" } } };
      storage?.setItem(EVIDENCE_TARGET_STORAGE_KEY, serializeStudioLocation(nextRoute));
      persist2(nextRoute);
    },
    openTrace(traceId, spanId) {
      if (snapshot.selection === void 0) return;
      const nextRoute = { page: "trace", selection: snapshot.selection, traceId, ...spanId === void 0 ? {} : { spanId } };
      snapshot = { ...snapshot, exactTargets: { ...snapshot.exactTargets, trace: { ...nextRoute, status: "available" } } };
      storage?.setItem(TRACE_TARGET_STORAGE_KEY, serializeStudioLocation(nextRoute));
      persist2(nextRoute);
    },
    restoreExactEvidence() {
      if (snapshot.exactTargets.evidence?.status === "unavailable") return;
      if (snapshot.exactTargets.evidence !== void 0) {
        const { status: _status, ...route2 } = snapshot.exactTargets.evidence;
        persist2(route2);
      }
    },
    restoreExactTrace() {
      if (snapshot.exactTargets.trace?.status === "unavailable") return;
      if (snapshot.exactTargets.trace !== void 0) {
        const { status: _status, ...route2 } = snapshot.exactTargets.trace;
        persist2(route2);
      }
    },
    backToResults() {
      if (snapshot.selection === void 0) persist2({ page: "select" });
      else persist2({ page: "results", selection: snapshot.selection });
    }
  };
  return controller;
}
function boundedText(value, maximum) {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

// modules/studio/src/client/studio.js
var STUDIO_PAGES = Object.freeze([
  Object.freeze({ id: "evaluate", label: "Evaluate", routePrefix: "/evaluate" })
]);
var STUDIO_TRACE_VIEWS = Object.freeze([
  Object.freeze({ id: "waterfall", label: "Waterfall", renderer: "TraceWaterfall", note: "Exact span timing" }),
  Object.freeze({ id: "tree", label: "Tree", renderer: "TraceTree", note: "Deterministic geometry \xB7 depth \u2192 recorded start/end \u2192 Span ID" })
]);
var ACCESSIBILITY = Object.freeze({
  routes: Object.freeze(STUDIO_PAGES.map((page) => page.label)),
  surface: "conversation-view",
  modal: false,
  landmarks: Object.freeze(["region", "navigation", "main"]),
  liveRegions: Object.freeze({ loading: "polite", error: "assertive" }),
  minimumTargetPixels: 44
});
function createStudioGatewayPort(ctx) {
  return Object.freeze({
    call(endpoint, payload, signal) {
      return ctx.connection.rpc.call("/crystra-studio", endpoint, payload, signal);
    }
  });
}
var viewStyle = {
  width: "100%",
  minHeight: "100%",
  overflow: "auto",
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-base)",
  padding: "clamp(11px, 2vw, 24px)",
  paddingBottom: "clamp(120px, 18vh, 180px)",
  boxSizing: "border-box"
};
var controlStyle = { minHeight: "44px", minWidth: "44px" };
var DEFAULT_LAYOUT = Object.freeze({
  schemaVersion: "crystra-dsh.studio-layout@1",
  columns: Object.freeze({ desktop: 12, tablet: 6, mobile: 1 }),
  panels: Object.freeze([
    ["operational-latency-ms", 3, 2, 3, 2, 1, 2],
    ["delivery-cycle-time-ms", 3, 2, 3, 2, 1, 2],
    ["operational-usage-availability", 3, 2, 3, 2, 1, 2],
    ["task-cohort-comparison-eligibility", 3, 2, 3, 2, 1, 2],
    ["role-template-rework-rate", 6, 3, 3, 3, 1, 3],
    ["role-model-task-outcome-rate", 6, 3, 3, 3, 1, 3],
    ["role-template-trajectory-partial-cost", 3, 2, 3, 2, 1, 2],
    ["trajectory-partial-cost", 3, 2, 3, 2, 1, 2],
    ["operational-attributable-cost", 3, 2, 3, 2, 1, 2],
    ["delivery-stage-reach", 12, 4, 6, 4, 1, 4],
    ["delivery-terminal-outcome-rate", 12, 4, 6, 4, 1, 4],
    ["operational-token-usage", 12, 4, 6, 4, 1, 4]
  ].map(([id2, dw, dh, tw, th, mw, mh]) => Object.freeze({
    id: id2,
    desktop: Object.freeze({ w: dw, h: dh }),
    tablet: Object.freeze({ w: tw, h: th }),
    mobile: Object.freeze({ w: mw, h: mh })
  })))
});
var DASHBOARD_STORAGE_KEY = "crystra.studio.dashboard-layout@1";
function createStudioTheme(mode) {
  if (mode !== "light" && mode !== "dark") throw new Error("UNKNOWN_STUDIO_THEME");
  return Object.freeze({
    mode,
    density: "compact",
    containerBorderStyle: "solid",
    palette: Object.freeze({
      surface: Object.freeze({
        section: "var(--dsw-specific-sidebar-fill)",
        panel: "var(--dsw-alias-bg-layer-1)",
        raised: "var(--dsw-alias-bg-layer-2)",
        inset: "var(--dsw-alias-bg-base)"
      }),
      content: Object.freeze({
        primary: "var(--dsw-alias-label-primary)",
        secondary: "var(--dsw-alias-label-secondary)",
        muted: "var(--dsw-alias-label-dimmed)",
        inverse: "var(--dsw-alias-label-primary-inverted)"
      }),
      border: Object.freeze({
        default: "var(--dsw-alias-border-l2)",
        strong: "var(--dsw-alias-border-l3)"
      }),
      interaction: Object.freeze({
        accent: "var(--dsw-alias-state-business-primary)",
        selection: "var(--dsw-alias-interactive-bg-active)",
        disabled: "var(--dsw-alias-label-dimmed)",
        focusRing: "var(--dsw-alias-state-business-primary)"
      }),
      status: Object.freeze({
        available: "var(--dsw-alias-state-success-primary)",
        attention: "var(--dsw-alias-state-warning-primary)",
        unavailable: "var(--dsw-alias-label-dimmed)",
        expired: "var(--dsw-alias-state-warn-label)",
        incompatible: "var(--dsw-alias-state-error-secondary)",
        error: "var(--dsw-alias-state-error-primary)"
      }),
      data: Object.freeze([
        "var(--dsw-alias-state-business-primary)",
        "var(--dsw-alias-state-success-primary)",
        "var(--dsw-alias-state-warning-primary)",
        "var(--dsw-alias-state-error-primary)"
      ])
    }),
    typography: Object.freeze({
      fontFamily: "var(--dsw-font-family)",
      codeFontFamily: "var(--dsw-font-family-mono)",
      h1: "18px",
      h2: "13px",
      subtitle1: "13px",
      body1: "11px",
      body2: "10px",
      caption: "9px",
      overline: "8px"
    })
  });
}
function createStudioDashboardState(panelIds) {
  if (!Array.isArray(panelIds) || new Set(panelIds).size !== panelIds.length || !panelIds.every((id2) => typeof id2 === "string" && id2.length > 0)) {
    throw new Error("INVALID_STUDIO_PANELS");
  }
  return Object.freeze({
    defaults: Object.freeze([...panelIds]),
    order: Object.freeze([...panelIds]),
    hidden: Object.freeze([]),
    sizes: Object.freeze({})
  });
}
function reduceStudioDashboardState(state, action) {
  if (action.type === "RESET" || action.type === "PRESET") {
    if (action.type === "PRESET" && action.preset !== "default") throw new Error("UNKNOWN_STUDIO_LAYOUT_PRESET");
    return createStudioDashboardState(state.defaults);
  }
  const known = state.order.includes(action.panelId);
  if (!known) throw new Error("UNKNOWN_STUDIO_PANEL");
  if (action.type === "REMOVE") return Object.freeze({
    ...state,
    hidden: Object.freeze([.../* @__PURE__ */ new Set([...state.hidden, action.panelId])])
  });
  if (action.type === "ADD") return Object.freeze({
    ...state,
    hidden: Object.freeze(state.hidden.filter((id2) => id2 !== action.panelId))
  });
  if (action.type === "RESIZE") {
    if (!["compact", "wide", "full"].includes(action.size)) throw new Error("UNKNOWN_STUDIO_PANEL_SIZE");
    return Object.freeze({ ...state, sizes: Object.freeze({ ...state.sizes, [action.panelId]: action.size }) });
  }
  if (action.type === "MOVE") {
    if (!state.order.includes(action.beforePanelId)) throw new Error("UNKNOWN_STUDIO_PANEL");
    const order = state.order.filter((id2) => id2 !== action.panelId);
    order.splice(order.indexOf(action.beforePanelId), 0, action.panelId);
    return Object.freeze({ ...state, order: Object.freeze(order) });
  }
  throw new Error("UNKNOWN_STUDIO_LAYOUT_ACTION");
}
function validDashboardState(value) {
  const uniqueStrings = (items) => Array.isArray(items) && items.every((item) => typeof item === "string" && item.length > 0) && new Set(items).size === items.length;
  return value !== null && typeof value === "object" && !Array.isArray(value) && uniqueStrings(value.defaults) && uniqueStrings(value.order) && uniqueStrings(value.hidden) && value.defaults.every((id2) => value.order.includes(id2)) && value.hidden.every((id2) => value.order.includes(id2)) && value.sizes !== null && typeof value.sizes === "object" && !Array.isArray(value.sizes) && Object.entries(value.sizes).every(([id2, size]) => value.order.includes(id2) && ["compact", "wide", "full"].includes(size));
}
function createStudioLayoutStore(storage) {
  return Object.freeze({
    load(fallback) {
      if (storage === void 0) return fallback;
      try {
        const encoded = storage.getItem(DASHBOARD_STORAGE_KEY);
        if (encoded === null) return fallback;
        const parsed = JSON.parse(encoded);
        if (!validDashboardState(parsed)) return fallback;
        return Object.freeze({
          defaults: Object.freeze([...parsed.defaults]),
          order: Object.freeze([...parsed.order]),
          hidden: Object.freeze([...parsed.hidden]),
          sizes: Object.freeze({ ...parsed.sizes })
        });
      } catch {
        return fallback;
      }
    },
    save(state) {
      if (!validDashboardState(state)) throw new Error("INVALID_STUDIO_LAYOUT_STATE");
      storage?.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state));
    }
  });
}
var hostStyles = `
#crystra-studio-view { --crystra-shape-panel:10px; --crystra-shape-control:7px; }
#crystra-studio-view, #crystra-studio-view > *, #crystra-studio-view .studio-page-copy { min-width:0; max-width:100%; }
#crystra-studio-view [data-crystra-studio-region="header"] { overflow:hidden; }
#crystra-studio-view .studio-product-row, #crystra-studio-view .studio-page-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; }
#crystra-studio-view .studio-product-row { min-height:47px; padding-block:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-breadcrumbs, #crystra-studio-view .studio-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
#crystra-studio-view .studio-breadcrumbs { color:var(--dsw-alias-label-secondary); font-size:10px; }
#crystra-studio-view .studio-page-copy h1, #crystra-studio-view .studio-page-copy p, #crystra-studio-view .studio-selection-copy { margin:2px 0; }
#crystra-studio-view .studio-page-copy p { max-width:67ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#crystra-studio-view .studio-eyebrow { display:block; }
#crystra-studio-view .studio-product-row .studio-controls { align-self:stretch; gap:3px; }
#crystra-studio-view .studio-view-link { min-height:47px; padding-inline:11px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent; color:var(--dsw-alias-label-secondary); }
#crystra-studio-view .studio-view-link[aria-current="page"] { border-color:var(--dsw-alias-state-business-primary,#79a6ff); background:linear-gradient(transparent,color-mix(in srgb,var(--dsw-alias-state-business-primary,#79a6ff) 7%,transparent)); color:var(--dsw-alias-state-business-primary,#79a6ff); }
#crystra-studio-view .studio-trace-view-switcher { width:fit-content; }
#crystra-studio-view .studio-trace-view-navigation { display:flex; width:100%; min-width:0; align-items:center; justify-content:space-between; gap:12px; }
#crystra-studio-view .studio-trace-view-note { margin-inline-start:auto; text-align:end; }
#crystra-studio-view [data-crystra-studio-region="main"] { margin-top:12px; }
#crystra-studio-view .studio-selection-grid { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(250px,.75fr); gap:12px; }
#crystra-studio-view .studio-selection-card { overflow:hidden; }
#crystra-studio-view .studio-selection-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-selection-filter { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; padding:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-selection-filter .crystra-input { width:100%; }
#crystra-studio-view .studio-filter-options { display:flex; gap:5px; grid-column:1/-1; }
#crystra-studio-view .studio-filter-options button[aria-pressed="true"] { border-color:var(--dsw-alias-state-business-primary,#7199e7); color:var(--dsw-alias-state-business-primary,#7199e7); }
#crystra-studio-view .studio-task-list { display:grid; max-height:min(50vh,520px); margin:0; padding:5px 8px 9px; overflow:auto; list-style:none; }
#crystra-studio-view .studio-task-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; min-height:52px; gap:10px; padding:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-task-row:last-child { border-bottom:0; }
#crystra-studio-view .studio-task-row label { display:flex; align-items:center; gap:9px; min-width:0; }
#crystra-studio-view .studio-task-row input[type="checkbox"] { width:17px; height:17px; margin:0; accent-color:var(--dsw-alias-state-business-primary,#7199e7); }
#crystra-studio-view .studio-task-id { display:block; overflow-wrap:anywhere; }
#crystra-studio-view .studio-selected-list { display:grid; gap:8px; padding:12px; }
#crystra-studio-view .studio-selected-item { padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--studio-raised); }
#crystra-studio-view .studio-selected-item .crystra-typography { display:block; }
#crystra-studio-view [data-crystra-dashboard-layout] { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; }
#crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span var(--studio-panel-desktop-columns,3); min-width:0; }
#crystra-studio-view [data-crystra-studio-region="footer"] { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; padding:12px 14px; }
@media (max-width:900px) { #crystra-studio-view [data-crystra-dashboard-layout] { grid-template-columns:repeat(6,minmax(0,1fr)); } #crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span var(--studio-panel-tablet-columns,3); } }
@media (max-width:700px) {
  #crystra-studio-view .studio-selection-grid { grid-template-columns:1fr; }
  #crystra-studio-view .studio-product-row, #crystra-studio-view .studio-page-row { align-items:flex-start; flex-direction:column; }
  #crystra-studio-view .studio-product-row .studio-controls { width:100%; flex-wrap:nowrap; overflow:hidden; }
  #crystra-studio-view .studio-product-row .studio-controls > button { flex:1 1 0; min-width:0; }
  #crystra-studio-view .studio-view-link { min-height:36px; padding-inline:2px; font-size:8px; }
  #crystra-studio-view .studio-page-row { gap:8px; padding:10px 12px; }
  #crystra-studio-view .studio-page-copy p { overflow-wrap:anywhere; white-space:normal; }
  #crystra-studio-view .studio-page-actions { width:100%; flex-wrap:nowrap; gap:5px; }
  #crystra-studio-view .studio-page-actions > button { min-height:32px; padding-inline:8px; font-size:9px; }
  #crystra-studio-view .studio-page-actions > button:nth-child(2) { display:none; }
  #crystra-studio-view .studio-trace-view-note { display:none; }
}
@media (max-width:560px) { #crystra-studio-view [data-crystra-dashboard-layout] { grid-template-columns:1fr; } #crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span 1 !important; } }
`;
function platformThemeMode(explicitMode) {
  if (explicitMode === "light" || explicitMode === "dark") return explicitMode;
  if (typeof document !== "undefined" && document.body?.hasAttribute("data-ds-dark-theme")) return "dark";
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}
function studioPanelPlacement(panelId, size) {
  if (size === "full") return { desktop: 12, tablet: 6, mobile: 1 };
  if (size === "wide") return { desktop: 6, tablet: 6, mobile: 1 };
  if (size === "compact") return { desktop: 3, tablet: 3, mobile: 1 };
  const configured = DEFAULT_LAYOUT.panels.find(({ id: id2 }) => id2 === panelId);
  return configured === void 0 ? { desktop: 3, tablet: 3, mobile: 1 } : { desktop: configured.desktop.w, tablet: configured.tablet.w, mobile: configured.mobile.w };
}
function sliceIdentity(sliceKey) {
  return JSON.stringify(Object.fromEntries(Object.entries(sliceKey ?? {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)));
}
function metricSlice(side2, coordinate, sliceKey) {
  if (side2?.tag !== "SIDE_RESULT") return void 0;
  const split = coordinate.lastIndexOf("@");
  const metric = side2.metric_results?.find((candidate) => candidate.metric_id === coordinate.slice(0, split) && candidate.metric_version === coordinate.slice(split + 1));
  const identity4 = sliceIdentity(sliceKey);
  return metric?.slices?.find((slice) => sliceIdentity(slice.slice_key) === identity4);
}
function factRow(fact) {
  if (typeof fact?.id !== "string" || typeof fact.kind !== "string" || typeof fact.provenance?.accepted_digest !== "string" || !Array.isArray(fact.compatibility?.dimensions) || typeof fact.truth?.availability !== "string") return void 0;
  const coordinates = Object.fromEntries(fact.compatibility.dimensions.map(({ field, value }) => [field, String(value)]));
  if (fact.compatibility.event_name !== null && fact.compatibility.event_name !== void 0) {
    coordinates.event_name = fact.compatibility.event_name;
  }
  if (fact.compatibility.family_schema !== null && fact.compatibility.family_schema !== void 0) {
    coordinates.family_schema = fact.compatibility.family_schema;
  }
  return {
    factId: fact.id,
    factClass: fact.kind,
    coordinates,
    provenance: fact.provenance.accepted_digest,
    truth: fact.truth,
    ...fact.source?.kind === "SPAN" ? {
      trace: { traceId: fact.source.trace_id, spanId: fact.source.span_id }
    } : {}
  };
}
function reduceSingleTaskSelection(_current, taskId, checked) {
  return checked ? Object.freeze({ mode: "single", taskIds: Object.freeze([taskId]) }) : void 0;
}
function StudioView(React4, Primitives2, Bi2, sharedStyles, controller, explicitThemeMode, layoutStorage) {
  const Button2 = Bi2.Button;
  const ButtonGroup = Bi2.ButtonGroup;
  const StatusBadge = Bi2.StatusBadge;
  const Surface = Bi2.Surface;
  const TextInput = Bi2.TextInput;
  const Typography = Bi2.Typography;
  const DisclosureRow2 = Primitives2.DisclosureRow;
  const JsonTree2 = Primitives2.JsonTree;
  return function StudioConversationView() {
    const [technicalDetailsOpen, setTechnicalDetailsOpen] = React4.useState(false);
    const [traceView, setTraceView] = React4.useState("waterfall");
    const [taskQuery, setTaskQuery] = React4.useState("");
    const [filtersOpen, setFiltersOpen] = React4.useState(false);
    const [taskFilter, setTaskFilter] = React4.useState("all");
    const [editingDashboard, setEditingDashboard] = React4.useState(false);
    const snapshot = React4.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const [studioPage, setStudioPage] = React4.useState(() => snapshot.result !== void 0 || ["receipt", "facts", "trace"].includes(snapshot.route.page) ? "dashboard" : "selection");
    const [selectionRequested, setSelectionRequested] = React4.useState(false);
    React4.useEffect(() => {
      if (!selectionRequested && (snapshot.result !== void 0 || ["receipt", "facts", "trace"].includes(snapshot.route.page)) && studioPage !== "dashboard") {
        setStudioPage("dashboard");
      }
    }, [selectionRequested, snapshot.result, snapshot.route.page, studioPage]);
    React4.useEffect(() => {
      if (snapshot.drilldown.phase !== "idle") return;
      if (snapshot.route.page === "facts" && snapshot.result !== void 0) {
        void controller.loadMetricFacts(snapshot.route.metric, snapshot.route.scope, snapshot.route.side);
      }
      if (snapshot.route.page === "trace") void controller.loadTrace({
        trace_id: snapshot.route.traceId,
        limit: 200
      });
    }, [snapshot.route.page, snapshot.result]);
    const presentation = projectStudioPresentation(snapshot);
    const deltaCoordinates = new Set(presentation.deltas.map((delta) => delta.metric_coordinate));
    const facts = presentation.facts.map(factRow);
    const factsCompatible = facts.every((row) => row !== void 0);
    let recorded;
    if (snapshot.route.page === "trace" && presentation.trace.length > 0) {
      try {
        recorded = Bi2.compileTraceView(presentation.trace);
      } catch {
        recorded = void 0;
      }
    }
    const theme = Bi2.createBiTheme(createStudioTheme(platformThemeMode(explicitThemeMode)));
    const json = (data, label) => JsonTree2 === void 0 ? React4.createElement("pre", { "aria-label": label }, JSON.stringify(data, null, 2)) : React4.createElement(JsonTree2, { data, label, copyable: true, expandTopLevel: true });
    const taskItems = snapshot.taskList.items ?? [];
    const current = snapshot.selection?.mode === "single" ? snapshot.selection.taskIds : [];
    const before = snapshot.selection?.mode === "compare" ? snapshot.selection.leftTaskIds : [];
    const after = snapshot.selection?.mode === "compare" ? snapshot.selection.rightTaskIds : [];
    const selectedTaskIds = /* @__PURE__ */ new Set([...current, ...before, ...after]);
    const visibleTaskItems = taskItems.filter((task) => {
      const query = taskQuery.trim().toLocaleLowerCase();
      const matchesQuery = query === "" || task.task_id.toLocaleLowerCase().includes(query) || task.display_name?.toLocaleLowerCase().includes(query);
      const matchesFilter = taskFilter === "all" || taskFilter === "selected" === selectedTaskIds.has(task.task_id);
      return matchesQuery && matchesFilter;
    });
    const metricPanelIds = presentation.metrics.map((metric) => metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@")));
    const layoutStore = createStudioLayoutStore(layoutStorage);
    const [dashboardState, setDashboardState] = React4.useState(() => layoutStore.load(createStudioDashboardState(DEFAULT_LAYOUT.panels.map(({ id: id2 }) => id2))));
    const [savedDashboardState, setSavedDashboardState] = React4.useState(dashboardState);
    const expandedDashboardState = dashboardState.order === void 0 ? dashboardState : {
      ...dashboardState,
      order: [...dashboardState.order, ...metricPanelIds.filter((id2) => !dashboardState.order.includes(id2))]
    };
    const dashboardMetrics = [...presentation.metrics].filter((metric) => !expandedDashboardState.hidden.includes(metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@")))).sort((left, right) => expandedDashboardState.order.indexOf(left.coordinate.slice(0, left.coordinate.lastIndexOf("@"))) - expandedDashboardState.order.indexOf(right.coordinate.slice(0, right.coordinate.lastIndexOf("@"))));
    const updateDashboard = (action) => setDashboardState(
      reduceStudioDashboardState(expandedDashboardState, action)
    );
    const setTask = (id2, checked) => {
      const selection2 = reduceSingleTaskSelection(current, id2, checked);
      if (selection2 === void 0) controller.clearSelection();
      else controller.setSelection(selection2);
    };
    const setComparedTask = (side2, id2, checked) => {
      const selected = side2 === "left" ? before : after;
      const taskIds = checked ? [.../* @__PURE__ */ new Set([...selected, id2])] : selected.filter((value) => value !== id2);
      if (taskIds.length === 0) return;
      controller.setSelection({
        mode: "compare",
        leftTaskIds: side2 === "left" ? taskIds : before,
        rightTaskIds: side2 === "right" ? taskIds : after
      });
    };
    const chooseMode = (mode) => {
      if (mode === snapshot.selection?.mode) return;
      const seed = current[0] ?? before[0] ?? after[0] ?? taskItems[0]?.task_id;
      if (seed === void 0) return;
      controller.setSelection(mode === "single" ? { mode: "single", taskIds: [seed] } : { mode: "compare", leftTaskIds: [seed], rightTaskIds: [seed] });
    };
    const evaluateSelection = async () => {
      await controller.evaluate();
      if (controller.getSnapshot().result !== void 0) {
        setSelectionRequested(false);
        setStudioPage("dashboard");
      }
    };
    const exactEvidenceTarget = snapshot.exactTargets.evidence;
    const exactTraceTarget = snapshot.exactTargets.trace;
    const evidenceUnavailableReason = exactEvidenceTarget === void 0 ? "EXACT_EVIDENCE_TARGET_NOT_ESTABLISHED" : exactEvidenceTarget.status === "unavailable" ? "EXACT_EVIDENCE_TARGET_UNAVAILABLE" : void 0;
    const traceUnavailableReason = exactTraceTarget === void 0 ? "EXACT_TRACE_TARGET_NOT_ESTABLISHED" : exactTraceTarget.status === "unavailable" ? "EXACT_TRACE_TARGET_UNAVAILABLE" : void 0;
    const pageIdentity = studioPage === "selection" ? { eyebrow: "New evaluation", title: "Select task population", detail: "Choose exact Task identities; display names are recognition only." } : snapshot.route.page === "trace" ? { eyebrow: "Recorded Evidence \xB7 exact identity", title: "Recorded Trace", detail: `${snapshot.route.traceId} \xB7 current evaluation \xB7 no inferred causality` } : snapshot.route.page === "facts" ? { eyebrow: "Evaluation Evidence", title: "Evidence", detail: "Exact recorded Facts and provenance for the current evaluation." } : snapshot.route.page === "receipt" ? { eyebrow: "Resolved evaluation context", title: "Evaluation receipt", detail: "Exact selection and resolved read-set identities." } : { eyebrow: `${snapshot.result?.mode === "COMPARE" ? "Compare" : "Single"} evaluation`, title: "Current evaluation", detail: "Current receipt \xB7 exact selection" };
    const traceViewDefinition = STUDIO_TRACE_VIEWS.find(({ id: id2 }) => id2 === traceView) ?? STUDIO_TRACE_VIEWS[0];
    const traceViewNavigation = React4.createElement(
      "nav",
      { className: "studio-trace-view-navigation", "aria-label": "Trace renderer navigation" },
      React4.createElement(
        ButtonGroup,
        { segmented: true, className: "studio-trace-view-switcher", "aria-label": "Trace renderer views" },
        ...STUDIO_TRACE_VIEWS.map((view) => React4.createElement(Button2, { appearance: "segment", key: view.id, selected: traceView === view.id, type: "button", onClick: () => setTraceView(view.id) }, view.label))
      ),
      React4.createElement(Typography, { as: "span", className: "studio-trace-view-note", variant: "caption" }, traceViewDefinition.note)
    );
    return React4.createElement(Bi2.BiSurface, { className: "studio-theme-root", theme }, React4.createElement(
      "section",
      {
        id: "crystra-studio-view",
        role: "region",
        "aria-labelledby": "crystra-studio-title",
        "data-crystra-studio-view": "evaluate",
        style: viewStyle
      },
      React4.createElement("style", { "data-crystra-studio-host-styles": "crystra-dsh@1" }, hostStyles),
      sharedStyles === void 0 ? null : React4.createElement("style", { "data-crystra-bi-styles": "crystra-ui-core@0.1.0" }, sharedStyles),
      React4.createElement(
        Surface,
        { as: "header", level: "section", "data-crystra-studio-region": "header" },
        React4.createElement(
          "div",
          { className: "studio-product-row" },
          React4.createElement(
            "div",
            { className: "studio-breadcrumbs" },
            React4.createElement(Typography, { as: "strong", variant: "label" }, "CRYSTRA Studio"),
            React4.createElement(Typography, { variant: "caption" }, "/"),
            React4.createElement(Typography, { variant: "caption" }, "Evaluation"),
            snapshot.route.page === "trace" ? React4.createElement(
              React4.Fragment,
              null,
              React4.createElement(Typography, { variant: "caption" }, "/"),
              React4.createElement(Typography, { variant: "caption" }, "Trace")
            ) : null
          ),
          React4.createElement(
            "nav",
            { className: "studio-controls", "aria-label": "Studio views" },
            React4.createElement(Button2, { appearance: "ghost", className: "studio-view-link", type: "button", disabled: false, "aria-current": studioPage === "selection" ? "page" : void 0, onClick: () => {
              setSelectionRequested(true);
              setStudioPage("selection");
            } }, "Select"),
            React4.createElement(Button2, { appearance: "ghost", className: "studio-view-link", type: "button", disabled: snapshot.result === void 0 && !["receipt", "facts", "trace"].includes(snapshot.route.page), "aria-current": studioPage === "dashboard" && snapshot.route.page === "results" ? "page" : void 0, onClick: () => {
              controller.backToResults();
              setSelectionRequested(false);
              setStudioPage("dashboard");
            } }, "Dashboard"),
            React4.createElement(Button2, {
              appearance: "ghost",
              className: "studio-view-link",
              type: "button",
              disabled: evidenceUnavailableReason !== void 0,
              "aria-current": snapshot.route.page === "facts" ? "page" : void 0,
              "data-navigation-state": evidenceUnavailableReason === void 0 ? "available" : "unavailable",
              "data-unavailable-reason": evidenceUnavailableReason,
              title: evidenceUnavailableReason,
              onClick: () => controller.restoreExactEvidence()
            }, "Evidence"),
            React4.createElement(Button2, {
              appearance: "ghost",
              className: "studio-view-link",
              type: "button",
              disabled: traceUnavailableReason !== void 0,
              "aria-current": snapshot.route.page === "trace" ? "page" : void 0,
              "data-navigation-state": traceUnavailableReason === void 0 ? "available" : "unavailable",
              "data-unavailable-reason": traceUnavailableReason,
              title: traceUnavailableReason,
              onClick: () => controller.restoreExactTrace()
            }, "Recorded Trace")
          )
        ),
        React4.createElement(
          "div",
          { className: "studio-page-row" },
          React4.createElement(
            "div",
            { className: "studio-page-copy" },
            React4.createElement(Typography, { as: "span", className: "studio-eyebrow", variant: "eyebrow" }, pageIdentity.eyebrow),
            React4.createElement(Typography, { as: "h1", id: "crystra-studio-title", variant: "pageTitle" }, pageIdentity.title),
            React4.createElement(Typography, { as: "p", variant: snapshot.route.page === "trace" ? "code" : "caption" }, pageIdentity.detail)
          ),
          React4.createElement(
            ButtonGroup,
            { className: "studio-controls studio-page-actions", "aria-label": "Page actions" },
            studioPage === "selection" ? React4.createElement(
              React4.Fragment,
              null,
              React4.createElement(Button2, { appearance: "ghost", type: "button", disabled: snapshot.recentSelection === void 0, onClick: () => controller.setSelection(snapshot.recentSelection) }, "Use recent selection"),
              React4.createElement(Button2, { appearance: "outline", type: "button", disabled: snapshot.taskList.phase === "loading", onClick: () => controller.loadTasks() }, "Load tasks"),
              React4.createElement(Button2, { appearance: "solid", tone: "primary", type: "button", disabled: snapshot.selection === void 0, onClick: evaluateSelection }, "Evaluate selection")
            ) : null,
            studioPage === "dashboard" && snapshot.route.page === "results" ? React4.createElement(
              React4.Fragment,
              null,
              snapshot.result === void 0 ? null : React4.createElement(Button2, { type: "button", onClick: () => controller.openReceipt() }, "View receipt"),
              React4.createElement(Button2, { type: "button", onClick: () => setDashboardState(reduceStudioDashboardState(expandedDashboardState, { type: "PRESET", preset: "default" })) }, "Default overview"),
              React4.createElement(Button2, { type: "button", onClick: () => {
                setSelectionRequested(true);
                setStudioPage("selection");
              } }, "Change evaluation")
            ) : null,
            studioPage === "dashboard" && snapshot.route.page === "trace" ? React4.createElement(
              React4.Fragment,
              null,
              React4.createElement(Button2, { appearance: "outline", type: "button", onClick: () => controller.backToResults() }, "Back to Dashboard"),
              React4.createElement(Button2, {
                appearance: "outline",
                type: "button",
                disabled: evidenceUnavailableReason !== void 0,
                "data-unavailable-reason": evidenceUnavailableReason,
                title: evidenceUnavailableReason,
                onClick: () => controller.restoreExactEvidence()
              }, "Open Evidence"),
              React4.createElement(Button2, { appearance: "solid", tone: "primary", type: "button", onClick: () => navigator.clipboard?.writeText(snapshot.route.traceId) }, "Copy trace identity")
            ) : null,
            studioPage === "dashboard" && editingDashboard ? React4.createElement(
              React4.Fragment,
              null,
              React4.createElement(Button2, { type: "button", onClick: () => setDashboardState(reduceStudioDashboardState(expandedDashboardState, { type: "RESET" })) }, "Reset layout"),
              React4.createElement(Button2, { appearance: "solid", tone: "primary", type: "button", onClick: () => {
                layoutStore.save(expandedDashboardState);
                setSavedDashboardState(expandedDashboardState);
                setEditingDashboard(false);
              } }, "Save layout"),
              React4.createElement(Button2, { appearance: "ghost", type: "button", onClick: () => {
                setDashboardState(savedDashboardState);
                setEditingDashboard(false);
              } }, "Cancel editing")
            ) : studioPage === "dashboard" && snapshot.route.page === "results" ? React4.createElement(Button2, { appearance: "solid", tone: "primary", type: "button", onClick: () => {
              setSavedDashboardState(expandedDashboardState);
              setEditingDashboard(true);
            } }, "Edit dashboard") : null
          )
        ),
        studioPage === "dashboard" && editingDashboard && metricPanelIds.some((id2) => expandedDashboardState.hidden.includes(id2)) ? React4.createElement(
          "div",
          { className: "studio-controls", "aria-label": "Add dashboard panels" },
          ...metricPanelIds.filter((id2) => expandedDashboardState.hidden.includes(id2)).map((panelId) => React4.createElement(Button2, { key: panelId, type: "button", onClick: () => updateDashboard({ type: "ADD", panelId }) }, `Add ${panelId}`))
        ) : null
      ),
      React4.createElement(
        "main",
        {
          tabIndex: -1,
          "data-crystra-studio-region": "main",
          "data-crystra-studio-page": studioPage
        },
        snapshot.phase === "loading" || snapshot.refreshing ? React4.createElement("p", { role: "status", "aria-live": "polite" }, snapshot.refreshing ? "Refreshing evaluation\u2026" : "Loading evaluation\u2026") : null,
        snapshot.error === void 0 ? null : React4.createElement(
          "section",
          { role: "alert", "aria-live": "assertive" },
          React4.createElement("h2", null, snapshot.result === void 0 ? "Evaluate unavailable" : "Showing the last result"),
          React4.createElement("p", null, snapshot.error.message),
          React4.createElement(Button2, { type: "button", style: controlStyle, onClick: () => controller.refresh() }, "Retry")
        ),
        studioPage === "selection" ? React4.createElement(
          "section",
          {
            "aria-labelledby": "crystra-task-selection",
            className: "studio-selection-grid"
          },
          React4.createElement(
            Surface,
            { as: "section", level: "section", className: "studio-selection-card", "data-crystra-selection-browser": "task-population" },
            React4.createElement(
              "header",
              { className: "studio-selection-head" },
              React4.createElement(
                "div",
                null,
                React4.createElement(Typography, { as: "h2", id: "crystra-task-selection", variant: "sectionTitle" }, "Task population"),
                React4.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, `${taskItems.length} Tasks \xB7 exact identities retained in the receipt`)
              ),
              React4.createElement(
                ButtonGroup,
                { segmented: true, className: "studio-mode", "aria-label": "Evaluation mode" },
                React4.createElement(Button2, { appearance: "segment", selected: snapshot.selection?.mode !== "compare", type: "button", onClick: () => chooseMode("single") }, "Single"),
                React4.createElement(Button2, { appearance: "segment", selected: snapshot.selection?.mode === "compare", type: "button", onClick: () => chooseMode("compare") }, "Compare")
              )
            ),
            React4.createElement(
              "div",
              { className: "studio-selection-filter" },
              React4.createElement(TextInput, { inputKind: "search", "aria-label": "Search Tasks", placeholder: "Search name or exact Task ID", value: taskQuery, onChange: (event) => setTaskQuery(event.target.value) }),
              React4.createElement(Button2, { type: "button", "aria-expanded": filtersOpen, onClick: () => setFiltersOpen(!filtersOpen) }, "Filters"),
              filtersOpen ? React4.createElement(
                "div",
                { className: "studio-filter-options", role: "group", "aria-label": "Task filters" },
                ...[["all", "All"], ["selected", "Selected"], ["available", "Available"]].map(([value, label]) => React4.createElement(Button2, { key: value, type: "button", "aria-pressed": taskFilter === value, onClick: () => setTaskFilter(value) }, label)),
                snapshot.taskList.page?.next_cursor ? React4.createElement(Button2, { type: "button", onClick: () => controller.loadTasks(snapshot.taskList.page.next_cursor) }, "Load more tasks") : null
              ) : null
            ),
            snapshot.taskList.phase === "error" ? React4.createElement("p", { role: "alert" }, "Task list unavailable; the current selection remains usable.") : null,
            snapshot.selection?.mode === "compare" ? React4.createElement("div", { className: "studio-task-list" }, ...[["Before", "left", before], ["After", "right", after]].flatMap(([label, side2, selected]) => [
              React4.createElement(Typography, { as: "strong", key: `${side2}-label`, variant: "label" }, label),
              ...visibleTaskItems.map((task) => React4.createElement(
                "div",
                { className: "studio-task-row", "data-crystra-selection-side": side2, "data-crystra-task-id": task.task_id, key: `${side2}-${task.task_id}` },
                React4.createElement(
                  "label",
                  null,
                  React4.createElement("input", { type: "checkbox", checked: selected.includes(task.task_id), onChange: (event) => setComparedTask(side2, task.task_id, event.target.checked) }),
                  React4.createElement(
                    "span",
                    null,
                    React4.createElement(Typography, { as: "strong", variant: "label" }, task.display_name ?? task.task_id),
                    React4.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, task.task_id)
                  )
                ),
                React4.createElement(StatusBadge, { status: selected.includes(task.task_id) ? "selected" : "available" }, selected.includes(task.task_id) ? "Selected" : "Available")
              ))
            ])) : React4.createElement("div", { className: "studio-task-list", role: "list" }, ...visibleTaskItems.map((task) => React4.createElement(
              "div",
              { className: "studio-task-row", "data-crystra-task-id": task.task_id, key: task.task_id, role: "listitem" },
              React4.createElement(
                "label",
                null,
                React4.createElement("input", { type: "checkbox", checked: current.includes(task.task_id), onChange: (event) => setTask(task.task_id, event.target.checked) }),
                React4.createElement(
                  "span",
                  null,
                  React4.createElement(Typography, { as: "strong", variant: "label" }, task.display_name ?? task.task_id),
                  React4.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, task.task_id)
                )
              ),
              React4.createElement(StatusBadge, { status: current.includes(task.task_id) ? "selected" : "available" }, current.includes(task.task_id) ? "Selected" : "Available")
            ))),
            snapshot.taskList.phase === "ready" && taskItems.length === 0 ? React4.createElement("p", { role: "status" }, "No Tasks are available in Evidence.") : null
          ),
          React4.createElement(
            Surface,
            { as: "aside", level: "section", className: "studio-selection-card", "aria-label": "Current selection" },
            React4.createElement(
              "header",
              { className: "studio-selection-head" },
              React4.createElement(
                "div",
                null,
                React4.createElement(Typography, { as: "h2", variant: "sectionTitle" }, "Current selection"),
                React4.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, snapshot.selection?.mode === "compare" ? `${before.length} Before \xB7 ${after.length} After` : `Single evaluation \xB7 ${current.length} ${current.length === 1 ? "Task" : "Tasks"}`)
              ),
              React4.createElement(Button2, { appearance: "ghost", type: "button", disabled: snapshot.selection === void 0, onClick: () => controller.clearSelection() }, "Clear")
            ),
            React4.createElement(
              "div",
              { className: "studio-selected-list" },
              ...(snapshot.selection?.mode === "compare" ? [["Before", before], ["After", after]] : [["Selected", current]]).flatMap(([label, ids]) => [
                React4.createElement(Typography, { as: "strong", key: `${label}-heading`, variant: "label" }, label),
                ...ids.map((id2) => {
                  const task = taskItems.find((candidate) => candidate.task_id === id2);
                  return React4.createElement(
                    "div",
                    { className: "studio-selected-item", key: `${label}-${id2}` },
                    React4.createElement(Typography, { as: "strong", variant: "label" }, task?.display_name ?? id2),
                    React4.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, id2)
                  );
                })
              ]),
              React4.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, "Evaluation resolves a current receipt. Layout and display names do not enter evaluation identity.")
            )
          )
        ) : null,
        studioPage !== "dashboard" || snapshot.route.page !== "results" ? null : snapshot.result === void 0 ? React4.createElement("p", null, "Choose one or more Tasks to evaluate.") : React4.createElement(
          "section",
          { "aria-label": snapshot.result.mode === "COMPARE" ? "Compared Metric Results" : "Metric Results" },
          snapshot.phase === "partial" ? React4.createElement("p", { role: "status" }, "Partial comparison: the available side remains visible.") : null,
          React4.createElement(
            Bi2.BiSurface,
            { theme },
            React4.createElement("div", {
              "data-crystra-dashboard-layout": DEFAULT_LAYOUT.schemaVersion
            }, ...dashboardMetrics.filter((metric) => snapshot.result.mode !== "COMPARE" || !deltaCoordinates.has(metric.coordinate)).map((metric) => {
              const panelId = metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@"));
              const placement = studioPanelPlacement(panelId, expandedDashboardState.sizes[panelId]);
              return React4.createElement(
                "article",
                {
                  key: metric.coordinate,
                  "data-crystra-bi-metric": metric.coordinate,
                  "data-crystra-dashboard-panel": panelId,
                  style: {
                    "--studio-panel-desktop-columns": placement.desktop,
                    "--studio-panel-tablet-columns": placement.tablet,
                    "--studio-panel-mobile-columns": placement.mobile
                  }
                },
                editingDashboard ? React4.createElement(
                  "div",
                  { className: "studio-controls", "aria-label": `${panelId} layout controls` },
                  React4.createElement(Button2, { type: "button", onClick: () => updateDashboard({ type: "RESIZE", panelId, size: placement.desktop >= 12 ? "compact" : placement.desktop >= 6 ? "full" : "wide" }) }, "Resize panel"),
                  React4.createElement(Button2, { type: "button", onClick: () => {
                    const index = expandedDashboardState.order.indexOf(panelId);
                    if (index > 0) updateDashboard({ type: "MOVE", panelId, beforePanelId: expandedDashboardState.order[index - 1] });
                  } }, "Move earlier"),
                  React4.createElement(Button2, { type: "button", onClick: () => updateDashboard({ type: "REMOVE", panelId }) }, "Remove panel")
                ) : null,
                snapshot.result.mode === "COMPARE" ? React4.createElement("h3", null, metric.coordinate) : null,
                ...metric.sides.map(({ side: side2, slices }) => {
                  const result = {
                    metric_id: metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@")),
                    metric_version: metric.coordinate.slice(metric.coordinate.lastIndexOf("@") + 1),
                    slices
                  };
                  return React4.createElement(
                    "section",
                    { key: side2, "aria-label": `${side2} Metric Result` },
                    snapshot.result.mode === "COMPARE" ? React4.createElement("h4", null, `${side2} side`) : null,
                    React4.createElement(Bi2.DashboardMetricPanel, {
                      result,
                      size: placement.desktop >= 12 ? "WIDE" : placement.desktop >= 6 ? "MEDIUM" : "SMALL",
                      onEvidence: () => controller.openFacts(metric.coordinate, "result", side2)
                    })
                  );
                })
              );
            })),
            ...snapshot.result.mode === "COMPARE" ? presentation.deltas.map((delta) => {
              const before2 = metricSlice(snapshot.result.left, delta.metric_coordinate, delta.slice_key);
              const after2 = metricSlice(snapshot.result.right, delta.metric_coordinate, delta.slice_key);
              return React4.createElement(Bi2.CompareResultFrame, {
                key: `${delta.metric_coordinate}-${sliceIdentity(delta.slice_key)}`,
                coordinate: delta.metric_coordinate,
                before: before2,
                after: after2,
                beforeError: snapshot.result.left?.tag === "SIDE_ERROR" ? snapshot.result.left : void 0,
                afterError: snapshot.result.right?.tag === "SIDE_ERROR" ? snapshot.result.right : void 0,
                delta,
                onRetryFailedSide: () => controller.refresh(),
                onEvidence: (side2) => controller.openFacts(delta.metric_coordinate, "result", side2),
                visualizer: Bi2.selectDefaultVisualizer({
                  metric_id: delta.metric_coordinate.slice(0, delta.metric_coordinate.lastIndexOf("@")),
                  metric_version: delta.metric_coordinate.slice(delta.metric_coordinate.lastIndexOf("@") + 1),
                  slices: [before2 ?? after2].filter(Boolean)
                })
              });
            }) : []
          )
        ),
        studioPage === "dashboard" && snapshot.route.page === "receipt" ? React4.createElement(
          "section",
          { "aria-label": "Evaluation receipts" },
          React4.createElement("h2", null, "Receipts"),
          React4.createElement(Button2, { type: "button", onClick: () => controller.backToResults() }, "Back to Metric Results"),
          React4.createElement(
            Bi2.BiSurface,
            { theme },
            ...presentation.receipts.map(({ side: side2, receipt }) => React4.createElement(Bi2.ReceiptView, {
              key: side2,
              receipt,
              side: side2
            }))
          ),
          React4.createElement(
            "details",
            { onToggle: (event) => setTechnicalDetailsOpen(event.currentTarget.open) },
            React4.createElement("summary", null, "Technical JSON details"),
            technicalDetailsOpen ? json(snapshot.result, "Evaluation receipt JSON") : null
          )
        ) : null,
        studioPage === "dashboard" && snapshot.route.page === "facts" ? React4.createElement(
          "section",
          { "aria-label": "Fact drill-down" },
          React4.createElement(Button2, { type: "button", onClick: () => controller.backToResults() }, "Back to Metric Results"),
          React4.createElement(
            Bi2.BiSurface,
            { theme },
            React4.createElement(Bi2.EvidenceConsoleFoundation, {
              scope: snapshot.route.scope,
              state: presentation.drilldownError !== void 0 ? { tag: "ERROR", detail: presentation.drilldownError.message } : !factsCompatible ? { tag: "ERROR", detail: "Studio received an incompatible formal Fact shape" } : snapshot.drilldown.phase === "loading" ? { tag: "LOADING" } : facts.length === 0 ? { tag: "EMPTY" } : facts.every((row) => row.truth.expiry === "EXPIRED") ? { tag: "EXPIRED" } : { tag: "READY" },
              rows: facts.filter(Boolean),
              references: (snapshot.drilldown.references ?? []).map((reference) => ({
                kind: "PUBLISHED_PROVENANCE",
                identity: reference.identity,
                provenance: reference.identity,
                loadedAsFact: reference.loadedAsFact
              })),
              onScopeChange: (scope) => {
                controller.openFacts(snapshot.route.metric, scope, snapshot.route.side);
                void controller.loadMetricFacts(snapshot.route.metric, scope, snapshot.route.side);
              },
              onOpenTrace: (traceId, spanId) => {
                controller.openTrace(traceId, spanId);
                void controller.loadTrace({ trace_id: traceId, limit: 200 });
              }
            })
          )
        ) : null,
        studioPage === "dashboard" && snapshot.route.page === "trace" ? React4.createElement(
          "section",
          { "aria-label": "Recorded Trace drill-down" },
          presentation.drilldownError === void 0 ? null : React4.createElement("p", { role: "alert" }, presentation.drilldownError.message),
          recorded === void 0 ? React4.createElement(
            "p",
            { role: presentation.trace.length > 0 ? "alert" : "status" },
            presentation.trace.length > 0 ? "Studio received an incompatible formal Trace shape" : "No recorded Trace items"
          ) : React4.createElement(
            Bi2.BiSurface,
            { theme },
            React4.createElement(
              "div",
              { "data-studio-trace-hierarchy": "navigation-header-content" },
              recorded.status === "INVALID" ? React4.createElement("p", { role: "alert" }, recorded.errors.join("; ")) : null,
              traceViewNavigation,
              React4.createElement(Bi2[STUDIO_TRACE_VIEWS.find(({ id: id2 }) => id2 === traceView)?.renderer ?? "TraceWaterfall"], {
                trace: recorded,
                showSummary: false
              })
            )
          )
        ) : null
      ),
      studioPage === "dashboard" && snapshot.route.page === "results" && snapshot.result !== void 0 ? React4.createElement(
        Surface,
        { as: "footer", border: "dashed", level: "raised", "data-crystra-studio-region": "footer" },
        React4.createElement(Typography, { as: "strong", variant: "label" }, presentation.trace.length > 0 ? "Recorded Trace is available" : "Recorded Trace availability follows current Evidence"),
        React4.createElement(Typography, { variant: "caption" }, " \xB7 exact recorded identities only; no inferred ordering")
      ) : null
    ));
  };
}
function createStudioClientPlugin({ React: React4, Primitives: Primitives2 = {}, Bi: Bi2, sharedStyles, initialContext, storage, themeMode } = {}) {
  if (React4 === void 0) throw new Error("STUDIO_REACT_REQUIRED");
  const component = (value) => {
    if (typeof value === "function" || typeof value === "string") return true;
    if (value === null || typeof value !== "object") return false;
    return value.$$typeof === Symbol.for("react.memo") || value.$$typeof === Symbol.for("react.forward_ref") || value.$$typeof === Symbol.for("react.lazy");
  };
  if (Bi2 === void 0 || !component(Bi2.BiSurface) || !component(Bi2.Button) || !component(Bi2.ButtonGroup) || !component(Bi2.DashboardMetricPanel) || !component(Bi2.StatusBadge) || !component(Bi2.Surface) || !component(Bi2.TextInput) || !component(Bi2.Typography) || !component(Bi2.MetricPanel) || !component(Bi2.CompareResultFrame) || !component(Bi2.ReceiptView) || !component(Bi2.ScopedError) || !component(Bi2.EvidenceConsoleFoundation) || !component(Bi2.TraceWaterfall) || !component(Bi2.TraceTree) || typeof Bi2.compileTraceView !== "function" || typeof Bi2.selectDefaultVisualizer !== "function" || typeof Bi2.createBiTheme !== "function") {
    throw new Error("STUDIO_BI_REQUIRED");
  }
  return {
    name: "crystra-studio-client",
    inject: ["connection", "slots"],
    apply(ctx) {
      const resolvedStorage = storage ?? (typeof window === "undefined" ? void 0 : window.sessionStorage);
      const controller = createEvaluateController({
        catalogCoordinates: Bi2.CATALOG_COORDINATES,
        gateway: createStudioGatewayPort(ctx),
        initialContext,
        storage: resolvedStorage
      });
      let dispose = () => void 0;
      ctx.slots.inject("conversation.view", () => {
        dispose = ctx.slots.register({
          name: "conversation.view",
          id: "crystra-studio",
          order: 30,
          label: "CRYSTRA Studio"
        }, StudioView(React4, Primitives2, Bi2, sharedStyles, controller, themeMode, resolvedStorage));
      });
      return Object.assign(() => dispose?.(), { controller });
    }
  };
}

// modules/studio/src/client/browser-entry.js
var Bi = Object.freeze({
  BiSurface: j,
  Button: b,
  ButtonGroup: S,
  CATALOG_COORDINATES: at,
  CompareResultFrame: Ve,
  DashboardMetricPanel: Le,
  EvidenceConsoleFoundation: kt,
  MetricPanel: Re,
  ReceiptView: wt,
  ScopedError: q,
  StatusBadge: D,
  Surface: C,
  TextInput: T,
  TraceTree: jn,
  TraceWaterfall: xn,
  Typography: y,
  compileTraceView: Jn,
  createBiTheme: zn,
  selectDefaultVisualizer: he
});
var plugin = createStudioClientPlugin({ React: import_react4.default, Primitives, Bi, sharedStyles: styles_default });
var name3 = plugin.name;
var inject3 = plugin.inject;
var apply3 = plugin.apply;

// src/client/index.js
var name4 = "crystra-client";
var inject4 = [.../* @__PURE__ */ new Set([...inject2, ...inject3, ...inject])];
function apply4(ctx) {
  ctx.plugin(client_exports);
  ctx.plugin(browser_entry_exports);
  ctx.plugin(browser_entry_exports2);
}

    return module.exports;
  },
});
