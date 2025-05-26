/**
 * Console Audit Logger Module
 *
 * Implements the AuditLogger interface for logging audit entries to the console.
 */

import type { AuditEntry, AuditLogger } from "./types.js";

/**
 * Console-based implementation of AuditLogger
 */
export class ConsoleAuditLogger implements AuditLogger {
  constructor(
    private options: {
      verbose?: boolean; // Show full details including arguments and metadata
      useColors?: boolean; // Use colors in console output
    } = {},
  ) {
    this.options.verbose = options.verbose ?? false;
    this.options.useColors = options.useColors ?? true;
  }

  async log(entry: AuditEntry): Promise<void> {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const sessionInfo = this.formatSessionId(entry.sessionId);
    const toolName = this.formatToolName(entry.tool);

    // Basic log line
    console.log(`${timestamp} ${sessionInfo} Tool call: ${toolName}`);

    // If verbose, show arguments and metadata
    if (this.options.verbose) {
      console.log(`  Arguments: ${JSON.stringify(entry.arguments, null, 2)}`);

      if (entry.metadata) {
        console.log(`  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`);
      }

      console.log(); // Empty line for better readability
    }
  }

  /**
   * Format timestamp with optional colors
   */
  private formatTimestamp(timestamp: string): string {
    const ts = new Date(timestamp).toLocaleTimeString();
    return this.options.useColors
      ? `\x1b[90m[${ts}]\x1b[0m` // Gray
      : `[${ts}]`;
  }

  /**
   * Format session ID with optional colors
   */
  private formatSessionId(sessionId: string): string {
    return this.options.useColors
      ? `\x1b[36m(${sessionId})\x1b[0m` // Cyan
      : `(${sessionId})`;
  }

  /**
   * Format tool name with optional colors
   */
  private formatToolName(tool: string): string {
    return this.options.useColors
      ? `\x1b[33m${tool}\x1b[0m` // Yellow
      : tool;
  }
}
