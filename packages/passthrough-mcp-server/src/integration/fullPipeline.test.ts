import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FastMCP } from "fastmcp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createPassthroughProxy } from "../createPassthroughProxy.js";

// Hook that records calls into arrays
class RecordingHook extends AbstractHook {
  public requests: Array<{ name: string; arguments: unknown }> = [];
  public responses: Array<{ toolName: string; response: unknown }> = [];

  get name(): string {
    return "RecordingHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    this.requests.push({
      name: toolCall.name,
      arguments: toolCall.arguments,
    });
    return {
      response: "continue",
      body: toolCall,
    };
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    this.responses.push({
      toolName: originalToolCall.name,
      response,
    });
    return {
      response: "continue",
      body: response,
    };
  }
}

describe("Full MCP Pipeline Integration", () => {
  let targetServer: FastMCP<{ id: string }>;
  let targetPort: number;
  let passthroughPort: number;
  let recordingHook: RecordingHook;
  let proxy: any;

  // Step A: Create and start a target server with echo tool
  async function createTargetServer(port: number) {
    const server = new FastMCP({
      name: "test-target-server",
      version: "1.0.0",
    });

    server.addTool({
      name: "echo",
      description: "Echoes back the input message",
      parameters: z.object({
        message: z.string().describe("A message to echo back"),
      }),
      execute: async ({ message }) => {
        return `Echo: ${message}`;
      },
    });

    await server.start({
      transportType: "httpStream",
      httpStream: {
        port,
        endpoint: "/mcp",
      },
    });

    return server;
  }

  // Step B: Create and start passthrough server with recording hook
  async function createPassthroughServer(
    port: number,
    targetUrl: string,
    hook: RecordingHook,
  ) {
    return await createPassthroughProxy({
      transportType: "httpStream",
      port,
      target: {
        url: targetUrl,
        transportType: "httpStream",
      },
      hooks: [hook],
      serverInfo: {
        name: "test-passthrough-server",
        version: "1.0.0",
      },
    });
  }

  // Step C: Create MCP client
  async function createMCPClient(serverUrl: string) {
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await client.connect(transport);

    return client;
  }

  beforeEach(async () => {
    // Use random ports to avoid conflicts
    targetPort = 40000 + Math.floor(Math.random() * 1000);
    passthroughPort = 41000 + Math.floor(Math.random() * 1000);

    // Create recording hook
    recordingHook = new RecordingHook();

    // Set up the full pipeline
    targetServer = await createTargetServer(targetPort);
    proxy = await createPassthroughServer(
      passthroughPort,
      `http://localhost:${targetPort}/mcp`,
      recordingHook,
    );
  });

  afterEach(async () => {
    // Clean up servers
    if (proxy) {
      await proxy.stop();
    }
    if (targetServer) {
      await targetServer.stop();
    }
  });

  it("should record tool calls through the passthrough server", async () => {
    // Wait a bit for servers to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step C: Create MCP client pointing to passthrough server
    const client = await createMCPClient(
      `http://localhost:${passthroughPort}/mcp`,
    );

    // Verify we can list tools
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("echo");

    // Step D: Make a call to the echo tool
    const result = await client.callTool({
      name: "echo",
      arguments: {
        message: "Hello, World!",
      },
    });

    // Step E: Check the hook recorded the call
    expect(recordingHook.requests).toHaveLength(1);
    expect(recordingHook.requests[0]).toEqual({
      name: "echo",
      arguments: { message: "Hello, World!" },
    });

    expect(recordingHook.responses).toHaveLength(1);
    expect(recordingHook.responses[0].toolName).toBe("echo");
    expect(recordingHook.responses[0].response).toHaveProperty("content");

    // Verify the actual response
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Echo: Hello, World!",
    });

    // Clean up client
    await client.close();
  });

  it("should handle multiple sequential calls", async () => {
    const client = await createMCPClient(
      `http://localhost:${passthroughPort}/mcp`,
    );

    // Make multiple calls
    await client.callTool({
      name: "echo",
      arguments: { message: "First" },
    });

    await client.callTool({
      name: "echo",
      arguments: { message: "Second" },
    });

    await client.callTool({
      name: "echo",
      arguments: { message: "Third" },
    });

    // Check all calls were recorded
    expect(recordingHook.requests).toHaveLength(3);
    expect(recordingHook.responses).toHaveLength(3);

    expect(recordingHook.requests.map((r) => r.arguments)).toEqual([
      { message: "First" },
      { message: "Second" },
      { message: "Third" },
    ]);

    await client.close();
  });
});
