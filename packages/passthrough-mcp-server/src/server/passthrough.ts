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
import { getHookClients } from "../hooks/manager.js";
import {
  processExceptionThroughHooks,
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
  DEFAULT_SESSION_ID,
  getOrCreateSessionForRequest,
} from "../utils/session.js";
import { type AuthSessionData, getDiscoveredTools } from "./server.js";

/**
 * Create a passthrough handler for a specific tool
 *
 * This is a curried function that captures the tool name at registration time
 * and returns a handler function that can be used to process tool calls.
 *
 * If hooks are configured, tool calls will be sent to the hooks for processing
 * before being forwarded to the target server.
 */
export function createPassthroughHandler(config: Config, toolName: string) {
  return async function passthrough(
    args: unknown,
    context: Context<AuthSessionData>,
  ): Promise<unknown> {
    const { session } = context;
    const sessionId = session?.id || DEFAULT_SESSION_ID;

    // Get or create session with target client
    const sessionData = await getOrCreateSessionForRequest(sessionId, config);

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

      try {
        response = await sessionData.targetClient.callTool(toolCallWithArgs);
      } catch (error) {
        // Process exception through hooks
        const exceptionResult = await processExceptionThroughHooks(
          error,
          requestResult.toolCall,
          hookClients,
        );

        if (exceptionResult.wasHandled) {
          // Hook handled the exception, use its response
          response = exceptionResult.response;
          logger.info(
            `Exception handled by hook: ${exceptionResult.reason || "No reason provided"}`,
          );
        } else {
          // No hook handled the exception, re-throw it
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Exception not handled by any hook for tool '${requestResult.toolCall.name}': ${errorMessage}`,
          );
          throw error;
        }
      }
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
