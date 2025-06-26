/**
 * MCP Protocol Handler Module
 *
 * Implements MCP server functionality using the MCP SDK directly.
 * Simply passes MCP requests to the target client with auth headers if present.
 */

import crypto from "node:crypto";
import type http from "node:http";
import { Readable } from "node:stream";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { createMCPServerWithAuth } from "./mcpServerAuth.js";

export interface MCPHandlerOptions {
  config: Config;
  sessionIdGenerator?: () => string;
}

/**
 * Creates an MCP protocol handler that processes requests
 */
export async function createMCPHandler(options: MCPHandlerOptions) {
  const { config } = options;

  // Create handler function for HTTP requests
  return async function handleMCPRequest(
    req: http.IncomingMessage & { auth?: AuthInfo },
    res: http.ServerResponse,
  ): Promise<void> {
    // Extract authorization headers if present
    const authHeaders: Record<string, string> = {};
    if (req.headers.authorization) {
      authHeaders.authorization = req.headers.authorization;
    }

    // Buffer the request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const requestBody = Buffer.concat(chunks);

    // Create a new readable stream from the buffered body
    const bufferedReq = Object.assign(Readable.from(requestBody), {
      method: req.method,
      headers: req.headers,
      url: req.url,
      socket: req.socket,
      httpVersion: req.httpVersion,
      auth: req.auth,
    }) as http.IncomingMessage & { auth?: AuthInfo };

    // Create a new MCP server for this request
    const { server } = await createMCPServerWithAuth({
      config,
      authHeaders,
    });

    // Handle MCP request through httpStream transport
    if (config.transportType === "httpStream") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: options.sessionIdGenerator || (() => crypto.randomUUID()),
      });

      // Connect the server to the transport
      await server.connect(transport);

      // Handle the request
      await transport.handleRequest(bufferedReq, res);
    } else {
      // For non-httpStream transports, return an error
      res.writeHead(400);
      res.end("Only httpStream transport is supported for HTTP requests");
    }

    // Clean up after request
    res.on("close", () => {
      server
        .close()
        .catch((err: unknown) => logger.error(`Error closing server: ${err}`));
    });
  };
}