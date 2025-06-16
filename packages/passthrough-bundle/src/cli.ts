#!/usr/bin/env node

/**
 * CLI entry point for passthrough-bundle
 */

import { startPassthroughBundle } from "./index.js";

// Start the bundle
startPassthroughBundle().catch((error) => {
  console.error("Failed to start passthrough bundle:", error);
  process.exit(1);
});
