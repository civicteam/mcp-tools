/**
 * File Audit Logger Module
 *
 * Implements the AuditLogger interface for writing audit entries to a file.
 */

import * as fs from "node:fs/promises";
import type { AuditEntry, AuditLogger } from "./types.js";

/**
 * File-based implementation of AuditLogger
 */
export class FileAuditLogger implements AuditLogger {
  constructor(private filePath: string) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      const responseClause = `${entry.response ? `, Response: ${JSON.stringify(entry.response)}` : ""}`;
      const argumentsClause = `, Arguments: ${JSON.stringify(entry.arguments)}`;
      const metadataClause = entry.metadata
        ? `, Metadata: ${JSON.stringify(entry.metadata)}`
        : "";
      const logEntry = `[${entry.timestamp}] Session: ${entry.sessionId}, Tool: ${entry.tool}${argumentsClause}${responseClause}${metadataClause}\n`;

      await fs.appendFile(this.filePath, logEntry, { encoding: "utf8" });
    } catch (error) {
      console.error(`Failed to write to audit log: ${error}`);
    }
  }
}
