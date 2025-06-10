export const DOCKERFILE_TEMPLATE = `FROM node:20-alpine
WORKDIR /app

# Install passthrough-mcp-server globally
RUN npm install -g @civic/passthrough-mcp-server@0.2.0

# Copy configuration
COPY mcphooks.config.json ./mcphooks.config.json

# Expose proxy port
EXPOSE <%= config.proxy.port %>

# Set environment variables
ENV NODE_ENV=production
ENV PORT=<%= config.proxy.port %>
ENV CONFIG_FILE=/app/mcphooks.config.json
<% if (config.target.mode === 'local') { -%>
ENV TARGET_SERVER_COMMAND="<%= config.target.command %>"
<% } else { -%>
ENV TARGET_SERVER_URL=<%= config.target.url %>
<% } -%>
<% if (config.hooks && config.hooks.length > 0) { -%>
ENV HOOKS=<%= config.hooks.map(h => h.url || h.name).join(',') %>
<% } -%>

# Start the proxy
CMD ["passthrough-mcp-server"]`;

export const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  mcp-proxy:
    build: .
    container_name: mcp-proxy
    ports:
      - "<%= config.proxy.port %>:<%= config.proxy.port %>"
    environment:
      - NODE_ENV=production
      - PORT=<%= config.proxy.port %>
      - CONFIG_FILE=/app/mcphooks.config.json
<% if (config.target.mode === 'local') { -%>
      - TARGET_SERVER_COMMAND=<%= config.target.command %>
<% } else { -%>
      - TARGET_SERVER_URL=<%= config.target.url %>
<% } -%>
<% if (config.hooks && config.hooks.length > 0) { -%>
      - HOOKS=<%= config.hooks.map(h => h.url || h.name).join(',') %>
<% } -%>
    restart: unless-stopped
    # Uncomment to persist logs
    # volumes:
    #   - ./logs:/app/logs
    # Uncomment for custom environment file
    # env_file:
    #   - .env
`;