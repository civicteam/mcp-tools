#!/bin/bash

# Exit if any command fails or if an undefined variable is used
set -e
set -u

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Testing passthrough-proxy-builder CLI (stdio mode)${NC}"

# Configuration
TEST_DIR="test-cli-stdio-output"
PROXY_PORT=33004
TARGET_URL="http://localhost:33003/stream"
PROJECT_NAME="test-proxy"

# Clean up function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    rm -rf "${TEST_DIR}"
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Set up trap to clean up on exit
trap cleanup EXIT

# Step 1: Create proxy configuration using CLI
echo -e "\n${YELLOW}📝 Step 1: Creating proxy configuration with CLI${NC}"
rm -rf "${TEST_DIR}"

# Run the CLI with all options to avoid interactive prompts
../packages/passthrough-proxy-builder/dist/cli.js init "${TEST_DIR}/${PROJECT_NAME}" \
    --target-mode remote \
    --target-url "${TARGET_URL}" \
    --proxy-port ${PROXY_PORT} \
    --hooks SimpleLogHook

# Step 2: Create a run script for the generated proxy
echo -e "\n${YELLOW}🔧 Step 2: Creating run script${NC}"

# Create run.sh that starts the passthrough server with the generated config
cat > "${TEST_DIR}/${PROJECT_NAME}/run.sh" << 'EOF'
#!/bin/bash
# Convert mcphooks.config.json to environment variables and run passthrough server

CONFIG_FILE="mcphooks.config.json"

# Read config values
TARGET_URL=$(jq -r '.target.url // empty' "$CONFIG_FILE")
TARGET_COMMAND=$(jq -r '.target.command // empty' "$CONFIG_FILE")
PROXY_PORT=$(jq -r '.proxy.port' "$CONFIG_FILE")
HOOKS=$(jq -r '.hooksOrder | join(",")' "$CONFIG_FILE")

# Map hook names to URLs (for now, using localhost ports)
HOOK_URLS=""
for hook in $(echo $HOOKS | tr "," "\n"); do
    case $hook in
        "SimpleLogHook")
            HOOK_URL="http://localhost:33005"
            ;;
        "AuditHook")
            HOOK_URL="http://localhost:33006"
            ;;
        "GuardrailHook")
            HOOK_URL="http://localhost:33007"
            ;;
        *)
            echo "Unknown hook: $hook"
            exit 1
            ;;
    esac
    
    if [ -n "$HOOK_URLS" ]; then
        HOOK_URLS="$HOOK_URLS,$HOOK_URL"
    else
        HOOK_URLS="$HOOK_URL"
    fi
done

# Set environment variables based on target mode
if [ -n "$TARGET_URL" ]; then
    export TARGET_SERVER_URL="$TARGET_URL"
else
    export TARGET_SERVER_COMMAND="$TARGET_COMMAND"
fi

export PROXY_PORT="$PROXY_PORT"
export HOOKS="$HOOK_URLS"

# Run the passthrough server
exec node ../../../packages/passthrough-mcp-server/dist/cli.js
EOF

chmod +x "${TEST_DIR}/${PROJECT_NAME}/run.sh"

# Step 3: Create test configuration
echo -e "\n${YELLOW}📋 Step 3: Creating test configuration${NC}"
cat > "${TEST_DIR}/stdio-test.json" << EOF
{
  "prompt": "use the passthrough MCP server to fetch docs.civic.com",
  "allowedTools": ["mcp__passthrough-mcp-server__fetch"],
  "mcpServers": {
    "passthrough-mcp-server": {
      "type": "stdio",
      "command": "${TEST_DIR}/${PROJECT_NAME}/run.sh",
      "args": [],
      "env": {}
    }
  }
}
EOF

# Step 4: Check if required services are running
echo -e "\n${YELLOW}🔍 Step 4: Checking services${NC}"

# Check if MCP server is running on port 33003
if ! nc -z localhost 33003 2>/dev/null; then
    echo -e "${RED}⚠️  Warning: No MCP server detected on port 33003${NC}"
    echo -e "${YELLOW}Please ensure your MCP server is running on port 33003${NC}"
    exit 1
fi
echo -e "${GREEN}✓ MCP server detected on port 33003${NC}"

# Start SimpleLogHook if not running
if ! nc -z localhost 33005 2>/dev/null; then
    echo -e "${YELLOW}Starting SimpleLogHook on port 33005...${NC}"
    cd ../packages/simple-log-hook
    npm run dev &
    HOOK_PID=$!
    sleep 2
    cd ../../test
    
    # Verify it started
    if nc -z localhost 33005 2>/dev/null; then
        echo -e "${GREEN}✓ SimpleLogHook started${NC}"
    else
        echo -e "${RED}✗ Failed to start SimpleLogHook${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ SimpleLogHook already running on port 33005${NC}"
fi

# Step 5: Run the test
echo -e "\n${YELLOW}🧪 Step 5: Running test${NC}"
cd test
./test.sh "../${TEST_DIR}/stdio-test.json"
cd ..

# Kill the hook if we started it
if [ -n "${HOOK_PID:-}" ]; then
    kill $HOOK_PID 2>/dev/null || true
fi

echo -e "\n${GREEN}✅ Test completed successfully!${NC}"
echo -e "${GREEN}The generated proxy successfully connected to your MCP server with SimpleLogHook${NC}"