import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { HookRouter } from "./router.js";
import type { HookResponse, ToolCall } from "./types.js";

/**
 * Configuration for a hook client
 */
export interface HookClientConfig {
  url: string;
  name: string;
}

/**
 * tRPC-based hook client
 */
export class HookClient {
  private client: ReturnType<typeof createTRPCClient<HookRouter>>;
  public readonly name: string;

  constructor(config: HookClientConfig) {
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
}

/**
 * Create hook clients from configuration
 */
export function createHookClients(configs: HookClientConfig[]): HookClient[] {
  return configs.map((config) => new HookClient(config));
}
