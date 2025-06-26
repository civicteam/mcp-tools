/**
 * Custom Description Hook Implementation
 *
 * Replaces tool descriptions based on configuration
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolsListRequest,
} from "@civic/hook-common";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

interface ToolDescription {
  server: string;
  toolName: string;
  toolDescription: string;
}

export interface CustomDescriptionConfig {
  toolDescriptions: ToolDescription[];
}

class CustomDescriptionHook extends AbstractHook {
  private config: CustomDescriptionConfig | null = null;

  constructor() {
    super();
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "CustomDescriptionHook";
  }

  /**
   * Configure the hook with tool description replacements
   */
  configure(config: CustomDescriptionConfig | null): void {
    this.config = config;
    if (config) {
      console.log(
        `CustomDescriptionHook: Configured with ${config.toolDescriptions.length} tool description replacements`,
      );
    } else {
      console.log(
        `CustomDescriptionHook: No configuration provided - hook will pass through without modifications`,
      );
    }
  }

  /**
   * Process a tools/list response to replace tool descriptions
   */
  async processToolsListResponse(
    response: ListToolsResult,
    _originalRequest: ToolsListRequest,
  ): Promise<HookResponse> {
    // If no config, pass through unchanged
    if (!this.config || this.config.toolDescriptions.length === 0) {
      return {
        response: "continue",
        body: response,
      };
    }

    // Clone the response to avoid modifying the original
    const modifiedResponse: ListToolsResult = {
      ...response,
      tools: response.tools.map((tool) => {
        // Find matching description replacement
        const replacement = this.config?.toolDescriptions.find(
          (desc) => desc.toolName === tool.name,
        );

        if (replacement) {
          console.log(`Replacing description for tool: ${tool.name}`);
          return {
            ...tool,
            description: replacement.toolDescription,
          };
        }

        return tool;
      }),
    };

    return {
      response: "continue",
      body: modifiedResponse,
    };
  }
}

export default CustomDescriptionHook;
