export const DOCKERFILE_TEMPLATE = `FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install dependencies based on which lockfile exists
RUN \\
  if [ -f pnpm-lock.yaml ]; then \\
    npm install -g pnpm && pnpm install --frozen-lockfile; \\
  elif [ -f yarn.lock ]; then \\
    yarn install --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then \\
    npm ci; \\
  else \\
    npm install; \\
  fi

# Copy source files
COPY . .

# Copy configuration
COPY mcphooks.config.json ./mcphooks.config.json

# Build the application
RUN npm run build || yarn build || pnpm build || echo "No build script found"

# Expose proxy port
EXPOSE <%= config.proxy.port %>

# Set environment variables
ENV NODE_ENV=production
ENV PROXY_PORT=<%= config.proxy.port %>

# Start the proxy
CMD ["node", "dist/cli.js", "start-proxy", "--config", "mcphooks.config.json"]`;

export const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  mcp-proxy:
    build: .
    container_name: mcp-proxy
    ports:
      - "<%= config.proxy.port %>:<%= config.proxy.port %>"
    environment:
      - NODE_ENV=production
      - PROXY_PORT=<%= config.proxy.port %>
<% if (config.target.mode === 'local') { -%>
      - TARGET_MODE=local
      - TARGET_COMMAND=<%= config.target.command %>
<% } else { -%>
      - TARGET_MODE=remote
      - TARGET_URL=<%= config.target.url %>
<% } -%>
    restart: unless-stopped
    # Uncomment to persist logs
    # volumes:
    #   - ./logs:/app/logs
    # Uncomment for custom environment file
    # env_file:
    #   - .env
`;
