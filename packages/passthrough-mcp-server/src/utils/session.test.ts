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
      const mockClient = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };

      const session = await getOrCreateSession("test-session", mockClient);

      expect(session).toBeDefined();
      expect(session.id).toBe("test-session");
      expect(session.targetClient).toBe(mockClient);
      expect(session.requestCount).toBe(0);
    });

    it("should return existing session", async () => {
      const mockClient = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };

      const session1 = await getOrCreateSession("test-session", mockClient);
      session1.requestCount = 5;

      const session2 = await getOrCreateSession("test-session", mockClient);

      expect(session2).toBe(session1);
      expect(session2.requestCount).toBe(5);
    });

    it("should handle multiple sessions", async () => {
      const mockClient1 = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
        id: "client1",
      };
      const mockClient2 = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
        id: "client2",
      };

      const session1 = await getOrCreateSession("session-1", mockClient1);
      const session2 = await getOrCreateSession("session-2", mockClient2);

      expect(session1.id).toBe("session-1");
      expect(session2.id).toBe("session-2");
      expect(session1.targetClient).toBe(mockClient1);
      expect(session2.targetClient).toBe(mockClient2);
      expect(getSessionCount()).toBe(2);
    });
  });

  describe("clearSession", () => {
    it("should clear specific session", async () => {
      const mockClient1 = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };
      const mockClient2 = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };

      const session1 = await getOrCreateSession("test-session", mockClient1);
      session1.requestCount = 10;

      clearSession("test-session");

      const session2 = await getOrCreateSession("test-session", mockClient2);
      expect(session2).not.toBe(session1);
      expect(session2.requestCount).toBe(0);
    });

    it("should not affect other sessions", async () => {
      const mockClient = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };

      await getOrCreateSession("session-1", mockClient);
      await getOrCreateSession("session-2", mockClient);

      clearSession("session-1");

      expect(getSessionCount()).toBe(1);
    });
  });

  describe("clearAllSessions", () => {
    it("should clear all sessions", async () => {
      const mockClient = {
        listTools: vi.fn(),
        callTool: vi.fn(),
        close: vi.fn(),
      };

      await getOrCreateSession("session-1", mockClient);
      await getOrCreateSession("session-2", mockClient);
      await getOrCreateSession("session-3", mockClient);

      expect(getSessionCount()).toBe(3);

      clearAllSessions();

      expect(getSessionCount()).toBe(0);
    });
  });
});
