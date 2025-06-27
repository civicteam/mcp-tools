/**
 * Passthrough Bundle Main Entry Point
 *
 * Combines passthrough-mcp-server with hook loading capabilities
 */

import type { HookDefinition } from "@civic/passthrough-mcp-server";
import { createPassthroughProxy } from "@civic/passthrough-mcp-server";
import { loadConfigFromFile } from "./config/loader.js";
import type { BundleConfig } from "./config/schema";
import { loadHooks } from "./hookLoader.js";

/**
 * Load configuration from file or environment
 */
function loadConfig(): BundleConfig {
  // Try to load from CONFIG_FILE first
  const configFile = process.env.CONFIG_FILE;
  if (configFile) return loadConfigFromFile(configFile);

  // Fall back to passthrough-mcp-server's config loading
  // This will throw an error about hooks without URLs, which is expected
  throw new Error(
    "passthrough-bundle requires a CONFIG_FILE environment variable pointing to a mcphooks.config.json file",
  );
}

/**
 * Start the passthrough bundle with hook loading
 */
export async function startPassthroughBundle(): Promise<void> {
  // Load configuration
  const config = loadConfig();

  // Load hooks (both built-in and remote)
  const hookDefinitions: HookDefinition[] = await loadHooks(config.hooks || []);

  console.log(`Loaded ${hookDefinitions.length} hook definitions`);

  // Convert config to passthrough-mcp-server format
  const serverConfig = {
    transportType:
      config.proxy.transport === "stdio"
        ? ("stdio" as const)
        : ("httpStream" as const),
    port: config.proxy.port,
    target: config.target.command
      ? { transportType: "stdio" as const, command: config.target.command }
      : { transportType: "httpStream" as const, url: config.target.url || "" },
    serverInfo: {
      name: "passthrough-bundle",
      version: "0.1.0" as const,
    },
    hooks: hookDefinitions,
  };

  // Create and start the proxy
  const proxy = await createPassthroughProxy(serverConfig);

  console.log(
    `Passthrough bundle started on ${
      serverConfig.transportType === "stdio"
        ? "stdio"
        : `port ${serverConfig.port}`
    }`,
  );

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down passthrough bundle...");
    await proxy.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down passthrough bundle...");
    await proxy.stop();
    process.exit(0);
  });
}

// Export the hook loader utilities
export { loadHooks, createHookDefinition } from "./hookLoader.js";
