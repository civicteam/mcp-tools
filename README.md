# @civicteam/mcp-tools

A collection of Model Context Protocol (MCP) tools including a passthrough server and hook system for request/response interception and modification.

## Packages

### @civicteam/passthrough-mcp-server
A passthrough MCP server that proxies requests to other MCP servers while applying configurable hooks.

### @civicteam/hook-common
Common utilities and types for building MCP hooks.

### @civicteam/audit-hook
An audit hook that logs all MCP requests and responses for monitoring and debugging.

### @civicteam/guardrail-hook
A guardrail hook that can filter and modify MCP requests/responses based on configurable rules. Includes an example domain filtering implementation for the fetch-docs server.

### @civicteam/simple-log-hook
A minimal hook implementation that logs requests and responses to console. Great for understanding the hook interface.

### @civicteam/fetch-docs
An MCP server that fetches and converts web pages to markdown. Useful for testing the passthrough server and hooks.

## Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

## Usage

The passthrough server can be configured to route requests through various hooks:

```bash
# Set environment variables
export TARGET_SERVER_URL="http://localhost:3000/stream"
export HOOKS="http://localhost:3001,http://localhost:3002"

# Start the passthrough server
cd packages/passthrough-mcp-server
pnpm start
```

## Testing

Test configurations are provided in the `test/` directory. Each configuration file includes:
- `prompt`: The test prompt to execute
- `allowedTools`: Array of allowed MCP tools
- `mcpServers`: MCP server configuration

To run tests:

```bash
cd test
./test.sh fetch-docs.json                    # Test fetch-docs server directly
./test.sh passthrough-mcp-server.json        # Test passthrough with audit and guardrail hooks
./test.sh simple-log-passthrough.json        # Test passthrough with simple logging
```

Example test configuration:
```json
{
  "prompt": "fetch docs.civic.com using the fetch-docs MCP server",
  "allowedTools": ["mcp__fetch-docs__fetch"],
  "mcpServers": {
    "fetch-docs": {
      "type": "stdio",
      "command": "../packages/fetch-docs/run.sh",
      "args": [],
      "env": {}
    }
  }
}
```

## Development

This monorepo uses:
- **pnpm** for package management
- **Turborepo** for task orchestration
- **TypeScript** for type safety
- **Biome** for linting and formatting

## License

MIT