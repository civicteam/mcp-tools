/**
 * Tests for the simplified hook API
 */

import type { HookClient, HookResponse, ToolCall } from "@civic/hook-common";
import { describe, expect, it, vi } from "vitest";
import { applyHooks } from "./apply.js";

// Mock logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to create a mock hook client
function createMockHookClient(
  name: string,
  requestResponse: HookResponse,
  responseResponse?: HookResponse,
): HookClient {
  return {
    name,
    processRequest: vi.fn().mockResolvedValue(requestResponse),
    processResponse: vi
      .fn()
      .mockResolvedValue(responseResponse || requestResponse),
  };
}

describe("applyHooks", () => {
  const mockToolCall: ToolCall = {
    name: "test-tool",
    arguments: { foo: "bar" },
  };

  describe("request hooks", () => {
    it("should return unmodified data when no hooks are provided", async () => {
      const result = await applyHooks("request", [], mockToolCall);

      expect(result).toEqual({
        data: mockToolCall,
        rejected: false,
      });
    });

    it("should apply a single hook that approves", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "continue",
        body: { ...mockToolCall, modified: true },
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result).toEqual({
        data: { ...mockToolCall, modified: true },
        rejected: false,
      });
      expect(hook.processRequest).toHaveBeenCalledWith(mockToolCall);
    });

    it("should apply multiple hooks in order", async () => {
      const hook1 = createMockHookClient("hook1", {
        response: "continue",
        body: { ...mockToolCall, hook1: true },
      });

      const hook2 = createMockHookClient("hook2", {
        response: "continue",
        body: { ...mockToolCall, hook1: true, hook2: true },
      });

      const result = await applyHooks("request", [hook1, hook2], mockToolCall);

      expect(result).toEqual({
        data: { ...mockToolCall, hook1: true, hook2: true },
        rejected: false,
      });
      expect(hook1.processRequest).toHaveBeenCalledWith(mockToolCall);
      expect(hook2.processRequest).toHaveBeenCalledWith({
        ...mockToolCall,
        hook1: true,
      });
    });

    it("should handle hook rejection", async () => {
      const hook = createMockHookClient("reject-hook", {
        response: "abort",
        body: { error: "Rejected" },
        reason: "Not allowed",
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result).toEqual({
        data: mockToolCall,
        rejected: true,
        rejectionReason: "Not allowed",
      });
    });

    it("should stop processing after first rejection", async () => {
      const hook1 = createMockHookClient("hook1", {
        response: "abort",
        reason: "First hook rejected",
      });

      const hook2 = createMockHookClient("hook2", {
        response: "continue",
        body: mockToolCall,
      });

      const result = await applyHooks("request", [hook1, hook2], mockToolCall);

      expect(result.rejected).toBe(true);
      expect(hook1.processRequest).toHaveBeenCalled();
      expect(hook2.processRequest).not.toHaveBeenCalled();
    });

    it("should handle hook errors gracefully", async () => {
      const hook: HookClient = {
        name: "error-hook",
        processRequest: vi.fn().mockRejectedValue(new Error("Hook failed")),
        processResponse: vi.fn(),
      };

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result).toEqual({
        data: mockToolCall,
        rejected: true,
        rejectionReason: "Hook failed",
      });
    });

    it("should validate tool call has required properties", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "continue",
        body: mockToolCall,
      });

      // Test with null
      let result = await applyHooks("request", [hook], null);
      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain("Invalid tool call");

      // Test with non-object
      result = await applyHooks("request", [hook], "not an object");
      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain("Invalid tool call");

      // Test with object missing name
      result = await applyHooks("request", [hook], { arguments: {} });
      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain("Invalid tool call");

      // Test with valid object
      result = await applyHooks("request", [hook], {
        name: "test",
        arguments: {},
      });
      expect(result.rejected).toBe(false);
    });
  });

  describe("response hooks", () => {
    const mockResponse = { result: "success" };

    it("should require toolCall in context for response hooks", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "continue",
        body: mockResponse,
      });

      const result = await applyHooks("response", [hook], mockResponse);

      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain(
        "Response hooks require toolCall",
      );
    });

    it("should apply response hooks in reverse order", async () => {
      const hook1 = createMockHookClient(
        "hook1",
        { response: "continue", body: mockToolCall },
        { response: "continue", body: { ...mockResponse, hook1: true } },
      );

      const hook2 = createMockHookClient(
        "hook2",
        { response: "continue", body: mockToolCall },
        { response: "continue", body: { ...mockResponse, hook2: true } },
      );

      const result = await applyHooks(
        "response",
        [hook1, hook2],
        mockResponse,
        { toolCall: mockToolCall },
      );

      // Hooks are processed in reverse order for responses
      expect(hook2.processResponse).toHaveBeenCalledWith(
        mockResponse,
        mockToolCall,
      );
      expect(hook1.processResponse).toHaveBeenCalledWith(
        { ...mockResponse, hook2: true },
        mockToolCall,
      );
      expect(result.data).toEqual({ ...mockResponse, hook1: true });
    });

    it("should handle response rejection", async () => {
      const hook = createMockHookClient(
        "filter-hook",
        { response: "continue", body: mockToolCall },
        { response: "abort", reason: "Contains sensitive data" },
      );

      const result = await applyHooks("response", [hook], mockResponse, {
        toolCall: mockToolCall,
      });

      expect(result).toMatchObject({
        rejected: true,
        rejectionReason: "Contains sensitive data",
      });
    });
  });

  describe("rejection reason formatting", () => {
    it("should format string rejection reasons", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "abort",
        body: "Simple rejection",
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result.rejectionReason).toBe("Simple rejection");
    });

    it("should extract reason from rejection object", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "abort",
        body: { reason: "Object with reason" },
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result.rejectionReason).toBe("Object with reason");
    });

    it("should extract message from rejection object", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "abort",
        body: { message: "Object with message" },
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result.rejectionReason).toBe("Object with message");
    });

    it("should stringify other rejection types", async () => {
      const hook = createMockHookClient("test-hook", {
        response: "abort",
        body: { foo: "bar" },
      });

      const result = await applyHooks("request", [hook], mockToolCall);

      expect(result.rejectionReason).toBe('{"foo":"bar"}');
    });
  });
});
