/**
 * MCP Protocol Handler Module
 *
 * Implements stateless HTTP proxying for MCP protocol messages.
 * Transparently passes all MCP requests to the target server with auth headers.
 */

import type http from "node:http";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import { messageFromError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import { MessageHandler } from "./messageHandler.js";

export interface MCPHandlerOptions {
  config: Config;
  sessionIdGenerator?: () => string;
}

/**
 * Creates an MCP protocol handler that processes requests
 */
export async function createMCPHandler(options: MCPHandlerOptions) {
  const { config } = options;
  const messageHandler = new MessageHandler(config);

  // Create handler function for HTTP requests
  return async function handleMCPRequest(
    req: http.IncomingMessage & { auth?: AuthInfo },
    res: http.ServerResponse,
  ): Promise<void> {
    logger.info(`[MCPHandler] Incoming HTTP request: ${req.method} ${req.url}`);
    logger.info(`[MCPHandler] Headers: ${JSON.stringify(req.headers)}`);

    try {
      // Only handle POST requests
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
        return;
      }

      // Buffer the request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const requestBody = Buffer.concat(chunks);
      logger.info(`[MCPHandler] Request body: ${requestBody.toString()}`);

      // Parse JSON-RPC message
      let message: JSONRPCMessage;
      try {
        message = JSON.parse(requestBody.toString()) as JSONRPCMessage;
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error",
            },
            id: null,
          }),
        );
        return;
      }

      // Extract relevant headers to forward
      const forwardHeaders: Record<string, string> = {};

      // Always forward these headers if present
      const headersToForward = [
        "authorization",
        "mcp-session-id",
        "accept",
        "accept-language",
        "user-agent",
      ];

      for (const header of headersToForward) {
        const value = req.headers[header];
        if (value && typeof value === "string") {
          forwardHeaders[header] = value;
        }
      }

      // Process the message through the handler
      const response = await messageHandler.handle(message, forwardHeaders);

      // Send the response
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify(response));
    } catch (error) {
      logger.error(`[MCPHandler] Unhandled error: ${messageFromError(error)}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: messageFromError(error),
          },
          id: null,
        }),
      );
    }
  };
}
