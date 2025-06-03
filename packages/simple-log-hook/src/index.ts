/**
 * Simple Log Hook - Minimal logging hook implementation
 *
 * Demonstrates the simplest possible hook implementation
 * that just logs tool calls to console.
 */

import * as process from "node:process";
import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
  createHookRouter,
} from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

/**
 * Minimal hook implementation that logs to console
 */
class SimpleLogHook extends AbstractHook {
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    console.log(`[REQUEST] ${toolCall.name}`, toolCall.arguments);

    // Call parent implementation to continue with unmodified tool call
    return super.processRequest(toolCall);
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    console.log(`[RESPONSE] ${originalToolCall.name}`, response);

    // Call parent implementation to continue with unmodified response
    return super.processResponse(response, originalToolCall);
  }
}

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33006;

// Create and start the server
const hook = new SimpleLogHook();
const router = createHookRouter(hook);

const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Simple Log Hook running on port ${PORT}`);
