/**
 * Tool Handler Module
 *
 * Creates handlers for individual tools that process requests through hooks
 * and forward them to the target server.
 */

import type { ToolCall } from "@civic/hook-common";
import type {
  CallToolRequest,
  CallToolResult,
  Tool as MCPTool,
} from "@modelcontextprotocol/sdk/types.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
  DEFAULT_SESSION_ID,
  getOrCreateSessionForRequest,
} from "../utils/session.js";
import type { ToolContext } from "./types.js";

export function createToolHandler(
  config: Config,
  tool: MCPTool,
  context?: ToolContext,
) {
  return async function handleToolCall(
    request: CallToolRequest,
  ): Promise<CallToolResult> {
    // Extract session ID from request context if available
    const sessionId = context?.sessionId || DEFAULT_SESSION_ID;

    // Get or create session with target client
    const sessionData = await getOrCreateSessionForRequest(
      sessionId,
      config,
      context?.authHeaders,
    );

    // Create the tool call object with metadata and tool definition
    const toolCall: ToolCall = {
      name: request.params.name,
      arguments: request.params.arguments,
      metadata: {
        sessionId,
        timestamp: new Date().toISOString(),
        source: "passthrough-server",
      },
      toolDefinition: {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
    };

    // Get hook clients
    const hookClients = getHookClients(config);

    // Process requests through hooks
    const requestResult = await processRequestThroughHooks(
      toolCall,
      hookClients,
    );

    // Initialize response
    let response: CallToolResult;

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
      // Use the rejection response - ensure it's a proper CallToolResult
      if (
        requestResult.rejectionResponse &&
        typeof requestResult.rejectionResponse === "object" &&
        "content" in requestResult.rejectionResponse
      ) {
        response = requestResult.rejectionResponse as CallToolResult;
      } else {
        // Create a default rejection response
        response = {
          content: [
            {
              type: "text",
              text: requestResult.rejectionReason || "Request rejected by hook",
            },
          ],
        };
      }
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
              text: String(
                responseResult.rejectionResponse ||
                  responseResult.rejectionReason ||
                  "Response rejected by hook",
              ),
            },
          ],
        };
      } else {
        response = responseResult.response as CallToolResult;
      }
    }

    logger.info(
      `Response for tool '${tool.name}': ${JSON.stringify(response)}`,
    );
    return response;
  };
}
