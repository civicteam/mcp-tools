/**
 * Passthrough Client Interface
 *
 * A subset of the MCP Client interface that contains only the methods
 * used by the passthrough server implementation. Assumes client is already connected.
 */

import type {
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { TargetConfig } from "../utils/config.js";

export interface PassthroughClient {
  /**
   * List available tools from the target server
   */
  listTools(): Promise<ListToolsResult>;

  /**
   * Call a specific tool on the target server
   * Uses the same signature as the MCP SDK Client.callTool method
   */
  callTool(params: {
    name: string;
    arguments?: { [x: string]: unknown };
    _meta?: { [x: string]: unknown; progressToken?: string | number };
  }): Promise<CallToolResult>;
}

/**
 * Client Factory Interface
 *
 * Factory function interface for creating PassthroughClient instances.
 * This allows for custom client implementations while maintaining compatibility.
 */
export type ClientFactory = (
  targetConfig: TargetConfig,
  clientId: string,
  clientInfo?: { name: string; version: string },
) => Promise<PassthroughClient>;
