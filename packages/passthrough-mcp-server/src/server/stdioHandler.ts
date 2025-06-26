/**
 * Stdio Handler Module
 *
 * Provides MCP server implementation for stdio transport using the
 * @modelcontextprotocol/sdk instead of FastMCP. Since stdio doesn't
 * support authentication, we use a simplified approach.
 */

import type { ToolsListRequest } from "@civic/hook-common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  CallToolResult,
  ListToolsResult,
  Tool as MCPTool,
} from "@modelcontextprotocol/sdk/types.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
  DEFAULT_SESSION_ID,
  getOrCreateSessionForRequest,
} from "../utils/session.js";
import { createPassthroughHandler } from "./passthrough.js";

/**
 * Create and configure an MCP server for stdio transport
 */
export async function createStdioServer(config: Config): Promise<{
  server: McpServer;
  transport: StdioServerTransport;
}> {
  // Create the server
  const server = new McpServer({
    name: config.serverInfo?.name || "passthrough-mcp-server",
    version: config.serverInfo?.version || "0.0.1",
  });

  // Discover and register tools
  await discoverAndRegisterTools(server, config);

  // Create the transport
  const transport = new StdioServerTransport();

  return { server, transport };
}

/**
 * Discover and register tools from the target server
 */
async function discoverAndRegisterTools(
  server: McpServer,
  config: Config,
): Promise<void> {
  const sessionData = await getOrCreateSessionForRequest(
    DEFAULT_SESSION_ID,
    config,
  );

  // Create tools/list request
  const toolsListRequest: ToolsListRequest = {
    method: "tools/list",
    metadata: {
      sessionId: "discovery",
      timestamp: new Date().toISOString(),
      source: "passthrough-server",
    },
  };

  // Get hook clients
  const hookClients = getHookClients(config);

  // Process the tools/list request through hooks
  const requestResult = await processToolsListRequestThroughHooks(
    toolsListRequest,
    hookClients,
  );

  // If request was rejected by a hook
  if (requestResult.wasRejected) {
    logger.warn("tools/list request rejected by hook");
    return;
  }

  // Get list of tools from the target server
  const { tools } = await sessionData.targetClient.listTools();
  logger.info(`Discovered ${tools.length} tools from target server`);
  logger.debug(`Raw: ${JSON.stringify(tools)}`);

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    logger.warn("No tools found on target server");
    return;
  }

  // Create tools/list response
  let toolsListResponse: ListToolsResult = { tools };

  // Process the response through hooks if configured
  if (hookClients.length > 0) {
    const startIndex = requestResult.wasRejected
      ? requestResult.lastProcessedIndex
      : hookClients.length - 1;

    const responseResult = await processToolsListResponseThroughHooks(
      toolsListResponse,
      requestResult.request,
      hookClients,
      startIndex,
    );

    if (responseResult.wasRejected) {
      logger.warn("tools/list response rejected by hook");
      return;
    }

    // Use the potentially modified response
    toolsListResponse = responseResult.response;
  }

  // Store tools in memory (potentially modified by hooks)
  const discoveredTools = toolsListResponse.tools;

  logger.info(
    `Discovered ${discoveredTools.length} tools from target server (after hook processing)`,
  );

  // Register each tool as a passthrough with its own handler
  for (const tool of discoveredTools) {
    // Create a passthrough handler specifically for this tool
    const toolHandler = createPassthroughHandler(config, tool.name);

    // Extract the JSON schema from the tool definition
    const inputSchema = tool.inputSchema || {};

    // Register the tool
    server.tool(
      tool.name,
      tool.description || `Passthrough to ${tool.name} on target server`,
      inputSchema,
      async (args): Promise<CallToolResult> => {
        // For stdio, we don't have session/auth context, so we pass empty context
        const context = {
          authHeaders: {},
          sessionId: DEFAULT_SESSION_ID,
        };

        return toolHandler(args, context) as Promise<CallToolResult>;
      },
    );

    logger.info(`Registered passthrough for tool: ${tool.name}`);
  }
}
