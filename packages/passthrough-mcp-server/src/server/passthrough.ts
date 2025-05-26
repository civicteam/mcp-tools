/**
 * Passthrough Handler Module (tRPC-based)
 *
 * Implements the core passthrough functionality that redirects tool execution
 * requests from the MCP server to the target MCP client. Maintains session context
 * and creates a specific handler for each tool.
 *
 * Uses tRPC-based hooks instead of MCP for hook communication.
 */

import { getOrCreateSession } from "../utils/session.js";
import { createTargetClient } from "../client/client.js";
import { Config } from "../utils/config.js";
import { Context } from "fastmcp";
import type { ToolCall } from "@civicteam/hook-common/types";
import { getHookClients } from "../hooks/manager.js";
import { processRequestThroughHooks, processResponseThroughHooks } from "../hooks/processor.js";

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
    args: any,
    context: Context<{ id: string }>
  ): Promise<any> {
    const { log, session } = context;
    const sessionId = session?.id || "default";

    // Get or create session with target client
    const sessionData = await getOrCreateSession(
      sessionId,
      () => createTargetClient(config.client, sessionId)
    );

    // Increment request counter
    sessionData.requestCount += 1;

    // Create the tool call object with metadata
    const toolCall: ToolCall = {
      name: toolName,
      arguments: args,
      metadata: {
        sessionId,
        timestamp: new Date().toISOString(),
        source: 'passthrough-server',
      }
    };

    // Get hook clients
    const hookClients = getHookClients(config);

    // Process requests through hooks
    const requestResult = await processRequestThroughHooks(
      toolCall,
      hookClients,
      log
    );

    // Initialize response
    let response: any;

    // If no hook rejected and we should call the target service
    if (!requestResult.wasRejected) {
      // Log the request to target server
      log.info(`Passing through request #${sessionData.requestCount} for tool '${requestResult.toolCall.name}' from session ${sessionId}`);

      // Call the target client's tool with arguments (potentially modified by hook)
      response = await sessionData.targetClient.callTool(requestResult.toolCall);
    } else {
      // Use the rejection response
      response = requestResult.rejectionResponse;
      log.info(`Request rejected by hook, skipping target service call. Using rejection response.`);
    }

    // Process responses through hooks in reverse order if configured
    if (hookClients.length > 0) {
      const startIndex = requestResult.wasRejected 
        ? requestResult.lastProcessedIndex  // Start from the hook that rejected
        : hookClients.length - 1; // Start from the last hook
      
      response = await processResponseThroughHooks(
        response,
        requestResult.toolCall,
        hookClients,
        startIndex,
        log
      );
    }

    return response;
  };
}