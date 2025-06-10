/**
 * Rate Limit Hook Server
 *
 * Provides rate limiting for tool calls based on user ID
 */

import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { RateLimitHook } from "./RateLimitHook.js";

// Configuration from environment variables
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33007;
const LIMIT_PER_MINUTE = process.env.RATE_LIMIT_PER_MINUTE
  ? Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE)
  : 10;
const LIMIT_PER_HOUR = process.env.RATE_LIMIT_PER_HOUR
  ? Number.parseInt(process.env.RATE_LIMIT_PER_HOUR)
  : 100;

// Create the hook instance
const hook = new RateLimitHook(LIMIT_PER_MINUTE, LIMIT_PER_HOUR);

// Create tRPC router
const router = createHookRouter(hook);

// Create and start the server
const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Rate Limit Hook running on port ${PORT}`);
console.log(`Limits: ${LIMIT_PER_MINUTE}/minute, ${LIMIT_PER_HOUR}/hour`);

// Periodically clean up old rate limit entries (every hour)
setInterval(() => {
  hook.cleanupOldEntries();
}, 3600000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down Rate Limit Hook...");
  process.exit(0);
});
