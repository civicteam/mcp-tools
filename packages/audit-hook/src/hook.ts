/**
 * Audit Hook Implementation
 *
 * Implements the Hook interface for audit logging
 */

import type {
  Hook,
  HookResponse,
  ToolCall,
} from "@civicteam/hook-common/types";
import type { AuditEntry, AuditLogger } from "./audit/types.js";

export class AuditHook implements Hook {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Process an incoming tool call request
   */
  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    const sessionId = toolCall.metadata?.sessionId || "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: toolCall.name,
      arguments:
        typeof toolCall.arguments === "object" && toolCall.arguments !== null
          ? (toolCall.arguments as Record<string, unknown>)
          : { value: toolCall.arguments },
      metadata: {
        source: "request",
        transportType: "tRPC",
        ...toolCall.metadata,
      },
    };

    // Log using the audit logger
    await this.auditLogger.log(auditEntry);

    // Always allow the request to proceed without modification
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
    const sessionId = originalToolCall.metadata?.sessionId || "unknown";

    // Create and log audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool: originalToolCall.name,
      arguments: {}, // No arguments for response
      response, // Include the full response data in dedicated field
      metadata: {
        source: "response",
        responseType: typeof response,
        hasResponse: response !== undefined,
        responseSize:
          typeof response === "object"
            ? JSON.stringify(response).length
            : String(response).length,
        transportType: "tRPC",
      },
    };

    // Log using the audit logger
    await this.auditLogger.log(auditEntry);

    // Always allow the response to proceed without modification
    return {
      response: "continue",
      body: response,
    };
  }
}
