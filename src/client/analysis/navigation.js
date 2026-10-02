const sourceKeys = new Set(['task_id','delivery_id','trace_id','span_id','event_id','plan_run_id','wave_id','workflow_run_id','trace_root_id','from_gate_id','attempt']);
function params(href) {
  const url = new URL(href);
  return new URL(url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname + url.search, url.origin).searchParams;
}
export function analysisLocation(href) {
  const query = params(href);
  return {period:query.get('period') ?? '7d',scope:query.get('scope') ?? 'all',sourceContext:Object.fromEntries([...query].filter(([key])=>sourceKeys.has(key)))};
}
export function analysisViewPath(href,view) {
  const query=params(href);
  query.delete('token');
  query.set('view',view);
  if(view !== 'traces') query.delete('scope');
  return '/analysis?'+query;
}

export function analysisPeriodPath(href,period) {
 const query=params(href);query.delete('token');query.set('period',period);
 return '/analysis?'+query;
}
