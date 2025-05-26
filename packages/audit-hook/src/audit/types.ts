/**
 * Audit Types Module
 *
 * Defines the core types for the audit system.
 */

/**
 * Audit entry containing information about a tool call
 */
export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  tool: string;
  arguments: Record<string, unknown>;
  response?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logger interface for recording tool calls
 */
export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}
