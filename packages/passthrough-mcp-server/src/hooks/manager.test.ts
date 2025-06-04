import type { Hook } from "@civic/hook-common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../utils/config.js";
import { clearHookClientsCache, getHookClients } from "./manager.js";

// Mock the hook-common module
vi.mock("@civic/hook-common", () => ({
  RemoteHookClient: vi.fn().mockImplementation((config) => ({
    name: config.name,
    processRequest: vi.fn(),
    processResponse: vi.fn(),
  })),
  LocalHookClient: vi.fn().mockImplementation((hook) => ({
    name: hook.name,
    processRequest: vi.fn(),
    processResponse: vi.fn(),
  })),
}));

describe("Hook Manager", () => {
  beforeEach(() => {
    clearHookClientsCache();
    vi.clearAllMocks();
  });

  describe("getHookClients", () => {
    it("should return empty array when no hooks configured", () => {
      const config: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [],
      };

      const clients = getHookClients(config);
      expect(clients).toEqual([]);
    });

    it("should create remote hook clients for URL-based hooks", () => {
      const config: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [
          { url: "http://localhost:3001", name: "audit-hook" },
          { url: "http://localhost:3002" },
        ],
      };

      const clients = getHookClients(config);

      expect(clients).toHaveLength(2);
      expect(clients[0].name).toBe("audit-hook");
      expect(clients[1].name).toBe("http://localhost:3002");
    });

    it("should create local hook clients for Hook instances", () => {
      const mockHook1: Hook = {
        name: "TestHook1",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const mockHook2: Hook = {
        name: "TestHook2",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const config: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [mockHook1, mockHook2],
      };

      const clients = getHookClients(config);

      expect(clients).toHaveLength(2);
      expect(clients[0].name).toBe("TestHook1");
      expect(clients[1].name).toBe("TestHook2");
    });

    it("should support mixing remote and local hooks", () => {
      const mockHook: Hook = {
        name: "LocalTestHook",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const config: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [
          { url: "http://localhost:3001", name: "remote-hook" },
          mockHook,
          { url: "http://localhost:3002", name: "another-remote" },
        ],
      };

      const clients = getHookClients(config);

      expect(clients).toHaveLength(3);
      expect(clients[0].name).toBe("remote-hook");
      expect(clients[1].name).toBe("LocalTestHook");
      expect(clients[2].name).toBe("another-remote");
    });

    it("should cache hook clients for same configuration", () => {
      const config: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [{ url: "http://localhost:3001" }],
      };

      const clients1 = getHookClients(config);
      const clients2 = getHookClients(config);

      expect(clients1).toBe(clients2); // Same reference
    });

    it("should create new clients for different configuration", () => {
      const config1: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [{ url: "http://localhost:3001" }],
      };

      const config2: Config = {
        server: { port: 34000, transportType: "httpStream" },
        client: { type: "stream", url: "http://localhost:3000" },
        hooks: [{ url: "http://localhost:3002" }],
      };

      const clients1 = getHookClients(config1);
      const clients2 = getHookClients(config2);

      expect(clients1).not.toBe(clients2);
      expect(clients1[0].name).toBe("http://localhost:3001");
      expect(clients2[0].name).toBe("http://localhost:3002");
    });
  });
});
