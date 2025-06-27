import type { HookResponse, ToolCall } from "@civic/hook-common";
import { describe, expect, it, vi } from "vitest";
import {
  processExceptionThroughHooks,
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
      expect(mockHook.processRequest).toHaveBeenCalledWith(toolCall, undefined);
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

      expect(result).toEqual({
        response: { content: "sensitive data" },
        wasRejected: true,
        rejectionResponse: "Response filtered",
        rejectionReason: "Sensitive content",
        lastProcessedIndex: 0,
      });
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

      expect(result).toEqual({
        response: modifiedResponse,
        wasRejected: false,
        rejectionResponse: null,
        lastProcessedIndex: 0,
      });
    });
  });

  describe("processExceptionThroughHooks", () => {
    it("should process exception through empty hook chain", async () => {
      const error = new Error("Test error");
      const toolCall: ToolCall = {
        name: "fetch",
        arguments: { url: "https://example.com" },
      };

      const result = await processExceptionThroughHooks(error, toolCall, []);

      expect(result.wasHandled).toBe(false);
      expect(result.response).toBeNull();
      expect(result.lastProcessedIndex).toBe(-1);
    });

    it("should handle Error instances", async () => {
      const error = new Error(
        "Error POSTing to endpoint (HTTP 400): Bad Request",
      );
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const mockHook = {
        name: "error-handler",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: {
            content: [
              {
                type: "text",
                text: "Handled HTTP 400 error gracefully",
              },
            ],
          },
          reason: "Converted error to user-friendly message",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        mockHook as Parameters<typeof processExceptionThroughHooks>[2][0],
      ]);

      expect(result.wasHandled).toBe(true);
      expect(result.response).toEqual({
        content: [
          {
            type: "text",
            text: "Handled HTTP 400 error gracefully",
          },
        ],
      });
      expect(result.reason).toBe("Converted error to user-friendly message");
      expect(mockHook.processToolException).toHaveBeenCalledWith(
        error,
        toolCall,
        undefined,
      );
    });

    it("should handle specific HTTP error from streamableHttp.ts", async () => {
      const httpError = new Error(
        'Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided or not an initialize request"},"id":null}',
      );
      const toolCall: ToolCall = { name: "call_external_api", arguments: {} };

      const mockHook = {
        name: "http-error-handler",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: {
            content: [
              {
                type: "text",
                text: "Authentication required. Please initialize your session first.",
              },
            ],
          },
          reason: "Handled session initialization error",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(httpError, toolCall, [
        mockHook as Parameters<typeof processExceptionThroughHooks>[2][0],
      ]);

      expect(result.wasHandled).toBe(true);
      expect(result.response.content[0].text).toBe(
        "Authentication required. Please initialize your session first.",
      );
      expect(mockHook.processToolException).toHaveBeenCalledWith(
        httpError,
        toolCall,
        undefined,
      );
    });

    it("should handle non-Error values (unknown type)", async () => {
      const error = "String error message";
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const mockHook = {
        name: "string-error-handler",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: { message: "Handled string error" },
          reason: "Converted string to structured error",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        mockHook as Parameters<typeof processExceptionThroughHooks>[2][0],
      ]);

      expect(result.wasHandled).toBe(true);
      expect(result.response).toEqual({ message: "Handled string error" });
      expect(mockHook.processToolException).toHaveBeenCalledWith(
        error,
        toolCall,
        undefined,
      );
    });

    it("should skip hooks that don't support exception handling", async () => {
      const error = new Error("Test error");
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const hookWithoutExceptionHandling = {
        name: "basic-hook",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
      };

      const hookWithExceptionHandling = {
        name: "exception-hook",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Handled",
          reason: "Exception processed",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        hookWithoutExceptionHandling,
        hookWithExceptionHandling,
      ] as Parameters<typeof processExceptionThroughHooks>[2]);

      expect(result.wasHandled).toBe(true);
      expect(
        hookWithExceptionHandling.processToolException,
      ).toHaveBeenCalledWith(error, toolCall, undefined);
    });

    it("should stop processing when first hook handles exception", async () => {
      const error = new Error("Test error");
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const hook1 = {
        name: "hook1",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Handled by hook1",
          reason: "First handler",
        } as HookResponse),
      };

      const hook2 = {
        name: "hook2",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Should not be called",
          reason: "Second handler",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        hook1,
        hook2,
      ] as Parameters<typeof processExceptionThroughHooks>[2]);

      expect(result.wasHandled).toBe(true);
      expect(result.response).toBe("Handled by hook1");
      expect(result.lastProcessedIndex).toBe(0);
      expect(hook1.processToolException).toHaveBeenCalled();
      expect(hook2.processToolException).not.toHaveBeenCalled();
    });

    it("should continue to next hook if current hook returns continue", async () => {
      const error = new Error("Test error");
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const hook1 = {
        name: "hook1",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "continue",
          body: null,
          reason: "Not my type of error",
        } as HookResponse),
      };

      const hook2 = {
        name: "hook2",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: "Handled by hook2",
          reason: "This is my error type",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        hook1,
        hook2,
      ] as Parameters<typeof processExceptionThroughHooks>[2]);

      expect(result.wasHandled).toBe(true);
      expect(result.response).toBe("Handled by hook2");
      expect(result.lastProcessedIndex).toBe(1);
      expect(hook1.processToolException).toHaveBeenCalled();
      expect(hook2.processToolException).toHaveBeenCalled();
    });

    it("should handle object errors", async () => {
      const error = { code: 500, message: "Internal server error" };
      const toolCall: ToolCall = { name: "fetch", arguments: {} };

      const mockHook = {
        name: "object-error-handler",
        processRequest: vi.fn(),
        processResponse: vi.fn(),
        processToolException: vi.fn().mockResolvedValue({
          response: "abort",
          body: { message: "Handled object error" },
          reason: "Converted object error",
        } as HookResponse),
      };

      const result = await processExceptionThroughHooks(error, toolCall, [
        mockHook as Parameters<typeof processExceptionThroughHooks>[2][0],
      ]);

      expect(result.wasHandled).toBe(true);
      expect(mockHook.processToolException).toHaveBeenCalledWith(
        error,
        toolCall,
        undefined,
      );
    });
  });
});
