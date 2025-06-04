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

// Export utility functions that users might need
export { createTargetClient } from "./client/client.js";
export { loadConfig } from "./utils/config.js";
export { getDiscoveredTools } from "./server/server.js";
