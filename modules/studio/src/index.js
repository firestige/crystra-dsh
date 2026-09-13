import { registerStudioGateway } from "./host/gateway.js";
import {
  createLoopbackHostIntegration,
  defaultLoopbackHostConfig,
  loadLoopbackHostConfigFile,
} from "./host/loopback-integration.js";

export const name = "crystra-studio";
export const inject = ["connection"];

export function apply(ctx, config) {
  const hostConfig = config?.hostConfigFile === undefined
    ? (config?.hostConfig ?? defaultLoopbackHostConfig({
      evidenceBaseUrl: config?.evidenceBaseUrl,
      evolutionBaseUrl: config?.evolutionBaseUrl,
    }))
    : loadLoopbackHostConfigFile(config.hostConfigFile);
  const integration = createLoopbackHostIntegration(hostConfig);
  return registerStudioGateway(ctx, {
    integration,
  });
}

export * from "./host/gateway.js";
export * from "./host/loopback-integration.js";
