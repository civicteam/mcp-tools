/**
 * Hook Manager Module
 * 
 * Manages hook clients and caching for the passthrough server
 */

import { HookClient, createHookClients } from "@civicteam/hook-common/client";
import type { Config } from "../utils/config.js";

// Cache for hook clients
const hookClientsCache = new Map<string, HookClient[]>();

/**
 * Get or create hook clients for a configuration
 */
export function getHookClients(config: Config): HookClient[] {
  const cacheKey = JSON.stringify(config.hooks || []);
  
  if (!hookClientsCache.has(cacheKey)) {
    const clients = createHookClients(
      (config.hooks || []).map(hook => ({
        url: hook.url,
        name: hook.name || hook.url,
      }))
    );
    hookClientsCache.set(cacheKey, clients);
  }
  
  return hookClientsCache.get(cacheKey)!;
}

/**
 * Clear the hook clients cache (useful for testing)
 */
export function clearHookClientsCache(): void {
  hookClientsCache.clear();
}