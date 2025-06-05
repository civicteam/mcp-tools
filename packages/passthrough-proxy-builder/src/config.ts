import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

// Simplified - built-in hooks are just strings now
export type HookEntry = string | { alias: string; url: string };

export interface TargetConfig {
  mode: 'local' | 'remote';
  command?: string;     // if local
  url?: string;         // if remote
}

export interface ProxyConfig {
  mode: 'local' | 'remote'; // recorded for future
  port: number;
}

export interface MCPHooksConfig {
  target: TargetConfig;
  proxy: ProxyConfig;
  hooksOrder: HookEntry[];
}

export async function readConfig(path: string): Promise<MCPHooksConfig> {
  try {
    const content = await readFile(resolve(path), 'utf-8');
    const config = JSON.parse(content) as MCPHooksConfig;
    validateConfig(config);
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${path}`);
    }
    throw error;
  }
}

export async function writeConfig(path: string, config: MCPHooksConfig): Promise<void> {
  validateConfig(config);
  const content = JSON.stringify(config, null, 2);
  await writeFile(resolve(path), content, 'utf-8');
}

export function validateConfig(config: MCPHooksConfig): void {
  // Validate target
  if (!config.target || !config.target.mode) {
    throw new Error('Invalid config: target.mode is required');
  }
  
  if (config.target.mode === 'local' && !config.target.command) {
    throw new Error('Invalid config: target.command is required for local mode');
  }
  
  if (config.target.mode === 'remote' && !config.target.url) {
    throw new Error('Invalid config: target.url is required for remote mode');
  }
  
  // Validate proxy
  if (!config.proxy || typeof config.proxy.port !== 'number') {
    throw new Error('Invalid config: proxy.port must be a number');
  }
  
  // Validate hooks
  if (!Array.isArray(config.hooksOrder)) {
    throw new Error('Invalid config: hooksOrder must be an array');
  }
  
  for (const hook of config.hooksOrder) {
    if (typeof hook === 'string') {
      // Built-in hook - just a string
      continue;
    } else if (typeof hook === 'object' && hook.alias && hook.url) {
      // Custom hook with alias and url
      continue;
    } else {
      throw new Error('Invalid config: each hook must be a string or {alias, url} object');
    }
  }
}

// Default configuration
export function getDefaultConfig(): MCPHooksConfig {
  return {
    target: {
      mode: 'local',
      command: 'node dist/server.js'
    },
    proxy: {
      mode: 'local',
      port: 8080
    },
    hooksOrder: []
  };
}