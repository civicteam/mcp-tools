import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { createHookRouter } from "./router.js";
import type { Hook } from "./types.js";

/**
 * Create and start a tRPC server for a hook
 */
export async function startHookServer(hook: Hook, port: number) {
  const router = createHookRouter(hook);

  const server = createHTTPServer({
    router,
    createContext() {
      return {};
    },
  });

  server.listen(port);
  console.log(`Hook server listening on port ${port}`);

  return server;
}
