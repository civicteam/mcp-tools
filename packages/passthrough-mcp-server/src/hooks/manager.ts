/**
 * Hook Manager Module
 *
 * Manages hook clients for the passthrough server
 */

import {
  type Hook,
  type HookClient,
  LocalHookClient,
  RemoteHookClient,
} from "@civic/hook-common";
import type { Config, HookDefinition } from "../utils/config.js";

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
 * Get or create hook clients for a configuration
 */
export function getHookClients(config: Config): HookClient[] {
  const hookDefinitions = config.hooks || [];

  return hookDefinitions.map((hookDef) => {
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
}
