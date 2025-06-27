import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  Hook,
  HookResponse,
  ToolCall,
  ToolsListRequest,
} from "./types.js";

/**
 * Abstract base class for hooks that provides default pass-through implementations
 * for all hook methods. Extend this class to create custom hooks and override
 * only the methods you need.
 *
 * @template TConfig The type of configuration this hook accepts
 */
export abstract class AbstractHook<TConfig = any> implements Hook {
  /**
   * The name of this hook. Must be implemented by subclasses.
   */
  abstract get name(): string;

  /**
   * Configure the hook with the provided configuration.
   * Subclasses should override this to handle their specific configuration.
   *
   * @param config The configuration object or null for default configuration
   */
  configure(config: TConfig | null): void {
    // Default implementation does nothing
    // Subclasses should override this method
  }
  /**
   * Process an incoming tool call request.
   * Default implementation passes through without modification.
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
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
  async processToolsList?(request: ToolsListRequest): Promise<HookResponse> {
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
  ): Promise<HookResponse> {
    return {
      response: "continue",
      body: response,
    };
  }
}
