/**
 * MCP Server with Auth Context Module
 *
 * Creates MCP servers that can pass authorization headers to tool handlers
 * by maintaining a session-to-auth mapping.
 */

import type { ToolCall } from "@civic/hook-common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolRequest,
  CallToolResult,
  Tool as MCPTool,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { createToolHandler } from "./toolHandler.js";
import { discoverToolsFromTarget } from "./tools.js";
import type { ToolContext } from "./types.js";

// Global session auth context storage
const sessionAuthContext = new Map<string, ToolContext>();

/**
 * Stores auth context for a session
 */
export function setSessionAuthContext(
  sessionId: string,
  context: ToolContext,
): void {
  sessionAuthContext.set(sessionId, context);
}

/**
 * Retrieves auth context for a session
 */
export function getSessionAuthContext(
  sessionId: string,
): ToolContext | undefined {
  return sessionAuthContext.get(sessionId);
}

/**
 * Clears auth context for a session
 */
export function clearSessionAuthContext(sessionId: string): void {
  sessionAuthContext.delete(sessionId);
}

/**
 * Creates an MCP server with auth context support
 */
export async function createMCPServerWithAuth(options: {
  config: Config;
  authHeaders?: Record<string, string>;
}): Promise<{
  server: McpServer;
  tools: MCPTool[];
}> {
  const { config, authHeaders } = options;
  // Create MCP server
  const server = new McpServer(
    {
      name: config.serverInfo?.name || "passthrough-mcp-server",
      version: config.serverInfo?.version || "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  // Discover tools from target
  const tools = await discoverToolsFromTarget(config, authHeaders);

  // Register each tool
  for (const tool of tools) {
    // Define the handler function
    const handler = async (
      args: Record<string, unknown>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ): Promise<CallToolResult> => {
      // Create context with auth info
      const context: ToolContext = {
        authHeaders: authHeaders || {},
        sessionId: extra.sessionId || "default",
      };

      // Parse the request to get tool name and arguments
      const toolCall: ToolCall = {
        name: tool.name,
        arguments: args,
        metadata: {
          sessionId: context.sessionId || "default",
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
        toolDefinition: {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
      };

      // Create tool handler with context
      const toolHandler = createToolHandler(config, tool, context);

      // Call the handler with a proper CallToolRequest
      const callToolRequest: CallToolRequest = {
        method: "tools/call",
        params: {
          name: tool.name,
          arguments: args,
        },
      };

      return toolHandler(callToolRequest);
    };

    // Register the tool on the server using the SDK pattern
    if (tool.inputSchema) {
      server.tool(
        tool.name,
        tool.description || `Passthrough to ${tool.name}`,
        tool.inputSchema as Record<string, unknown>,
        handler,
      );
    } else {
      // For zero-argument tools, create a handler that doesn't expect args
      const zeroArgHandler = async (
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
      ): Promise<CallToolResult> => {
        return handler({}, extra);
      };

      server.tool(
        tool.name,
        tool.description || `Passthrough to ${tool.name}`,
        zeroArgHandler,
      );
    }

    logger.info(`Registered passthrough for tool: ${tool.name}`);
  }

  return { server, tools };
}
