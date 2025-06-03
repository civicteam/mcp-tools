# @civic/explain-hook

A hook for the MCP passthrough server that adds a "reason" parameter to all tools, encouraging users to explain their tool usage.

## Overview

The Explain Hook intercepts `tools/list` responses and modifies each tool's input schema to include a required "reason" parameter. This helps promote thoughtful tool usage by requiring users to articulate why they're using each tool.

## Features

- Adds a "reason" parameter to every tool's input schema
- The parameter is marked as required
- Includes a helpful description encouraging concise justifications
- Automatically strips the "reason" parameter before forwarding to the target service
- Logs the reason for each tool call for auditing purposes
- Passes through all other requests and responses without modification

## Usage

### As a Standalone Server

```bash
# Default port 33007
pnpm start

# Custom port
PORT=3000 pnpm start
```

### With Passthrough MCP Server

Configure the passthrough server to use this hook:

```bash
export HOOKS="http://localhost:33007"
```

## Implementation Details

The hook:
1. Intercepts `tools/list` responses from the target MCP server
2. Modifies each tool's `inputSchema` to add the "reason" parameter
3. Ensures the parameter is included in the `required` array
4. Returns the modified tools list to the client

When processing tool calls:
1. Intercepts incoming tool call requests
2. Extracts and logs the "reason" parameter
3. Strips the "reason" parameter from the arguments
4. Forwards the cleaned request to the target service

This encourages more thoughtful and explainable AI tool usage by requiring justification for each tool call, while ensuring compatibility with target services that don't expect this parameter.

## Example

Before the hook, a tool might have this schema:
```json
{
  "name": "fetch",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" }
    },
    "required": ["url"]
  }
}
```

After the hook processes it:
```json
{
  "name": "fetch",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "reason": {
        "type": "string",
        "description": "A concise justification for using this tool, explaining how it helps achieve your goal"
      }
    },
    "required": ["url", "reason"]
  }
}
```