# Audit Hook Server

A lightweight tRPC server that logs all tool call requests through a flexible audit logging system.

## Features

- Modular audit logging system with multiple backends:
  - File logging (writes to `audit.log`)
  - Console logging with color formatting
  - PostgreSQL database logging
- Supports composite logging to multiple destinations simultaneously
- Never blocks requests (allows all to pass through)
- Compatible with the passthrough proxy hook interface
- Includes utilities for querying and exporting audit logs
- Fully written in TypeScript with proper type definitions

## Usage

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Database Setup (for PostgreSQL logging)

The project includes a TypeScript script to set up a PostgreSQL database for audit logging:

```bash
# Set up the audit database using default settings (localhost, postgres/postgres)
pnpm setup-db

# Customize with environment variables if needed
PGHOST=myhost PGUSER=myuser PGPASSWORD=mypassword pnpm setup-db
```

**Important**: The PostgreSQL logger requires the database to be set up first. You **must** run the setup script before using the PostgreSQL logger.

The setup script will:
1. Create a database called `audit_db` (or the name specified in `AUDIT_DB_NAME`)
2. Create an `audit_logs` table with appropriate indexes for efficient querying
3. Generate a `.env.local` file with the connection string

### Run

You can run the server using npm scripts and environment variables. The server uses dotenv to load environment variables from a `.env` file in the project root.

```bash
# Start the server with default file logging
pnpm start

# Development mode with auto-reload
pnpm dev

# Start on a custom port
PORT=33001 pnpm start

# Enable console logging
ENABLE_CONSOLE_LOGGER=true pnpm start

# Enable PostgreSQL logging
POSTGRES_URL=postgres://user:password@localhost:5432/audit_db pnpm start

# Use multiple loggers at once
ENABLE_CONSOLE_LOGGER=true POSTGRES_URL=postgres://user:password@localhost:5432/audit_db pnpm start

# Custom log file location
LOG_FILE=/var/log/audit.log pnpm start
```

### Configuration

Environment variables:
- `PORT`: HTTP port to listen on (default: 33004)
- `LOG_FILE`: Path to the audit log file (default: `./audit.log`)
- `POSTGRES_URL`: PostgreSQL connection string (optional)
- `ENABLE_CONSOLE_LOGGER`: Enable console logging (default: false)

## Using with Passthrough Server

To use this hook with the passthrough server:

```bash
# Start the audit hook
cd packages/audit-hook
pnpm dev

# In another terminal, start passthrough with this hook
cd packages/passthrough-mcp-server
export HOOKS="http://localhost:33004"
pnpm start

# Or use multiple hooks
export HOOKS="http://localhost:33004,http://localhost:33005"
pnpm start
```

## Working with Audit Logs

The project includes utilities for querying and exporting audit logs from the PostgreSQL database.

### Querying Logs

```bash
# Basic query (shows the most recent 20 logs)
pnpm query-logs

# Filter by tool
pnpm query-logs --tool request

# Filter by session ID
pnpm query-logs --session abc123

# Filter by time range
pnpm query-logs --time "2 hours"

# Show arguments and metadata
pnpm query-logs --show-args --show-meta

# Pagination with limit and offset
pnpm query-logs --limit 50 --offset 100

# View all options
pnpm query-logs --help
```

### Exporting Logs

Export logs to various formats for analysis or integration with other tools:

```bash
# Export as JSON (default)
pnpm export-logs

# Export as CSV
pnpm export-logs --format csv

# Export as newline-delimited JSON (for large datasets)
pnpm export-logs --format ndjson

# Apply filters
pnpm export-logs --tool request --time "1 day"

# Set export location
pnpm export-logs --output-dir ./analysis/exports

# Limit number of records
pnpm export-logs --limit 5000

# Pretty-print JSON output
pnpm export-logs --pretty

# View all options
pnpm export-logs --help
```

Exports are saved to the `./exports` directory by default with timestamps in the filenames.

## Extending with Custom Loggers

You can create your own audit loggers by implementing the `AuditLogger` interface:

```typescript
import { AuditLogger, AuditEntry } from "./audit/types.js";

export class MyCustomLogger implements AuditLogger {
  async log(entry: AuditEntry): Promise<void> {
    // Implement your custom logging logic here
    // For example, send to a logging service, store in another database, etc.
  }
}
```

Then add it to the composite logger in `index.ts`:

```typescript
import { MyCustomLogger } from "./audit/my-custom-logger.js";

// Add your custom logger
compositeLogger.addLogger(new MyCustomLogger());
```

### Audit Entry Structure

Each audit entry contains:

- `timestamp`: ISO timestamp of when the tool call was made
- `sessionId`: Unique identifier for the client session
- `tool`: Name of the tool being called
- `arguments`: Arguments passed to the tool
- `response`: The response data (for response auditing)
- `metadata`: Additional context about the tool call

This structured format makes it easy to analyze and search audit logs.