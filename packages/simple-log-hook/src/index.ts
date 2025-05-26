/**
 * Simple Log Hook - Minimal logging hook implementation
 * 
 * Demonstrates the simplest possible hook implementation
 * that just logs tool calls to console.
 */

import * as process from "node:process";
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createHookRouter } from '@civicteam/hook-common/router';
import type { Hook, ToolCall, HookResponse } from '@civicteam/hook-common/types';

/**
 * Minimal hook implementation that logs to console
 */
class SimpleLogHook implements Hook {
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    console.log(`[REQUEST] ${toolCall.name}`, toolCall.arguments);
    
    return {
      response: 'continue',
      body: toolCall,
    };
  }

  async processResponse(response: any, originalToolCall: ToolCall): Promise<HookResponse> {
    console.log(`[RESPONSE] ${originalToolCall.name}`, response);
    
    return {
      response: 'continue',
      body: response,
    };
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