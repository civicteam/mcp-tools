# Test Scripts

This directory contains test configurations and scripts for testing the MCP tools.

## passthrough-mcp-server.json

Configuration for testing the passthrough MCP server with hooks.

### Environment Variables:
- `TARGET_SERVER_URL`: The URL of the target MCP server to proxy requests to
- `HOOKS`: Comma-separated list of hook server URLs

### Usage:

```bash
# Run the test script
./test.sh passthrough-mcp-server <tool-name> "<prompt>"
```

### Example:

```bash
# First, start the target server and hook servers
# Then run:
./test.sh passthrough-mcp-server echo "Test message"
```

## Setting up a test environment

1. Start a target MCP server on port 33003
2. Start the audit hook server on port 33004
3. Start the guardrail hook server on port 33005
4. Run the passthrough server using the test configuration