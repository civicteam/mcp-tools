# Guardrail Hook Server

A tRPC server that provides guardrails for tool calls in the passthrough proxy system.

## Features

- Intercepts and validates tool calls
- Can modify or reject tool calls based on configurable rules
- Blocks destructive operations (delete/remove)
- Detects sensitive data in requests and responses
- Validates URL domains for fetch/HTTP operations
- Limits response size to prevent overwhelming the system

## Usage

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Run

```bash
# Start the server (default port 33005)
pnpm start

# Development mode with auto-reload
pnpm dev

# With custom port
PORT=3006 pnpm start
```

### Configuration

The server can be configured through environment variables:

- `PORT`: HTTP port to listen on (default: 33005)

## Implementation

This server implements the `Hook` interface with two main methods:

1. `processRequest`: Validates incoming tool call requests against guardrail rules
2. `processResponse`: Validates responses from tool calls for sensitive data

### Current Guardrails

- **Destructive Operations**: Blocks tools with names containing "delete" or "remove"
- **Sensitive Data**: Blocks requests/responses containing passwords, secrets, tokens, or API keys
- **URL Validation**: Example implementation for fetch-docs - only allows requests to specific domains (github.com, example.com, etc.). This is specific to the fetch-docs MCP server and should be customized based on your MCP server's requirements
- **Response Size**: Limits responses to 1MB to prevent memory issues

## Using with Passthrough Server

To use this hook with the passthrough server:

```bash
# Start the guardrail hook
cd packages/guardrail-hook
pnpm dev

# In another terminal, start passthrough with this hook
cd packages/passthrough-mcp-server
export HOOKS="http://localhost:33005"
pnpm start
```

## Extending Guardrails

To add new guardrails, edit `src/hook.ts` and add your validation logic to either:
- `processRequest()` - for validating incoming requests
- `processResponse()` - for validating responses

Example:
```typescript
// Block requests to specific tools
if (toolCall.name === 'dangerous-tool') {
  return {
    response: 'abort',
    body: 'This tool is not allowed',
    reason: 'Tool blacklisted'
  };
}
```