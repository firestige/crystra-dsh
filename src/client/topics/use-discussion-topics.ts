import { useEffect, useRef, useState, useCallback } from "react";
import type { HostRpc } from "../host/host-rpc-context";
type Topic = {
  id: string;
  title: string;
  sessionId: import("@deepseek-ai/dsh-session/types").SessionId;
};
type Group = { id: string; title: string; selectedTopicId: string };
export type DiscussionTopics = {
  taskId?: string;
  definitionId?: string;
  directory?: string;
  workspaceId: string;
  workspacePath: string;
  group: Group;
  currentGroup: Group;
  groups: Group[];
  topics: Topic[];
  selected: Topic;
  busy: boolean;
};
export function useDiscussionTopics(
  taskId: string | undefined,
  rpc: HostRpc,
  sessions: any,
  domain: "task" | "workflow" = "task",
) {
  const rpcPath =
    domain === "task" ? "/crystra-control" : "/crystra-workflow-sessions";
  const ownerKey = domain === "task" ? "taskId" : "definitionId";
  const [snapshot, setSnapshot] = useState<DiscussionTopics | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [retry, setRetry] = useState(0);
  const generation = useRef(0),
    adopted = useRef(""),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  const apply = useCallback(
    async (value: DiscussionTopics, version: number) => {
      if (value[ownerKey] !== taskId) throw Error("TOPIC_OWNER_MISMATCH");
      if (adopted.current !== value.selected.sessionId) {
        await sessions.create({
          sessionId: value.selected.sessionId,
          ...(domain === "task"
            ? { workspaceId: value.workspaceId }
            : { cwd: value.directory }),
        });
      }
      if (mounted.current && version === generation.current) {
        adopted.current = value.selected.sessionId;
        setSnapshot(value);
        setError("");
      }
    },
    [taskId, sessions, domain, ownerKey],
  );
  useEffect(() => {
    if (!taskId) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const version = ++generation.current;
    setError("");
    async function poll() {
      try {
        const result = await rpc.call(rpcPath, "topics/read", {
          [ownerKey]: taskId,
        });
        if (!result.ok) throw Error(result.error?.message || "主题读取失败");
        if (!stopped && version === generation.current)
          await apply(result.value, version);
      } catch (e) {
        if (!stopped && version === generation.current)
          setError((e as Error).message);
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [taskId, rpc, apply, retry, rpcPath, ownerKey]);
  const act = async (endpoint: string, fields: Record<string, unknown>) => {
    if (!taskId || pending) return;
    const version = ++generation.current;
    setPending(true);
    try {
      const result = await rpc.call(rpcPath, endpoint, {
        [ownerKey]: taskId,
        ...fields,
      });
      if (!result.ok)
        throw Error(
          /TOPIC_BUSY/.test(result.error?.message || result.error?.code || "")
            ? "当前主题正在回复或等待确认，请完成或停止后切换。"
            : result.error?.message || "主题操作失败",
        );
      await apply(result.value, version);
    } catch (e) {
      if (mounted.current && version === generation.current)
        setError((e as Error).message);
      throw e;
    } finally {
      if (mounted.current) {
        setPending(false);
        setRetry((x) => x + 1);
      }
    }
  };
  return {
    snapshot: snapshot?.[ownerKey] === taskId ? snapshot : null,
    error,
    pending,
    retry: () => setRetry((x) => x + 1),
    select: (id: string) =>
      act("topics/select", { groupId: snapshot?.group.id, topicId: id }),
    selectGroup: (id: string) =>
      act("topics/select", {
        groupId: id,
        topicId: snapshot?.groups.find((g) => g.id === id)?.selectedTopicId,
      }),
    create: () => act("topics/create", { groupId: snapshot?.group.id }),
    rename: (title: string) =>
      act("topics/rename", { topicId: snapshot?.selected.id, title }),
  };
}
