/**
 * Passthrough MCP Server Library
 *
 * This module exports the public API for programmatically creating
 * and controlling passthrough MCP servers.
 *
 * For CLI usage, see cli.ts
 */

// Export the main factory function
export { createPassthroughProxy } from "./createPassthroughProxy.js";

// Export types
export type {
  Config,
  TargetConfig,
  BaseConfig,
  HookDefinition,
  RemoteHookConfig,
} from "./utils/config.js";
export type { ClientFactory, PassthroughClient } from "./types/client.js";
export type {
  PassthroughProxy,
  PassthroughProxyOptions,
} from "./createPassthroughProxy.js";

// Export hook-related types and interfaces
export type {
  Hook,
  HookClient,
  HookResponse,
  ToolCall,
  ToolsListRequest,
  LocalHookClient,
} from "@civic/hook-common";

// Export AbstractHook as a value (not just a type)
export { AbstractHook } from "@civic/hook-common";

// Export the simplified hook API
export { applyHooks } from "./hooks/apply.js";
export type { HookType, HookResult, HookContext } from "./hooks/apply.js";

// Export hook utilities
export { getHookClients } from "./hooks/manager.js";
export { createHookClient, createHookClients } from "./hooks/utils.js";

// Export utility functions that users might need
export { createTargetClient } from "./client/RemoteClient.js";
export { loadConfig } from "./utils/config.js";
export { getDiscoveredTools } from "./server/server.js";
