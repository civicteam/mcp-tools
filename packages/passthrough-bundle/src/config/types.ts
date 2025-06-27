/**
 * Configuration Types for Passthrough Bundle
 *
 * Defines the structure of configuration files and hook configs
 */

import type { HookConfig, RemoteHookConfig } from "@civic/hook-common";

export type BuiltInHookConfig = {
  /**
   * Name of the built-in hook (e.g., "SimpleLogHook")
   */
  name: string;
  /**
   * Optional configuration for the hook
   */
  config?: HookConfig | undefined;
};

/**
 * Configuration for a single hook instance
 * Can be either a built-in hook with name and config,
 * or a remote hook with URL
 */
export type HookInstanceConfig = BuiltInHookConfig | RemoteHookConfig;
