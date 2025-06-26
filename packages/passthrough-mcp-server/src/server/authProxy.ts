/**
 * Authentication Proxy Module
 *
 * Simple routing proxy that:
 * - Routes /mcp requests to the MCP handler
 * - Proxies all other requests directly to the target server
 * - Preserves all headers including authorization
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { logger } from "../utils/logger.js";

export interface ProxyOptions {
  targetUrl: string;
  mcpEndpoint?: string; // defaults to /mcp
}

/**
 * Creates an HTTP server that routes requests:
 * - /mcp -> MCP handler
 * - Everything else -> proxy to target
 */
export function createAuthProxyServer(
  options: ProxyOptions,
  mcpHandler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void>,
): http.Server {
  const targetUrl = new URL(options.targetUrl);
  const mcpEndpoint = options.mcpEndpoint || "/mcp";

  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);

    // Route based on path
    if (requestUrl.pathname === mcpEndpoint) {
      // Handle MCP requests
      await mcpHandler(req, res);
    } else {
      // Proxy all other requests directly to target
      await proxyToTarget(req, res, targetUrl);
    }
  });
}

/**
 * Proxies a request directly to the target server
 */
export async function proxyToTarget(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetUrl: URL,
): Promise<void> {
  try {
    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host, // Update host header to target
      },
    };

    logger.debug(`Proxying ${req.method} ${req.url} to ${targetUrl.host}`);

    const protocol = targetUrl.protocol === "https:" ? https : http;
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Forward status and headers from target
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

      // Forward response body
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      logger.error(`Proxy request error: ${err}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end("Bad Gateway");
      }
    });

    // Forward request body
    req.pipe(proxyReq);
  } catch (err) {
    logger.error(`Error in proxy request: ${err}`);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }
}