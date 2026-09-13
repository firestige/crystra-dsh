import * as execution from '../modules/execution/src/index.js';
import * as studio from '../modules/studio/src/index.js';

export const name = 'crystra';
export const inject = [...new Set([...execution.inject, ...studio.inject])];

export function apply(ctx, config) {
  if (!config?.execution) throw new TypeError('CRYSTRA_EXECUTION_CONFIGURATION_REQUIRED');
  ctx.plugin(execution, config.execution);
  ctx.plugin(studio, config.studio ?? {});
}
