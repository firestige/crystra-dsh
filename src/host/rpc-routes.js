import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection';

const endpoints = {
  '/crystra-control': ['tasks/admit','tasks/bindings','tasks/projection','tasks/select-gate','tasks/artifact'],
  '/crystra-execution': ['inventory/read', 'session/read'],
  '/crystra-tasks': ['list', 'changes', 'update'],
  '/crystra-workflows': ['list', 'changes', 'settings/read', 'settings/save'],
  '/crystra-studio': ['services/status', 'tasks/list', 'facts/read', 'traces/read', 'evaluations/compute'],
};

/** Public 0.1.5 Fetch routes; DSH owns authentication, trust checks and body limits. */
export function registerCrystraRpc(ctx, channel, handle) {
  const names = endpoints[channel];
  if (!names) throw new TypeError('Unknown Crystra RPC channel');
  const disposers = [];
  try {
    for (const endpoint of names) {
      disposers.push(ctx.connection.fetch.register({
        path: `/api${channel}/${endpoint}`, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return new Response('Expected application/json', {status:415});
          let raw;
          try { raw = await request.json(); } catch { return new Response('Invalid JSON', {status:400}); }
          const parsed = clientRequestSchema.safeParse(raw);
          if (!parsed.success || parsed.data.method !== `${channel.slice(1)}/${endpoint}`) return new Response('Invalid RPC envelope', {status:400});
          const message = parsed.data;
          let result;
          try { result = await handle(endpoint, message.payload, request.signal); }
          catch { result = {ok:false,error:{code:'internal',message:'Crystra request failed',details:{}}}; }
          if (result.ok === false) result = {...result, error: {...result.error, details: result.error.details ?? {}}};
          return Response.json({type:'server-response',rpcId:message.rpcId,result});
        },
      }));
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) void dispose();
    throw error;
  }
  const dispose = async () => { for (const stop of disposers.splice(0).reverse()) await stop(); };
  ctx.effect(() => dispose, `Crystra ${channel} routes`);
  return dispose;
}
