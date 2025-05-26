/**
 * Client Module
 *
 * Provides functionality for creating and configuring MCP clients
 * that connect to target MCP servers. Supports different transport
 * types (SSE, HTTP Stream) and discovers available tools.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClientConfig } from "../utils/config.js";

/**
 * Create a client that connects to the target MCP server
 */
export async function createTargetClient(
  clientConfig: ClientConfig,
  clientId: string
): Promise<Client> {
  // Create MCP client
  const client = new Client(
    {
      name: "passthrough-mcp-client",
      version: "0.0.1",
    },
    {
      capabilities: {}, // No special capabilities needed
    }
  );

  // Create appropriate transport based on configuration
  const url = new URL(clientConfig.url);
  const transport = clientConfig.type === "sse"
    ? new SSEClientTransport(url)
    : new StreamableHTTPClientTransport(url);

  // Connect the client to the target server
  await client.connect(transport);
  console.log(`Client ${clientId} connected to target server at ${url.toString()}`);
  
  return client;
}