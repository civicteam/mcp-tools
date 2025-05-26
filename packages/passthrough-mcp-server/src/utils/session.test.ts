import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllSessions,
  clearSession,
  generateSessionId,
  getOrCreateSession,
  getSessionCount,
} from "./session.js";

describe("Session Management", () => {
  beforeEach(() => {
    clearAllSessions();
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
      const createClient = vi.fn().mockResolvedValue(mockClient);

      const session = await getOrCreateSession("test-session", createClient);

      expect(session).toBeDefined();
      expect(session.id).toBe("test-session");
      expect(session.targetClient).toBe(mockClient);
      expect(session.requestCount).toBe(0);
      expect(createClient).toHaveBeenCalledTimes(1);
    });

    it("should return existing session", async () => {
      const mockClient = { close: vi.fn() };
      const createClient = vi.fn().mockResolvedValue(mockClient);

      const session1 = await getOrCreateSession("test-session", createClient);
      session1.requestCount = 5;

      const session2 = await getOrCreateSession("test-session", createClient);

      expect(session2).toBe(session1);
      expect(session2.requestCount).toBe(5);
      expect(createClient).toHaveBeenCalledTimes(1); // Only called once
    });

    it("should handle multiple sessions", async () => {
      const mockClient1 = { close: vi.fn(), id: "client1" };
      const mockClient2 = { close: vi.fn(), id: "client2" };

      const createClient1 = vi.fn().mockResolvedValue(mockClient1);
      const createClient2 = vi.fn().mockResolvedValue(mockClient2);

      const session1 = await getOrCreateSession("session-1", createClient1);
      const session2 = await getOrCreateSession("session-2", createClient2);

      expect(session1.id).toBe("session-1");
      expect(session2.id).toBe("session-2");
      expect(session1.targetClient).toBe(mockClient1);
      expect(session2.targetClient).toBe(mockClient2);
      expect(getSessionCount()).toBe(2);
    });
  });

  describe("clearSession", () => {
    it("should clear specific session", async () => {
      const mockClient = { close: vi.fn() };
      const createClient = vi.fn().mockResolvedValue(mockClient);

      const session1 = await getOrCreateSession("test-session", createClient);
      session1.requestCount = 10;

      clearSession("test-session");

      const session2 = await getOrCreateSession("test-session", createClient);
      expect(session2).not.toBe(session1);
      expect(session2.requestCount).toBe(0);
      expect(createClient).toHaveBeenCalledTimes(2);
    });

    it("should not affect other sessions", async () => {
      const mockClient = { close: vi.fn() };
      const createClient = vi.fn().mockResolvedValue(mockClient);

      await getOrCreateSession("session-1", createClient);
      await getOrCreateSession("session-2", createClient);

      clearSession("session-1");

      expect(getSessionCount()).toBe(1);
    });
  });

  describe("clearAllSessions", () => {
    it("should clear all sessions", async () => {
      const mockClient = { close: vi.fn() };
      const createClient = vi.fn().mockResolvedValue(mockClient);

      await getOrCreateSession("session-1", createClient);
      await getOrCreateSession("session-2", createClient);
      await getOrCreateSession("session-3", createClient);

      expect(getSessionCount()).toBe(3);

      clearAllSessions();

      expect(getSessionCount()).toBe(0);
    });
  });
});
