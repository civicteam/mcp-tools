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

export interface SimpleLogConfig {
  logLevel?: "verbose" | "normal";
  prefix?: string;
}

/**
 * Minimal hook implementation that logs to console
 */
class SimpleLogHook extends AbstractHook {
  private config: SimpleLogConfig | null = null;

  constructor() {
    super();
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "SimpleLogHook";
  }

  /**
   * Configure the hook with optional settings
   */
  configure(config: SimpleLogConfig | null): void {
    this.config = config;
    if (config) {
      console.log(`SimpleLogHook: Configured with settings`, config);
    }
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    const prefix = this.config?.prefix || "";
    const logPrefix = prefix ? `${prefix} ` : "";
    
    if (this.config?.logLevel === "verbose") {
      console.log(`${logPrefix}[REQUEST] ${toolCall.name}`, JSON.stringify(toolCall.arguments, null, 2));
    } else {
      console.log(`${logPrefix}[REQUEST] ${toolCall.name}`, toolCall.arguments);
    }

    // Call parent implementation to continue with unmodified tool call
    return super.processRequest(toolCall);
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    const prefix = this.config?.prefix || "";
    const logPrefix = prefix ? `${prefix} ` : "";
    
    if (this.config?.logLevel === "verbose") {
      console.log(`${logPrefix}[RESPONSE] ${originalToolCall.name}`, JSON.stringify(response, null, 2));
    } else {
      console.log(`${logPrefix}[RESPONSE] ${originalToolCall.name}`, response);
    }

    // Call parent implementation to continue with unmodified response
    return super.processResponse(response, originalToolCall);
  }
}

export default SimpleLogHook;
