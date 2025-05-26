#!/bin/bash

# Change to the script's directory
cd "$(dirname "$0")"

# Run the bridge commander using tsx
npx tsx src/index.ts --stdio