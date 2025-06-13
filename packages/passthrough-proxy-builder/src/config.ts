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

export type TargetConfig =
  | {
      command: string;
      url?: never;
    }
  | {
      url: string;
      command?: never;
    };

interface ProxyConfig {
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

interface ServerConfig {
  target: {
    command?: string;
    url?: string;
  };
  proxy: {
    port: number;
    transport: string;
  };
  hooks: Array<{
    name: string;
    url?: string;
  }>;
}

/**
 * Convert builder config to server config format
 */
function convertToServerFormat(config: MCPHooksConfig): ServerConfig {
  // Clean up target config
  const target: { command?: string; url?: string } = {};
  if (config.target.command) {
    target.command = config.target.command;
  } else {
    target.url = config.target.url;
  }

  return {
    target,
    proxy: {
      port: config.proxy.port,
      transport: "httpStream", // Default transport
    },
    hooks: config.hooksOrder.map((hook) => {
      if (hook.type === "built-in") {
        return { name: hook.name };
      }
      return { url: hook.url, name: hook.alias };
    }),
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
  // Validate proxy port is a reasonable number
  if (config.proxy.port < 1 || config.proxy.port > 65535) {
    throw new Error("Invalid config: proxy.port must be between 1 and 65535");
  }
}

// Default configuration
export function getDefaultConfig(): MCPHooksConfig {
  return {
    target: {
      command: "node dist/server.js",
    },
    proxy: {
      port: 8080,
    },
    hooksOrder: [],
  };
}
