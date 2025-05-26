# Passthrough MCP Server

A Model Context Protocol (MCP) server that passes all requests through to another MCP server with support for tRPC-based hook middleware for validating and modifying tool calls.

## Features

- Acts as a proxy server between MCP clients and another MCP server
- Configurable to connect to different backend MCP servers
- Supports various transport methods for MCP (HTTP SSE, HTTP Stream, Stdio)
- tRPC-based hook system for request/response interception and modification
- Comprehensive test coverage with modular, testable architecture

## Usage

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Test

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Run

```bash
# Start the server with default HTTP Stream transport
pnpm start

# Start with stdio transport
pnpm start:stdio

# Development mode with auto-reload
pnpm dev
```

### Configuration

The server can be configured through environment variables:

- `PORT`: HTTP port to listen on (default: 34000)
- `TARGET_SERVER_URL`: URL of the target MCP server to connect to
- `TARGET_SERVER_TRANSPORT`: Transport type for connecting to the target server (httpStream, sse)
- `HOOKS`: Comma-separated list of tRPC hook server URLs for middleware processing

#### Hook Middleware

You can specify multiple tRPC hook servers as middleware to process tool calls before they reach the target server:

```bash
# Single hook
HOOKS=http://localhost:33004 pnpm start

# Multiple hooks
HOOKS=http://localhost:33004,http://localhost:33005 pnpm start
```

Hook servers are processed in sequence, forming a middleware chain:
- **Requests**: Processed in order (first to last)
- **Responses**: Processed in reverse order (last to first)

Each hook can:
1. Allow the tool call to proceed (potentially with modifications)
2. Reject the tool call, preventing it from reaching the target server

This is useful for implementing validation, security checks, audit logging, or transformations.

## Implementation

This server uses:
- **fastMCP**: For the MCP server implementation
- **@modelcontextprotocol/sdk**: For the MCP client to connect to target servers
- **tRPC**: For communication with hook servers

### Architecture

The codebase is organized into small, focused modules with single responsibilities:

- **hooks/manager.ts** - Manages hook client instances and caching
- **hooks/processor.ts** - Processes tool calls through hook chains
- **server/passthrough.ts** - Main passthrough handler orchestration
- **utils/session.ts** - Session management and client connections
- **utils/config.ts** - Configuration parsing and validation

Each module has accompanying unit tests located alongside the source files for easy maintenance and testing.

## Creating Custom Hooks

To create a custom tRPC hook:

1. Install `hook-common` as a dependency
2. Implement the `Hook` interface from `hook-common/types`
3. Create a tRPC server using `createHTTPServer` and `createHookRouter`
4. Start the server on a specific port
5. Add the hook URL to the `HOOKS` environment variable

See the audit-hook and guardrail-hook packages for examples.

## Example Setup

```bash
# Terminal 1: Start a target MCP server (e.g., sample-mcp-server)
cd ../sample-mcp-server
pnpm start

# Terminal 2: Start hook servers
cd ../audit-hook
pnpm start  # Port 33004

# Terminal 3: Start another hook
cd ../guardrail-hook
pnpm start  # Port 33005

# Terminal 4: Start passthrough with hooks
cd ../passthrough-mcp-server
export TARGET_SERVER_URL=http://localhost:3000
export HOOKS=http://localhost:33004,http://localhost:33005
pnpm start
```

Now clients can connect to the passthrough server on port 34000, and all requests will be:
1. Logged by the audit hook
2. Validated by the guardrail hook
3. Forwarded to the target server