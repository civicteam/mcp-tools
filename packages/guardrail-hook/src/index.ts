/**
 * Guardrail Hook tRPC Server
 *
 * This server provides guardrails for tool calls, allowing validation,
 * modification, or rejection of tool calls before they reach the target server.
 *
 * It implements the hook interface for the passthrough-mcp-server.
 */

import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { GuardrailHook } from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33005;

// Create the guardrail hook
const guardrailHook = new GuardrailHook();

// Create the tRPC router
const router = createHookRouter(guardrailHook);

// Create and start the server
const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Guardrail Hook tRPC Server running on port ${PORT}`);
console.log("\nActive guardrails:");
console.log("- Blocking destructive operations (delete/remove)");
console.log("- Detecting sensitive data in requests and responses");
console.log("- Validating URL domains for fetch/HTTP operations");
console.log("- Limiting response size to 1MB");
console.log("\nReady to process tool calls!");
