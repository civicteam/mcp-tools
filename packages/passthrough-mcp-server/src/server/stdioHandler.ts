/**
 * Stdio Handler Module
 *
 * Provides stdio transport handling using the MessageHandler
 * for transparent message forwarding to HTTP targets.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { MessageHandler } from "./messageHandler.js";

/**
 * Create and configure stdio transport with protocol forwarder
 */
export async function createStdioServer(config: Config): Promise<{
  transport: StdioServerTransport;
  messageHandler: MessageHandler;
}> {
  // Create the transport
  const transport = new StdioServerTransport();

  // Create message handler
  const messageHandler = new MessageHandler(config);

  // Extract auth headers from config if provided
  const authHeaders: Record<string, string> = {};
  if (config.authToken) {
    authHeaders.authorization = `Bearer ${config.authToken}`;
  }

  // Set up message forwarding
  transport.onmessage = async (message: JSONRPCMessage) => {
    logger.info(`[StdioHandler] Received message: ${JSON.stringify(message)}`);

    const response = await messageHandler.handle(message, authHeaders);

    logger.info(`[StdioHandler] Sending response: ${JSON.stringify(response)}`);
    if (response) {
      await transport.send(response);
    }
  };

  // Log transport errors
  transport.onerror = (error: Error) => {
    logger.error(`Stdio transport error: ${error.message}`);
  };

  // Handle transport close
  transport.onclose = () => {
    logger.info("Stdio transport closed");
  };

  return { transport, messageHandler };
}
