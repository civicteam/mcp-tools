/**
 * Hook Processor Module
 *
 * Handles processing of tool calls through hook chains
 */

import type {
  HookClient,
  HookContext,
  HookResponse,
  ToolCall,
  ToolsListRequest,
} from "@civic/hook-common";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";

export interface ProcessRequestResult {
  toolCall: ToolCall;
  wasRejected: boolean;
  rejectionResponse?: unknown;
  rejectionReason?: string;
  lastProcessedIndex: number;
}

export interface ProcessResponseResult {
  response: unknown;
  wasRejected: boolean;
  rejectionResponse?: unknown;
  rejectionReason?: string;
  lastProcessedIndex: number;
}

export interface ProcessExceptionResult {
  wasHandled: boolean;
  response?: unknown;
  reason?: string;
  lastProcessedIndex: number;
}

/**
 * Process a tool call through a chain of hooks for request validation
 */
export async function processRequestThroughHooks(
  toolCall: ToolCall,
  hooks: HookClient[],
  context?: HookContext,
): Promise<ProcessRequestResult> {
  let currentToolCall = toolCall;
  let wasRejected = false;
  let rejectionResponse: unknown = null;
  let rejectionReason: string | undefined;
  let lastProcessedIndex = -1;

  for (let i = 0; i < hooks.length && !wasRejected; i++) {
    const hook = hooks[i];

    logger.info(
      `Processing request through hook ${i + 1} (${hook.name}) for tool '${currentToolCall.name}'`,
    );

    const hookResponse: HookResponse = await hook.processRequest(
      currentToolCall,
      context,
    );
    lastProcessedIndex = i;

    if (hookResponse.response === "continue") {
      currentToolCall = hookResponse.body as ToolCall;
      logger.info(
        `Hook ${i + 1} approved request for tool '${currentToolCall.name}'`,
      );
    } else {
      wasRejected = true;
      rejectionResponse = hookResponse.body;
      rejectionReason = hookResponse.reason;
      logger.info(
        `Hook ${i + 1} rejected request: ${hookResponse.reason || "No reason provided"}`,
      );
    }
  }

  return {
    toolCall: currentToolCall,
    wasRejected,
    rejectionResponse,
    rejectionReason,
    lastProcessedIndex,
  };
}

/**
 * Process a response through a chain of hooks in reverse order
 */
export async function processResponseThroughHooks(
  response: unknown,
  toolCall: ToolCall,
  hooks: HookClient[],
  startIndex: number,
  context?: HookContext,
): Promise<ProcessResponseResult> {
  let currentResponse = response;
  let wasRejected = false;
  let rejectionResponse: unknown = null;
  let rejectionReason: string | undefined;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    logger.info(
      `Processing response through hook ${i + 1} (${hook.name}) for tool '${toolCall.name}'`,
    );

    const hookResponse: HookResponse = await hook.processResponse(
      currentResponse,
      toolCall,
      context,
    );
    lastProcessedIndex = i;
    logger.info(`Response from hook: ${JSON.stringify(hookResponse, null, 2)}`);

    if (hookResponse.response === "continue") {
      currentResponse = hookResponse.body;
      logger.info(
        `Hook ${i + 1} approved response for tool '${toolCall.name}'`,
      );
    } else {
      wasRejected = true;
      rejectionResponse = hookResponse.body;
      rejectionReason = hookResponse.reason;
      logger.info(
        `Hook ${i + 1} rejected response: ${hookResponse.reason || "No reason provided"}`,
      );
      // For consistency, we'll let the caller handle formatting the rejection
      break;
    }
  }

  return {
    response: currentResponse,
    wasRejected,
    rejectionResponse,
    rejectionReason,
    lastProcessedIndex,
  };
}

/**
 * Process a tools/list request through a chain of hooks
 */
export async function processToolsListRequestThroughHooks(
  request: ToolsListRequest,
  hooks: HookClient[],
  context?: HookContext,
): Promise<ProcessRequestResult & { request: ToolsListRequest }> {
  let currentRequest = request;
  let wasRejected = false;
  let rejectionResponse: unknown = null;
  let rejectionReason: string | undefined;
  let lastProcessedIndex = -1;

  for (let i = 0; i < hooks.length && !wasRejected; i++) {
    const hook = hooks[i];

    // Check if hook supports tools/list processing
    if (!hook.processToolsList) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tools/list processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tools/list request through hook ${i + 1} (${hook.name})`,
    );

    const hookResponse: HookResponse = await hook.processToolsList(
      currentRequest,
      context,
    );
    lastProcessedIndex = i;

    if (hookResponse.response === "continue") {
      currentRequest = hookResponse.body as ToolsListRequest;
      logger.info(`Hook ${i + 1} approved tools/list request`);
    } else {
      wasRejected = true;
      rejectionResponse = hookResponse.body;
      rejectionReason = hookResponse.reason;
      logger.info(
        `Hook ${i + 1} rejected tools/list request: ${hookResponse.reason || "No reason provided"}`,
      );
    }
  }

  return {
    request: currentRequest,
    toolCall: {} as ToolCall, // Not used for tools/list
    wasRejected,
    rejectionResponse,
    rejectionReason,
    lastProcessedIndex,
  };
}

/**
 * Process a tools/list response through a chain of hooks in reverse order
 */
export async function processToolsListResponseThroughHooks(
  response: ListToolsResult,
  request: ToolsListRequest,
  hooks: HookClient[],
  startIndex: number,
  context?: HookContext,
): Promise<ProcessResponseResult & { response: ListToolsResult }> {
  let currentResponse = response;
  let wasRejected = false;
  let rejectionResponse: unknown = null;
  let rejectionReason: string | undefined;
  let lastProcessedIndex = startIndex;

  for (let i = startIndex; i >= 0; i--) {
    const hook = hooks[i];

    // Check if hook supports tools/list response processing
    if (!hook.processToolsListResponse) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support tools/list response processing, skipping`,
      );
      continue;
    }

    logger.info(
      `Processing tools/list response through hook ${i + 1} (${hook.name})`,
    );

    const hookResponse: HookResponse = await hook.processToolsListResponse(
      currentResponse,
      request,
      context,
    );
    lastProcessedIndex = i;

    if (hookResponse.response === "continue") {
      currentResponse = hookResponse.body as ListToolsResult;
      logger.info(`Hook ${i + 1} approved tools/list response`);
    } else {
      wasRejected = true;
      rejectionResponse = hookResponse.body;
      rejectionReason = hookResponse.reason;
      logger.info(
        `Hook ${i + 1} rejected tools/list response: ${hookResponse.reason || "No reason provided"}`,
      );
      break;
    }
  }

  return {
    response: currentResponse,
    wasRejected,
    rejectionResponse,
    rejectionReason,
    lastProcessedIndex,
  };
}

/**
 * Process an exception through a chain of hooks
 */
export async function processExceptionThroughHooks(
  error: unknown,
  toolCall: ToolCall,
  hooks: HookClient[],
  context?: HookContext,
): Promise<ProcessExceptionResult> {
  let response: unknown = null;
  let wasHandled = false;
  let reason: string | undefined;
  let lastProcessedIndex = -1;

  for (let i = 0; i < hooks.length && !wasHandled; i++) {
    const hook = hooks[i];

    // Check if hook supports exception processing
    if (!hook.processToolException) {
      logger.info(
        `Hook ${i + 1} (${hook.name}) does not support exception processing, skipping`,
      );
      continue;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.info(
      `Processing exception through hook ${i + 1} (${hook.name}) for tool '${toolCall.name}': ${errorMessage}`,
    );

    const hookResponse: HookResponse = await hook.processToolException(
      error,
      toolCall,
      context,
    );
    lastProcessedIndex = i;

    if (hookResponse.response === "continue") {
      logger.info(
        `Hook ${i + 1} did not handle the exception for tool '${toolCall.name}'`,
      );
    } else {
      wasHandled = true;
      response = hookResponse.body;
      reason = hookResponse.reason;
      logger.info(
        `Hook ${i + 1} handled exception for tool '${toolCall.name}': ${hookResponse.reason || "No reason provided"}`,
      );
    }
  }

  return {
    wasHandled,
    response,
    reason,
    lastProcessedIndex,
  };
}
