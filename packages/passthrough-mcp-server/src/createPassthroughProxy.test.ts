/**
 * Tests for createPassthroughProxy function
 */

import type { FastMCP } from "fastmcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPassthroughProxy } from "./createPassthroughProxy.js";
import type { PassthroughClient } from "./types/client.js";
import type { Config } from "./utils/config.js";

// Mock the dependencies
vi.mock("./server/server.js", () => ({
  createServer: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    name: "test-server",
  })),
  discoverAndRegisterTools: vi.fn(),
}));

vi.mock("./server/transport.js", () => ({
  getServerTransportConfig: vi.fn(() => ({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/stream",
      port: 34000,
    },
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should create and auto-start the proxy by default", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    const proxy = await createPassthroughProxy({
      ...mockConfig,
    });

    expect(createServer).toHaveBeenCalledWith(mockConfig.serverInfo);
    expect(mockServer.start).toHaveBeenCalled();
    expect(proxy.server).toBe(mockServer);
  });

  it("should not auto-start when autoStart is false", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    const proxy = await createPassthroughProxy({
      ...mockConfig,
      autoStart: false,
    });

    expect(createServer).toHaveBeenCalled();
    expect(mockServer.start).not.toHaveBeenCalled();
  });

  it("should allow manual start after creation", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    const proxy = await createPassthroughProxy({
      ...mockConfig,
      autoStart: false,
    });

    expect(mockServer.start).not.toHaveBeenCalled();

    await proxy.start();
    expect(mockServer.start).toHaveBeenCalledTimes(1);

    // Calling start again should not start twice
    await proxy.start();
    expect(mockServer.start).toHaveBeenCalledTimes(1);
  });

  it("should handle stop correctly", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    const proxy = await createPassthroughProxy({
      ...mockConfig,
    });

    await proxy.stop();
    expect(mockServer.stop).toHaveBeenCalledTimes(1);

    // Calling stop again should not stop twice
    await proxy.stop();
    expect(mockServer.stop).toHaveBeenCalledTimes(1);
  });

  it("should use custom client factory when provided", async () => {
    const { createServer, discoverAndRegisterTools } = await import(
      "./server/server.js"
    );
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    const mockClientFactory = vi.fn(
      async (): Promise<PassthroughClient> => ({
        listTools: vi.fn(),
        callTool: vi.fn(),
      }),
    );

    await createPassthroughProxy({
      ...mockConfig,
      clientFactory: mockClientFactory,
    });

    expect(discoverAndRegisterTools).toHaveBeenCalledWith(
      expect.any(Object),
      mockConfig,
      mockClientFactory,
    );
  });

  it("should handle hooks configuration", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

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

  it("should log appropriate messages for different transport types", async () => {
    const { createServer } = await import("./server/server.js");
    const { logger } = await import("./utils/logger.js");
    const mockServer = {
      start: vi.fn(),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    // Test stdio transport
    const stdioConfig: Config = {
      transportType: "stdio",
      target: {
        url: "http://localhost:33000",
        type: "stream",
      },
    };

    await createPassthroughProxy({
      ...stdioConfig,
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("stdio transport"),
    );
  });

  it("should handle errors during startup", async () => {
    const { createServer } = await import("./server/server.js");
    const mockServer = {
      start: vi.fn().mockRejectedValue(new Error("Start failed")),
      stop: vi.fn(),
      name: "test-server",
    };
    (createServer as any).mockReturnValue(mockServer);

    await expect(
      createPassthroughProxy({
        config: mockConfig,
      }),
    ).rejects.toThrow("Start failed");
  });
});
