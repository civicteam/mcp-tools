/**
 * Passthrough Client Interface
 * 
 * A subset of the MCP Client interface that contains only the methods
 * used by the passthrough server implementation. Assumes client is already connected.
 */

import type { ListToolsResult, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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