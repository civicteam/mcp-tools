/**
 * PostgreSQL Audit Logger Module
 *
 * Implements the AuditLogger interface for storing audit entries in a PostgreSQL database.
 */

import { Pool, type PoolConfig } from "pg";
import type { AuditEntry, AuditLogger } from "./types.js";

/**
 * Configuration for PostgreSQL connection
 */
export interface PostgresLoggerConfig {
  // Postgres connection options
  connectionConfig: PoolConfig;

  // Table options
  tableName?: string;
  schemaName?: string;

  // Behavior options
  batchInserts?: boolean;
  batchSize?: number;

  // Error handling
  logErrors?: boolean;
}

/**
 * Default configuration for PostgreSQL logger
 */
const DEFAULT_CONFIG: Partial<PostgresLoggerConfig> = {
  tableName: "audit_logs",
  schemaName: "public",
  batchInserts: false,
  batchSize: 10,
  logErrors: true,
};

/**
 * PostgreSQL-based implementation of AuditLogger
 */
export class PostgresAuditLogger implements AuditLogger {
  private pool: Pool;
  private config: Required<PostgresLoggerConfig>;
  private batch: AuditEntry[] = [];
  private initialized = false;

  constructor(config: PostgresLoggerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<PostgresLoggerConfig>;
    this.pool = new Pool(this.config.connectionConfig);
  }

  /**
   * Initialize the connection
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test the connection to make sure the table exists
    try {
      const fullTableName = `${this.config.schemaName}.${this.config.tableName}`;

      // Simple query to test if the table exists
      const testQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        );
      `;

      const result = await this.pool.query(testQuery, [
        this.config.schemaName,
        this.config.tableName,
      ]);

      if (!result.rows[0].exists) {
        throw new Error(
          `Table ${fullTableName} does not exist. Please run the setup-db script first.`,
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error connecting to audit log table:", error);
      throw error;
    }
  }

  /**
   * Log an audit entry to PostgreSQL
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // If batching is enabled, add to batch and check if we should flush
      if (this.config.batchInserts) {
        this.batch.push(entry);

        if (this.batch.length >= this.config.batchSize) {
          await this.flushBatch();
        }

        return;
      }

      // Otherwise, insert directly
      await this.insertEntry(entry);
    } catch (error) {
      if (this.config.logErrors) {
        console.error("Error logging to PostgreSQL:", error);
      }
      throw error;
    }
  }

  /**
   * Insert a single audit entry
   */
  private async insertEntry(entry: AuditEntry): Promise<void> {
    const fullTableName = `${this.config.schemaName}.${this.config.tableName}`;

    const query = `
      INSERT INTO ${fullTableName} 
      (timestamp, session_id, tool, arguments, metadata)
      VALUES ($1, $2, $3, $4, $5);
    `;

    const values = [
      entry.timestamp,
      entry.sessionId,
      entry.tool,
      JSON.stringify(entry.arguments),
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Flush the batch of entries to the database
   */
  private async flushBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const fullTableName = `${this.config.schemaName}.${this.config.tableName}`;

    // Build a multi-value INSERT statement
    const placeholders: string[] = [];
    const values: (string | number | null)[] = [];
    let valueIndex = 1;

    for (const entry of this.batch) {
      placeholders.push(
        `($${valueIndex}, $${valueIndex + 1}, $${valueIndex + 2}, $${valueIndex + 3}, $${valueIndex + 4})`,
      );
      values.push(
        entry.timestamp,
        entry.sessionId,
        entry.tool,
        JSON.stringify(entry.arguments),
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      );
      valueIndex += 5;
    }

    const query = `
      INSERT INTO ${fullTableName} 
      (timestamp, session_id, tool, arguments, metadata)
      VALUES ${placeholders.join(", ")};
    `;

    await this.pool.query(query, values);

    // Clear the batch
    this.batch = [];
  }

  /**
   * Flush any pending entries and close the connection pool
   */
  async close(): Promise<void> {
    try {
      if (this.config.batchInserts && this.batch.length > 0) {
        await this.flushBatch();
      }
    } finally {
      await this.pool.end();
    }
  }
}
