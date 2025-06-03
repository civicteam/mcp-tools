#!/bin/bash
# Simple runner script for the explain hook

# Change to the directory where this script is located
cd "$(dirname "$0")"

# Check if dist directory exists, if not build first
if [ ! -d "dist" ]; then
  echo "Building explain-hook..."
  pnpm build
fi

# Run the server
exec node dist/index.js