/**
 * Guardrail Hook Implementation
 *
 * Implements the Hook interface for request validation and guardrails
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";
import { z } from "zod";

/**
 * Configuration schema for GuardrailHook
 */
export const configSchema = z.object({
  allowedDomains: z
    .array(z.string())
    .describe("List of allowed domains for URL-based tools (e.g., github.com)")
    .optional(),
  blockedTools: z
    .array(z.string())
    .describe("List of tool names to block completely")
    .optional(),
  sensitivePatterns: z
    .array(z.string())
    .describe("Patterns to detect sensitive data in tool arguments")
    .default(["password", "secret", "token"]),
  enableDestructiveOperationCheck: z
    .boolean()
    .describe("Block tools with 'delete' or 'remove' in their names")
    .default(true),
});

export type GuardrailConfig = z.infer<typeof configSchema>;

class GuardrailHook extends AbstractHook<GuardrailConfig> {
  private config: GuardrailConfig | null = null;

  // Default configuration
  private defaultConfig: GuardrailConfig = {
    allowedDomains: ["example.com", "github.com", "raw.githubusercontent.com"],
    blockedTools: [],
    sensitivePatterns: ["password", "secret", "token"],
    enableDestructiveOperationCheck: true,
  };

  /**
   * The name of this hook
   */
  get name(): string {
    return "GuardrailHook";
  }

  /**
   * Configure the hook with guardrail settings
   */
  configure(config: GuardrailConfig | null): void {
    this.config = config;
    if (config) {
      console.log("GuardrailHook: Configured with custom settings");
    } else {
      console.log("GuardrailHook: Using default configuration");
    }
  }

  private getConfig(): GuardrailConfig {
    return this.config || this.defaultConfig;
  }

  /**
   * Process an incoming tool call request
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    const { name, arguments: toolArgs } = toolCall;
    const config = this.getConfig();

    // Check for explicitly blocked tools
    if (config.blockedTools?.includes(name)) {
      return {
        response: "abort",
        body: `Tool call to '${name}' was blocked by guardrails: tool is in blocklist`,
        reason: "Tool is explicitly blocked",
      };
    }

    // Check for destructive operations if enabled
    if (config.enableDestructiveOperationCheck) {
      if (
        name.toLowerCase().includes("delete") ||
        name.toLowerCase().includes("remove")
      ) {
        return {
          response: "abort",
          body: `Tool call to '${name}' was blocked by guardrails: destructive operations are not allowed`,
          reason: "Destructive operation detected",
        };
      }
    }

    // Check for sensitive data in arguments
    const argsStr = JSON.stringify(toolArgs).toLowerCase();
    const sensitivePatterns = config.sensitivePatterns || [];
    for (const pattern of sensitivePatterns) {
      if (argsStr.includes(pattern.toLowerCase())) {
        return {
          response: "abort",
          body: `Tool call to '${name}' was blocked by guardrails: sensitive data detected in arguments`,
          reason: "Sensitive data detected",
        };
      }
    }

    // Domain validation for URL-based tools
    if (
      config.allowedDomains &&
      config.allowedDomains.length > 0 &&
      (name.toLowerCase().includes("fetch") ||
        name.toLowerCase().includes("http") ||
        name.toLowerCase().includes("request"))
    ) {
      // Validate URLs are from allowed domains
      if (
        typeof toolArgs === "object" &&
        toolArgs !== null &&
        "url" in toolArgs &&
        typeof toolArgs.url === "string"
      ) {
        try {
          const url = new URL(toolArgs.url);

          if (
            !config.allowedDomains.some((domain) =>
              url.hostname.endsWith(domain),
            )
          ) {
            return {
              response: "abort",
              body: `Tool call to '${name}' was blocked by guardrails: URL domain '${url.hostname}' is not in the allowed domains list`,
              reason: "Disallowed URL domain",
            };
          }
        } catch (error) {
          return {
            response: "abort",
            body: `Tool call to '${name}' was blocked by guardrails: invalid URL provided`,
            reason: "Invalid URL",
          };
        }
      }
    }

    // In a real implementation, you would have more sophisticated validation
    // such as checking for:
    // - Command injection
    // - Path traversal
    // - Authentication and authorization
    // - Rate limiting
    // - Data validation

    // Return the tool call without modification
    return {
      response: "continue",
      body: toolCall,
    };
  }

  /**
   * Process a tool call response
   */
  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    const { name } = originalToolCall;

    // Convert response to string for analysis if it's an object
    const responseStr =
      typeof response === "object"
        ? JSON.stringify(response)
        : String(response);

    // Check for sensitive data in the response
    const sensitivePatterns = [
      /password\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /secret\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /token\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /private_key\s*[:=]\s*["']?[^"'\s]+["']?/i,
      /api[-_]?key\s*[:=]\s*["']?[^"'\s]+["']?/i,
    ];

    // Check if any sensitive patterns are found
    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseStr)) {
        return {
          response: "abort",
          body: `Response from tool '${name}' was blocked by guardrails: sensitive data detected in response`,
          reason: "Sensitive data in response",
        };
      }
    }

    // Check if response is too large (example: over 1MB)
    if (responseStr.length > 1048576) {
      // 1MB
      return {
        response: "continue",
        body: `Response from '${name}' was truncated: response size exceeded 1MB limit`,
        reason: "Response too large",
      };
    }

    // For Image/File responses, you might want to validate content types or sizes
    if (typeof response === "object" && response && "content" in response) {
      const content = Array.isArray(response.content) ? response.content : [];

      // Check for image or file content
      for (const item of content) {
        if (
          typeof item === "object" &&
          item &&
          (item.type === "image" || item.type === "file")
        ) {
          console.log(
            `Validated ${item.type} content in response from '${name}'`,
          );
          // Here you might do additional validation based on the content type
        }
      }
    }

    // Return response without modification
    return {
      response: "continue",
      body: response,
    };
  }
}

export default GuardrailHook;
