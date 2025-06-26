/**
 * Tests for createPassthroughProxy function
 */

import type { Server as HTTPServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPassthroughProxy } from "./createPassthroughProxy.js";
import type { Config } from "./utils/config.js";

// Create mocks that we can manipulate
const mockHttpServer = {
  listen: vi.fn((port: number, callback: () => void) => callback()),
  close: vi.fn((callback?: () => void) => callback?.()),
  on: vi.fn(),
  off: vi.fn(),
};

const mockMcpServer = {
  connect: vi.fn(),
  close: vi.fn(),
};

const mockStdioTransport = {
  start: vi.fn(),
  close: vi.fn(),
};

const mockMCPHandler = vi.fn();

// Mock the dependencies
vi.mock("./server/mcpHandler.js", () => ({
  createMCPHandler: vi.fn(() => mockMCPHandler),
}));

vi.mock("./server/authProxy.js", () => ({
  createAuthProxyServer: vi.fn(() => mockHttpServer),
}));

vi.mock("./server/stdioHandler.js", () => ({
  createStdioServer: vi.fn(() => Promise.resolve({
    server: mockMcpServer,
    transport: mockStdioTransport,
  })),
}));

vi.mock("./utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./utils/session.js", () => ({
  clearAllSessions: vi.fn(),
  setSessionClientFactory: vi.fn(),
}));

describe("createPassthroughProxy", () => {
  const mockConfig: Config = {
    transportType: "httpStream",
    port: 34000,
    target: {
      url: "http://localhost:33000",
      transportType: "httpStream",
    },
    serverInfo: {
      name: "test-passthrough",
      version: "1.0.0",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockHttpServer.listen.mockClear();
    mockHttpServer.close.mockClear();
    mockHttpServer.on.mockClear();
    mockHttpServer.off.mockClear();

    mockMcpServer.connect.mockClear();
    mockMcpServer.close.mockClear();
    mockStdioTransport.start.mockClear();
    mockStdioTransport.close.mockClear();

    mockMCPHandler.mockClear();

    // Reset implementations to default behavior
    mockHttpServer.listen.mockImplementation(
      (port: number, callback: () => void) => callback(),
    );
    mockHttpServer.close.mockImplementation((callback?: () => void) =>
      callback?.(),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create and auto-start the proxy by default for httpStream", async () => {
    const { createMCPHandler } = await import("./server/mcpHandler.js");
    const { createAuthProxyServer } = await import("./server/authProxy.js");
    const { logger } = await import("./utils/logger.js");

    const proxy = await createPassthroughProxy({
      ...mockConfig,
    });

    expect(createMCPHandler).toHaveBeenCalledWith({
      config: mockConfig,
      sessionIdGenerator: expect.any(Function),
    });
    expect(createAuthProxyServer).toHaveBeenCalledWith(
      {
        targetUrl: mockConfig.target.url,
        mcpEndpoint: "/mcp",
      },
      mockMCPHandler,
    );
    expect(mockHttpServer.listen).toHaveBeenCalledWith(
      34000,
      expect.any(Function),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("httpStream transport on port 34000"),
    );
    expect(proxy.server).toBe(mockHttpServer);
  });

  it("should not auto-start when autoStart is false", async () => {
    const proxy = await createPassthroughProxy({
      ...mockConfig,
      autoStart: false,
    });

    expect(mockHttpServer.listen).not.toHaveBeenCalled();
  });

  it("should allow manual start after creation", async () => {
    const { logger } = await import("./utils/logger.js");

    const proxy = await createPassthroughProxy({
      ...mockConfig,
      autoStart: false,
    });

    expect(mockHttpServer.listen).not.toHaveBeenCalled();

    await proxy.start();
    expect(mockHttpServer.listen).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("httpStream transport on port 34000"),
    );

    // Calling start again should log a warning
    vi.clearAllMocks();
    await proxy.start();
    expect(mockHttpServer.listen).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Server is already started");
  });

  it("should handle stop correctly", async () => {
    const { clearAllSessions } = await import("./utils/session.js");
    const { logger } = await import("./utils/logger.js");

    const proxy = await createPassthroughProxy({
      ...mockConfig,
    });

    await proxy.stop();
    expect(clearAllSessions).toHaveBeenCalledTimes(1);
    expect(mockHttpServer.close).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("Passthrough MCP Server stopped");

    // Calling stop again should log a warning
    vi.clearAllMocks();
    await proxy.stop();
    expect(mockHttpServer.close).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Server is not started");
  });

  it("should use custom client factory when provided", async () => {
    const { setSessionClientFactory } = await import("./utils/session.js");
    const mockClientFactory = vi.fn();

    await createPassthroughProxy({
      ...mockConfig,
      clientFactory: mockClientFactory,
    });

    expect(setSessionClientFactory).toHaveBeenCalledWith(mockClientFactory);
  });

  it("should handle hooks configuration", async () => {
    const configWithHooks: Config = {
      ...mockConfig,
      hooks: [
        { url: "http://localhost:8080/trpc", name: "hook1" },
        { url: "http://localhost:8081/trpc", name: "hook2" },
      ],
    };

    const proxy = await createPassthroughProxy({
      ...configWithHooks,
    });

    expect(proxy.server).toBeDefined();
  });

  it("should use MCP SDK for stdio transport", async () => {
    const { createStdioServer } = await import("./server/stdioHandler.js");
    const { logger } = await import("./utils/logger.js");

    const stdioConfig: Config = {
      transportType: "stdio",
      target: {
        url: "http://localhost:33000",
        transportType: "httpStream",
      },
    };

    const proxy = await createPassthroughProxy({
      ...stdioConfig,
    });

    expect(createStdioServer).toHaveBeenCalledWith(stdioConfig);
    expect(mockMcpServer.connect).toHaveBeenCalledWith(mockStdioTransport);
    expect(mockStdioTransport.start).toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("stdio transport"),
    );

    expect(proxy.server).toBe(mockMcpServer);
  });

  it("should handle errors during HTTP server startup", async () => {
    // Mock the listen method to simulate an error
    mockHttpServer.listen.mockImplementationOnce(
      (port: number, callback: () => void) => {
        // Find and call the error handler
        const errorCall = mockHttpServer.on.mock.calls.find(
          (call: any[]) => call[0] === "error",
        );
        if (errorCall) {
          const errorHandler = errorCall[1];
          errorHandler(new Error("EADDRINUSE"));
        }
      },
    );

    await expect(
      createPassthroughProxy({
        ...mockConfig,
      }),
    ).rejects.toThrow("EADDRINUSE");
  });

  it("should reject SSE transport as unsupported", async () => {
    const sseConfig: Config = {
      ...mockConfig,
      transportType: "sse",
    };

    await expect(
      createPassthroughProxy({
        ...sseConfig,
      }),
    ).rejects.toThrow(
      "Transport type sse is not supported for HTTP. Only httpStream and stdio are supported.",
    );
  });
});
