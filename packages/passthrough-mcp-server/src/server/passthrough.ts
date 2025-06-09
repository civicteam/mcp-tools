/**
 * Passthrough Handler Module (tRPC-based)
 *
 * Implements the core passthrough functionality that redirects tool execution
 * requests from the MCP server to the target MCP client. Maintains session context
 * and creates a specific handler for each tool.
 *
 * Uses tRPC-based hooks instead of MCP for hook communication.
 */

import type { ToolCall } from "@civic/hook-common";
import type { Context } from "fastmcp";
import { createTargetClient } from "../client/client.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hooks/processor.js";
import type { ClientFactory, PassthroughClient } from "../types/client.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { getOrCreateSession } from "../utils/session.js";
import { getDiscoveredTools } from "./server.js";

/**
 * Create a passthrough handler for a specific tool
 *
 * This is a curried function that captures the tool name at registration time
 * and returns a handler function that can be used to process tool calls.
 *
 * If hooks are configured, tool calls will be sent to the hooks for processing
 * before being forwarded to the target server.
 */
export function createPassthroughHandler(
  config: Config,
  toolName: string,
  targetClient: PassthroughClient,
) {
  return async function passthrough(
    args: unknown,
    context: Context<{ id: string }>,
  ): Promise<unknown> {
    const { session } = context;
    const sessionId = session?.id || "default";

    // Get or create session with target client
    const sessionData = await getOrCreateSession(sessionId, targetClient);

    // Increment request counter
    sessionData.requestCount += 1;

    // Find the tool definition from cached tools
    const discoveredTools = getDiscoveredTools();
    const toolDefinition = discoveredTools.find(
      (tool) => tool.name === toolName,
    );

    // Create the tool call object with metadata and tool definition
    const toolCall: ToolCall = {
      name: toolName,
      arguments: args,
      metadata: {
        sessionId,
        timestamp: new Date().toISOString(),
        source: "passthrough-server",
      },
      toolDefinition: toolDefinition
        ? {
            name: toolDefinition.name,
            description: toolDefinition.description,
            inputSchema: toolDefinition.inputSchema,
          }
        : undefined,
    };

    // Get hook clients
    const hookClients = getHookClients(config);

    // Process requests through hooks
    const requestResult = await processRequestThroughHooks(
      toolCall,
      hookClients,
    );

    // Initialize response
    let response: unknown;

    // If no hook rejected and we should call the target service
    if (!requestResult.wasRejected) {
      // Log the request to target server
      logger.info(
        `Passing through request #${sessionData.requestCount} for tool '${requestResult.toolCall.name}' from session ${sessionId}`,
      );

      // Call the target client's tool with arguments (potentially modified by hook)
      const toolCallWithArgs = {
        ...requestResult.toolCall,
        arguments:
          typeof requestResult.toolCall.arguments === "object" &&
          requestResult.toolCall.arguments !== null
            ? (requestResult.toolCall.arguments as Record<string, unknown>)
            : undefined,
      };
      response = await sessionData.targetClient.callTool(toolCallWithArgs);
    } else {
      // Use the rejection response
      response = requestResult.rejectionResponse;
      logger.info(
        "Request rejected by hook, skipping target service call. Using rejection response.",
      );
    }

    // Process responses through hooks in reverse order if configured
    if (hookClients.length > 0) {
      const startIndex = requestResult.wasRejected
        ? requestResult.lastProcessedIndex // Start from the hook that rejected
        : hookClients.length - 1; // Start from the last hook

      const responseResult = await processResponseThroughHooks(
        response,
        requestResult.toolCall,
        hookClients,
        startIndex,
      );

      logger.info(`Response result: ${JSON.stringify(responseResult)}`);

      // Use the final response or rejection response
      if (responseResult.wasRejected) {
        response = {
          content: [
            {
              type: "text",
              text: responseResult.rejectionResponse,
            },
          ],
        };
      } else {
        response = responseResult.response;
      }
    }

    logger.info(`Response for tool '${toolName}': ${JSON.stringify(response)}`);
    return response;
  };
}
