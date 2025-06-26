/**
 * Explain Hook tRPC Server
 *
 * This server adds a "reason" parameter to all tools, encouraging users
 * to explain why they're using each tool.
 */

import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import ExplainHook from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33007;

// Create the explain hook
const explainHook = new ExplainHook();

// Create the tRPC router
const router = createHookRouter(explainHook);

// Create and start the server
const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Explain Hook tRPC Server running on port ${PORT}`);
console.log("\nFeatures:");
console.log("- Adds 'reason' parameter to all tools");
console.log("- Logs reasons for each tool call");
console.log("- Strips 'reason' before forwarding to target service");
console.log("\nReady to process tool calls!");
