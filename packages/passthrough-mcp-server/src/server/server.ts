/**
 * Server Module
 *
 * Responsible for creating the FastMCP server instance and registering
 * tools discovered from the target server. Dynamically discovers and
 * registers all available tools from the target server.
 */

import { FastMCP } from "fastmcp";
import { generateSessionId } from "../utils/session.js";
import { createTargetClient } from "../client/client.js";
import { createPassthroughHandler } from "./passthrough.js";
import { Config } from "../utils/config.js";
import { extractToolParameters } from "../utils/schemaConverter.js";

/**
 * Create a FastMCP server instance
 */
export function createServer(): FastMCP<{ id: string }> {
  return new FastMCP<{ id: string }>({
    name: "passthrough-mcp-server",
    version: "0.0.1",
    authenticate: async () => {
      return {
        id: generateSessionId(),
      };
    },
  });
}

/**
 * Discover and register tools from the target server
 */
export async function discoverAndRegisterTools(
  server: FastMCP<{ id: string }>,
  config: Config
): Promise<void> {
  // Create a temporary client to discover available tools
  const tempClient = await createTargetClient(
    config.client,
    "discovery"
  );

  // Get list of tools from the target server
  const { tools } = await tempClient.listTools();
  console.log(`Discovered ${tools.length} tools from target server`);
  console.log("Raw: ", JSON.stringify(tools));

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    console.warn("No tools found on target server");
    return;
  }

  console.log(`Discovered ${tools.length} tools from target server`);

  // Register each tool as a passthrough with its own handler
  for (const tool of tools) {
    // Create a passthrough handler specifically for this tool
    const toolHandler = createPassthroughHandler(config, tool.name);

    // Extract parameters from the tool definition
    const parameters = extractToolParameters(tool);

    server.addTool({
      name: tool.name,
      description: tool.description || `Passthrough to ${tool.name} on target server`,
      parameters,
      execute: toolHandler,
    });

    console.log(`Registered passthrough for tool: ${tool.name}`);
  }
}