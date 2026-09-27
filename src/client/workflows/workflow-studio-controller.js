/** Host-owned snapshot and write lifecycle. UI never manages RPC generations. */
export function createWorkflowStudioController({
  rpc,
  definitionId,
  revision,
  interval = 2000,
  onChanged = () => {},
}) {
  let state = { source: null, error: "", busy: false },
    generation = 0,
    timer,
    disposed = false;
  const listeners = new Set();
  const publish = (patch) => {
    if (disposed) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const schedule = (delay = interval) => {
    clearTimeout(timer);
    if (!disposed) timer = setTimeout(() => void refresh(), delay);
  };
  async function refresh() {
    if (disposed || state.busy) return;
    clearTimeout(timer);
    const current = ++generation;
    try {
      const result = await rpc.call("/crystra-workflows", "studio/read", {
        definitionId,
        ...(!state.source && revision ? { revision } : {}),
      });
      if (!result.ok) throw Error(result.error?.message || "工作流读取失败");
      if (current === generation) publish({ source: result.value, error: "" });
    } catch (error) {
      if (current === generation) publish({ error: error.message });
    } finally {
      if (current === generation) schedule();
    }
  }
  async function write(endpoint, payload) {
    if (disposed || !state.source) throw Error("工作流未加载");
    if (state.busy) throw Error("资源修改尚未完成");
    clearTimeout(timer);
    generation++;
    publish({ busy: true });
    try {
      const result = await rpc.call("/crystra-workflows", endpoint, {
        ...payload,
        definitionId,
        revision: state.source.revision,
      });
      if (!result.ok) throw Error(result.error?.message || "资源修改失败");
      publish({
        source:
          endpoint === "studio/mutate" ? result.value.source : result.value,
        error: "",
      });
      Promise.resolve()
        .then(onChanged)
        .catch(() => {});
      return result.value;
    } catch (error) {
      publish({ error: error.message });
      throw error;
    } finally {
      publish({ busy: false });
      schedule(0);
    }
  }
  return {
    start() {
      disposed = false;
      void refresh();
    },
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    save: (payload) => write("studio/save", payload),
    mutate: (payload) => write("studio/mutate", payload),
    dispose() {
      disposed = true;
      generation++;
      clearTimeout(timer);
      listeners.clear();
    },
  };
}
