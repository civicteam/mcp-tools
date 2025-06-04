import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { HookRouter } from "./router.js";
import type { HookResponse, ToolCall, ToolsListRequest } from "./types.js";

/**
 * Hook client interface
 */
export interface HookClient {
  readonly name: string;
  processRequest(toolCall: ToolCall): Promise<HookResponse>;
  processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse>;
  processToolsList?(request: ToolsListRequest): Promise<HookResponse>;
  processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ToolsListRequest,
  ): Promise<HookResponse>;
}

/**
 * Configuration for a remote hook client
 */
export interface RemoteHookConfig {
  url: string;
  name: string;
}

/**
 * Remote tRPC-based hook client
 */
export class RemoteHookClient implements HookClient {
  private client: ReturnType<typeof createTRPCClient<HookRouter>>;
  public readonly name: string;

  constructor(config: RemoteHookConfig) {
    this.name = config.name;
    this.client = createTRPCClient<HookRouter>({
      links: [
        httpBatchLink({
          url: config.url,
          transformer: superjson,
        }),
      ],
    });
  }

  /**
   * Process a tool call through the hook
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    try {
      return await this.client.processRequest.mutate(toolCall);
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
      return await this.client.processResponse.mutate({
        response,
        originalToolCall,
      });
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
      return await this.client.processToolsList.mutate(request);
    } catch (error) {
      // Check if it's a "not implemented" error
      if (error instanceof Error && error.message.includes("not implemented")) {
        // Hook doesn't support this method, continue with unmodified request
        return {
          response: "continue",
          body: request,
        };
      }
      console.error(
        `Hook ${this.name} tools/list request processing failed:`,
        error,
      );
      // On other errors, continue with unmodified request
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
      return await this.client.processToolsListResponse.mutate({
        response,
        originalRequest,
      });
    } catch (error) {
      // Check if it's a "not implemented" error
      if (error instanceof Error && error.message.includes("not implemented")) {
        // Hook doesn't support this method, continue with unmodified response
        return {
          response: "continue",
          body: response,
        };
      }
      console.error(
        `Hook ${this.name} tools/list response processing failed:`,
        error,
      );
      // On other errors, continue with unmodified response
      return {
        response: "continue",
        body: response,
      };
    }
  }
}

/**
 * Create remote hook clients from configuration
 */
export function createRemoteHookClients(
  configs: RemoteHookConfig[],
): RemoteHookClient[] {
  return configs.map((config) => new RemoteHookClient(config));
}
