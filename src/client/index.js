import * as product from './product-entry.js';
import * as initialization from '../../modules/initialization/src/client.js';
import * as execution from '../../modules/execution/src/client/browser-entry.js';
import * as studio from '../../modules/studio/src/client/browser-entry.js';

export const name = 'crystra-client';
export const inject = [...new Set([...execution.inject, ...studio.inject, ...initialization.inject, ...product.inject])];
export function apply(ctx) {
  ctx.plugin(initialization);
  ctx.plugin(execution);
  ctx.plugin(studio);
  ctx.plugin(product);
}
