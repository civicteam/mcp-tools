#!/bin/bash

# Exit if any command fails or if an undefined variable is used
set -e
set -u

# Check if argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <config-file.json>"
    echo "Example: $0 simple-log-passthrough.json"
    exit 1
fi

CONFIG_FILE=$1

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file '$CONFIG_FILE' not found"
    exit 1
fi

# Extract values from JSON config
PROMPT=$(jq -r '.prompt' "$CONFIG_FILE")
ALLOWED_TOOLS=$(jq -c '.allowedTools' "$CONFIG_FILE")
MCP_SERVERS=$(jq -c '.mcpServers' "$CONFIG_FILE")

# Convert allowed tools array to comma-separated string
ALLOWED_TOOLS_STRING=$(echo "$ALLOWED_TOOLS" | jq -r 'join(",")')

# Run claude with extracted configuration
claude --verbose --output-format stream-json \
  --mcp-config "{ \"mcpServers\": $MCP_SERVERS }" \
  --allowedTools "$ALLOWED_TOOLS_STRING" \
  -p "$PROMPT" | jq