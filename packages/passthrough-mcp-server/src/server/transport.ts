/**
 * Transport Configuration Module
 *
 * Provides utilities for configuring the server transport based on
 * the server configuration. Supports stdio, SSE, and HTTP Stream transports.
 */

import { ServerConfig } from "../utils/config.js";

/**
 * Get server transport configuration based on type
 */
export function getServerTransportConfig(config: ServerConfig) {
  if (config.transportType === "stdio") {
    return { 
      transportType: "stdio" as const 
    };
  }
  
  if (config.transportType === "sse") {
    return {
      transportType: "sse" as const,
      sse: {
        endpoint: "/sse" as const,
        port: config.port,
      },
    };
  }
  
  // Default to HTTP stream
  return {
    transportType: "httpStream" as const,
    httpStream: {
      endpoint: "/stream" as const,
      port: config.port,
    },
  };
}