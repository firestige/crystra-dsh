import { Session } from '@deepseek-ai/dsh-session';
import { SessionPersistenceNotFoundError } from '@deepseek-ai/dsh-session-persistence';
import { digest, plain } from './value.js';
const TYPE = 'crystra/backend-state';
// The envelope stays v1. Component owners validate/migrate their own versions.
const validState = (state, workerSessionId) => plain(state)
  && state.workerSessionId === workerSessionId
  && Number.isSafeInteger(state.schemaVersion) && state.schemaVersion >= 1;

export async function openJournal(persistence, workerSessionId) {
  const id = `crystra-backend-${digest(workerSessionId)}`;
  let handle;
  try { handle = await persistence.open(id, 'write'); }
  catch (error) {
    // Native profile plugins and the host can resolve separate package copies.
    // Match the public error identity and requested session, never message text.
    const missing = error instanceof SessionPersistenceNotFoundError || error?.name === 'SessionPersistenceNotFoundError';
    if (!missing || error.sessionId !== id) throw error;
    handle = await persistence.create(Session.create(id).header);
  }
  try {
    const events = (await handle.read()).events;
    for (const event of events) {
      if (event.type !== TYPE || event.data?.schemaVersion !== 1 || event.data.workerSessionId !== workerSessionId || !validState(event.data.state, workerSessionId)) throw new Error('Unsupported Crystra journal schema or identity');
    }
    let count = events.length;
    let latest = events.at(-1)?.data.state ?? null;
    let poisoned = false;
    return {
      id,
      read: async () => structuredClone(latest),
      async append(state) {
        if (poisoned) throw new Error('Crystra journal unavailable');
        if (!validState(state, workerSessionId)) throw new Error('Invalid journal state identity');
        const copy = structuredClone(state);
        try {
          await handle.append([{ type: TYPE, seq: count, time: Date.now(), ignorable: true, data: { schemaVersion: 1, workerSessionId, state: copy } }]);
          await handle.flush();
        } catch (error) { poisoned = true; throw error; }
        count++; latest = copy;
      },
      close: () => handle.close(),
    };
  } catch (error) { await handle.close(); throw error; }
}
