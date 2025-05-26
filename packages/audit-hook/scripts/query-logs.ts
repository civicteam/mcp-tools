#!/usr/bin/env node

/**
 * Query Audit Logs Script
 *
 * This script queries the audit logs from the PostgreSQL database
 * and displays them in a readable format.
 */

import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import pg from "pg";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration interface
interface QueryOptions {
  connectionString: string;
  limit: number;
  offset: number;
  sort: string;
  toolFilter: string | null;
  sessionFilter: string | null;
  timeFilter: string;
  showArguments: boolean;
  showMetadata: boolean;
}

// Default configuration
const DEFAULT_CONFIG: QueryOptions = {
  connectionString: "postgres://postgres:postgres@localhost:5432/audit_db",
  limit: 20,
  offset: 0,
  sort: "timestamp DESC",
  toolFilter: null,
  sessionFilter: null,
  timeFilter: "1 day", // e.g., '1 hour', '1 day', '1 week'
  showArguments: false,
  showMetadata: false,
};

/**
 * Load environment variables from .env.local if available
 */
async function loadEnv(): Promise<void> {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    const envExists = await fs
      .access(envPath)
      .then(() => true)
      .catch(() => false);

    if (envExists) {
      const envContent = await fs.readFile(envPath, "utf8");
      const envConfig = parse(envContent);

      // Add to process.env
      for (const [key, value] of Object.entries(envConfig)) {
        process.env[key] = value as string;
      }

      console.log("Loaded configuration from .env.local");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Error loading .env.local (not critical):", errorMessage);
  }
}

// Parse command line arguments
function parseArgs(): QueryOptions {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--limit" && i + 1 < args.length) {
      options.limit = Number.parseInt(args[++i], 10);
    } else if (arg === "--offset" && i + 1 < args.length) {
      options.offset = Number.parseInt(args[++i], 10);
    } else if (arg === "--sort" && i + 1 < args.length) {
      options.sort = args[++i];
    } else if (arg === "--tool" && i + 1 < args.length) {
      options.toolFilter = args[++i];
    } else if (arg === "--session" && i + 1 < args.length) {
      options.sessionFilter = args[++i];
    } else if (arg === "--time" && i + 1 < args.length) {
      options.timeFilter = args[++i];
    } else if (arg === "--show-args") {
      options.showArguments = true;
    } else if (arg === "--show-meta") {
      options.showMetadata = true;
    } else if (arg === "--show-all") {
      options.showArguments = true;
      options.showMetadata = true;
    } else if (arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Query Audit Logs Script

Usage: pnpm query-logs [options]

Options:
  --limit N          Limit the number of results (default: 20)
  --offset N         Offset for pagination (default: 0)
  --sort FIELD       Sort field and direction (default: "timestamp DESC")
  --tool NAME        Filter by tool name
  --session ID       Filter by session ID
  --time INTERVAL    Filter by time interval (e.g., "1 hour", "1 day", "1 week")
  --show-args        Show arguments in output
  --show-meta        Show metadata in output
  --show-all         Show both arguments and metadata
  --help             Show this help message

Examples:
  pnpm query-logs --limit 10
  pnpm query-logs --tool request --time "12 hours"
  pnpm query-logs --session abc123 --show-all
  `);
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get the WHERE clause based on filters
 */
function getWhereClause(options: QueryOptions): {
  whereClause: string;
  params: (string | number)[];
} {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.toolFilter) {
    conditions.push(`tool = $${params.length + 1}`);
    params.push(options.toolFilter);
  }

  if (options.sessionFilter) {
    conditions.push(`session_id = $${params.length + 1}`);
    params.push(options.sessionFilter);
  }

  if (options.timeFilter) {
    conditions.push(`timestamp > NOW() - INTERVAL '${options.timeFilter}'`);
  }

  return {
    whereClause:
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

interface LogRow {
  id: number;
  timestamp: string;
  session_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Query the audit logs
 */
async function queryLogs(options: QueryOptions): Promise<void> {
  // Use connection string from .env.local if present
  const connectionString = process.env.POSTGRES_URL || options.connectionString;

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log(
      `Connected to database at ${connectionString.replace(/:[^:]+@/, ":****@")}`,
    );

    const { whereClause, params } = getWhereClause(options);

    // Build the query
    const query = `
      SELECT id, timestamp, session_id, tool, arguments, metadata
      FROM public.audit_logs
      ${whereClause}
      ORDER BY ${options.sort}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Add limit and offset parameters
    params.push(options.limit, options.offset);

    // Get the count of total records
    const countQuery = `
      SELECT COUNT(*) as count
      FROM public.audit_logs
      ${whereClause}
    `;

    // Execute the queries
    const [resultSet, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2)), // Exclude limit and offset
    ]);

    const totalCount = Number.parseInt(countResult.rows[0].count, 10);
    const rows = resultSet.rows as LogRow[];

    // Display the results
    console.log(
      `\nFound ${totalCount} audit log entries. Showing ${Math.min(options.limit, rows.length)} entries (offset: ${options.offset}):\n`,
    );

    for (const row of rows) {
      // Format the output
      console.log(
        `[${formatTimestamp(row.timestamp)}] #${row.id} - Session: ${row.session_id}`,
      );
      console.log(`Tool: ${row.tool}`);

      if (options.showArguments) {
        console.log(`Arguments: ${JSON.stringify(row.arguments, null, 2)}`);
      }

      if (options.showMetadata && row.metadata) {
        console.log(`Metadata: ${JSON.stringify(row.metadata, null, 2)}`);
      }

      console.log("---");
    }

    // Pagination info
    if (totalCount > options.limit) {
      const currentPage = Math.floor(options.offset / options.limit) + 1;
      const totalPages = Math.ceil(totalCount / options.limit);
      console.log(`Page ${currentPage} of ${totalPages}`);

      if (options.offset + options.limit < totalCount) {
        console.log("\nTo see the next page, run:");
        console.log(
          `pnpm query-logs --offset ${options.offset + options.limit} --limit ${options.limit}`,
        );
      }
    }

    // If no results, suggest removing filters
    if (
      rows.length === 0 &&
      (options.toolFilter || options.sessionFilter || options.timeFilter)
    ) {
      console.log(
        "No results found with the current filters. Try removing some filters.",
      );
    }
  } catch (error) {
    console.error("Error querying audit logs:", error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    await loadEnv();
    const options = parseArgs();
    await queryLogs(options);
  } catch (error) {
    console.error("Query failed:", error);
    process.exit(1);
  }
}

// Run the main function
main();
