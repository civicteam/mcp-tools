/**
 * Unified Hook Application API
 *
 * Provides a simplified interface for applying hooks to requests and responses
 */

import type { HookClient, ToolCall } from "@civic/hook-common";
import { messageFromError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import {
  processRequestThroughHooks,
  processResponseThroughHooks,
} from "./processor.js";

export type HookType = "request" | "response";

export interface HookResult {
  data: unknown; // Modified data (tool call or response)
  rejected: boolean; // Whether any hook rejected
  rejectionReason?: string; // Reason for rejection if rejected
}

export interface HookContext {
  toolCall?: ToolCall; // Original tool call (for response hooks)
  metadata?: Record<string, unknown>; // Additional context metadata
}

/**
 * Apply hooks to data based on the hook type
 *
 * @param type - Whether to process as request or response hooks
 * @param hooks - Array of hook clients to apply
 * @param data - The data to process (ToolCall for requests, response data for responses)
 * @param context - Optional context information
 * @returns Modified data and rejection status
 */
export async function applyHooks(
  type: HookType,
  hooks: HookClient[],
  data: unknown,
  context?: HookContext,
): Promise<HookResult> {
  if (!hooks || hooks.length === 0) {
    return {
      data,
      rejected: false,
    };
  }

  try {
    if (type === "request") {
      // Process request hooks
      if (!data || typeof data !== 'object' || !('name' in data)) {
        throw new Error('Invalid tool call: missing required properties');
      }
      const toolCall = data as ToolCall;
      const result = await processRequestThroughHooks(toolCall, hooks);

      return {
        data: result.toolCall,
        rejected: result.wasRejected,
        rejectionReason: result.wasRejected
          ? result.rejectionReason ||
            formatRejectionReason(result.rejectionResponse)
          : undefined,
      };
    }
    // Process response hooks
    if (!context?.toolCall) {
      throw new Error("Response hooks require toolCall in context");
    }

    // For response hooks, we process in reverse order (from last successful request hook)
    const startIndex = hooks.length - 1;
    const result = await processResponseThroughHooks(
      data,
      context.toolCall,
      hooks,
      startIndex,
    );

    return {
      data: result.response,
      rejected: result.wasRejected,
      rejectionReason: result.wasRejected
        ? result.rejectionReason ||
          formatRejectionReason(result.rejectionResponse)
        : undefined,
    };
  } catch (error) {
    logger.error(`Error applying ${type} hooks: ${messageFromError(error)}`);
    return {
      data,
      rejected: true,
      rejectionReason: messageFromError(error),
    };
  }
}

/**
 * Format a rejection response into a string reason
 */
function formatRejectionReason(rejection: unknown): string {
  if (typeof rejection === "string") {
    return rejection;
  }
  if (rejection && typeof rejection === "object" && "reason" in rejection) {
    return String(rejection.reason);
  }
  if (rejection && typeof rejection === "object" && "message" in rejection) {
    return String(rejection.message);
  }
  return JSON.stringify(rejection);
}
