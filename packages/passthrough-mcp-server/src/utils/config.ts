/**
 * Configuration Management Module
 *
 * Handles loading and defining the configuration for both the MCP server
 * and the target client connection. Loads settings from environment variables
 * and command line arguments.
 */

import * as process from "node:process";
import type { Hook } from "@civic/hook-common";
import { configureLoggerForStdio, logger } from "./logger.js";

export type TransportType = "stdio" | "sse" | "httpStream";

// Base configuration with discriminated union based on transport type
export type BaseConfig =
  | {
      transportType: "stdio";
      // Port is not required for stdio
    }
  | {
      transportType: "sse" | "httpStream";
      port: number;
    };

export interface TargetConfig {
  transportType: "sse" | "httpStream";
  url: string;
}

export interface RemoteHookConfig {
  url: string;
  name?: string; // Optional name for the hook
}

export type HookDefinition = RemoteHookConfig | Hook;

export type Config = BaseConfig & {
  target: TargetConfig;
  hooks?: HookDefinition[];
  serverInfo?: {
    name: string;
    version: `${number}.${number}.${number}`;
  };
  clientInfo?: {
    name: string;
    version: string;
  };
  authToken?: string; // Optional auth token for stdio transport
};

/**
 * Parse server transport type from command line arguments
 */
export function parseServerTransport(args: string[]): TransportType {
  if (args.includes("--stdio")) return "stdio";
  if (args.includes("--sse")) return "sse";
  return "httpStream";
}

/**
 * Parse client transport type from environment
 */
export function parseClientTransport(
  env: NodeJS.ProcessEnv,
): "sse" | "httpStream" {
  return env.TARGET_SERVER_TRANSPORT === "sse" ? "sse" : "httpStream";
}

/**
 * Parse hook URLs from environment variable
 */
export function parseHookUrls(hooksEnv?: string): string[] {
  if (!hooksEnv) return [];
  return hooksEnv
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

/**
 * Convert hook URLs to hook configurations
 */
export function createHookConfigs(urls: string[]): RemoteHookConfig[] {
  return urls.map((url) => {
    try {
      const urlObj = new URL(url);
      return {
        url,
        name: urlObj.hostname,
      };
    } catch {
      // If URL parsing fails, use the whole URL as name
      return {
        url,
        name: url,
      };
    }
  });
}

/**
 * Load configuration from environment and command line
 */
export function loadConfig(): Config {
  // Server configuration
  const transportType = parseServerTransport(process.argv);

  // Configure logger for stdio mode to avoid interfering with stdout
  if (transportType === "stdio") {
    configureLoggerForStdio();
  }

  // Target configuration
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33000";
  const targetTransport = parseClientTransport(process.env);

  // Hooks configuration
  const hookUrls = parseHookUrls(process.env.HOOKS);

  // Build config based on transport type
  let config: Config;

  if (transportType === "stdio") {
    config = {
      transportType: "stdio",
      target: {
        url: targetUrl,
        transportType: targetTransport,
      },
    };
  } else {
    const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 34000;
    config = {
      transportType,
      port,
      target: {
        url: targetUrl,
        transportType: targetTransport,
      },
    };
  }

  // Add hooks config if URLs are provided
  if (hookUrls.length > 0) {
    config.hooks = createHookConfigs(hookUrls);

    logger.info(`${hookUrls.length} tRPC hooks enabled:`);
    hookUrls.forEach((url, index) => {
      logger.info(`  ${index + 1}. ${url}`);
    });
  }

  return config;
}
