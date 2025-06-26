/**
 * Tools Discovery and Registration Module
 *
 * Handles discovering tools from the target MCP server and registering
 * them on the passthrough server with hook support.
 */

import type { ToolsListRequest } from "@civic/hook-common";
import type {
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

/**
 * Discovers tools from the target MCP server with hook processing
 */
export async function discoverToolsFromTarget(
  config: Config,
  authHeaders?: Record<string, string>,
): Promise<MCPTool[]> {
  const sessionData = await getOrCreateSessionForRequest(
    DEFAULT_SESSION_ID,
    config,
    authHeaders,
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
    return [];
  }

  // Get list of tools from the target server
  const { tools } = await sessionData.targetClient.listTools();
  logger.info(`Discovered ${tools.length} tools from target server`);

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    logger.warn("No tools found on target server");
    return [];
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
      return [];
    }

    // Use the potentially modified response
    toolsListResponse = responseResult.response;
  }

  logger.info(
    `Discovered ${toolsListResponse.tools.length} tools from target server (after hook processing)`,
  );

  return toolsListResponse.tools;
}
