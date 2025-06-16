# Multi-stage Dockerfile for passthrough-bundle
# This creates a minimal production image with all hooks bundled

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack install -g pnpm@10

# Set working directory
WORKDIR /build

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm -r build

# Stage 2: Create production image
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create config directory
RUN mkdir -p /app/config

# Copy built files and dependencies
COPY --from=builder /build/packages/passthrough-bundle/dist ./dist
COPY --from=builder /build/packages/passthrough-bundle/package.json ./
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages ./packages

# Set production environment
ENV NODE_ENV=production

# Default environment variables
ENV CONFIG_FILE=/app/config/mcphooks.config.json

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/cli.js"]