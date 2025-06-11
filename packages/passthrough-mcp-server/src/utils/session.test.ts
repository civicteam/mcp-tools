import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientFactory } from "../types/client.js";
import type { Config } from "./config.js";
import {
  clearAllSessions,
  clearSession,
  generateSessionId,
  getOrCreateSession,
  getSessionCount,
  setSessionClientFactory,
} from "./session.js";

function createMockConfig(): Config {
  return {
    transportType: "stdio",
    target: { transportType: "httpStream", url: "http://localhost:3000" },
    clientInfo: { name: "test", version: "1.0.0" },
  };
}

describe("Session Management", () => {
  beforeEach(async () => {
    await clearAllSessions();
  });

  describe("generateSessionId", () => {
    it("should generate unique session IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it("should generate IDs with correct format", () => {
      const id = generateSessionId();
      expect(id).toMatch(/^session-[a-z0-9]+$/);
    });
  });

  describe("getOrCreateSession", () => {
    it("should create new session if not exists", async () => {
      const mockClient = { close: vi.fn() };
      const mockClientFactory: ClientFactory = vi
        .fn()
        .mockResolvedValue(mockClient);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      const session = await getOrCreateSession("test-session", mockConfig);

      expect(session).toBeDefined();
      expect(session.id).toBe("test-session");
      expect(session.targetClient).toBe(mockClient);
      expect(session.requestCount).toBe(0);
      expect(mockClientFactory).toHaveBeenCalledTimes(1);
      expect(mockClientFactory).toHaveBeenCalledWith(
        mockConfig.target,
        "test-session",
        mockConfig.clientInfo,
      );
    });

    it("should return existing session", async () => {
      const mockClient = { close: vi.fn() };
      const mockClientFactory: ClientFactory = vi
        .fn()
        .mockResolvedValue(mockClient);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      const session1 = await getOrCreateSession("test-session", mockConfig);
      session1.requestCount = 5;

      const session2 = await getOrCreateSession("test-session", mockConfig);

      expect(session2).toBe(session1);
      expect(session2.requestCount).toBe(5);
      expect(mockClientFactory).toHaveBeenCalledTimes(1); // Only called once
    });

    it("should handle multiple sessions", async () => {
      const mockClient1 = { close: vi.fn(), id: "client1" };
      const mockClient2 = { close: vi.fn(), id: "client2" };

      const mockClientFactory = vi
        .fn()
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      const session1 = await getOrCreateSession("session-1", mockConfig);
      const session2 = await getOrCreateSession("session-2", mockConfig);

      expect(session1.id).toBe("session-1");
      expect(session2.id).toBe("session-2");
      expect(session1.targetClient).toBe(mockClient1);
      expect(session2.targetClient).toBe(mockClient2);
      expect(getSessionCount()).toBe(2);
    });
  });

  describe("clearSession", () => {
    it("should clear specific session", async () => {
      const mockClient1 = { close: vi.fn() };
      const mockClient2 = { close: vi.fn() };
      const mockClientFactory = vi
        .fn()
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      const session1 = await getOrCreateSession("test-session", mockConfig);
      session1.requestCount = 10;

      await clearSession("test-session");

      const session2 = await getOrCreateSession("test-session", mockConfig);
      expect(session2).not.toBe(session1);
      expect(session2.requestCount).toBe(0);
      expect(mockClientFactory).toHaveBeenCalledTimes(2);
      expect(mockClient1.close).toHaveBeenCalledTimes(1);
    });

    it("should not affect other sessions", async () => {
      const mockClient1 = { close: vi.fn() };
      const mockClient2 = { close: vi.fn() };
      const mockClientFactory = vi
        .fn()
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      await getOrCreateSession("session-1", mockConfig);
      await getOrCreateSession("session-2", mockConfig);

      await clearSession("session-1");

      expect(getSessionCount()).toBe(1);
      expect(mockClient1.close).toHaveBeenCalledTimes(1);
      expect(mockClient2.close).not.toHaveBeenCalled();
    });
  });

  describe("clearAllSessions", () => {
    it("should clear all sessions", async () => {
      const mockClient1 = { close: vi.fn() };
      const mockClient2 = { close: vi.fn() };
      const mockClient3 = { close: vi.fn() };
      const mockClientFactory = vi
        .fn()
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2)
        .mockResolvedValueOnce(mockClient3);
      const mockConfig = createMockConfig();

      setSessionClientFactory(mockClientFactory);

      await getOrCreateSession("session-1", mockConfig);
      await getOrCreateSession("session-2", mockConfig);
      await getOrCreateSession("session-3", mockConfig);

      expect(getSessionCount()).toBe(3);

      await clearAllSessions();

      expect(getSessionCount()).toBe(0);
      expect(mockClient1.close).toHaveBeenCalledTimes(1);
      expect(mockClient2.close).toHaveBeenCalledTimes(1);
      expect(mockClient3.close).toHaveBeenCalledTimes(1);
    });
  });
});
