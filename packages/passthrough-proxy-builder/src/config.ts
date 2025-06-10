import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BuiltInHookName } from "./hooks";

export type HookEntry =
  | {
      type: "built-in";
      name: BuiltInHookName;
    }
  | {
      type: "custom";
      alias: string;
      url: string;
    };

export interface TargetConfig {
  mode: "local" | "remote";
  command?: string; // if local
  url?: string; // if remote
}

export interface ProxyConfig {
  mode: "local" | "remote"; // recorded for future
  port: number;
}

export interface MCPHooksConfig {
  target: TargetConfig;
  proxy: ProxyConfig;
  hooksOrder: HookEntry[];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function readConfig(path: string): Promise<MCPHooksConfig> {
  try {
    const content = await readFile(resolve(path), "utf-8");
    const config = JSON.parse(content) as MCPHooksConfig;
    validateConfig(config);
    return config;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Config file not found: ${path}`);
    }
    throw error;
  }
}

/**
 * Convert builder config to server config format
 */
function convertToServerFormat(config: MCPHooksConfig): any {
  return {
    target: config.target,
    proxy: {
      port: config.proxy.port,
      transport: "httpStream" // Default transport
    },
    hooks: config.hooksOrder.map(hook => {
      if (hook.type === "built-in") {
        return { name: hook.name };
      } else {
        return { url: hook.url, name: hook.alias };
      }
    })
  };
}

export async function writeConfig(
  path: string,
  config: MCPHooksConfig,
): Promise<void> {
  validateConfig(config);
  const serverConfig = convertToServerFormat(config);
  const content = JSON.stringify(serverConfig, null, 2);
  await writeFile(resolve(path), content, "utf-8");
}

export function validateConfig(config: MCPHooksConfig): void {
  // Validate target
  if (config.target.mode === "local" && !config.target.command) {
    throw new Error(
      "Invalid config: target.command is required for local mode",
    );
  }

  if (config.target.mode === "remote" && !config.target.url) {
    throw new Error("Invalid config: target.url is required for remote mode");
  }

  // Validate proxy port is a reasonable number
  if (config.proxy.port < 1 || config.proxy.port > 65535) {
    throw new Error("Invalid config: proxy.port must be between 1 and 65535");
  }
}

// Default configuration
export function getDefaultConfig(): MCPHooksConfig {
  return {
    target: {
      mode: "local",
      command: "node dist/server.js",
    },
    proxy: {
      mode: "local",
      port: 8080,
    },
    hooksOrder: [],
  };
}
