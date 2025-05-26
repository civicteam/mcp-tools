import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import { ToolCallSchema, HookResponseSchema } from './types.js';
import type { Hook } from './types.js';

/**
 * Create a tRPC instance with SuperJSON for serialization
 */
const t = initTRPC.create({
  transformer: superjson,
});

/**
 * Create a hook router for a given hook implementation
 */
export function createHookRouter(hook: Hook) {
  return t.router({
    /**
     * Process an incoming tool call request
     */
    processRequest: t.procedure
      .input(ToolCallSchema)
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        return await hook.processRequest(input);
      }),
    
    /**
     * Process a tool call response
     */
    processResponse: t.procedure
      .input(z.object({
        response: z.any(),
        originalToolCall: ToolCallSchema,
      }))
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        return await hook.processResponse(input.response, input.originalToolCall);
      }),
  });
}

/**
 * Type for the hook router
 */
export type HookRouter = ReturnType<typeof createHookRouter>;