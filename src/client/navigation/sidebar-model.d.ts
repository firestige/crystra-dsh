import type { Route } from './routes.js';
interface TaskInput { id: string; title: string; }
interface WorkflowInput { definitionId: string; revision: string; fromTaskId?: string; title: string; }
interface AnalysisInput { id: 'dashboard' | 'traces' | 'reports'; title: string; }
export declare function projectSidebar<T extends TaskInput, W extends WorkflowInput, A extends AnalysisInput>(data: { tasks: readonly T[]; workflows: readonly W[]; analysis: readonly A[] }, route: Route): {
 tasks: (T & { href: string; selected: boolean })[];
 workflows: (W & { id: string; href: string; selected: boolean })[];
 analysis: (A & { href: string; selected: boolean })[];
 allTasksHref: string; allWorkflowsHref: string; tasksSelected: boolean; workflowsSelected: boolean;
};
