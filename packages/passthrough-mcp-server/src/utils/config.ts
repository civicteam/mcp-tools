/**
 * Configuration Management Module
 *
 * Handles loading and defining the configuration for both the MCP server
 * and the target client connection. Loads settings from environment variables
 * and command line arguments.
 */

import * as process from "node:process";

export type TransportType = "stdio" | "sse" | "httpStream";

export interface ServerConfig {
  port: number;
  transportType: TransportType;
}

export interface ClientConfig {
  type: "sse" | "stream";
  url: string;
}

export interface HookConfig {
  url: string;
  name?: string; // Optional name for the hook
}

export interface Config {
  server: ServerConfig;
  client: ClientConfig;
  hooks?: HookConfig[];
}

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
export function parseClientTransport(env: NodeJS.ProcessEnv): "sse" | "stream" {
  return env.TARGET_SERVER_TRANSPORT === "sse" ? "sse" : "stream";
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
export function createHookConfigs(urls: string[]): HookConfig[] {
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
  const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 34000;
  const serverTransport = parseServerTransport(process.argv);

  // Client configuration
  const targetUrl = process.env.TARGET_SERVER_URL || "http://localhost:33000";
  const clientTransport = parseClientTransport(process.env);

  // Hooks configuration
  const hookUrls = parseHookUrls(process.env.HOOKS);

  const config: Config = {
    server: {
      port,
      transportType: serverTransport,
    },
    client: {
      url: targetUrl,
      type: clientTransport,
    },
  };

  // Add hooks config if URLs are provided
  if (hookUrls.length > 0) {
    config.hooks = createHookConfigs(hookUrls);

    console.log(`${hookUrls.length} tRPC hooks enabled:`);
    hookUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });
  }

  return config;
}
