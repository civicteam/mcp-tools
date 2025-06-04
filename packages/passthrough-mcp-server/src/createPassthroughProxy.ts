/**
 * Passthrough Proxy Factory
 *
 * Provides a high-level factory function for creating and starting
 * a passthrough MCP server with a single function call.
 */

import type { FastMCP } from "fastmcp";
import { createServer, discoverAndRegisterTools } from "./server/server.js";
import { getServerTransportConfig } from "./server/transport.js";
import type { ClientFactory } from "./types/client.js";
import type { Config } from "./utils/config.js";
import { logger } from "./utils/logger.js";

export interface PassthroughProxyOptions {
  /**
   * Server configuration
   */
  server: Config["server"];

  /**
   * Target client configuration
   */
  client: Config["client"];

  /**
   * Optional server metadata
   */
  serverInfo?: Config["serverInfo"];

  /**
   * Optional client metadata for connections
   */
  clientInfo?: Config["clientInfo"];

  /**
   * Optional array of hook configurations
   */
  hooks?: Config["hooks"];

  /**
   * Optional custom client factory for creating target clients
   */
  clientFactory?: ClientFactory;

  /**
   * Whether to start the server immediately after creation
   * @default true
   */
  autoStart?: boolean;
}

export interface PassthroughProxy {
  /**
   * The FastMCP server instance
   */
  server: FastMCP<{ id: string }>;

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
 *   server: { port: 34000, transportType: "httpStream" },
 *   client: { url: "http://localhost:33000", type: "stream" },
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
 *   server: { port: 34000, transportType: "httpStream" },
 *   client: { url: "http://localhost:33000", type: "stream" },
 *   autoStart: false
 * });
 *
 * // Start manually later
 * await proxy.start();
 * ```
 */
export async function createPassthroughProxy(
  options: PassthroughProxyOptions,
): Promise<PassthroughProxy> {
  const {
    server: serverConfig,
    client: clientConfig,
    serverInfo,
    clientInfo,
    hooks,
    clientFactory,
    autoStart = true,
  } = options;

  // Reconstruct config object for internal use
  const config: Config = {
    server: serverConfig,
    client: clientConfig,
    serverInfo,
    clientInfo,
    hooks,
  };

  // Create the server
  const server = createServer(config.serverInfo);

  // Discover and register tools from the target server
  await discoverAndRegisterTools(server, config, clientFactory);

  // Get transport configuration
  const transportConfig = getServerTransportConfig(config.server);

  let isStarted = false;

  const start = async () => {
    if (isStarted) {
      logger.warn("Server is already started");
      return;
    }

    await server.start(transportConfig);
    isStarted = true;

    logger.info(
      `Passthrough MCP Server running with ${config.server.transportType} transport${
        config.server.transportType !== "stdio"
          ? ` on port ${config.server.port}`
          : ""
      }, connecting to target at ${config.client.url}`,
    );
  };

  const stop = async () => {
    if (!isStarted) {
      logger.warn("Server is not started");
      return;
    }

    await server.stop();
    isStarted = false;
    logger.info("Passthrough MCP Server stopped");
  };

  // Auto-start if requested
  if (autoStart) {
    await start();
  }

  return {
    server,
    start,
    stop,
  };
}
