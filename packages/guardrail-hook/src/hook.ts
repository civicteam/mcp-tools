/**
 * Guardrail Hook Implementation
 *
 * Implements the Hook interface for request validation and guardrails
 */

import type { Hook, HookResponse, ToolCall } from "@civic/hook-common";

export class GuardrailHook implements Hook {
  // Example: Domain allowlist for fetch-docs MCP server
  // This is specific to fetch-docs and demonstrates how to restrict URL fetching
  // You can customize or remove this based on your MCP server's needs
  private allowedDomains: string[] = [
    "example.com",
    "github.com",
    "raw.githubusercontent.com",
  ];

  /**
   * Process an incoming tool call request
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    const { name, arguments: toolArgs } = toolCall;

    // Check for disallowed tools or operations
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

    // Check for sensitive data in arguments (simple example)
    const argsStr = JSON.stringify(toolArgs).toLowerCase();
    if (
      argsStr.includes("password") ||
      argsStr.includes("secret") ||
      argsStr.includes("token")
    ) {
      return {
        response: "abort",
        body: `Tool call to '${name}' was blocked by guardrails: sensitive data detected in arguments`,
        reason: "Sensitive data detected",
      };
    }

    // Example: Domain validation for fetch-docs MCP server
    // This demonstrates how to restrict which domains the fetch-docs tool can access
    // Customize this logic based on your specific MCP server's requirements
    if (
      name.toLowerCase().includes("fetch") ||
      name.toLowerCase().includes("http") ||
      name.toLowerCase().includes("request")
    ) {
      // Validate URLs are from allowed domains (fetch-docs specific example)
      if (
        typeof toolArgs === "object" &&
        toolArgs !== null &&
        "url" in toolArgs &&
        typeof toolArgs.url === "string"
      ) {
        try {
          const url = new URL(toolArgs.url);

          if (
            !this.allowedDomains.some((domain) => url.hostname.endsWith(domain))
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
