/**
 * Hook Processor Module
 *
 * Handles processing of tool calls through hook chains
 */

import type {HookClient} from "@civic/hook-common/client";
import type {HookResponse, ToolCall} from "@civic/hook-common/types";
import {logger} from "../utils/logger.js";

export interface ProcessRequestResult {
    toolCall: ToolCall;
    wasRejected: boolean;
    rejectionResponse?: unknown;
    lastProcessedIndex: number;
}

export interface ProcessResponseResult {
    response: unknown;
    wasRejected: boolean;
    rejectionResponse?: unknown;
    lastProcessedIndex: number;
}

/**
 * Process a tool call through a chain of hooks for request validation
 */
export async function processRequestThroughHooks(
    toolCall: ToolCall,
    hooks: HookClient[],
): Promise<ProcessRequestResult> {
    let currentToolCall = toolCall;
    let wasRejected = false;
    let rejectionResponse: unknown = null;
    let lastProcessedIndex = -1;

    for (let i = 0; i < hooks.length && !wasRejected; i++) {
        const hook = hooks[i];

        logger.info(
            `Processing request through hook ${i + 1} (${hook.name}) for tool '${currentToolCall.name}'`,
        );

        const hookResponse: HookResponse =
            await hook.processRequest(currentToolCall);
        lastProcessedIndex = i;

        if (hookResponse.response === "continue") {
            currentToolCall = hookResponse.body as ToolCall;
            logger.info(
                `Hook ${i + 1} approved request for tool '${currentToolCall.name}'`,
            );
        } else {
            wasRejected = true;
            rejectionResponse = hookResponse.body;
            logger.info(
                `Hook ${i + 1} rejected request: ${hookResponse.reason || "No reason provided"}`,
            );
        }
    }

    return {
        toolCall: currentToolCall,
        wasRejected,
        rejectionResponse,
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
): Promise<ProcessResponseResult> {
    let currentResponse = response;
    let wasRejected = false;
    let rejectionResponse: unknown = null;
    let lastProcessedIndex = startIndex;

    for (let i = startIndex; i >= 0; i--) {
        const hook = hooks[i];

        logger.info(
            `Processing response through hook ${i + 1} (${hook.name}) for tool '${toolCall.name}'`,
        );

        const hookResponse: HookResponse = await hook.processResponse(
            currentResponse,
            toolCall,
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
            rejectionResponse = hookResponse.body ?? hookResponse.reason ?? "No reason provided";
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
        lastProcessedIndex,
    };
}
