/**
 * Message Handler Module
 *
 * Provides shared message processing logic for both HTTP and stdio transports.
 * Handles JSON-RPC message forwarding to HTTP targets with hook processing.
 */

import type {
  HookClient,
  ToolCall,
  ToolsListRequest,
} from "@civic/hook-common";
import type {
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { getHookClients } from "../hooks/manager.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
  processToolsListRequestThroughHooks,
  processToolsListResponseThroughHooks,
} from "../hooks/processor.js";
import type { Config } from "../utils/config.js";
import { messageFromError } from "../utils/error.js";
import { logger } from "../utils/logger.js";

export class MessageHandler {
  private hooks: HookClient[];
  private targetUrl: string;

  constructor(private config: Config) {
    this.hooks = getHookClients(config);
    this.targetUrl = config.target.url;
  }

  /**
   * Handle a JSON-RPC message by forwarding it to the target and processing hooks
   */
  async handle(
    message: JSONRPCMessage,
    headers: Record<string, string> = {},
  ): Promise<JSONRPCMessage> {
    logger.info(
      `[MessageHandler] Processing message: ${JSON.stringify(message)}`,
    );
    logger.info(`[MessageHandler] Headers: ${JSON.stringify(headers)}`);

    try {
      // Only process requests
      if (!("method" in message)) {
        logger.warn(
          `[MessageHandler] Received non-request message: ${JSON.stringify(message)}`,
        );
        return message;
      }

      const request = message as JSONRPCRequest;

      // Check if this request needs hook processing
      if (request.method === "tools/call") {
        return await this.handleToolCall(request, headers);
      }
      if (request.method === "tools/list") {
        return await this.handleToolsList(request, headers);
      }

      // Forward all other requests directly
      return await this.forwardRequest(request, headers);
    } catch (error) {
      const errorMessage = messageFromError(error);
      logger.error(
        `[MessageHandler] Error processing message: ${errorMessage}`,
      );

      return {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: errorMessage,
        },
        id: "id" in message ? message.id : null,
      } as JSONRPCError;
    }
  }

  /**
   * Handle tools/call requests with hook processing
   */
  private async handleToolCall(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<JSONRPCMessage> {
    try {
      // Extract tool call information
      const params = request.params as { name: string; arguments?: unknown };
      const toolCall: ToolCall = {
        name: params.name,
        arguments: params.arguments || {},
        metadata: {
          sessionId: headers["mcp-session-id"] || "unknown",
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      };

      // Process through request hooks
      const requestResult = await processRequestThroughHooks(
        toolCall,
        this.hooks,
      );

      if (requestResult.wasRejected) {
        return {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message:
              requestResult.rejectionReason || "Request rejected by hook",
            data: requestResult.rejectionResponse,
          },
          id: request.id,
        } as JSONRPCError;
      }

      // Forward to target
      const response = await this.forwardRequest(request, headers);

      // Process response through hooks if successful
      if ("result" in response) {
        const responseResult = await processResponseThroughHooks(
          response.result,
          requestResult.toolCall,
          this.hooks,
          requestResult.lastProcessedIndex,
        );

        if (responseResult.wasRejected) {
          return {
            jsonrpc: "2.0",
            error: {
              code: -32002,
              message:
                responseResult.rejectionReason || "Response rejected by hook",
              data: responseResult.rejectionResponse,
            },
            id: request.id,
          } as JSONRPCError;
        }

        // Return modified response
        return {
          ...response,
          result: responseResult.response as Record<string, unknown>,
        };
      }

      return response;
    } catch (error) {
      return {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `Error processing tool call: ${messageFromError(error)}`,
          data: messageFromError(error),
        },
        id: request.id,
      } as JSONRPCError;
    }
  }

  /**
   * Handle tools/list requests with hook processing
   */
  private async handleToolsList(
    request: JSONRPCRequest,
    headers: Record<string, string>,
  ): Promise<JSONRPCMessage> {
    try {
      // Create tools list request
      const toolsListRequest: ToolsListRequest = {
        method: "tools/list",
        metadata: {
          sessionId: headers["mcp-session-id"] || "unknown",
          timestamp: new Date().toISOString(),
          source: "passthrough-server",
        },
      };

      // Process through request hooks
      const requestResult = await processToolsListRequestThroughHooks(
        toolsListRequest,
        this.hooks,
      );

      if (requestResult.wasRejected) {
        return {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message:
              requestResult.rejectionReason || "Request rejected by hook",
            data: requestResult.rejectionResponse,
          },
          id: request.id,
        } as JSONRPCError;
      }

      // Forward to target
      const response = await this.forwardRequest(request, headers);

      // Process response through hooks if successful
      if ("result" in response) {
        const responseResult = await processToolsListResponseThroughHooks(
          response.result as ListToolsResult,
          requestResult.request,
          this.hooks,
          requestResult.lastProcessedIndex,
        );

        if (responseResult.wasRejected) {
          return {
            jsonrpc: "2.0",
            error: {
              code: -32002,
              message:
                responseResult.rejectionReason || "Response rejected by hook",
              data: responseResult.rejectionResponse,
            },
            id: request.id,
          } as JSONRPCError;
        }

        // Return modified response
        return {
          ...response,
          result: responseResult.response,
        };
      }

      return response;
    } catch (error) {
      return {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `Error processing tools list: ${messageFromError(error)}`,
          data: messageFromError(error),
        },
        id: request.id,
      } as JSONRPCError;
    }
  }

  /**
   * Forward a request to the target server via HTTP
   */
    private async forwardRequest(
      request: JSONRPCRequest,
      headers: Record<string, string>,
    ): Promise<JSONRPCResponse | JSONRPCError> {
      logger.info(
        `[MessageHandler] Forwarding to ${this.targetUrl}: ${JSON.stringify(request)}`,
      );
      logger.info(`[MessageHandler] Forward headers: ${JSON.stringify(headers)}`);
  
      try {
        const response = await fetch(this.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(request),
        });
  
        const responseText = await response.text();
        logger.info(`[MessageHandler] Response status: ${response.status}`);
        logger.info(`[MessageHandler] Response body: ${responseText}`);
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }
  
        // Handle empty responses (e.g., from notifications)
        if (!responseText || responseText.trim() === "") {
          // Return a null response for notifications
          return {
            jsonrpc: "2.0",
            result: null,
            id: request.id,
          } as unknown as JSONRPCResponse;
        }

        // Check if response is SSE format
        if (responseText.startsWith("event:")) {
          // Parse SSE response
          const lines = responseText.split("\n");
          let jsonData = "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              jsonData = line.substring(6); // Remove "data: " prefix
              break;
            }
          }
          
          if (!jsonData) {
            throw new Error("No data found in SSE response");
          }
          
          const jsonResponse = JSON.parse(jsonData) as JSONRPCMessage;
          return jsonResponse as JSONRPCResponse | JSONRPCError;
        } else {
          // Regular JSON response
          const jsonResponse = JSON.parse(responseText) as JSONRPCMessage;
          return jsonResponse as JSONRPCResponse | JSONRPCError;
        }
      } catch (error) {
        logger.error(
          `[MessageHandler] Forward error: ${messageFromError(error)}`,
        );
        return {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Failed to forward request: ${messageFromError(error)}`,
            data: messageFromError(error),
          },
          id: request.id,
        } as JSONRPCError;
      }
    }

}
