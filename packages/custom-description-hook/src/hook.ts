/**
 * Custom Description Hook Implementation
 *
 * Replaces tool descriptions based on configuration
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
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

interface Config {
  toolDescriptions: ToolDescription[];
}

export class CustomDescriptionHook extends AbstractHook {
  private config: Config | null = null;

  /**
   * The name of this hook
   */
  get name(): string {
    return "CustomDescriptionHook";
  }

  async loadConfig(): Promise<void> {
    if (this.config) return; // Already loaded

    let configContent: string;

    // Check for --config argument
    const configArgIndex = process.argv.indexOf("--config");
    const configFile =
      configArgIndex !== -1
        ? process.argv[configArgIndex + 1]
        : "./config.json";

    // Check if stdin has data
    if (!process.stdin.isTTY && process.stdin.readable) {
      configContent = "";
      for await (const chunk of process.stdin) {
        configContent += chunk;
      }
    } else {
      // Read from file
      const configPath = resolve(configFile);
      configContent = await readFile(configPath, "utf-8");
    }

    this.config = JSON.parse(configContent) as Config;
    console.log(
      `Loaded ${this.config.toolDescriptions.length} tool description replacements`,
    );
  }

  /**
   * Process a tools/list response to replace tool descriptions
   */
  async processToolsListResponse(
    response: ListToolsResult,
    _originalRequest: ToolsListRequest,
  ): Promise<HookResponse> {
    // Load config if not already loaded
    await this.loadConfig();

    if (!this.config) {
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
