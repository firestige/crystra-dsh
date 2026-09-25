/** Task facts projected exclusively from the Execution owner. */
export interface Task {
  id: string;
  title: string;
  createdAt?: number;
  lastActivityAt: number;
  deliveryIds: string[];
  status?: "failed" | "review" | "running";
  /** Only an explicit Task-owner fact may set this; Delivery terminal status cannot. */
  active?: boolean;
}
export interface TasksApi {
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
