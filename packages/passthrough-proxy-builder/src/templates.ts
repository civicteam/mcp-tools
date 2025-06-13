// Dockerfile is no longer needed when using the official image
export const DOCKERFILE_TEMPLATE = "";

export const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  mcp-proxy:
    image: civicteam/passthrough-mcp-server:0.3.0
    container_name: mcp-proxy
<% if (config.proxy.transport === "stdio") { -%>
    # Stdio mode configuration
    command: ["node", "dist/cli.js", "--stdio"]
    stdin_open: true
    tty: true
<% } else { -%>
    # HTTP mode configuration
    ports:
      - "<%= config.proxy.port %>:<%= config.proxy.port %>"
<% } -%>
    volumes:
      - ./mcphooks.config.json:/app/config/mcphooks.config.json:ro
    environment:
      - NODE_ENV=production
      - CONFIG_FILE=/app/config/mcphooks.config.json
<% if (config.proxy.transport !== "stdio") { -%>
      - PORT=<%= config.proxy.port %>
<% } -%>
<% if (config.target.command) { -%>
      - TARGET_SERVER_COMMAND=<%= config.target.command %>
<% } else { -%>
      - TARGET_SERVER_URL=<%= config.target.url %>
<% } -%>
<% if (config.hooks && config.hooks.length > 0) { -%>
      - HOOKS=<%= config.hooks.map(h => h.url || h.name).join(',') %>
<% } -%>
    restart: <%= config.proxy.transport === "stdio" ? "no" : "unless-stopped" %>
    # Uncomment to persist logs
    # volumes:
    #   - ./logs:/app/logs
    # Uncomment for custom environment file
    # env_file:
    #   - .env
`;
