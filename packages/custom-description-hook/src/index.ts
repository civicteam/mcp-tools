/**
 * Custom Description Hook - Replaces tool descriptions based on configuration
 *
 * This hook intercepts tools/list responses and replaces tool descriptions
 * based on a configuration file or stdin input.
 */

import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { CustomDescriptionHook } from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33008;

// Create and start the server
const hook = new CustomDescriptionHook();
const router = createHookRouter(hook);

const server = createHTTPServer({
  router,
  createContext() {
    return {};
  },
});

server.listen(PORT);

console.log(`Custom Description Hook running on port ${PORT}`);

export { CustomDescriptionHook } from "./hook.js";
