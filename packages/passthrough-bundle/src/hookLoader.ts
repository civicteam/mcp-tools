/**
 * Hook Loader Module
 *
 * Handles loading of built-in hooks via dynamic imports
 * and creation of hook configurations
 */

import type { Hook } from "@civic/hook-common";
import type { HookDefinition } from "@civic/passthrough-mcp-server";

/**
 * Map of built-in hook names to their package names
 */
const HOOK_PACKAGE_MAP: Record<string, string> = {
  SimpleLogHook: "@civic/simple-log-hook/hook",
  AuditHook: "@civic/audit-hook/hook",
  GuardrailHook: "@civic/guardrail-hook/hook",
  CustomDescriptionHook: "@civic/custom-description-hook/hook",
  ExplainHook: "@civic/explain-hook/hook",
};

/**
 * Load a built-in hook by name
 */
async function loadBuiltinHook(hookName: string): Promise<Hook> {
  const packageName = HOOK_PACKAGE_MAP[hookName];
  if (!packageName) {
    throw new Error(
      `Unknown built-in hook: ${hookName}. Valid hooks are: ${Object.keys(
        HOOK_PACKAGE_MAP,
      ).join(", ")}`,
    );
  }

  try {
    // Dynamic import of the hook class
    const hookModule = await import(packageName);
    const HookClass = hookModule.default || hookModule[hookName];

    if (!HookClass) {
      throw new Error(
        `Hook class not found in ${packageName}. Expected default export or ${hookName} export.`,
      );
    }

    // For audit-hook, we need to pass an audit logger
    // For now, we'll use a simple console logger
    let hookInstance: Hook;
    if (hookName === "AuditHook") {
      // Create a simple console audit logger
      const consoleAuditLogger = {
        async log(entry: unknown): Promise<void> {
          console.log("[AUDIT]", JSON.stringify(entry, null, 2));
        },
      };
      hookInstance = new HookClass(consoleAuditLogger);
    } else {
      hookInstance = new HookClass();
    }

    return hookInstance;
  } catch (error) {
    throw new Error(
      `Failed to load built-in hook ${hookName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Create a hook definition from a hook configuration
 */
export async function createHookDefinition(hookConfig: {
  name?: string;
  url?: string;
}): Promise<HookDefinition> {
  // If it has a URL, it's a remote hook
  if (hookConfig.url) {
    const result: HookDefinition = {
      url: hookConfig.url,
    };
    if (hookConfig.name) {
      result.name = hookConfig.name;
    }
    return result;
  }

  // For built-in hooks, load them dynamically
  if (hookConfig.name && hookConfig.name in HOOK_PACKAGE_MAP) {
    const hookInstance = await loadBuiltinHook(hookConfig.name);
    // Return the Hook instance directly - passthrough-mcp-server will wrap it
    return hookInstance;
  }

  throw new Error(
    `Invalid hook configuration: ${JSON.stringify(hookConfig)}. ` +
      `Must have either a URL or a valid built-in hook name (${Object.keys(
        HOOK_PACKAGE_MAP,
      ).join(", ")})`,
  );
}

/**
 * Load all hooks from a configuration
 */
export async function loadHooks(
  hooksConfig: Array<{ name?: string; url?: string }>,
): Promise<HookDefinition[]> {
  const hookDefinitions: HookDefinition[] = [];

  for (const hookConfig of hooksConfig) {
    try {
      const definition = await createHookDefinition(hookConfig);
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
