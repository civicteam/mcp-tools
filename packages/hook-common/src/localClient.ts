/**
 * Local Hook Client
 *
 * Wraps a Hook instance to implement the HookClient interface
 */

import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { HookClient } from "./client.js";
import type {
  Hook,
  HookResponse,
  ToolCall,
  ToolsListRequest,
} from "./types.js";

export class LocalHookClient implements HookClient {
  public readonly name: string;

  constructor(private hook: Hook) {
    this.name = hook.name;
  }

  /**
   * Process a tool call through the hook
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    try {
      return await this.hook.processRequest(toolCall);
    } catch (error) {
      console.error(`Hook ${this.name} request processing failed:`, error);
      // On error, continue with unmodified request
      return {
        response: "continue",
        body: toolCall,
      };
    }
  }

  /**
   * Process a response through the hook
   */
  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    try {
      return await this.hook.processResponse(response, originalToolCall);
    } catch (error) {
      console.error(`Hook ${this.name} response processing failed:`, error);
      // On error, continue with unmodified response
      return {
        response: "continue",
        body: response,
      };
    }
  }

  /**
   * Process a tools/list request through the hook
   */
  async processToolsList(request: ToolsListRequest): Promise<HookResponse> {
    try {
      // Check if hook supports tools/list processing
      if (!this.hook.processToolsList) {
        return {
          response: "continue",
          body: request,
        };
      }
      return await this.hook.processToolsList(request);
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list request processing failed:`,
        error,
      );
      // On error, continue with unmodified request
      return {
        response: "continue",
        body: request,
      };
    }
  }

  /**
   * Process a tools/list response through the hook
   */
  async processToolsListResponse(
    response: ListToolsResult,
    originalRequest: ToolsListRequest,
  ): Promise<HookResponse> {
    try {
      // Check if hook supports tools/list response processing
      if (!this.hook.processToolsListResponse) {
        return {
          response: "continue",
          body: response,
        };
      }
      return await this.hook.processToolsListResponse(
        response,
        originalRequest,
      );
    } catch (error) {
      console.error(
        `Hook ${this.name} tools/list response processing failed:`,
        error,
      );
      // On error, continue with unmodified response
      return {
        response: "continue",
        body: response,
      };
    }
  }
}
