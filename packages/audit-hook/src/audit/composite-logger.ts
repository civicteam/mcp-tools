/**
 * Composite Audit Logger Module
 *
 * Implements the AuditLogger interface by combining multiple loggers.
 * This allows logging to multiple destinations simultaneously.
 */

import type { AuditEntry, AuditLogger } from "./types.js";

/**
 * Interface for loggers with close method
 */
interface CloseableLogger extends AuditLogger {
  close(): Promise<void>;
}

/**
 * Composite implementation of AuditLogger that delegates to multiple loggers
 */
export class CompositeAuditLogger implements AuditLogger {
  private loggers: AuditLogger[] = [];

  /**
   * Create a composite logger with the provided loggers
   */
  constructor(loggers: AuditLogger[] = []) {
    this.loggers = loggers;
  }

  /**
   * Add a logger to the composite
   */
  addLogger(logger: AuditLogger): void {
    this.loggers.push(logger);
  }

  /**
   * Remove a logger from the composite
   */
  removeLogger(logger: AuditLogger): void {
    const index = this.loggers.indexOf(logger);
    if (index !== -1) {
      this.loggers.splice(index, 1);
    }
  }

  /**
   * Log an entry to all loggers
   */
  async log(entry: AuditEntry): Promise<void> {
    // Create a copy of the entry to avoid modification by loggers
    const entryCopy = { ...entry };

    // Collect any errors from loggers
    const errors: Error[] = [];

    // Log to all loggers in parallel
    await Promise.all(
      this.loggers.map(async (logger) => {
        try {
          await logger.log(entryCopy);
        } catch (error) {
          errors.push(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }),
    );

    // If any loggers failed, throw a combined error
    if (errors.length > 0) {
      const combinedMessage = `Errors from ${errors.length} loggers: ${errors
        .map((e) => e.message)
        .join(", ")}`;
      throw new Error(combinedMessage);
    }
  }

  /**
   * Close all loggers that support closing
   */
  async close(): Promise<void> {
    await Promise.all(
      this.loggers.map(async (logger) => {
        if ("close" in logger && typeof logger.close === "function") {
          await (logger as CloseableLogger).close();
        }
      }),
    );
  }
}
