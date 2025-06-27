import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  Hook,
  HookContext,
  HookResponse,
  ToolCall,
  ToolsListRequest,
} from "./types.js";

/**
 * Abstract base class for hooks that provides default pass-through implementations
 * for all hook methods. Extend this class to create custom hooks and override
 * only the methods you need.
 */
export abstract class AbstractHook implements Hook {
  /**
   * The name of this hook. Must be implemented by subclasses.
   */
  abstract get name(): string;
  /**
   * Process an incoming tool call request.
   * Default implementation passes through without modification.
   */
  async processRequest(
    toolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: toolCall,
    };
  }

  /**
   * Process a tool call response.
   * Default implementation passes through without modification.
   */
  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: response,
    };
  }

  /**
   * Process a tools/list request.
   * Default implementation passes through without modification.
   */
  async processToolsList?(
    request: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: request,
    };
  }

  /**
   * Process a tools/list response.
   * Default implementation passes through without modification.
   */
  async processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: response,
    };
  }

  /**
   * Handle exceptions thrown during tool execution.
   * Default implementation does not handle the exception (continues).
   */
  async processToolException?(
    error: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: null,
    };
  }
}
