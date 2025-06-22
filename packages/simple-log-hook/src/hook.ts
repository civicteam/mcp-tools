/**
 * Simple Log Hook Class Export
 *
 * This file exports the SimpleLogHook class for use by passthrough-bundle
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";

/**
 * Minimal hook implementation that logs to console
 */
export class SimpleLogHook extends AbstractHook {
  /**
   * The name of this hook
   */
  get name(): string {
    return "SimpleLogHook";
  }

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

export default SimpleLogHook;
