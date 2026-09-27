export function workflowSessionReady(definitionId, binding, selectedSessionId) {
  return (
    !!binding &&
    binding.definitionId === definitionId &&
    binding.sessionId === selectedSessionId &&
    binding.sessionId.startsWith("crystra-workflow-")
  );
}
