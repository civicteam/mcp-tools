import type { HookResponse, ToolCall } from "@civicteam/hook-common/types";
import { describe, expect, it, vi } from "vitest";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "./processor.js";

describe("Hook Processor", () => {
  describe("processRequestThroughHooks", () => {
    it("should process request through empty hook chain", async () => {
      const toolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "https://example.com" },
      };

      const result = await processRequestThroughHooks(toolCall, []);

      expect(result.toolCall).toEqual(toolCall);
      expect(result.wasRejected).toBe(false);
      expect(result.lastProcessedIndex).toBe(-1);
    });

    it("should process request through single approving hook", async () => {
      const toolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "https://example.com" },
      };

      const mockHook = {
        name: "test-hook",
        processRequest: vi.fn().mockResolvedValue({
          response: "continue",
          body: toolCall,
        } as HookResponse),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.wasRejected).toBe(false);
      expect(result.toolCall).toEqual(toolCall);
      expect(result.lastProcessedIndex).toBe(0);
      expect(mockHook.processRequest).toHaveBeenCalledWith(toolCall);
    });

    it("should handle hook rejection", async () => {
      const toolCall: ToolCall = {
        name: "delete",
        arguments: { path: "/important" },
      };

      const mockHook = {
        name: "security-hook",
        processRequest: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Operation blocked",
          reason: "Destructive operation",
        } as HookResponse),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.wasRejected).toBe(true);
      expect(result.rejectionResponse).toBe("Operation blocked");
      expect(result.lastProcessedIndex).toBe(0);
    });

    it("should stop processing on first rejection", async () => {
      const toolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "https://example.com" },
      };

      const hook1 = {
        name: "hook1",
        processRequest: vi.fn().mockResolvedValue({
          response: "continue",
          body: toolCall,
        } as HookResponse),
        processResponse: vi.fn(),
      };

      const hook2 = {
        name: "hook2",
        processRequest: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Blocked by hook2",
        } as HookResponse),
        processResponse: vi.fn(),
      };

      const hook3 = {
        name: "hook3",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(toolCall, [
        hook1,
        hook2,
        hook3,
      ] as Parameters<typeof processRequestThroughHooks>[1]);

      expect(result.wasRejected).toBe(true);
      expect(result.lastProcessedIndex).toBe(1);
      expect(hook1.processRequest).toHaveBeenCalled();
      expect(hook2.processRequest).toHaveBeenCalled();
      expect(hook3.processRequest).not.toHaveBeenCalled();
    });

    it("should allow hooks to modify tool call", async () => {
      const originalToolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "http://example.com" },
      };

      const modifiedToolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "https://example.com" }, // Changed to HTTPS
      };

      const mockHook = {
        name: "modifier-hook",
        processRequest: vi.fn().mockResolvedValue({
          response: "continue",
          body: modifiedToolCall,
        } as HookResponse),
        processResponse: vi.fn(),
      };

      const result = await processRequestThroughHooks(originalToolCall, [
        mockHook as Parameters<typeof processRequestThroughHooks>[1][0],
      ]);

      expect(result.toolCall).toEqual(modifiedToolCall);
      expect(result.toolCall.arguments.url).toBe("https://example.com");
    });
  });

  describe("processResponseThroughHooks", () => {
    it("should process response through hooks in reverse order", async () => {
      const response = { content: "test response" };
      const toolCall: ToolCall = { name: "fetch", arguments: {} };
      const callOrder: string[] = [];

      const hooks = [
        {
          name: "hook1",
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook1");
            return { response: "continue", body: response };
          }),
        },
        {
          name: "hook2",
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook2");
            return { response: "continue", body: response };
          }),
        },
        {
          name: "hook3",
          processRequest: vi.fn(),
          processResponse: vi.fn().mockImplementation(async () => {
            callOrder.push("hook3");
            return { response: "continue", body: response };
          }),
        },
      ];

      await processResponseThroughHooks(
        response,
        toolCall,
        hooks as Parameters<typeof processResponseThroughHooks>[2],
        2,
      );

      expect(callOrder).toEqual(["hook3", "hook2", "hook1"]);
    });

    it("should handle response rejection", async () => {
      const response = { content: "sensitive data" };
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const mockHook = {
        name: "filter-hook",
        processRequest: vi.fn(),
        processResponse: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Response filtered",
          reason: "Sensitive content",
        } as HookResponse),
      };

      const result = await processResponseThroughHooks(
        response,
        toolCall,
        [mockHook] as Parameters<typeof processResponseThroughHooks>[2],
        0,
      );

      expect(result).toBe("Response filtered");
    });

    it("should allow hooks to modify response", async () => {
      const originalResponse = { content: "original" };
      const modifiedResponse = { content: "modified" };
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const mockHook = {
        name: "modifier-hook",
        processRequest: vi.fn(),
        processResponse: vi.fn().mockResolvedValue({
          response: "continue",
          body: modifiedResponse,
        } as HookResponse),
      };

      const result = await processResponseThroughHooks(
        originalResponse,
        toolCall,
        [mockHook] as Parameters<typeof processResponseThroughHooks>[2],
        0,
      );

      expect(result).toEqual(modifiedResponse);
    });
  });
});
