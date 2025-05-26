import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../utils/config.js";
import { clearHookClientsCache, getHookClients } from "./manager.js";

// Mock the hook-common module
vi.mock("@civic/hook-common/client", () => ({
  createHookClients: vi.fn((configs) =>
    configs.map((config: { name: string; url: string }) => ({
      name: config.name,
      url: config.url,
      processRequest: vi.fn(),
      processResponse: vi.fn(),
    })),
  ),
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

    it("should create hook clients for configured hooks", () => {
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
