/**
 * Custom Description Hook - Replaces tool descriptions based on configuration
 *
 * This hook intercepts tools/list responses and replaces tool descriptions
 * based on a configuration file or stdin input.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as process from "node:process";
import { createHookRouter } from "@civic/hook-common";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import CustomDescriptionHook, { type CustomDescriptionConfig } from "./hook.js";

// Configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33008;

async function loadConfig(): Promise<CustomDescriptionConfig | null> {
  try {
    let configContent: string;

    // Check for --config argument
    const configArgIndex = process.argv.indexOf("--config");
    const configFile =
      configArgIndex !== -1
        ? process.argv[configArgIndex + 1]
        : "./config.json";

    // Check if stdin has data
    if (!process.stdin.isTTY && process.stdin.readable) {
      configContent = "";
      for await (const chunk of process.stdin) {
        configContent += chunk;
      }
    } else {
      // Read from file
      const configPath = resolve(configFile);
      configContent = await readFile(configPath, "utf-8");
    }

    return JSON.parse(configContent) as CustomDescriptionConfig;
  } catch (error) {
    console.log(
      "CustomDescriptionHook: No configuration found or failed to load config - hook will pass through without modifications",
    );
    return null;
  }
}

async function main() {
  // Create hook and load config
  const hook = new CustomDescriptionHook();
  const config = await loadConfig();
  hook.configure(config);

  // Create and start the server
  const router = createHookRouter(hook);

  const server = createHTTPServer({
    router,
    createContext() {
      return {};
    },
  });

  server.listen(PORT);

  console.log(`Custom Description Hook running on port ${PORT}`);
}

main().catch(console.error);
