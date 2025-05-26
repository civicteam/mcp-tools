import { z } from 'zod';

/**
 * Schema for tool call metadata
 */
export const ToolCallMetadataSchema = z.object({
  sessionId: z.string(),
  timestamp: z.string(),
  source: z.string().optional(),
}).passthrough();

/**
 * Schema for a tool call
 */
export const ToolCallSchema = z.object({
  name: z.string(),
  arguments: z.any(),
  metadata: ToolCallMetadataSchema.optional(),
});

/**
 * Schema for hook response
 */
export const HookResponseSchema = z.object({
  response: z.enum(['continue', 'abort']),
  body: z.any(),
  reason: z.string().optional(),
});

/**
 * Type definitions
 */
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type HookResponse = z.infer<typeof HookResponseSchema>;
export type ToolCallMetadata = z.infer<typeof ToolCallMetadataSchema>;

/**
 * Hook interface that all hooks must implement
 */
export interface Hook {
  /**
   * Process an incoming tool call request
   */
  processRequest(toolCall: ToolCall): Promise<HookResponse>;
  
  /**
   * Process a tool call response
   */
  processResponse(response: any, originalToolCall: ToolCall): Promise<HookResponse>;
}