/**
 * Server types
 *
 * Common types used across server modules
 */

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  /** Authentication headers from the request */
  authHeaders: Record<string, string>;
  /** Session ID for the request */
  sessionId: string;
}
