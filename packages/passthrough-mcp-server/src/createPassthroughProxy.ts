/**
 * Passthrough Proxy Factory
 *
 * Provides a high-level factory function for creating and starting
 * a passthrough MCP server with a single function call.
 */

import crypto from "node:crypto";
import { createAuthProxyServer } from "./server/authProxy.js";
import { createMCPHandler } from "./server/mcpHandler.js";
import { createStdioServer } from "./server/stdioHandler.js";
import type { Config } from "./utils/config.js";
import { logger } from "./utils/logger.js";


export type PassthroughProxyOptions = Config & {
  /**
   * Whether to start the server immediately after creation
   * @default true
   */
  autoStart?: boolean;
};

export interface PassthroughProxy {
  /**
   * The server instance (FastMCP for stdio, HTTP server for httpStream/sse)
   */
  server: unknown; // FastMCP or HTTPServer

  /**
   * Start the server (if not already started)
   */
  start: () => Promise<void>;

  /**
   * Stop the server
   */
  stop: () => Promise<void>;
}

/**
 * Create and optionally start a passthrough MCP proxy server
 *
 * This function encapsulates all the setup logic needed to create
 * a passthrough MCP server, including:
 * - Server creation
 * - Tool discovery and registration
 * - Transport configuration
 * - Server startup (optional)
 *
 * @param options Configuration options for the proxy
 * @returns A PassthroughProxy object with server instance and control methods
 *
 * @example
 * ```typescript
 * // Create and start a passthrough proxy
 * const proxy = await createPassthroughProxy({
 *   transportType: "httpStream",
 *   port: 34000,
 *   target: { url: "http://localhost:33000", transportType: "httpStream" },
 *   serverInfo: { name: "my-passthrough", version: "1.0.0" }
 * });
 *
 * // Later, stop the server
 * await proxy.stop();
 * ```
 *
 * @example
 * ```typescript
 * // Create without auto-starting
 * const proxy = await createPassthroughProxy({
 *   transportType: "httpStream",
 *   port: 34000,
 *   target: { url: "http://localhost:33000", transportType: "httpStream" },
 *   autoStart: false
 * });
 *
 * // Start manually later
 * await proxy.start();
 * ```
 *
 * @example
 * ```typescript
 * // Create with stdio transport (no port required)
 * const proxy = await createPassthroughProxy({
 *   transportType: "stdio",
 *   target: { url: "http://localhost:33000", transportType: "httpStream" },
 *   serverInfo: { name: "stdio-passthrough", version: "1.0.0" }
 * });
 * ```
 */
export async function createPassthroughProxy(
  options: PassthroughProxyOptions,
): Promise<PassthroughProxy> {
  const { autoStart = true, ...config } = options;



  // For stdio transport, use the message handler
  if (config.transportType === "stdio") {
    const { transport, messageHandler } = await createStdioServer(config);

    let isStarted = false;

    const start = async () => {
      if (isStarted) {
        logger.warn("Server is already started");
        return;
      }

      await transport.start();
      isStarted = true;

      logger.info(
        `Passthrough MCP Server running with stdio transport, connecting to target at ${config.target.url}`,
      );
    };

    const stop = async () => {
      if (!isStarted) {
        logger.warn("Server is not started");
        return;
      }


      await transport.close();
      isStarted = false;
      logger.info("Passthrough MCP Server stopped");
    };

    if (autoStart) {
      await start();
    }

    return { server: transport as unknown, start, stop };
  }

  // For HTTP-based transports, use new auth-compliant implementation
  if (config.transportType !== "httpStream") {
    throw new Error(
      `Transport type ${config.transportType} is not supported for HTTP. Only httpStream and stdio are supported.`,
    );
  }

  // Create MCP handler
  const mcpHandler = await createMCPHandler({
    config,
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  // Create HTTP proxy server
  const httpServer = createAuthProxyServer(
    {
      targetUrl: config.target.url,
      mcpEndpoint: "/mcp",
    },
    mcpHandler,
  );

  let isStarted = false;

  const start = async () => {
    if (isStarted) {
      logger.warn("Server is already started");
      return;
    }

    const port = config.port || 3000;
    await new Promise<void>((resolve, reject) => {
      httpServer.on("error", reject);
      httpServer.listen(port, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });

    isStarted = true;

    logger.info(
      `Passthrough MCP Server running with ${config.transportType} transport on port ${port}, connecting to target at ${config.target.url}`,
    );
  };

  const stop = async () => {
    if (!isStarted) {
      logger.warn("Server is not started");
      return;
    }


    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    isStarted = false;
    logger.info("Passthrough MCP Server stopped");
  };

  if (autoStart) {
    await start();
  }

  // Return a compatible interface
  // Note: httpServer doesn't have the same interface as FastMCP
  return {
    server: httpServer as unknown,
    start,
    stop,
  };
}
