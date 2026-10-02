export type Route = {
    page: "tasks" | "workflows" | "new-task" | "not-found";
} | {
    page: "task";
    taskId: string;
} | {
    page: "workflow";
    definitionId: string;
    view?: "studio" | "resources" | "crystallization";
    revision: string | null;
    fromTaskId: string | null;
} | {
    page: "analysis";
    view: "dashboard" | "traces" | "reports";
};
export declare function resolveRoute(location: string): Route;
