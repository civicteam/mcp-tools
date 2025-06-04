/**
 * Hook Manager Module
 *
 * Manages hook clients and caching for the passthrough server
 */

import {
  type Hook,
  type HookClient,
  LocalHookClient,
  RemoteHookClient,
} from "@civic/hook-common";
import type {
  Config,
  HookDefinition,
  RemoteHookConfig,
} from "../utils/config.js";

// Cache for hook clients
const hookClientsCache = new Map<string, HookClient[]>();

/**
 * Check if a hook definition is a Hook instance
 */
function isHookInstance(hook: HookDefinition): hook is Hook {
  return (
    typeof hook === "object" &&
    "processRequest" in hook &&
    "processResponse" in hook &&
    "name" in hook
  );
}

/**
 * Create a cache key for hook definitions
 */
function createCacheKey(hooks: HookDefinition[]): string {
  return JSON.stringify(
    hooks.map((hook) =>
      isHookInstance(hook) ? { type: "instance", name: hook.name } : hook,
    ),
  );
}

/**
 * Get or create hook clients for a configuration
 */
export function getHookClients(config: Config): HookClient[] {
  const hookDefinitions = config.hooks || [];
  const cacheKey = createCacheKey(hookDefinitions);

  if (!hookClientsCache.has(cacheKey)) {
    const clients: HookClient[] = hookDefinitions.map((hookDef) => {
      if (isHookInstance(hookDef)) {
        // Create a LocalHookClient for Hook instances
        return new LocalHookClient(hookDef);
      }
      // Create a RemoteHookClient for URL-based hooks
      return new RemoteHookClient({
        url: hookDef.url,
        name: hookDef.name || hookDef.url,
      });
    });
    hookClientsCache.set(cacheKey, clients);
  }

  const clients = hookClientsCache.get(cacheKey);
  if (!clients) {
    throw new Error("Hook clients cache miss - this should not happen");
  }
  return clients;
}

/**
 * Clear the hook clients cache (useful for testing)
 */
export function clearHookClientsCache(): void {
  hookClientsCache.clear();
}
