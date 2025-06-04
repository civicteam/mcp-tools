import { AbstractHook, type HookResponse, type ToolCall } from "@civic/hook-common";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPassthroughProxy } from "../createPassthroughProxy.js";
import type { PassthroughClient } from "../types/client.js";

// Mock the client module
vi.mock("../client/client.js", () => ({
  createTargetClient: vi.fn(),
}));

// Track registered tools
let registeredTools: any[] = [];

// Mock the server module
vi.mock("../server/server.js", () => ({
  createServer: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    addTool: vi.fn((tool) => {
      registeredTools.push(tool);
    }),
  })),
  discoverAndRegisterTools: vi.fn(),
  getDiscoveredTools: vi.fn(() => [
    {
      name: "fetch",
      description: "Fetch data from URL",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
      },
    },
    {
      name: "dangerousDelete",
      description: "Delete something",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  ]),
}));

// Create a hook that logs to an array for testing
class ArrayLoggingHook extends AbstractHook {
  public logs: string[] = [];

  get name(): string {
    return "ArrayLoggingHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    this.logs.push(`[REQUEST] ${toolCall.name}: ${JSON.stringify(toolCall.arguments)}`);
    return {
      response: "continue",
      body: toolCall,
    };
  }

  async processResponse(response: unknown, originalToolCall: ToolCall): Promise<HookResponse> {
    this.logs.push(`[RESPONSE] ${originalToolCall.name}: ${JSON.stringify(response)}`);
    return {
      response: "continue",
      body: response,
    };
  }
}

// Create a validation hook that blocks certain operations
class TestValidationHook extends AbstractHook {
  public blockedCalls: string[] = [];

  get name(): string {
    return "TestValidationHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    if (toolCall.name.toLowerCase().includes("dangerous")) {
      this.blockedCalls.push(toolCall.name);
      return {
        response: "abort",
        body: null,
        reason: "Dangerous operation blocked",
      };
    }
    
    return {
      response: "continue",
      body: toolCall,
    };
  }
}

describe("Programmatic Hooks Integration", () => {
  let mockTargetClient: PassthroughClient;
  let loggingHook: ArrayLoggingHook;
  let validationHook: TestValidationHook;

  beforeEach(async () => {
    vi.clearAllMocks();
    registeredTools = []; // Clear registered tools

    // Create fresh hook instances
    loggingHook = new ArrayLoggingHook();
    validationHook = new TestValidationHook();

    // Mock target client
    mockTargetClient = {
      listTools: vi.fn().mockResolvedValue({
        tools: [
          {
            name: "fetch",
            description: "Fetch data from URL",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string" },
              },
              required: ["url"],
            },
          },
          {
            name: "dangerousDelete",
            description: "Delete something",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string" },
              },
              required: ["id"],
            },
          },
        ],
      } as ListToolsResult),
      callTool: vi.fn().mockImplementation(async ({ name, arguments: args }) => {
        if (name === "fetch") {
          return {
            content: [
              {
                type: "text",
                text: `Fetched from ${args.url}`,
              },
            ],
          };
        }
        return { content: [{ type: "text", text: "Unknown tool" }] };
      }),
    };

    // Mock createTargetClient
    const { createTargetClient } = vi.mocked(await import("../client/client.js"));
    createTargetClient.mockResolvedValue(mockTargetClient);
  });

  it("should process requests and responses through programmatic hooks", async () => {
    const proxy = await createPassthroughProxy({
      transportType: "httpStream",
      port: 0, // Use any available port for testing
      target: {
        url: "http://localhost:33000",
        type: "stream",
      },
      hooks: [loggingHook, validationHook],
      autoStart: false,
    });

    // Get the registered tool handler
    const tools = proxy.server.tools;
    expect(tools).toHaveLength(2);

    // Find the fetch tool
    const fetchTool = tools.find(t => t.name === "fetch");
    expect(fetchTool).toBeDefined();

    // Call the fetch tool
    const result = await fetchTool!.handler({
      url: "https://example.com",
    });

    // Check that the logging hook captured the request and response
    expect(loggingHook.logs).toHaveLength(2);
    expect(loggingHook.logs[0]).toBe('[REQUEST] fetch: {"url":"https://example.com"}');
    expect(loggingHook.logs[1]).toContain('[RESPONSE] fetch:');
    expect(loggingHook.logs[1]).toContain('Fetched from https://example.com');

    // Verify the result
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Fetched from https://example.com",
        },
      ],
    });
  });

  it("should block dangerous operations with validation hook", async () => {
    const proxy = await createPassthroughProxy({
      transportType: "httpStream",
      port: 0,
      target: {
        url: "http://localhost:33000",
        type: "stream",
      },
      hooks: [loggingHook, validationHook],
      autoStart: false,
    });

    // Get the registered tool handler
    const tools = proxy.server.tools;
    const dangerousTool = tools.find(t => t.name === "dangerousDelete");
    expect(dangerousTool).toBeDefined();

    // Try to call the dangerous tool
    const result = await dangerousTool!.handler({
      id: "123",
    });

    // Check that the validation hook blocked the call
    expect(validationHook.blockedCalls).toContain("dangerousDelete");

    // Check that logging hook only logged the request (not the response)
    expect(loggingHook.logs).toHaveLength(1);
    expect(loggingHook.logs[0]).toBe('[REQUEST] dangerousDelete: {"id":"123"}');

    // Verify the error result
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Dangerous operation blocked",
        },
      ],
      isError: true,
    });

    // Verify the target client was never called
    expect(mockTargetClient.callTool).not.toHaveBeenCalled();
  });

  it("should support mixing programmatic and remote hooks", async () => {
    // Mock a remote hook client
    const mockRemoteHook = {
      name: "remote-audit",
      processRequest: vi.fn().mockResolvedValue({
        response: "continue",
        body: expect.any(Object),
      }),
      processResponse: vi.fn().mockResolvedValue({
        response: "continue", 
        body: expect.any(Object),
      }),
    };

    // Mock the RemoteHookClient constructor
    vi.doMock("@civic/hook-common", async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        RemoteHookClient: vi.fn().mockImplementation(() => mockRemoteHook),
      };
    });

    const proxy = await createPassthroughProxy({
      transportType: "httpStream",
      port: 0,
      target: {
        url: "http://localhost:33000",
        type: "stream",
      },
      hooks: [
        loggingHook,
        {
          url: "http://localhost:8080/trpc",
          name: "remote-audit",
        },
        validationHook,
      ],
      autoStart: false,
    });

    // Get the fetch tool
    const tools = proxy.server.tools;
    const fetchTool = tools.find(t => t.name === "fetch");

    // Call the fetch tool
    await fetchTool!.handler({ url: "https://example.com" });

    // Check that all hooks were called in order
    expect(loggingHook.logs).toHaveLength(2);
    expect(mockRemoteHook.processRequest).toHaveBeenCalled();
    expect(mockRemoteHook.processResponse).toHaveBeenCalled();

    // Reset mocks
    vi.doUnmock("@civic/hook-common");
  });

  it("should handle hook processing order correctly", async () => {
    // Create a hook that modifies requests
    class ModifyingHook extends AbstractHook {
      get name(): string {
        return "ModifyingHook";
      }

      async processRequest(toolCall: ToolCall): Promise<HookResponse> {
        return {
          response: "continue",
          body: {
            ...toolCall,
            arguments: {
              ...toolCall.arguments,
              modified: true,
            },
          },
        };
      }
    }

    const modifyingHook = new ModifyingHook();

    const proxy = await createPassthroughProxy({
      transportType: "httpStream",
      port: 0,
      target: {
        url: "http://localhost:33000",
        type: "stream",
      },
      hooks: [loggingHook, modifyingHook],
      autoStart: false,
    });

    // Get the fetch tool
    const tools = proxy.server.tools;
    const fetchTool = tools.find(t => t.name === "fetch");

    // Call the fetch tool
    await fetchTool!.handler({ url: "https://example.com" });

    // Check that the logging hook saw the modified request
    expect(loggingHook.logs[0]).toContain('"modified":true');

    // Verify the modified arguments were passed to the target client
    expect(mockTargetClient.callTool).toHaveBeenCalledWith({
      name: "fetch",
      arguments: {
        url: "https://example.com",
        modified: true,
      },
    });
  });
});