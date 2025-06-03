/**
 * Passthrough MCP Server - Main Entry Point
 *
 * This module serves as the entry point for the passthrough MCP server.
 * It coordinates the loading of configuration, creation of the server,
 * tool discovery, and starting the server with the appropriate transport.
 *
 * The passthrough server acts as a proxy, forwarding all tool invocations
 * to a target MCP server and relaying the responses back to the client.
 */

import {
  createServer,
  discoverAndRegisterTools,
  getDiscoveredTools,
} from "./server/server.js";
import { getServerTransportConfig } from "./server/transport.js";
import { loadConfig } from "./utils/config.js";
import { logger } from "./utils/logger.js";

// Export types and functions for external use
export {
  getDiscoveredTools,
  createServer,
  discoverAndRegisterTools,
  getServerTransportConfig,
};
export type { Config, ClientConfig } from "./utils/config.js";
export type { ClientFactory, PassthroughClient } from "./types/client.js";
export { createTargetClient } from "./client/client.js";

/**
 * Main function to start the passthrough MCP server
 */
async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Create the server
    const server = createServer(config.serverInfo);

    // Discover and register tools from the target server
    await discoverAndRegisterTools(server, config);

    // Get transport configuration
    const transportConfig = getServerTransportConfig(config.server);

    // Start the server
    await server.start(transportConfig);

    logger.info(
      `Passthrough MCP Server running with ${config.server.transportType} transport${config.server.transportType !== "stdio" ? ` on port ${config.server.port}` : ""}, connecting to target at ${config.client.url}`,
    );
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});
