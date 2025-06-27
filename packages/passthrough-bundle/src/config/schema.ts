/**
 * Configuration Schema for Passthrough Bundle
 *
 * Zod schemas for validating bundle configuration files
 */

import { z } from "zod";

/**
 * Schema for a single hook instance configuration
 * Can be either a built-in hook or a remote hook
 */
const hookInstanceSchema = z.union([
  // Built-in hook with optional config
  z.object({
    name: z
      .string()
      .describe("Name of the built-in hook (e.g., SimpleLogHook)"),
    config: z
      .record(z.unknown())
      .optional()
      .describe("Hook-specific configuration"),
  }),
  // Remote hook with URL
  z.object({
    url: z.string().describe("URL of remote hook server"),
    name: z.string().describe("Name for the remote hook"),
  }),
]);

/**
 * Schema for target server configuration
 */
const targetSchema = z
  .object({
    command: z
      .string()
      .optional()
      .describe("Command to start local MCP server"),
    url: z.string().optional().describe("URL of remote MCP server"),
  })
  .refine((data) => data.command || data.url, {
    message: "Either command or url must be specified",
  });

/**
 * Schema for proxy server configuration
 */
const proxySchema = z.object({
  port: z.number().describe("Port for the proxy server"),
  transport: z.enum(["stdio", "httpStream"]).describe("Transport type"),
});

/**
 * Complete bundle configuration schema
 */
export const bundleConfigSchema = z.object({
  target: targetSchema,
  proxy: proxySchema,
  hooks: z.array(hookInstanceSchema).describe("List of hooks to enable"),
});

/**
 * Type derived from the schema
 */
export type BundleConfig = z.infer<typeof bundleConfigSchema>;
