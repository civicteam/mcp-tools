import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  HookResponseSchema,
  ToolCallSchema,
  ToolsListRequestSchema,
} from "./types.js";
import type { Hook } from "./types.js";

/**
 * Create a tRPC instance with SuperJSON for serialization
 */
const t = initTRPC.create({
  transformer: superjson,
});

/**
 * Base router procedures that all hooks must have
 */
const baseRouter = t.router({
  /**
   * Process an incoming tool call request
   */
  processRequest: t.procedure
    .input(ToolCallSchema)
    .output(HookResponseSchema)
    .mutation(async ({ input }) => {
      throw new Error("processRequest not implemented");
    }),

  /**
   * Process a tool call response
   */
  processResponse: t.procedure
    .input(
      z.object({
        response: z.any(),
        originalToolCall: ToolCallSchema,
      }),
    )
    .output(HookResponseSchema)
    .mutation(async ({ input }) => {
      throw new Error("processResponse not implemented");
    }),
});

/**
 * Optional router procedures for tools/list
 */
const toolsListRouter = t.router({
  /**
   * Process a tools/list request
   */
  processToolsList: t.procedure
    .input(ToolsListRequestSchema)
    .output(HookResponseSchema)
    .mutation(async ({ input }) => {
      throw new Error("processToolsList not implemented");
    }),

  /**
   * Process a tools/list response
   */
  processToolsListResponse: t.procedure
    .input(
      z.object({
        response: ListToolsResultSchema,
        originalRequest: ToolsListRequestSchema,
      }),
    )
    .output(HookResponseSchema)
    .mutation(async ({ input }) => {
      throw new Error("processToolsListResponse not implemented");
    }),

  /**
   * Process an exception during tool execution
   */
  processToolException: t.procedure
    .input(
      z.object({
        error: z.any(),
        originalToolCall: ToolCallSchema,
      }),
    )
    .output(HookResponseSchema)
    .mutation(async ({ input }) => {
      throw new Error("processToolException not implemented");
    }),
});

/**
 * Full router type with all procedures
 */
export const fullRouter = t.router({
  ...baseRouter._def.procedures,
  ...toolsListRouter._def.procedures,
});

export type HookRouter = typeof fullRouter;

/**
 * Create a hook router for a given hook implementation
 */
export function createHookRouter(hook: Hook) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedures need flexible typing
  const procedures: any = {
    processRequest: t.procedure
      .input(ToolCallSchema)
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        return await hook.processRequest(input);
      }),

    processResponse: t.procedure
      .input(
        z.object({
          response: z.any(),
          originalToolCall: ToolCallSchema,
        }),
      )
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        return await hook.processResponse(
          input.response,
          input.originalToolCall,
        );
      }),
  };

  // Add optional procedures if the hook supports them
  if (hook.processToolsList) {
    procedures.processToolsList = t.procedure
      .input(ToolsListRequestSchema)
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolsList) {
          throw new Error("processToolsList not implemented");
        }
        return await hook.processToolsList(input);
      });
  }

  if (hook.processToolsListResponse) {
    procedures.processToolsListResponse = t.procedure
      .input(
        z.object({
          response: ListToolsResultSchema,
          originalRequest: ToolsListRequestSchema,
        }),
      )
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolsListResponse) {
          throw new Error("processToolsListResponse not implemented");
        }
        return await hook.processToolsListResponse(
          input.response,
          input.originalRequest,
        );
      });
  }

  if (hook.processToolException) {
    procedures.processToolException = t.procedure
      .input(
        z.object({
          error: z.any(),
          originalToolCall: ToolCallSchema,
        }),
      )
      .output(HookResponseSchema)
      .mutation(async ({ input }) => {
        // This should never happen since we check for the method existence
        if (!hook.processToolException) {
          throw new Error("processToolException not implemented");
        }
        return await hook.processToolException(
          input.error,
          input.originalToolCall,
        );
      });
  }

  return t.router(procedures);
}
