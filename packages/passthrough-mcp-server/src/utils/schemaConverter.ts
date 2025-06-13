/**
 * Schema Converter Module
 *
 * Provides utilities for converting between different schema formats,
 * specifically for converting JSON Schema to Zod schema objects.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger } from "./logger.js";

/**
 * Convert JSON Schema to Zod schema
 *
 * Takes a JSON Schema object and converts it to an equivalent Zod schema
 * that can be used with FastMCP tool definitions.
 */
function convertJsonSchemaToZod(jsonSchema: Tool["inputSchema"]): z.ZodType {
  // Handle empty or invalid schema
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.object({});
  }

  // If it's not an object schema, return empty object schema
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    return z.object({});
  }

  try {
    const zodSchema: Record<string, z.ZodType> = {};

    // Process each property and convert to a Zod type
    for (const [propName, propSchema] of Object.entries(
      jsonSchema.properties,
    )) {
      const propType = (propSchema as { type: string }).type;
      const propDescription =
        (propSchema as { description?: string }).description || "";

      // Basic type mapping
      if (propType === "string") {
        zodSchema[propName] = z.string().describe(propDescription);
      } else if (propType === "number" || propType === "integer") {
        zodSchema[propName] = z.number().describe(propDescription);
      } else if (propType === "boolean") {
        zodSchema[propName] = z.boolean().describe(propDescription);
      } else if (propType === "array") {
        // Basic array support - defaults to array of any
        zodSchema[propName] = z.array(z.any()).describe(propDescription);
      } else if (propType === "object") {
        // Recursively convert nested objects
        zodSchema[propName] = convertJsonSchemaToZod(
          propSchema as Tool["inputSchema"],
        ).describe(propDescription);
      } else {
        // Default to any for complex or unknown types
        zodSchema[propName] = z.any().describe(propDescription);
      }

      // Mark as optional if not in required array
      if (
        !jsonSchema.required ||
        !Array.isArray(jsonSchema.required) ||
        !jsonSchema.required.includes(propName)
      ) {
        zodSchema[propName] = zodSchema[propName].optional();
      }
    }

    return z.object(zodSchema);
  } catch (error) {
    logger.warn(`Error converting JSON schema to Zod: ${error}`);
    return z.object({});
  }
}

/**
 * Extract parameters from a tool definition
 *
 * Handles different tool definition formats to extract a consistent
 * parameters object that can be used with FastMCP.
 */
export function extractToolParameters(tool: Tool): z.ZodType {
  // If it has an inputSchema, convert it to Zod
  if (tool.inputSchema) {
    return convertJsonSchemaToZod(tool.inputSchema);
  }

  // Default to empty object
  return z.object({});
}
