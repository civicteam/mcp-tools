/**
 * Tests for passthrough handler module
 */

import type { ToolCall } from "@civic/hook-common";
import type { Context } from "fastmcp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPassthroughHandler } from "./passthrough.js";
import type { AuthSessionData } from "./server.js";

// Mock dependencies
vi.mock("../hooks/manager.js", () => ({
  getHookClients: vi.fn(() => []),
}));

vi.mock("../hooks/processor.js", () => ({
  processRequestThroughHooks: vi.fn(),
  processResponseThroughHooks: vi.fn(),
  processExceptionThroughHooks: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../utils/session.js", () => ({
  DEFAULT_SESSION_ID: "default",
  getOrCreateSessionForRequest: vi.fn(),
}));

vi.mock("./server.js", () => ({
  getDiscoveredTools: vi.fn(() => [
    {
      name: "fetch",
      description: "Fetch data from URL",
      inputSchema: { type: "object" },
    },
  ]),
}));

describe("createPassthroughHandler", () => {
  const mockConfig = {
    transportType: "httpStream" as const,
    port: 34000,
    target: {
      url: "http://localhost:33000",
      transportType: "httpStream" as const,
    },
  };

  const mockSessionData = {
    targetClient: {
      callTool: vi.fn(),
      listTools: vi.fn(),
      close: vi.fn(),
    },
    requestCount: 1,
  };

  const mockContext: Context<AuthSessionData> = {
    session: { id: "test-session" },
  } as Context<AuthSessionData>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default mocks
    const { getOrCreateSessionForRequest } = vi.mocked(
      await import("../utils/session.js"),
    );
    getOrCreateSessionForRequest.mockResolvedValue(mockSessionData);

    const { processRequestThroughHooks, processResponseThroughHooks } =
      vi.mocked(await import("../hooks/processor.js"));
    processRequestThroughHooks.mockResolvedValue({
      toolCall: {
        name: "fetch",
        arguments: { url: "https://example.com" },
      } as ToolCall,
      wasRejected: false,
      lastProcessedIndex: -1,
    });
    processResponseThroughHooks.mockResolvedValue({
      response: { result: "success" },
      wasRejected: false,
      lastProcessedIndex: -1,
    });
  });

  describe("exception handling", () => {
    it("should handle exceptions through hooks when callTool throws", async () => {
      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const genericError = new Error("Connection failed");

      // Mock callTool to throw an error
      mockSessionData.targetClient.callTool.mockRejectedValue(genericError);

      // Mock hook handling the exception
      processExceptionThroughHooks.mockResolvedValue({
        wasHandled: true,
        response: {
          content: [
            {
              type: "text",
              text: "Service temporarily unavailable. Please try again later.",
            },
          ],
        },
        reason: "Handled connection error",
        lastProcessedIndex: 0,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      expect(processExceptionThroughHooks).toHaveBeenCalledWith(
        genericError,
        expect.objectContaining({
          name: "fetch",
          arguments: { url: "https://example.com" },
        }),
        [],
      );

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Service temporarily unavailable. Please try again later.",
          },
        ],
      });
    });

    it("should re-throw error when no hook handles the exception", async () => {
      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const error = new Error("Unhandled error");

      // Mock callTool to throw an error
      mockSessionData.targetClient.callTool.mockRejectedValue(error);

      // Mock no hook handling the exception
      processExceptionThroughHooks.mockResolvedValue({
        wasHandled: false,
        lastProcessedIndex: -1,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");

      await expect(
        handler({ url: "https://example.com" }, mockContext),
      ).rejects.toThrow("Unhandled error");

      expect(processExceptionThroughHooks).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          name: "fetch",
          arguments: { url: "https://example.com" },
        }),
        [],
      );
    });

    it("should handle non-Error exceptions", async () => {
      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const stringError = "String error message";

      // Mock callTool to throw a string
      mockSessionData.targetClient.callTool.mockRejectedValue(stringError);

      // Mock hook handling the exception
      processExceptionThroughHooks.mockResolvedValue({
        wasHandled: true,
        response: { message: "Handled string error" },
        reason: "Converted string to structured error",
        lastProcessedIndex: 0,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      expect(processExceptionThroughHooks).toHaveBeenCalledWith(
        stringError,
        expect.objectContaining({
          name: "fetch",
          arguments: { url: "https://example.com" },
        }),
        [],
      );

      expect(result).toEqual({ message: "Handled string error" });
    });

    it("should handle HTTP 400 error with specific JSON-RPC error", async () => {
      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const jsonRpcError = new Error(
        'Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided or not an initialize request"},"id":null}',
      );

      // Mock callTool to throw the specific error
      mockSessionData.targetClient.callTool.mockRejectedValue(jsonRpcError);

      // Mock hook parsing and handling the JSON-RPC error
      processExceptionThroughHooks.mockResolvedValue({
        wasHandled: true,
        response: {
          content: [
            {
              type: "text",
              text: "Session initialization required. Please provide a valid session ID or send an initialize request.",
            },
          ],
        },
        reason: "Parsed JSON-RPC error and provided helpful message",
        lastProcessedIndex: 0,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      expect(processExceptionThroughHooks).toHaveBeenCalledWith(
        jsonRpcError,
        expect.objectContaining({
          name: "fetch",
          arguments: { url: "https://example.com" },
        }),
        [],
      );

      expect(result.content[0].text).toBe(
        "Session initialization required. Please provide a valid session ID or send an initialize request.",
      );
    });

    it("should handle object-type errors", async () => {
      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const objectError = {
        code: 500,
        message: "Internal server error",
        details: { timestamp: "2023-01-01T00:00:00Z" },
      };

      // Mock callTool to throw an object
      mockSessionData.targetClient.callTool.mockRejectedValue(objectError);

      // Mock hook handling the object error
      processExceptionThroughHooks.mockResolvedValue({
        wasHandled: true,
        response: {
          content: [
            {
              type: "text",
              text: "A server error occurred. Please try again later.",
            },
          ],
        },
        reason: "Converted object error to user-friendly message",
        lastProcessedIndex: 0,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      expect(processExceptionThroughHooks).toHaveBeenCalledWith(
        objectError,
        expect.objectContaining({
          name: "fetch",
          arguments: { url: "https://example.com" },
        }),
        [],
      );

      expect(result.content[0].text).toBe(
        "A server error occurred. Please try again later.",
      );
    });

    it("should not process through hooks when request is rejected", async () => {
      const { processRequestThroughHooks, processExceptionThroughHooks } =
        vi.mocked(await import("../hooks/processor.js"));

      // Mock request being rejected by hooks
      processRequestThroughHooks.mockResolvedValue({
        toolCall: {
          name: "fetch",
          arguments: { url: "https://example.com" },
        } as ToolCall,
        wasRejected: true,
        rejectionResponse: "Operation blocked",
        lastProcessedIndex: 0,
      });

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      // Should not call the target client or exception handling
      expect(mockSessionData.targetClient.callTool).not.toHaveBeenCalled();
      expect(processExceptionThroughHooks).not.toHaveBeenCalled();
      expect(result).toBe("Operation blocked");
    });

    it("should pass through successful responses without exception handling", async () => {
      const successResponse = { result: "success", data: "test" };
      mockSessionData.targetClient.callTool.mockResolvedValue(successResponse);

      const { processExceptionThroughHooks } = vi.mocked(
        await import("../hooks/processor.js"),
      );

      const handler = createPassthroughHandler(mockConfig, "fetch");
      const result = await handler({ url: "https://example.com" }, mockContext);

      expect(mockSessionData.targetClient.callTool).toHaveBeenCalled();
      expect(processExceptionThroughHooks).not.toHaveBeenCalled();
      expect(result).toEqual({ result: "success", data: "test" });
    });
  });
});
