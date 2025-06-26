/**
 * Explain Hook Implementation
 *
 * Adds a "reason" parameter to all tools to encourage thoughtful tool usage
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
  type ToolsListRequest,
} from "@civic/hook-common";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

export interface ExplainHookConfig {
  reasonDescription?: string;
  makeOptional?: boolean;
}

class ExplainHook extends AbstractHook {
  private config: ExplainHookConfig | null = null;

  constructor() {
    super();
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "ExplainHook";
  }

  /**
   * Configure the hook with optional settings
   */
  configure(config: ExplainHookConfig | null): void {
    this.config = config;
    if (config) {
      console.log(`ExplainHook: Configured with settings`, config);
    }
  }

  /**
   * Process an incoming tool call request to strip the reason parameter
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    // Clone the tool call to avoid modifying the original
    const modifiedToolCall = { ...toolCall };

    // If arguments is an object and has a 'reason' property, remove it
    if (
      typeof modifiedToolCall.arguments === "object" &&
      modifiedToolCall.arguments !== null &&
      "reason" in modifiedToolCall.arguments
    ) {
      // Log the reason before removing it
      const reason = (modifiedToolCall.arguments as Record<string, unknown>)
        .reason;
      console.log(`[${toolCall.name}] Reason: ${reason}`);

      // Clone arguments and remove the reason
      const { reason: _, ...strippedArguments } =
        modifiedToolCall.arguments as Record<string, unknown>;
      modifiedToolCall.arguments = strippedArguments;
    }

    return {
      response: "continue",
      body: modifiedToolCall,
    };
  }
  /**
   * Process a tools/list response to add the reason parameter to all tools
   */
  async processToolsListResponse(
    response: ListToolsResult,
    _originalRequest: ToolsListRequest,
  ): Promise<HookResponse> {
    // Clone the response to avoid modifying the original
    const modifiedResponse: ListToolsResult = {
      ...response,
      tools: response.tools.map((tool) => {
        // Clone the tool to avoid modifying the original
        const modifiedTool = { ...tool };

        // Ensure inputSchema exists and is an object schema
        if (!modifiedTool.inputSchema) {
          modifiedTool.inputSchema = {
            type: "object",
            properties: {},
            required: [],
          };
        }

        // Type guard to ensure we're working with an object schema
        const schema = modifiedTool.inputSchema as {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        };

        // Ensure it's an object type
        if (schema.type !== "object") {
          console.warn(
            `Tool ${tool.name} has non-object schema type: ${schema.type}. Skipping reason parameter addition.`,
          );
          return modifiedTool;
        }

        // Ensure properties exist
        if (!schema.properties) {
          schema.properties = {};
        }

        // Add the reason parameter
        const defaultDescription =
          "A justification for using this tool, explaining how it helps achieve your goal. Should contain the following: " +
          "GOAL: <Your current goal>, JUSTIFICATION: <how this tool helps achieve the goal>, CHOICE: <why you chose to use this tool over other available tools>.";
        
        schema.properties.reason = {
          type: "string",
          description: this.config?.reasonDescription || defaultDescription,
        };

        // Ensure required array exists and add reason to it (unless configured as optional)
        if (!this.config?.makeOptional) {
          if (!schema.required) {
            schema.required = [];
          }
          if (!schema.required.includes("reason")) {
            schema.required.push("reason");
          }
        }

        return modifiedTool;
      }),
    };

    console.log(`Added 'reason' parameter to ${response.tools.length} tools`);

    return {
      response: "continue",
      body: modifiedResponse,
    };
  }
}

export default ExplainHook;
