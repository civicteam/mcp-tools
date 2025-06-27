/**
 * Audit Hook Implementation
 *
 * Implements the Hook interface for audit logging
 */

import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";
import { z } from "zod";
import { CompositeAuditLogger } from "./audit/composite-logger.js";
import { ConsoleAuditLogger } from "./audit/console-logger.js";
import { FileAuditLogger } from "./audit/file-logger.js";
import type { AuditEntry, AuditLogger } from "./audit/types.js";

/**
 * Configuration schema for AuditHook
 * Note: Custom loggers must be configured programmatically, not through CLI
 */
export const configSchema = z.object({
  loggers: z
    .array(z.enum(["console", "file"]))
    .describe("Types of loggers to enable (console, file)")
    .default(["console"]),
  fileLogPath: z
    .string()
    .describe("Path to the audit log file (when file logger is enabled)")
    .default("./audit.log"),
});

// Base config from schema (for CLI configuration)
export type AuditHookConfigBase = z.infer<typeof configSchema>;

// Extended config with programmatic options
export type AuditHookConfig = Omit<AuditHookConfigBase, "loggers"> & {
  loggers?: Array<"console" | "file" | { custom: AuditLogger }>;
};

class AuditHook extends AbstractHook<AuditHookConfig> {
  private auditLogger: AuditLogger;

  constructor() {
    super();
    // Default to console logger
    this.auditLogger = new ConsoleAuditLogger();
  }

  /**
   * The name of this hook
   */
  get name(): string {
    return "AuditHook";
  }

  /**
   * Configure the hook with audit settings
   */
  configure(config: AuditHookConfig | null): void {
    if (!config || !config.loggers || config.loggers.length === 0) {
      // Use default console logger
      this.auditLogger = new ConsoleAuditLogger();
      console.log("AuditHook: Using default console logger");
      return;
    }

    const loggers: AuditLogger[] = [];

    for (const loggerConfig of config.loggers) {
      if (loggerConfig === "console") {
        loggers.push(new ConsoleAuditLogger());
      } else if (loggerConfig === "file") {
        loggers.push(new FileAuditLogger(config.fileLogPath || "./audit.log"));
      } else if (typeof loggerConfig === "object" && "custom" in loggerConfig) {
        loggers.push(loggerConfig.custom);
      }
    }

    this.auditLogger =
      loggers.length === 1 ? loggers[0] : new CompositeAuditLogger(loggers);
    console.log(`AuditHook: Configured with ${loggers.length} logger(s)`);
  }

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

export default AuditHook;
