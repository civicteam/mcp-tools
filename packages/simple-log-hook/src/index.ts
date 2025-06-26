/**
 * Simple Log Hook - Minimal logging hook implementation
 *
 * Demonstrates the simplest possible hook implementation
 * that just logs tool calls to console.
 */

import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import SimpleLogHook from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33006;

// Create and start the server
const hook = new SimpleLogHook();
const router = createHookRouter(hook);

const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Simple Log Hook running on port ${PORT}`);
