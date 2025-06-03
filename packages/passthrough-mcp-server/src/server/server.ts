/**
 * Server Module
 *
 * Responsible for creating the FastMCP server instance and registering
 * tools discovered from the target server. Dynamically discovers and
 * registers all available tools from the target server.
 */

import type { ToolsListRequest } from "@civic/hook-common";
import type {
  AudioContent,
  ListToolsResult,
  Tool as MCPTool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type ContentResult,
  type Context,
  FastMCP,
  type ImageContent,
  type TextContent,
} from "fastmcp";
import { createTargetClient } from "../client/client.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
} from "../hooks/processor.js";
import type { ClientFactory } from "../types/client.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { extractToolParameters } from "../utils/schemaConverter.js";
import { generateSessionId } from "../utils/session.js";
import { createPassthroughHandler } from "./passthrough.js";

type ToolHandler = (
  args: unknown,
  context: Context<{
    id: string;
  }>,
) => Promise<
  string | AudioContent | ContentResult | ImageContent | TextContent
>;

// Store discovered tools in memory
let discoveredTools: MCPTool[] = [];

/**
 * Get the list of discovered tools
 */
export function getDiscoveredTools(): MCPTool[] {
  return discoveredTools;
}
/**
 * Create a FastMCP server instance
 */
export function createServer(serverInfo?: {
  name: string;
  version: string;
}): FastMCP<{ id: string }> {
  return new FastMCP<{ id: string }>({
    name: serverInfo?.name || "passthrough-mcp-server",
    version: (serverInfo?.version ||
      "0.0.1") as `${number}.${number}.${number}`,
    authenticate: async () => {
      return {
        id: generateSessionId(),
      };
    },
  });
}

/**
 * Discover and register tools from the target server
 */
export async function discoverAndRegisterTools(
  server: FastMCP<{ id: string }>,
  config: Config,
  clientFactory?: ClientFactory,
): Promise<void> {
  // Create a temporary client to discover available tools
  const tempClient = clientFactory
    ? await clientFactory(config.client, "discovery", config.clientInfo)
    : await createTargetClient(config.client, "discovery", config.clientInfo);

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
  const { tools } = await tempClient.listTools();
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
  discoveredTools = toolsListResponse.tools;

  logger.info(
    `Discovered ${discoveredTools.length} tools from target server (after hook processing)`,
  );

  // Register each tool as a passthrough with its own handler
  for (const tool of discoveredTools) {
    // Create a passthrough handler specifically for this tool
    const toolHandler = createPassthroughHandler(
      config,
      tool.name,
      clientFactory,
    );

    // Extract parameters from the tool definition
    const parameters = extractToolParameters(tool);

    server.addTool({
      name: tool.name,
      description:
        tool.description || `Passthrough to ${tool.name} on target server`,
      parameters,
      execute: toolHandler as ToolHandler,
    });

    logger.info(`Registered passthrough for tool: ${tool.name}`);
  }
}
