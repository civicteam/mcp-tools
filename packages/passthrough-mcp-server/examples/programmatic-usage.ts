/**
 * Example: Programmatic Usage of Passthrough MCP Server
 *
 * This example demonstrates how to use the passthrough MCP server
 * programmatically in your own applications.
 */

import { createPassthroughProxy } from "../src/index.js";

async function example1_basicUsage() {
  console.log("Example 1: Basic Usage");

  // Create and start the proxy
  const proxy = await createPassthroughProxy({
    server: {
      port: 34000,
      transportType: "httpStream",
    },
    client: {
      url: "http://localhost:33000",
      type: "stream",
    },
    serverInfo: {
      name: "my-passthrough-server",
      version: "1.0.0",
    },
  });

  console.log("Passthrough proxy is running!");

  // Stop after 10 seconds
  setTimeout(async () => {
    await proxy.stop();
    console.log("Proxy stopped");
  }, 10000);
}

async function example2_manualStart() {
  console.log("\nExample 2: Manual Start");

  // Create without auto-starting
  const proxy = await createPassthroughProxy({
    server: {
      port: 34001,
      transportType: "sse",
    },
    client: {
      url: "http://localhost:33001",
      type: "sse",
    },
    autoStart: false,
  });

  console.log("Proxy created but not started");

  // Start manually after some setup
  console.log("Starting proxy...");
  await proxy.start();
  console.log("Proxy is now running!");

  // Access the underlying FastMCP server if needed
  const server = proxy.server;
  console.log(`Server name: ${server.name}`);
}

async function example3_withHooks() {
  console.log("\nExample 3: With Hooks");

  const proxy = await createPassthroughProxy({
    server: {
      port: 34002,
      transportType: "httpStream",
    },
    client: {
      url: "http://localhost:33002",
      type: "stream",
    },
    hooks: [
      {
        url: "http://localhost:8080/trpc",
        name: "audit-hook",
      },
      {
        url: "http://localhost:8081/trpc",
        name: "filter-hook",
      },
    ],
  });
  console.log("Proxy running with hooks configured");
}

async function example4_customClientFactory() {
  console.log("\nExample 4: Custom Client Factory");

  // Custom client factory that adds logging
  const customClientFactory = async (clientConfig, clientId, clientInfo) => {
    console.log(`Creating client ${clientId} for ${clientConfig.url}`);

    // Import the default client creator
    const { createTargetClient } = await import("../src/client/client.js");

    const client = await createTargetClient(clientConfig, clientId, clientInfo);

    // Wrap the client to add logging
    return {
      async listTools() {
        console.log(`Client ${clientId}: Listing tools`);
        const result = await client.listTools();
        console.log(`Client ${clientId}: Found ${result.tools.length} tools`);
        return result;
      },

      async callTool(params) {
        console.log(`Client ${clientId}: Calling tool ${params.name}`);
        const result = await client.callTool(params);
        console.log(`Client ${clientId}: Tool call completed`);
        return result;
      },
    };
  };

  const proxy = await createPassthroughProxy({
    server: {
      port: 34003,
      transportType: "httpStream",
    },
    client: {
      url: "http://localhost:33003",
      type: "stream",
    },
    clientFactory: customClientFactory,
  });

  console.log("Proxy running with custom client factory");
}

// Run examples based on command line argument
const exampleNumber = process.argv[2] || "1";

switch (exampleNumber) {
  case "1":
    example1_basicUsage().catch(console.error);
    break;
  case "2":
    example2_manualStart().catch(console.error);
    break;
  case "3":
    example3_withHooks().catch(console.error);
    break;
  case "4":
    example4_customClientFactory().catch(console.error);
    break;
  default:
    console.log("Usage: tsx programmatic-usage.ts [1|2|3|4]");
    console.log("1 - Basic usage");
    console.log("2 - Manual start");
    console.log("3 - With hooks");
    console.log("4 - Custom client factory");
}
