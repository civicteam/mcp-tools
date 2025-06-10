/**
 * Tests for hook utility functions
 */

import type { Hook, HookResponse } from "@civic/hook-common";
import { LocalHookClient, RemoteHookClient } from "@civic/hook-common";
import { describe, expect, it, vi } from "vitest";
import { createHookClient, createHookClients } from "./utils.js";

// Mock the RemoteHookClient constructor
vi.mock("@civic/hook-common", async () => {
  const actual = await vi.importActual("@civic/hook-common");
  return {
    ...actual,
    RemoteHookClient: vi.fn().mockImplementation((config) => ({
      name: config.name || config.url,
      processRequest: vi.fn(),
      processResponse: vi.fn(),
    })),
  };
});

// Mock logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

// Helper to create a mock Hook
class MockHook implements Hook {
  constructor(public name: string) {}

  async processRequest(): Promise<HookResponse> {
    return { response: "continue", body: {} };
  }

  async processResponse(): Promise<HookResponse> {
    return { response: "continue", body: {} };
  }
}

describe("createHookClient", () => {
  it("should create LocalHookClient for Hook instance", () => {
    const hook = new MockHook("test-hook");
    const client = createHookClient(hook);

    expect(client).toBeInstanceOf(LocalHookClient);
    expect(client.name).toBe("test-hook");
  });

  it("should create RemoteHookClient for RemoteHookConfig", () => {
    const config = { url: "http://example.com/hook", name: "remote-hook" };
    const client = createHookClient(config);

    expect(RemoteHookClient).toHaveBeenCalledWith({
      url: "http://example.com/hook",
      name: "remote-hook",
    });
    expect(client.name).toBe("remote-hook");
  });

  it("should use URL as name if name not provided", () => {
    const config = { url: "http://example.com/hook" };
    const client = createHookClient(config);

    expect(RemoteHookClient).toHaveBeenCalledWith({
      url: "http://example.com/hook",
      name: "http://example.com/hook",
    });
  });
});

describe("createHookClients", () => {
  it("should create multiple hook clients", () => {
    const hook1 = new MockHook("hook1");
    const hook2Config = { url: "http://example.com/hook2" };
    const hook3 = new MockHook("hook3");

    const clients = createHookClients([hook1, hook2Config, hook3]);

    expect(clients).toHaveLength(3);
    expect(clients[0]).toBeInstanceOf(LocalHookClient);
    expect(clients[0].name).toBe("hook1");
    expect(clients[1].name).toBe("http://example.com/hook2");
    expect(clients[2]).toBeInstanceOf(LocalHookClient);
    expect(clients[2].name).toBe("hook3");
  });

  it("should handle empty array", () => {
    const clients = createHookClients([]);
    expect(clients).toEqual([]);
  });
});
