import {
  type ListToolsResult,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema for tool call metadata
 */
export const ToolCallMetadataSchema = z
  .object({
    sessionId: z.string(),
    timestamp: z.string(),
    source: z.string().optional(),
  })
  .passthrough();

/**
 * Schema for a tool call
 */
export const ToolCallSchema = z.object({
  name: z.string(),
  arguments: z.unknown(),
  metadata: ToolCallMetadataSchema.optional(),
  toolDefinition: ToolSchema.optional(),
});

/**
 * Schema for tools list request
 */
export const ToolsListRequestSchema = z.object({
  method: z.literal("tools/list"),
  metadata: ToolCallMetadataSchema.optional(),
});

/**
 * Schema for hook response
 */
export const HookResponseSchema = z.object({
  response: z.enum(["continue", "abort"]),
  body: z.unknown(),
  reason: z.string().optional(),
});

/**
 * Type definitions
 */
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolsListRequest = z.infer<typeof ToolsListRequestSchema>;
export type HookResponse = z.infer<typeof HookResponseSchema>;
export type ToolCallMetadata = z.infer<typeof ToolCallMetadataSchema>;

/**
 * Generic hook context interface that can hold typed contextual information
 */
export interface HookContext<TData = unknown, TType extends string = string> {
  readonly contextType: TType;
  readonly data: TData;
}

/**
 * Hook interface that all hooks must implement
 */
export interface Hook {
  /**
   * The name of this hook
   */
  get name(): string;

  /**
   * Process an incoming tool call request
   */
  processRequest(
    toolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse>;

  /**
   * Process a tool call response
   */
  processResponse(
    response: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse>;

  /**
   * Process a tools/list request (optional)
   */
  processToolsList?(
    request: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse>;

  /**
   * Process a tools/list response (optional)
   */
  processToolsListResponse?(
    response: ListToolsResult,
    originalRequest: ToolsListRequest,
    context?: HookContext,
  ): Promise<HookResponse>;

  /**
   * Handle exceptions thrown during tool execution (optional)
   */
  processToolException?(
    error: unknown,
    originalToolCall: ToolCall,
    context?: HookContext,
  ): Promise<HookResponse>;
}
