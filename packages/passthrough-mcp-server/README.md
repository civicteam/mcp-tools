# Passthrough MCP Server

A Model Context Protocol (MCP) server that passes all requests through to another MCP server with support for tRPC-based hook middleware for validating and modifying tool calls.

## Features

- Acts as a proxy server between MCP clients and another MCP server
- Configurable to connect to different backend MCP servers
- Supports various transport methods for MCP (HTTP SSE, HTTP Stream, Stdio)
- tRPC-based hook system for request/response interception and modification
- **MCP Authorization spec compliant**: Properly handles authentication and authorization
- **401 passthrough**: For httpStream and SSE transports, passes through 401 responses from target servers
- **Non-MCP request proxying**: Routes non-MCP requests directly to the target server
- **Authorization header forwarding**: Passes authorization headers from incoming requests to the target server
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
- `MCP_ENDPOINT`: Custom endpoint for MCP requests (default: /mcp)

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

### Authorization Support

The passthrough server is fully compliant with the MCP authorization specification:

#### 401 Passthrough
For `httpStream` and `sse` transports, the server checks if the target MCP server returns a 401 response. If it does, the 401 response is passed through directly to the client, allowing proper authentication flows.

#### Request Routing
- **MCP requests** (on `/mcp` endpoint): Handled by the MCP protocol handler
- **Non-MCP requests** (all other paths): Proxied directly to the target server

This allows the passthrough server to work seamlessly with MCP servers that implement OAuth or other authentication mechanisms.

#### Authorization Header Forwarding
Any authorization headers present in incoming requests are automatically forwarded to the target server, ensuring that authentication credentials are properly passed through the proxy chain.

## Programmatic Usage

The passthrough MCP server can be used programmatically in your Node.js applications, allowing you to embed a passthrough proxy within your own systems.

### Installation for Library Use

```bash
npm install @civic/passthrough-mcp-server
```

### Basic Programmatic Usage

```typescript
import { createPassthroughProxy } from '@civic/passthrough-mcp-server';

// Create and start the proxy
const proxy = await createPassthroughProxy({
  transportType: "httpStream",
  port: 34000,
  target: {
    url: "http://localhost:33000",
    transportType: "httpStream"
  },
  serverInfo: {
    name: "my-passthrough-server",
    version: "1.0.0"
  }
});

// Later, stop the proxy
await proxy.stop();
```

### Advanced Programmatic Features

#### Manual Start

```typescript
const proxy = await createPassthroughProxy({
  transportType: "httpStream",
  port: 34000,
  target: {
    url: "http://localhost:33000",
    transportType: "httpStream"
  },
  autoStart: false
});

// Perform additional setup...

// Start when ready
await proxy.start();
```

#### Custom Client Factory

You can provide a custom client factory to control how connections to the target server are created:

```typescript
import type { ClientFactory, PassthroughClient } from '@civic/passthrough-mcp-server';

const customClientFactory: ClientFactory = // your factory implementation here;

const proxy = await createPassthroughProxy({
  transportType: "httpStream",
  port: 34000,
  target: {
    url: "http://localhost:33000",
    transportType: "httpStream"
  },
  clientFactory: customClientFactory
});
```

#### With Hooks in Code

Configure hooks programmatically:

```typescript
const proxy = await createPassthroughProxy({
  transportType: "httpStream",
  port: 34000,
  target: {
    url: "http://localhost:33000",
    transportType: "httpStream"
  },
  hooks: [
    {
      url: "http://localhost:8080/trpc",
      name: "audit-hook"
    },
    {
      url: "http://localhost:8081/trpc",
      name: "security-hook"
    }
  ]
});
```

### API Reference

#### `createPassthroughProxy(options)`

Creates and optionally starts a passthrough MCP proxy server.

**Parameters:**
- `options.transportType` (required): Transport type for the server ("httpStream", "sse", "stdio")
- `options.port` (required for non-stdio transports): Port number for the server
- `options.target` (required): Target server configuration
  - `url`: URL of the target MCP server
  - `transportType`: Transport type ("httpStream", "sse")
- `options.serverInfo` (optional): Server metadata
  - `name`: Server name
  - `version`: Server version
- `options.clientInfo` (optional): Client metadata
- `options.hooks` (optional): Array of hook configurations
  - `url`: Hook endpoint URL
  - `name`: Hook name
- `options.clientFactory` (optional): Custom factory for creating target clients
- `options.autoStart` (optional): Whether to start the server immediately (default: true)

**Returns:**
A `PassthroughProxy` object with:
- `server`: The underlying HTTP server instance
- `start()`: Method to start the server (if not auto-started)
- `stop()`: Method to stop the server

### Loading Configuration from Environment

When using programmatically, you can still leverage environment variables:

```typescript
import { loadConfig, createPassthroughProxy } from '@civic/passthrough-mcp-server';

// Load configuration from environment
const config = loadConfig();

// Create proxy with environment-based config
const proxy = await createPassthroughProxy({
  ...config
});
```

### Type Exports

The package exports several TypeScript types for better type safety:

```typescript
import type {
  ClientConfig,
  ClientFactory,
  PassthroughClient,
  PassthroughProxy,
  PassthroughProxyOptions
} from '@civic/passthrough-mcp-server';
```

## Hook API

The passthrough server provides a comprehensive API for applying hooks to requests and responses, making it easy to integrate hook functionality into other services like the MCP Hub.

### Key Features

- **Unified `applyHooks` function**: Single entry point for processing both request and response hooks
- **Hook creation utilities**: `createHookClient` and `createHookClients` for easy hook instantiation
- **Type exports**: All necessary types from `@civic/hook-common` are re-exported for convenience
- **AbstractHook base class**: Simplifies creating custom local hooks

### Hook-Related Exports

- `applyHooks` - Main function for applying hooks to data
- `createHookClient`, `createHookClients` - Utilities for creating hook instances
- `AbstractHook` - Base class for implementing custom hooks
- Types: `Hook`, `HookClient`, `HookResponse`, `ToolCall`, `HookType`, `HookResult`, `HookContext`

### Examples

For a complete example of using the hook API, see:
- `examples/hook-api-example.ts` - Hook API usage patterns and implementation

See the `examples/` directory for additional working examples of programmatic usage.

## Implementation

This server uses:
- **@modelcontextprotocol/sdk**: Direct MCP SDK usage for both server and client implementation
- **tRPC**: For communication with hook servers
- **Custom HTTP proxy**: For routing and authorization compliance

### Architecture

The codebase is organized into small, focused modules with single responsibilities:

- **hooks/manager.ts** - Manages hook client instances and caching
- **hooks/processor.ts** - Processes tool calls through hook chains
- **server/authProxy.ts** - HTTP proxy server for routing MCP and non-MCP requests
- **server/mcpHandler.ts** - MCP protocol handler with 401 passthrough support
- **server/mcpServerAuth.ts** - Creates MCP servers with authorization context
- **server/toolHandler.ts** - Handles individual tool calls with hook processing
- **utils/session.ts** - Session management and client connections with auth support
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