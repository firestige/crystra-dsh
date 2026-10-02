/** Match exact owner correlations; never choose a recent or unrelated session. */
export function resolveTaskSession(taskId, inventory, sessions, bindings = []) {
  if (!taskId) return undefined;
  const exact=bindings.filter(row=>row.taskId===taskId&&Object.hasOwn(sessions,row.sessionId));
  if(exact.length)return exact.length===1?exact[0].sessionId:undefined;
  if(inventory?.kind !== "ready")return undefined;
  const ids = new Set(
    inventory.snapshot.deliveries
      .filter((delivery) => delivery.task.identity === taskId)
      .map((delivery) => delivery.navigation?.sessionCorrelation)
      .filter((id) => typeof id === "string" && Object.hasOwn(sessions, id)),
  );
  return ids.size === 1 ? [...ids][0] : undefined;
}
