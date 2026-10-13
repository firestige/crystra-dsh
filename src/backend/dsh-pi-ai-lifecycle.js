import {closeOpenAICodexWebSocketSessions} from '@earendil-works/pi-ai/api/openai-codex-responses';

export const name = 'crystra-pi-ai-lifecycle';
export const inject = ['agents'];

/** DSH 0.1.5-rc.2 / pi-ai 0.85.1 compatibility glue. Keep provider APIs out of
 * reflection and Barrier. Disposing one agent must not close another's socket.
 * The public provider function synchronously clears this session's idle timer
 * and closes its cached WebSocket; the OS completes the close asynchronously.
 */
export function apply(ctx) {
  ctx.on('agent/disposed', ({agent}) => {
    const id = agent.session.id;
    if (typeof id === 'string' && id) closeOpenAICodexWebSocketSessions(id);
  });
}
