#!/usr/bin/env node

/**
 * Export Audit Logs Script
 *
 * This script exports audit logs from the PostgreSQL database to various formats
 * for analysis or integration with other tools.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import pg from "pg";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration interface
interface ExportOptions {
  connectionString: string;
  outputDir: string;
  format: "json" | "csv" | "ndjson";
  toolFilter: string | null;
  sessionFilter: string | null;
  timeFilter: string;
  limit: number;
  pretty: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ExportOptions = {
  connectionString: "postgres://postgres:postgres@localhost:5432/audit_db",
  outputDir: path.join(process.cwd(), "exports"),
  format: "json", // 'json', 'csv', or 'ndjson'
  toolFilter: null,
  sessionFilter: null,
  timeFilter: "1 week",
  limit: 1000,
  pretty: false, // For JSON output
};

/**
 * Load environment variables from .env.local if available
 */
async function loadEnv(): Promise<void> {
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
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
function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output-dir" && i + 1 < args.length) {
      options.outputDir = args[++i];
    } else if (arg === "--format" && i + 1 < args.length) {
      const format = args[++i].toLowerCase();
      if (["json", "csv", "ndjson"].includes(format)) {
        options.format = format as "json" | "csv" | "ndjson";
      } else {
        console.warn(
          `Unknown format: ${format}. Using default: ${options.format}`,
        );
      }
    } else if (arg === "--tool" && i + 1 < args.length) {
      options.toolFilter = args[++i];
    } else if (arg === "--session" && i + 1 < args.length) {
      options.sessionFilter = args[++i];
    } else if (arg === "--time" && i + 1 < args.length) {
      options.timeFilter = args[++i];
    } else if (arg === "--limit" && i + 1 < args.length) {
      options.limit = Number.parseInt(args[++i], 10);
    } else if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg === "--help") {
      showHelp();
      process.exit(0);
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Export Audit Logs Script

Usage: pnpm export-logs [options]

Options:
  --output-dir DIR    Directory to save exported files (default: ./exports)
  --format FORMAT     Output format: json, csv, or ndjson (default: json)
  --tool NAME         Filter by tool name
  --session ID        Filter by session ID
  --time INTERVAL     Filter by time interval (e.g., "1 hour", "1 day", "1 week")
  --limit N           Maximum number of records to export (default: 1000)
  --pretty            Use pretty formatting for JSON output
  --help              Show this help message

Examples:
  pnpm export-logs --format csv
  pnpm export-logs --tool request --time "2 days" --format json --pretty
  pnpm export-logs --session abc123 --output-dir ./my-exports
  `);
}

/**
 * Get the WHERE clause based on filters
 */
function getWhereClause(options: ExportOptions): {
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

// Define a type for audit log rows
interface LogRow {
  id: number;
  timestamp: string;
  session_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Export logs to a JSON file
 */
async function exportToJson(
  rows: LogRow[],
  filePath: string,
  pretty = false,
): Promise<string> {
  const jsonContent = pretty
    ? JSON.stringify(rows, null, 2)
    : JSON.stringify(rows);

  await fs.writeFile(filePath, jsonContent, "utf8");
  return filePath;
}

/**
 * Export logs to a CSV file
 */
async function exportToCsv(rows: LogRow[], filePath: string): Promise<string> {
  if (rows.length === 0) {
    await fs.writeFile(filePath, "", "utf8");
    return filePath;
  }

  // Get header from first row
  const headers = Object.keys(rows[0]);

  // Convert each row to CSV
  const csvRows = [
    // Header row
    headers.join(","),
    // Data rows
    ...rows.map((row) => {
      return headers
        .map((field) => {
          const value = row[field as keyof LogRow];

          // Format objects as JSON strings
          if (typeof value === "object" && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }

          // Handle strings with commas or quotes
          if (typeof value === "string") {
            return `"${value.replace(/"/g, '""')}"`;
          }

          return value;
        })
        .join(",");
    }),
  ].join("\n");

  await fs.writeFile(filePath, csvRows, "utf8");
  return filePath;
}

/**
 * Export logs to a newline-delimited JSON file
 */
async function exportToNdjson(
  rows: LogRow[],
  filePath: string,
): Promise<string> {
  const ndjsonContent = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, ndjsonContent, "utf8");
  return filePath;
}

/**
 * Export the audit logs
 */
async function exportLogs(options: ExportOptions): Promise<void> {
  // Use connection string from .env.local if present
  const connectionString = process.env.POSTGRES_URL || options.connectionString;

  const client = new pg.Client({ connectionString });

  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(options.outputDir, { recursive: true });

    await client.connect();
    console.log(
      `Connected to database at ${connectionString.replace(/:[^:]+@/, ":****@")}`,
    );

    const { whereClause, params } = getWhereClause(options);

    // Build the query
    const query = `
      SELECT id, timestamp, session_id, tool, arguments, metadata, created_at
      FROM public.audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${params.length + 1}
    `;

    // Add limit parameter
    params.push(options.limit);

    // Execute the query
    const result = await client.query(query, params);
    const rows = result.rows as LogRow[];

    console.log(`Found ${rows.length} audit log entries.`);

    if (rows.length === 0) {
      console.log("No logs to export.");
      return;
    }

    // Generate timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const toolPart = options.toolFilter ? `-${options.toolFilter}` : "";
    const sessionPart = options.sessionFilter
      ? `-${options.sessionFilter}`
      : "";
    const filename = `audit-logs-${timestamp}${toolPart}${sessionPart}`;

    // Export based on format
    let exportedFilePath: string;

    switch (options.format) {
      case "json":
        exportedFilePath = path.join(options.outputDir, `${filename}.json`);
        await exportToJson(rows, exportedFilePath, options.pretty);
        break;

      case "csv":
        exportedFilePath = path.join(options.outputDir, `${filename}.csv`);
        await exportToCsv(rows, exportedFilePath);
        break;

      case "ndjson":
        exportedFilePath = path.join(options.outputDir, `${filename}.ndjson`);
        await exportToNdjson(rows, exportedFilePath);
        break;

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    console.log(`\nSuccessfully exported ${rows.length} logs to:`);
    console.log(exportedFilePath);

    // If filtering was applied, show info about filters
    if (options.toolFilter || options.sessionFilter || options.timeFilter) {
      console.log("\nFilters applied:");
      if (options.toolFilter) console.log(`- Tool: ${options.toolFilter}`);
      if (options.sessionFilter)
        console.log(`- Session: ${options.sessionFilter}`);
      if (options.timeFilter) console.log(`- Time: ${options.timeFilter}`);
    }

    console.log("\nTo export with different options, try:");
    console.log(`pnpm export-logs --format csv --limit 500 --time "1 day"`);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
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
    await exportLogs(options);
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
}

// Run the main function
main();
