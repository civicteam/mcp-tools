/**
 * Server Module
 *
 * Responsible for creating the FastMCP server instance and registering
 * tools discovered from the target server. Dynamically discovers and
 * registers all available tools from the target server.
 */

import type { HookContext, ToolsListRequest } from "@civic/hook-common";
import type {
  ListToolsResult,
  Tool as MCPTool,
} from "@modelcontextprotocol/sdk/types.js";
import { FastMCP, type Tool as FastMCPTool } from "fastmcp";
import type { ZodType, ZodTypeDef } from "zod";
import { PassthroughServerHookContext } from "../context/PassthroughServerHookContext.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
} from "../hooks/processor.js";
import type { ClientFactory } from "../types/client.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { extractToolParameters } from "../utils/schemaConverter.js";
import {
  DEFAULT_SESSION_ID,
  clearSession,
  generateSessionId,
  getOrCreateSessionForRequest,
} from "../utils/session.js";
import { createPassthroughHandler } from "./passthrough.js";

/**
 * AuthSessionData of the FastMCP. This is only defined for http-streaming and sse, NOT for stdio
 */
export interface AuthSessionData {
  id: string;
  [key: string]: unknown; // Add index signature to satisfy Record<string, unknown>
}

interface ServerInfo {
  name: string;
  version: `${number}.${number}.${number}`;
}

type FastMCPToolHandler = FastMCPTool<
  AuthSessionData,
  ZodType<unknown, ZodTypeDef, unknown>
>["execute"];

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
export function createServer(
  serverInfo?: ServerInfo,
): FastMCP<AuthSessionData> {
  return new FastMCP<AuthSessionData>({
    name: serverInfo?.name || "passthrough-mcp-server",
    version: serverInfo?.version ?? "0.0.1",
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
  server: FastMCP<AuthSessionData>,
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
      sessionId: DEFAULT_SESSION_ID,
      timestamp: new Date().toISOString(),
      source: "passthrough-server",
    },
  };

  // Get hook clients
  const hookClients = getHookClients(config);

  // Create hook context
  const hookContext: HookContext = new PassthroughServerHookContext({
    sessionId: DEFAULT_SESSION_ID,
    targetClient: sessionData.targetClient,
    recreateTargetClient: async () => {
      // Clear current session and recreate it
      await clearSession(DEFAULT_SESSION_ID);
      const newSessionData = await getOrCreateSessionForRequest(
        DEFAULT_SESSION_ID,
        config,
      );
      return newSessionData.targetClient;
    },
  });

  // Process the tools/list request through hooks
  const requestResult = await processToolsListRequestThroughHooks(
    toolsListRequest,
    hookClients,
    hookContext,
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
      hookContext,
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
    const toolHandler = createPassthroughHandler(config, tool.name);

    // Extract parameters from the tool definition
    const parameters = extractToolParameters(tool);

    server.addTool({
      name: tool.name,
      description:
        tool.description || `Passthrough to ${tool.name} on target server`,
      parameters,
      execute: toolHandler as FastMCPToolHandler,
    });

    logger.info(`Registered passthrough for tool: ${tool.name}`);
  }
}
