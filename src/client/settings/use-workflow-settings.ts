import { useEffect, useRef, useState } from "react";
import type { QueryRpc } from "../shared/revision-api";
export type Directory = { path: string; kind: "collection" | "package" };
type Settings = { revision: string; directories: Directory[] };
async function request(
  rpc: QueryRpc,
  endpoint: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Settings> {
  const answer = (await rpc.call(
    "/crystra-workflows",
    endpoint,
    payload,
    signal,
  )) as { ok: boolean; value: Settings; error?: { message: string } };
  if (!answer?.ok)
    throw Error(answer?.error?.message || "无法读取或保存来源设置");
  if (
    typeof answer.value?.revision !== "string" ||
    !Array.isArray(answer.value.directories)
  )
    throw Error("来源设置格式不兼容");
  return answer.value;
}
export function useWorkflowSettings(rpc: QueryRpc, onSaved: () => void) {
  const lifetime = useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = async (signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const value = await request(rpc, "settings/read", {}, signal);
      if (!signal?.aborted) setSettings(value);
    } catch (cause) {
      if (!signal?.aborted) setError((cause as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    request(rpc, "settings/read", {}, controller.signal)
      .then(
        (value) => {
          if (!controller.signal.aborted) setSettings(value);
        },
        (cause) => {
          if (!controller.signal.aborted) setError((cause as Error).message);
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [rpc]);
  const update = (directories: Directory[]) => {
    setSettings((current) => (current ? { ...current, directories } : current));
    setSaved(false);
    setError(null);
  };
  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const signal = lifetime.current?.signal;
    try {
      const value = await request(rpc, "settings/save", settings, signal);
      if (signal?.aborted) return;
      setSettings(value);
      setSaved(true);
      onSaved();
    } catch (cause) {
      if (!signal?.aborted) setError((cause as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  };
  return {
    settings,
    busy,
    error,
    saved,
    update,
    save,
    reload: () => load(lifetime.current?.signal),
  };
}
