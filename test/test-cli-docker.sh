#!/bin/bash

# Exit if any command fails or if an undefined variable is used
set -e
set -u

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Testing passthrough-proxy-builder CLI with Docker${NC}"

# Configuration
TEST_DIR="test-cli-docker-output"
PROXY_PORT=33004
TARGET_URL="http://host.docker.internal:33003/stream"
PROJECT_NAME="test-proxy"
DOCKER_IMAGE="test-mcp-proxy"

# Clean up function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    
    # Stop and remove Docker container
    docker stop ${DOCKER_IMAGE} 2>/dev/null || true
    docker rm ${DOCKER_IMAGE} 2>/dev/null || true
    
    # Remove Docker image
    docker rmi ${DOCKER_IMAGE} 2>/dev/null || true
    
    # Remove test directory
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

# Step 2: Modify the generated files for Docker stdio mode
echo -e "\n${YELLOW}🔧 Step 2: Preparing files for Docker build${NC}"

# Create a start script for stdio mode
cat > "${TEST_DIR}/${PROJECT_NAME}/start-stdio.js" << 'EOF'
#!/usr/bin/env node
const { startProxy } = require('@civic/passthrough-mcp-server');
const fs = require('fs');

// Read config
const config = JSON.parse(fs.readFileSync('./mcphooks.config.json', 'utf-8'));

// Convert to passthrough-mcp-server format
const proxyConfig = {
  target: config.target.mode === 'remote' 
    ? { type: 'remote', url: config.target.url }
    : { type: 'local', command: config.target.command },
  proxy: { port: config.proxy.port },
  hooks: config.hooksOrder.map(hook => ({
    type: 'builtin',
    name: hook
  }))
};

// Start in stdio mode
startProxy(proxyConfig, true);
EOF

chmod +x "${TEST_DIR}/${PROJECT_NAME}/start-stdio.js"

# Update Dockerfile to use our start script
cat > "${TEST_DIR}/${PROJECT_NAME}/Dockerfile" << 'EOF'
FROM node:18-alpine
WORKDIR /app

# Install passthrough-mcp-server and hooks
RUN npm install @civic/passthrough-mcp-server@latest

# Copy configuration files
COPY mcphooks.config.json ./
COPY start-stdio.js ./

# Make script executable
RUN chmod +x start-stdio.js

# Start in stdio mode
ENTRYPOINT ["node", "start-stdio.js"]
EOF

# Step 3: Build Docker image
echo -e "\n${YELLOW}🐳 Step 3: Building Docker image${NC}"
cd "${TEST_DIR}/${PROJECT_NAME}"
docker build -t ${DOCKER_IMAGE} .
cd ../..

# Step 4: Create test configuration for stdio Docker container
echo -e "\n${YELLOW}📋 Step 4: Creating test configuration${NC}"
cat > "${TEST_DIR}/docker-test.json" << EOF
{
  "prompt": "use the passthrough MCP server to fetch docs.civic.com",
  "allowedTools": ["mcp__passthrough-mcp-server__fetch"],
  "mcpServers": {
    "passthrough-mcp-server": {
      "type": "docker",
      "image": "${DOCKER_IMAGE}",
      "args": [],
      "env": {}
    }
  }
}
EOF

# Step 5: Run the test
echo -e "\n${YELLOW}🧪 Step 5: Running test with Docker container${NC}"
echo -e "${GREEN}Note: This test expects an MCP server running on port 33003${NC}"

# Check if MCP server is running on port 33003
if ! nc -z localhost 33003 2>/dev/null; then
    echo -e "${RED}⚠️  Warning: No server detected on port 33003${NC}"
    echo -e "${YELLOW}Please ensure your MCP server is running on port 33003${NC}"
    exit 1
fi

# Run the test using the existing test infrastructure
cd test
./test.sh "../${TEST_DIR}/docker-test.json"
cd ..

echo -e "\n${GREEN}✅ Test completed successfully!${NC}"
echo -e "${GREEN}The Docker container with SimpleLogHook successfully proxied to your MCP server${NC}"