/**
 * Hook Loader Module
 *
 * Handles loading of built-in hooks via dynamic imports
 * and creation of hook configurations
 */

import type { Hook, HookConfig, RemoteHookConfig } from "@civic/hook-common";
import type { HookDefinition } from "@civic/passthrough-mcp-server";
import type { HookInstanceConfig } from "./config/types.js";

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
 * Load a built-in hook by name and apply configuration
 */
async function loadBuiltinHook(
  hookName: string,
  config?: HookConfig,
): Promise<Hook> {
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

    // Create hook instance with empty constructor
    const hookInstance: Hook = new HookClass();

    // Apply configuration if the hook has a configure method
    if (
      config &&
      "configure" in hookInstance &&
      typeof hookInstance.configure === "function"
    ) {
      hookInstance.configure(config);
    } else if (config) {
      console.warn(`Hook ${hookName} does not support configuration`);
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

const isRemoteHookConfig = (
  hookConfig: HookInstanceConfig,
): hookConfig is RemoteHookConfig => {
  return "url" in hookConfig;
};

/**
 * Create a hook definition from a hook configuration
 */
export async function createHookDefinition(
  hookConfig: HookInstanceConfig,
): Promise<HookDefinition> {
  if (isRemoteHookConfig(hookConfig)) return hookConfig;

  // For built-in hooks, load them dynamically with configuration
  if (hookConfig.name in HOOK_PACKAGE_MAP) {
    // Return the Hook instance directly - passthrough-mcp-server will wrap it
    return loadBuiltinHook(hookConfig.name, hookConfig.config);
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
  hooksConfig: HookInstanceConfig[],
): Promise<HookDefinition[]> {
  const hookDefinitions: HookDefinition[] = [];

  for (const hookConfig of hooksConfig) {
    try {
      const definition = await createHookDefinition(hookConfig);
      hookDefinitions.push(definition);
    } catch (error) {
      console.error(
        `Failed to load hook ${hookConfig.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Continue loading other hooks even if one fails
    }
  }

  return hookDefinitions;
}
