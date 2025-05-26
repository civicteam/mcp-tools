/**
 * Audit Hook tRPC Server
 *
 * A lightweight tRPC server that logs all tool call requests to an audit log
 * and allows them to proceed without modification.
 *
 * Uses a pluggable audit logging system that can be extended with custom implementations.
 */

import * as path from "node:path";
import * as process from "node:process";
import dotenv from "dotenv";
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createHookRouter } from '@civicteam/hook-common/router';
import { AuditHook } from './hook.js';
import {
  type AuditLogger,
  CompositeAuditLogger,
  ConsoleAuditLogger,
  FileAuditLogger,
  PostgresAuditLogger,
} from "./audit/index.js";

// Load environment variables from .env file if it exists
dotenv.config();

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33004;
const LOG_FILE = process.env.LOG_FILE || path.join(process.cwd(), "audit.log");
const POSTGRES_URL = process.env.POSTGRES_URL;
const ENABLE_CONSOLE_LOGGER = process.env.ENABLE_CONSOLE_LOGGER === "true";

// Create the composite audit logger
const compositeLogger = new CompositeAuditLogger();

// Always add file logger by default
compositeLogger.addLogger(new FileAuditLogger(LOG_FILE));

// Add console logger if enabled
if (ENABLE_CONSOLE_LOGGER) {
  compositeLogger.addLogger(
    new ConsoleAuditLogger({
      verbose: process.env.NODE_ENV !== "production",
      useColors: true,
    }),
  );
}

// Add Postgres logger if connection string is provided
if (POSTGRES_URL) {
  compositeLogger.addLogger(
    new PostgresAuditLogger({
      connectionConfig: {
        connectionString: POSTGRES_URL,
      },
      // Use batching in production
      batchInserts: process.env.NODE_ENV === "production",
      batchSize: 20,
    }),
  );
}

// Use the composite logger for all auditing
const auditLogger: AuditLogger = compositeLogger;

// Create the audit hook
const auditHook = new AuditHook(auditLogger);

// Create the tRPC router
const router = createHookRouter(auditHook);

// Create and start the server
const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Audit Hook tRPC Server running on port ${PORT}`);

// Log which loggers are active
console.log("Active audit loggers:");
console.log(`- FileAuditLogger (writing to ${LOG_FILE})`);

if (ENABLE_CONSOLE_LOGGER) {
  console.log(
    `- ConsoleAuditLogger (verbose: ${process.env.NODE_ENV !== "production"})`,
  );
}

if (POSTGRES_URL) {
  console.log("- PostgresAuditLogger (connected to database)");
}

console.log("\nReady to audit tool calls!");