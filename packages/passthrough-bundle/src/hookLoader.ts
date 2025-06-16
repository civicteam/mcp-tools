/**
 * Hook Loader Module
 *
 * Handles loading of built-in hooks and creation of hook configurations
 *
 * NOTE: Until hook packages export their classes, we'll use the remote
 * approach and expect the hooks to be running as separate services
 */

import type {
  HookDefinition,
  RemoteHookConfig,
} from "@civic/passthrough-mcp-server";

/**
 * Map of built-in hook names to their default ports
 */
const HOOK_DEFAULT_PORTS: Record<string, number> = {
  SimpleLogHook: 33006,
  AuditHook: 33004,
  GuardrailHook: 33007,
  CustomDescriptionHook: 33008,
  ExplainHook: 33009,
};

/**
 * Create a hook definition from a hook configuration
 */
export function createHookDefinition(hookConfig: {
  name?: string;
  url?: string;
}): HookDefinition {
  // If it has a URL, it's a remote hook
  if (hookConfig.url) {
    return {
      url: hookConfig.url,
      name: hookConfig.name,
    } as RemoteHookConfig;
  }

  // For built-in hooks without URLs, map them to their default ports
  if (hookConfig.name && hookConfig.name in HOOK_DEFAULT_PORTS) {
    const port = HOOK_DEFAULT_PORTS[hookConfig.name];
    return {
      url: `http://localhost:${port}`,
      name: hookConfig.name,
    } as RemoteHookConfig;
  }

  throw new Error(
    `Invalid hook configuration: ${JSON.stringify(hookConfig)}. ` +
      `Must have either a URL or a valid built-in hook name (${Object.keys(HOOK_DEFAULT_PORTS).join(", ")})`,
  );
}

/**
 * Load all hooks from a configuration
 */
export function loadHooks(
  hooksConfig: Array<{ name?: string; url?: string }>,
): HookDefinition[] {
  const hookDefinitions: HookDefinition[] = [];

  for (const hookConfig of hooksConfig) {
    try {
      const definition = createHookDefinition(hookConfig);
      hookDefinitions.push(definition);
    } catch (error) {
      console.error(
        `Failed to load hook ${hookConfig.name || hookConfig.url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Continue loading other hooks even if one fails
    }
  }

  return hookDefinitions;
}
