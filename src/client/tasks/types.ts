/** Execution-owned Task identity/presentation with host-owned discussion metadata. */
export interface Task {
  presentationRevision?: number;
  pinnedAt?: number | null;
  archivedAt?: number | null;
  thumbnail?: string;
  id: string;
  title: string;
  createdAt?: number;
  lastActivityAt: number;
  deliveryIds: string[];
  status?: string;
  attention?: number;
  workspace?: string;
  workspacePath?: string;
  /** Only an explicit Task-owner fact may set this; Delivery terminal status cannot. */
  active?: boolean;
}
export interface TaskUpdate {
  taskId: string;
  expectedRevision: number;
  displayTitle?: string;
  pinned?: boolean;
  archived?: boolean;
  thumbnailPng?: string | null;
}
export interface TasksApi {
  update?(input: TaskUpdate): Promise<void>;
  read(signal: AbortSignal): Promise<Task[]>;
  subscribe?(
    invalidate: () => void,
    onError: (error: Error) => void,
  ): () => void;
}
export interface ExecutionRpc {
  call(
    channel: string,
    endpoint: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
export interface TasksState {
  phase: "idle" | "loading" | "ready" | "error";
  items: Task[];
  error: string | null;
}
