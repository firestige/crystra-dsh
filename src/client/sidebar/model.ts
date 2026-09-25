import type { ReactNode } from "react";
import type { IconName } from "crystra-ui-core";

export type SidebarSection = "task" | "workflow" | "analysis";
export interface SidebarLink {
  id: string;
  title: string;
  href: string;
  selected?: boolean;
  attention?: number;
}
export interface SidebarTask extends SidebarLink {
  status?: "failed" | "review" | "running" | "complete";
  active?: boolean;
  relativeTime?: string;
  /** Epoch milliseconds provided by the data owner; never inferred from display text. */
  createdAt?: number;
  lastActivityAt?: number;
}
export interface SidebarWorkflow extends SidebarLink {
  revision: string;
  version?: string;
}
export interface SidebarAnalysis extends SidebarLink {
  icon?: IconName;
}
export interface SidebarPreferences {
  collapsed: boolean;
  expanded: Record<SidebarSection, boolean>;
  taskSort: "created" | "activity";
  activeOnly: boolean;
  workflowSort: "asc" | "desc";
  showVersions: boolean;
}
export const defaultSidebarPreferences: SidebarPreferences = {
  collapsed: false,
  expanded: { task: true, workflow: true, analysis: true },
  taskSort: "created",
  activeOnly: false,
  workflowSort: "asc",
  showVersions: true,
};
export interface SidebarProps {
  tasks: readonly SidebarTask[];
  taskFeedback?: ReactNode;
  tasksReady?: boolean;
  workflows: readonly SidebarWorkflow[];
  workflowFeedback?: ReactNode;
  workflowsReady?: boolean;
  analysis: readonly SidebarAnalysis[];
  preferences: SidebarPreferences;
  onPreferencesChange: (preferences: SidebarPreferences) => void;
  allTasksHref: string;
  allWorkflowsHref: string;
  tasksSelected?: boolean;
  workflowsSelected?: boolean;
  onNavigate?: (href: string) => void;
  onNewTask: () => void;
  onOpenHarness?: () => void;
  onOpenSettings?: () => void;
  brandMark?: ReactNode;
  /** Caller-provided copy permits a coherent locale switch; user data is never translated. */
  labels?: Partial<typeof sidebarLabels>;
}
export const sidebarLabels = {
  task: "任务",
  workflow: "工作流",
  analysis: "分析",
  brand: "Crystra",
  newTask: "新建任务",
  settings: "设置",
  harness: "切换到 DeepSeek Harness",
  collapse: "收起侧边栏",
  expand: "展开侧边栏",
  rail: "快捷导航",
  searchTask: "搜索任务",
  searchWorkflow: "搜索工作流",
  closeSearch: "关闭搜索",
  taskView: "任务视图",
  workflowView: "工作流视图",
  allTasks: "全部任务",
  allWorkflows: "全部工作流",
  emptyTasks: "暂无任务",
  emptyWorkflows: "暂无工作流",
  emptyAnalysis: "暂无分析入口",
  noMatches: "无匹配结果",
  created: "按创建时间",
  activity: "按活跃时间",
  activeOnly: "仅显示活跃任务",
  ascending: "名称升序",
  descending: "名称降序",
  versions: "显示版本标签",
};
