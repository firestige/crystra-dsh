import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "crystra-ui-core";
import { ExpandableSearchField } from "crystra-ui-core";
import { CrystraBrandMark, NewTaskGlyph } from "./brand";
import {
  sidebarLabels,
  type SidebarProps,
  type SidebarSection,
  type SidebarLink,
} from "./model";
import "./sidebar.css";

const ignoreQuery = () => {};

function Tool({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, rect.left), top: rect.bottom + 6 });
  };
  return (
    <span
      className="cs-tool"
      aria-describedby={position ? id : undefined}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPosition(null)}
      onClick={() => setPosition(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPosition(null);
      }}
    >
      {children}
      {position &&
        createPortal(
          <span id={id} role="tooltip" className="cs-tooltip" style={position}>
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
function NavLink({
  item,
  onNavigate,
  children,
  className = "",
  section,
}: {
  item: SidebarLink;
  onNavigate?: SidebarProps["onNavigate"];
  children: ReactNode;
  className?: string;
  section?: string;
}) {
  return (
    <a
      href={item.href}
      data-item-id={item.id}
      data-section-id={section}
      className={`cs-link ${className}`}
      aria-current={item.selected ? "page" : undefined}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          !onNavigate ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          event.defaultPrevented
        )
          return;
        event.preventDefault();
        onNavigate(item.href);
      }}
    >
      {children}
    </a>
  );
}
function Badge({ count }: { count?: number }) {
  return count && count > 0 ? <span className="cs-badge">{count}</span> : null;
}

function Directory({
  kind,
  label,
  expanded,
  onExpandedChange,
  transientOpen,
  allHref,
  allSelected,
  onNavigate,
  children,
  menu,
  labels,
  attention,
  query,
  onQueryChange,
}: {
  kind: SidebarSection;
  label: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  transientOpen: boolean;
  allHref?: string;
  allSelected?: boolean;
  onNavigate?: SidebarProps["onNavigate"];
  children: ReactNode;
  menu?: ReactNode;
  labels: typeof sidebarLabels;
  attention?: number;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [search, setSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const closeSearch = () => {
    setSearch(false);
    onQueryChange("");
  };
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setSearch(false);
      setMenuOpen(false);
      onQueryChange("");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [onQueryChange]);
  if (!expanded && !transientOpen && (search || menuOpen)) {
    setSearch(false);
    setMenuOpen(false);
  }
  const title = (
    <>
      <button
        type="button"
        data-section-id={`${kind}-section-toggle`}
        className="cs-disclosure"
        aria-label={label}
        aria-expanded={expanded || transientOpen}
        aria-controls={contentId}
        onClick={() => {
          setMenuOpen(false);
          closeSearch();
          onExpandedChange(!expanded);
        }}
      >
        <Icon
          name="chevron-down"
          size="disclosure"
          className="cs-chevron"
          data-expanded={expanded || transientOpen}
        />
        <span>{label}</span>
        {kind === "task" && !expanded && <Badge count={attention} />}
      </button>
      {kind !== "analysis" && (
        <>
          <span className="cs-search-seat" />
          <Tool label={kind === "task" ? labels.taskView : labels.workflowView}>
            <button
              ref={menuButton}
              className="cs-icon-button"
              type="button"
              aria-label={
                kind === "task" ? labels.taskView : labels.workflowView
              }
              data-section-id={`${kind}-view-options-action`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="adjustments-horizontal" />
            </button>
          </Tool>
          <Tool label={kind === "task" ? labels.allTasks : labels.allWorkflows}>
            <NavLink
              section={
                kind === "task" ? "all-tasks-action" : "all-workflows-action"
              }
              className="cs-icon-button"
              item={{
                id: `all-${kind}`,
                href: allHref!,
                title: label,
                selected: allSelected,
              }}
              onNavigate={onNavigate}
            >
              <span className="cs-sr-only">
                {kind === "task" ? labels.allTasks : labels.allWorkflows}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                aria-hidden="true"
                data-iconify="tabler:player-play-filled"
              >
                <path
                  fill="currentColor"
                  d="M6 4a2 2 0 0 1 3-1.73l12 7a2 2 0 0 1 0 3.46l-12 7A2 2 0 0 1 6 18Z"
                />
              </svg>
            </NavLink>
          </Tool>
        </>
      )}
    </>
  );
  return (
    <section
      ref={root}
      className="cs-section"
      data-kind={kind}
      data-expanded={expanded}
      data-panel-open={transientOpen}
      data-section-id={
        kind === "task" ? "task-working-set" : `${kind}-navigation`
      }
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (search) {
          event.stopPropagation();
          closeSearch();
        } else if (menuOpen) {
          event.stopPropagation();
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <header
        className="cs-section-header"
        data-section-id={`${kind}-section-header`}
        data-search-open={search}
        onClickCapture={(event) => {
          if (
            search &&
            (event.target as Element).closest(
              ".crystra-expandable-search-trigger",
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
            closeSearch();
          }
        }}
      >
        {kind === "analysis" ? (
          title
        ) : (
          <ExpandableSearchField
            label={kind === "task" ? labels.searchTask : labels.searchWorkflow}
            title={title}
            expanded={search}
            value={query}
            onValueChange={onQueryChange}
            cancelLabel={labels.closeSearch}
            maxLength={500}
            onExpandedChange={(open) => {
              setSearch(open);
              setMenuOpen(false);
              if (open) onExpandedChange(true);
              else onQueryChange("");
            }}
            triggerProps={{
              title:
                kind === "task" ? labels.searchTask : labels.searchWorkflow,
            }}
          />
        )}
        {menuOpen && (
          <div
            role="menu"
            aria-label={kind === "task" ? labels.taskView : labels.workflowView}
            className="cs-menu"
            data-section-id={`${kind}-view-options-menu`}
          >
            {menu}
          </div>
        )}
      </header>
      <div
        id={contentId}
        hidden={!expanded && !transientOpen}
        className="cs-section-content"
        data-section-id={`${kind}-section-content`}
      >
        {children}
      </div>
    </section>
  );
}

export function Sidebar(props: SidebarProps) {
  const {
    preferences,
    onPreferencesChange,
    tasks,
    workflows,
    analysis,
    onNavigate,
  } = props;
  const labels = { ...sidebarLabels, ...props.labels };
  const [panel, setPanel] = useState<SidebarSection | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  const [workflowQuery, setWorkflowQuery] = useState("");
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLElement>(null);
  const id = useId();
  const attention = tasks.reduce(
    (sum, item) => sum + Math.max(0, item.attention ?? 0),
    0,
  );
  const closePanel = (restoreFocus = false) => {
    if (restoreFocus && panel)
      rail.current
        ?.querySelector<HTMLButtonElement>(`[data-kind="${panel}"]`)
        ?.focus();
    setPanel(null);
  };
  useEffect(() => {
    if (!preferences.collapsed || !panel) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPanel(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [preferences.collapsed, panel]);
  const changeCollapsed = (collapsed: boolean) => {
    closePanel();
    setTaskQuery("");
    setWorkflowQuery("");
    onPreferencesChange({ ...preferences, collapsed });
  };
  const expand = (kind: SidebarSection, expanded: boolean) =>
    onPreferencesChange({
      ...preferences,
      expanded: { ...preferences.expanded, [kind]: expanded },
    });
  const matchingTasks = tasks
    .filter(
      (item) =>
        (!preferences.activeOnly || item.active !== false) &&
        item.title
          .toLocaleLowerCase()
          .includes(taskQuery.trim().toLocaleLowerCase()),
    )
    .slice()
    .sort((a, b) =>
      preferences.taskSort === "created"
        ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
        : (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0),
    );
  const matchingWorkflows = workflows
    .filter((item) =>
      item.title
        .toLocaleLowerCase()
        .includes(workflowQuery.trim().toLocaleLowerCase()),
    )
    .slice()
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title) *
        (preferences.workflowSort === "asc" ? 1 : -1),
    );
  const option = (
    label: string,
    checked: boolean,
    onClick: () => void,
    checkbox = false,
  ) => (
    <button
      type="button"
      role={checkbox ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={checked}
      onClick={onClick}
    >
      <span className="cs-option-check">
        {checked && <Icon name="check" />}
      </span>
      {label}
    </button>
  );
  const navigate = (href: string) => {
    closePanel(true);
    onNavigate?.(href);
  };
  const sectionProps = {
    labels,
    onNavigate: onNavigate ? navigate : undefined,
  };
  const sections: { kind: SidebarSection; icon: IconName }[] = [
    { kind: "task", icon: "clipboard-list" },
    { kind: "workflow", icon: "git-branch" },
    { kind: "analysis", icon: "chart-dots" },
  ];
  return (
    <aside
      ref={root}
      id={id}
      className="crystra-bi crystra-sidebar"
      data-ui-owner="components"
      data-section-id="sidebar"
      data-collapsed={preferences.collapsed}
      data-open-panel={preferences.collapsed ? (panel ?? "") : ""}
      onKeyDown={(e) => {
        if (e.key === "Escape" && panel) {
          e.stopPropagation();
          closePanel(true);
        }
      }}
    >
      <div className="cs-brand-row" data-section-id="sidebar-logo-row">
        <Tool label={preferences.collapsed ? labels.expand : labels.harness}>
          <button
            type="button"
            className="cs-brand"
            data-section-id="surface-banner"
            aria-label={preferences.collapsed ? labels.expand : labels.harness}
            disabled={!preferences.collapsed && !props.onOpenHarness}
            onClick={() =>
              preferences.collapsed
                ? changeCollapsed(false)
                : props.onOpenHarness?.()
            }
          >
            <span className="cs-brand-mark">
              {props.brandMark ?? <CrystraBrandMark />}
            </span>
            <span className="cs-brand-expand">
              <Icon name="layout-sidebar-left-expand" size="brand-slot" />
            </span>
            <span className="cs-brand-name">{labels.brand}</span>
          </button>
        </Tool>
        <Tool label={labels.collapse}>
          <button
            type="button"
            className="cs-icon-button cs-collapse"
            data-section-id="sidebar-toggle"
            aria-label={labels.collapse}
            aria-expanded={!preferences.collapsed}
            aria-controls={id}
            onClick={() => changeCollapsed(true)}
          >
            <Icon name="layout-sidebar-left-collapse" size="navigation" />
          </button>
        </Tool>
      </div>
      <button
        type="button"
        className="cs-new"
        aria-label={labels.newTask}
        data-section-id="new-task-action"
        onClick={props.onNewTask}
      >
        <NewTaskGlyph />
        <span>{labels.newTask}</span>
      </button>
      <nav
        ref={rail}
        aria-label={labels.rail}
        className="cs-rail"
        hidden={!preferences.collapsed}
      >
        {sections.map(({ kind, icon }) => (
          <Tool key={kind} label={labels[kind]}>
            <button
              type="button"
              className="cs-icon-button"
              data-kind={kind}
              data-section-id={`sidebar-rail-${kind === "task" ? "tasks" : kind === "workflow" ? "workflows" : "analysis"}`}
              aria-label={labels[kind]}
              aria-expanded={panel === kind}
              onClick={() => setPanel(panel === kind ? null : kind)}
            >
              <Icon name={String(icon)} size="navigation" />
              {kind === "task" && <Badge count={attention} />}
            </button>
          </Tool>
        ))}
      </nav>
      <div
        className="cs-directories"
        inert={preferences.collapsed && !panel}
        aria-hidden={preferences.collapsed && !panel}
      >
        <Directory
          {...sectionProps}
          kind="task"
          label={labels.task}
          expanded={preferences.expanded.task}
          onExpandedChange={(open) => expand("task", open)}
          transientOpen={preferences.collapsed && panel === "task"}
          allHref={props.allTasksHref}
          allSelected={props.tasksSelected}
          attention={attention}
          query={taskQuery}
          onQueryChange={setTaskQuery}
          menu={
            <>
              {option(labels.created, preferences.taskSort === "created", () =>
                onPreferencesChange({ ...preferences, taskSort: "created" }),
              )}
              {option(
                labels.activity,
                preferences.taskSort === "activity",
                () =>
                  onPreferencesChange({ ...preferences, taskSort: "activity" }),
              )}
              {option(
                labels.activeOnly,
                preferences.activeOnly,
                () =>
                  onPreferencesChange({
                    ...preferences,
                    activeOnly: !preferences.activeOnly,
                  }),
                true,
              )}
            </>
          }
        >
          <div className="cs-task-list" data-section-id="task-list">
            {props.taskFeedback}
            {matchingTasks.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                onNavigate={onNavigate ? navigate : undefined}
                className="cs-task-row"
              >
                <span className="cs-status" data-status={item.status} />
                <span className="cs-row-title" title={item.title}>
                  {item.title}
                </span>
                {item.relativeTime && (
                  <span className="cs-time">{item.relativeTime}</span>
                )}
                <Badge count={item.attention} />
              </NavLink>
            ))}
            {!matchingTasks.length && props.tasksReady !== false && (
              <p className="cs-empty">
                {tasks.length ? labels.noMatches : labels.emptyTasks}
              </p>
            )}
          </div>
        </Directory>
        <Directory
          {...sectionProps}
          kind="workflow"
          label={labels.workflow}
          expanded={preferences.expanded.workflow}
          onExpandedChange={(open) => expand("workflow", open)}
          transientOpen={preferences.collapsed && panel === "workflow"}
          allHref={props.allWorkflowsHref}
          allSelected={props.workflowsSelected}
          query={workflowQuery}
          onQueryChange={setWorkflowQuery}
          menu={
            <>
              {option(
                labels.ascending,
                preferences.workflowSort === "asc",
                () =>
                  onPreferencesChange({ ...preferences, workflowSort: "asc" }),
              )}
              {option(
                labels.descending,
                preferences.workflowSort === "desc",
                () =>
                  onPreferencesChange({ ...preferences, workflowSort: "desc" }),
              )}
              {option(
                labels.versions,
                preferences.showVersions,
                () =>
                  onPreferencesChange({
                    ...preferences,
                    showVersions: !preferences.showVersions,
                  }),
                true,
              )}
            </>
          }
        >
          {props.workflowFeedback}
          {matchingWorkflows.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              onNavigate={onNavigate ? navigate : undefined}
              className="cs-workflow-row"
            >
              <span className="cs-status" />
              <span className="cs-row-title" title={item.title}>
                {item.title}
              </span>
              {preferences.showVersions && (
                <span className="cs-time">{item.version ?? item.revision}</span>
              )}
            </NavLink>
          ))}
          {!matchingWorkflows.length && props.workflowsReady !== false && (
            <p className="cs-empty">
              {workflows.length ? labels.noMatches : labels.emptyWorkflows}
            </p>
          )}
        </Directory>
        <Directory
          {...sectionProps}
          kind="analysis"
          label={labels.analysis}
          expanded={preferences.expanded.analysis}
          onExpandedChange={(open) => expand("analysis", open)}
          transientOpen={preferences.collapsed && panel === "analysis"}
          query=""
          onQueryChange={ignoreQuery}
        >
          {analysis.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              onNavigate={onNavigate ? navigate : undefined}
              className="cs-analysis-row"
            >
              <Icon
                name={String(item.icon ?? "chart-dots")}
                size="navigation"
              />
              <span className="cs-row-title">{item.title}</span>
              <Badge count={item.attention} />
            </NavLink>
          ))}
          {!analysis.length && (
            <p className="cs-empty">{labels.emptyAnalysis}</p>
          )}
        </Directory>
      </div>
      <footer className="cs-footer" data-section-id="sidebar-footer">
        <Tool label={labels.settings}>
          <button
            type="button"
            className="cs-settings"
            data-section-id="host-settings"
            aria-label={labels.settings}
            disabled={!props.onOpenSettings}
            onClick={props.onOpenSettings}
          >
            <Icon name="settings" size="navigation" />
            <span>{labels.settings}</span>
          </button>
        </Tool>
      </footer>
    </aside>
  );
}
