# Multi-stage Dockerfile for passthrough-bundle
# This creates a minimal production image with all hooks bundled

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack install -g pnpm@10

# Set working directory
WORKDIR /build

# Copy workspace files
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm -r build

# Deploy passthrough-bundle with all its dependencies
RUN pnpm deploy --filter=@civic/passthrough-bundle --prod /deployed

# Stage 2: Create production image
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy the deployed package
COPY --from=builder /deployed ./

# Set production environment
ENV NODE_ENV=production

# Default environment variables
ENV CONFIG_FILE=/app/config/mcphooks.config.json

# Create config directory mount point
RUN mkdir -p /app/config

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/cli.js"]