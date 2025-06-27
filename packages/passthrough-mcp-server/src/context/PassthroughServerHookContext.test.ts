/**
 * Tests for PassthroughServerHookContext demonstrating typed context usage
 */

import type { HookContext, HookResponse, ToolCall } from "@civic/hook-common";
import { describe, expect, it } from "vitest";
import {
  type PassthroughServerContextData,
  PassthroughServerHookContext,
  getPassthroughServerContext,
  isPassthroughServerContext,
} from "./PassthroughServerHookContext.js";

describe("PassthroughServerHookContext", () => {
  it("should provide typed access to passthrough-specific functionality", () => {
    const mockTargetClient = {
      callTool: async () => ({ result: "success" }),
      listTools: async () => ({ tools: [] }),
    };

    const mockRecreateFunction = async () => ({
      callTool: async () => ({ result: "recreated" }),
      listTools: async () => ({ tools: [] }),
    });

    const contextData: PassthroughServerContextData = {
      sessionId: "test-session",
      targetClient: mockTargetClient,
      recreateTargetClient: mockRecreateFunction,
    };

    const context = new PassthroughServerHookContext(contextData);

    // Verify context type identification
    expect(context.contextType).toBe("passthrough-server");
    expect(context.data).toBe(contextData);

    // Verify basic access
    expect(context.sessionId).toBe("test-session");

    // Verify typed access methods
    const targetClient = context.getTargetClient();
    expect(targetClient).toBe(mockTargetClient);

    // Verify typed client access with generic
    const typedClient = context.getTargetClient<typeof mockTargetClient>();
    expect(typedClient.callTool).toBeDefined();
    expect(typedClient.listTools).toBeDefined();
  });

  it("should support type guards for safe context access", () => {
    const contextData: PassthroughServerContextData = {
      sessionId: "test-session",
      targetClient: {},
      recreateTargetClient: async () => ({}),
    };

    const passthroughContext = new PassthroughServerHookContext(contextData);
    const genericContext: HookContext = passthroughContext;

    // Type guard should work
    expect(isPassthroughServerContext(genericContext)).toBe(true);
    expect(isPassthroughServerContext(undefined)).toBe(false);

    // Safe getter should work
    const safeContext = getPassthroughServerContext(genericContext);
    expect(safeContext).toBe(passthroughContext);
    expect(safeContext?.sessionId).toBe("test-session");

    // Should return undefined for wrong type
    expect(getPassthroughServerContext(undefined)).toBeUndefined();
  });

  it("should demonstrate a hook using typed context for error recovery", async () => {
    class RecoveryHook {
      async processToolException(
        error: unknown,
        toolCall: ToolCall,
        context?: HookContext,
      ): Promise<HookResponse> {
        // Safe context access with type checking
        const passthroughContext = getPassthroughServerContext(context);

        if (!passthroughContext) {
          // No passthrough context available, can't handle recovery
          return { response: "continue", body: null };
        }

        if (error instanceof Error && error.message.includes("Connection")) {
          try {
            // Type-safe access to passthrough functionality
            const newClient = await passthroughContext.recreateClient();

            return {
              response: "abort",
              body: {
                content: [
                  {
                    type: "text",
                    text: `Connection recovered for session ${passthroughContext.sessionId}. Please retry.`,
                  },
                ],
              },
              reason: "Connection recovered",
            };
          } catch (recoveryError) {
            return {
              response: "abort",
              body: {
                content: [
                  {
                    type: "text",
                    text: "Unable to recover connection. Please check your network.",
                  },
                ],
              },
              reason: "Recovery failed",
            };
          }
        }

        return { response: "continue", body: null };
      }
    }

    const mockTargetClient = {
      callTool: async () => ({ result: "success" }),
    };

    const mockRecreateFunction = async () => ({
      callTool: async () => ({ result: "recreated" }),
    });

    const context = new PassthroughServerHookContext({
      sessionId: "test-session",
      targetClient: mockTargetClient,
      recreateTargetClient: mockRecreateFunction,
    });

    const hook = new RecoveryHook();
    const connectionError = new Error("Connection failed");
    const toolCall: ToolCall = { name: "test", arguments: {} };

    const result = await hook.processToolException(
      connectionError,
      toolCall,
      context,
    );

    expect(result.response).toBe("abort");
    expect(result.reason).toBe("Connection recovered");
    expect(result.body).toEqual({
      content: [
        {
          type: "text",
          text: "Connection recovered for session test-session. Please retry.",
        },
      ],
    });
  });

  it("should demonstrate a hook using typed context for request enrichment", async () => {
    class EnrichmentHook {
      async processRequest(
        toolCall: ToolCall,
        context?: HookContext,
      ): Promise<HookResponse> {
        // Safe context access with type checking
        const passthroughContext = getPassthroughServerContext(context);

        if (!passthroughContext) {
          // No passthrough context, just pass through
          return { response: "continue", body: toolCall };
        }

        // Type-safe access to session ID and target client
        const sessionId = passthroughContext.sessionId;
        const targetClient = passthroughContext.getTargetClient<any>();

        // Enrich the tool call with session and client information
        const enrichedToolCall = {
          ...toolCall,
          arguments: {
            ...toolCall.arguments,
            _sessionContext: {
              sessionId,
              hasTargetClient: !!targetClient,
              timestamp: new Date().toISOString(),
            },
          },
        };

        return {
          response: "continue",
          body: enrichedToolCall,
        };
      }
    }

    const mockTargetClient = { callTool: async () => ({}) };
    const context = new PassthroughServerHookContext({
      sessionId: "enrichment-session",
      targetClient: mockTargetClient,
      recreateTargetClient: async () => mockTargetClient,
    });

    const hook = new EnrichmentHook();
    const toolCall: ToolCall = {
      name: "fetch",
      arguments: { url: "https://example.com" },
    };

    const result = await hook.processRequest(toolCall, context);

    expect(result.response).toBe("continue");
    const enrichedCall = result.body as ToolCall;
    expect(enrichedCall.arguments).toMatchObject({
      url: "https://example.com",
      _sessionContext: {
        sessionId: "enrichment-session",
        hasTargetClient: true,
      },
    });
    expect(enrichedCall.arguments._sessionContext.timestamp).toBeDefined();
  });
});
