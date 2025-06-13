/**
 * Example: Programmatic Usage of Passthrough MCP Server
 *
 * This example demonstrates how to use the passthrough MCP server
 * programmatically in your own applications.
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";
import { createPassthroughProxy } from "../src/index.js";

async function example1_basicUsage() {
  console.log("Example 1: Basic Usage");

  // Create and start the proxy
  const proxy = await createPassthroughProxy({
    transportType: "httpStream",
    port: 34000,
    target: {
      url: "http://localhost:33000",
      transportType: "httpStream",
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
    transportType: "sse",
    port: 34001,
    target: {
      url: "http://localhost:33001",
      transportType: "sse",
    },
    autoStart: false,
  });

  console.log("Proxy created but not started");

  // Start manually after some setup
  console.log("Starting proxy...");
  await proxy.start();
  console.log("Proxy is now running!");
}

async function example3_withRemoteHooks() {
  console.log("\nExample 3: With Remote Hooks");

  const proxy = await createPassthroughProxy({
    transportType: "httpStream",
    port: 34002,
    target: {
      url: "http://localhost:33002",
      transportType: "httpStream",
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
  console.log("Proxy running with remote hooks configured");
}

async function example4_withProgrammaticHooks() {
  console.log("\nExample 4: With Programmatic Hooks");

  // Create a simple logging hook
  class LoggingHook extends AbstractHook {
    get name(): string {
      return "LoggingHook";
    }

    async processRequest(toolCall: ToolCall): Promise<HookResponse> {
      console.log(
        `[${this.name}] Tool request: ${toolCall.name}`,
        toolCall.arguments,
      );
      return {
        response: "continue",
        body: toolCall,
      };
    }

    async processResponse(
      response: unknown,
      originalToolCall: ToolCall,
    ): Promise<HookResponse> {
      console.log(
        `[${this.name}] Tool response for ${originalToolCall.name}:`,
        response,
      );
      return {
        response: "continue",
        body: response,
      };
    }
  }

  // Create a validation hook
  class ValidationHook extends AbstractHook {
    get name(): string {
      return "ValidationHook";
    }

    async processRequest(toolCall: ToolCall): Promise<HookResponse> {
      // Block dangerous operations
      if (
        toolCall.name.toLowerCase().includes("delete") ||
        toolCall.name.toLowerCase().includes("remove")
      ) {
        return {
          response: "abort",
          body: null,
          reason: "Dangerous operations are not allowed",
        };
      }

      return {
        response: "continue",
        body: toolCall,
      };
    }
  }

  // Mix programmatic hooks with remote hooks
  const proxy = await createPassthroughProxy({
    transportType: "httpStream",
    port: 34002,
    target: {
      url: "http://localhost:33002",
      transportType: "httpStream",
    },
    hooks: [
      new LoggingHook(), // Programmatic hook instance
      new ValidationHook(), // Another programmatic hook
      {
        // Remote hook
        url: "http://localhost:8080/trpc",
        name: "remote-audit-hook",
      },
    ],
  });

  console.log("Proxy running with both programmatic and remote hooks");
}

async function example5_customClientFactory() {
  console.log("\nExample 5: Custom Client Factory");

  // Custom client factory that adds logging
  const customClientFactory = async (clientConfig, clientId, clientInfo) => {
    console.log(`Creating client ${clientId} for ${clientConfig.url}`);

    // Import the default client creator
    const { createTargetClient } = await import(
      "../src/client/RemoteClient.js"
    );

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
    transportType: "httpStream",
    port: 34003,
    target: {
      url: "http://localhost:33003",
      transportType: "httpStream",
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
    example3_withRemoteHooks().catch(console.error);
    break;
  case "4":
    example4_withProgrammaticHooks().catch(console.error);
    break;
  case "5":
    example5_customClientFactory().catch(console.error);
    break;
  default:
    console.log("Usage: tsx programmatic-usage.ts [1|2|3|4|5]");
    console.log("1 - Basic usage");
    console.log("2 - Manual start");
    console.log("3 - With remote hooks");
    console.log("4 - With programmatic hooks");
    console.log("5 - Custom client factory");
}
