/** Presentation projection only: exact identities in, host-owned navigation targets out. */
export function projectSidebar(data, route) {
  return {
    tasks: data.tasks.filter(task=>!task.archivedAt).map(task => ({
      ...task, href: `/tasks/${encodeURIComponent(task.id)}`,
      selected: route.page === 'task' && route.taskId === task.id,
    })),
    workflows: data.workflows.map(workflow => {
      const query = new URLSearchParams({ revision: workflow.revision });
      if (workflow.fromTaskId !== undefined) query.set('from_task_id', workflow.fromTaskId);
      return {
        ...workflow, id: JSON.stringify([workflow.definitionId, workflow.revision, workflow.fromTaskId ?? null]),
        href: `/workflows/${encodeURIComponent(workflow.definitionId)}?${query}`,
        selected: route.page === 'workflow' && route.definitionId === workflow.definitionId && route.revision === workflow.revision,
      };
    }),
    analysis: data.analysis.map(entry => ({
      ...entry, href: `/analysis?${new URLSearchParams({view:entry.id})}`,
      selected: route.page === 'analysis' && route.view === entry.id,
    })),
    allTasksHref: '/tasks', allWorkflowsHref: '/workflows',
    tasksSelected: route.page === 'tasks', workflowsSelected: route.page === 'workflows',
  };
}
