#!/usr/bin/env node

/**
 * PostgreSQL Database Setup Script
 *
 * This script creates a new database and audit_logs table for the audit hook server.
 * It's designed to be run once to set up the initial database structure.
 */

import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration interface
interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string; // Default database to connect to initially
  dbName: string; // Database to create
  tableSchema: string;
  tableName: string;
}

// Default configuration
const DEFAULT_CONFIG: DbConfig = {
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "postgres", // Default database to connect to initially
  dbName: "audit_db", // Database to create
  tableSchema: "public",
  tableName: "audit_logs",
};

// Override defaults with environment variables
const config: DbConfig = {
  ...DEFAULT_CONFIG,
  host: process.env.PGHOST || DEFAULT_CONFIG.host,
  port: process.env.PGPORT
    ? Number.parseInt(process.env.PGPORT, 10)
    : DEFAULT_CONFIG.port,
  user: process.env.PGUSER || DEFAULT_CONFIG.user,
  password: process.env.PGPASSWORD || DEFAULT_CONFIG.password,
  database: process.env.PGDATABASE || DEFAULT_CONFIG.database,
  dbName: process.env.AUDIT_DB_NAME || DEFAULT_CONFIG.dbName,
};

// SQL for creating the database
const createDatabaseSQL = `
CREATE DATABASE ${config.dbName}
  WITH OWNER = ${config.user}
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;
`;

// SQL for creating the audit_logs table
const createTableSQL = `
CREATE TABLE IF NOT EXISTS ${config.tableSchema}.${config.tableName} (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  session_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  arguments JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on timestamp for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON ${config.tableSchema}.${config.tableName}(timestamp);

-- Index on tool for queries filtering by tool name
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool ON ${config.tableSchema}.${config.tableName}(tool);

-- Index on session_id for queries filtering by session
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON ${config.tableSchema}.${config.tableName}(session_id);

-- Comment on table
COMMENT ON TABLE ${config.tableSchema}.${config.tableName} IS 'Audit logs for MCP tool calls';
`;

/**
 * Create the database
 */
async function createDatabase(): Promise<void> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  try {
    await client.connect();
    console.log(`Connected to PostgreSQL on ${config.host}:${config.port}`);

    // Check if database already exists
    const checkResult = await client.query(
      `
      SELECT 1 FROM pg_database WHERE datname = $1
    `,
      [config.dbName],
    );

    if (checkResult.rows.length > 0) {
      console.log(`Database '${config.dbName}' already exists`);
    } else {
      // Create the database
      await client.query(createDatabaseSQL);
      console.log(`Created database '${config.dbName}'`);
    }
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Create the audit_logs table
 */
async function createTable(): Promise<void> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.dbName, // Connect to the new database
  });

  try {
    await client.connect();
    console.log(`Connected to '${config.dbName}' database`);

    // Create the table and indexes
    await client.query(createTableSQL);
    console.log(
      `Created table '${config.tableSchema}.${config.tableName}' with indexes`,
    );

    // Save connection string to .env.local
    const connectionString = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.dbName}`;

    // Create a sample .env file with the connection string
    const envPath = join(__dirname, "..", ".env.local");
    await fs.writeFile(
      envPath,
      `# PostgreSQL connection string for audit logging
POSTGRES_URL=${connectionString}
ENABLE_CONSOLE_LOGGER=true
`,
    );

    console.log("Created .env.local file with connection string");
    console.log("\nTo start the server with PostgreSQL logging:");
    console.log("pnpm start --env-file=.env.local");
    console.log("\nOr set the environment variables manually:");
    console.log(
      `POSTGRES_URL=${connectionString} ENABLE_CONSOLE_LOGGER=true pnpm start`,
    );
  } catch (error) {
    console.error("Error creating table:", error);
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
    console.log("Setting up audit database...");

    // Create the database
    await createDatabase();

    // Create the table structure
    await createTable();

    console.log("\nDatabase setup completed successfully!");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  }
}

// Run the main function
main();
