/**
 * Schema Converter Module
 * 
 * Provides utilities for converting between different schema formats,
 * specifically for converting JSON Schema to Zod schema objects.
 */

import { z } from "zod";

/**
 * Convert JSON Schema to Zod schema
 * 
 * Takes a JSON Schema object and converts it to an equivalent Zod schema
 * that can be used with FastMCP tool definitions.
 */
export function convertJsonSchemaToZod(jsonSchema: any): z.ZodType {
  // Handle empty or invalid schema
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({});
  }
  
  // If it's not an object schema, return empty object schema
  if (jsonSchema.type !== 'object' || !jsonSchema.properties) {
    return z.object({});
  }
  
  try {
    const zodSchema: Record<string, z.ZodType> = {};
    
    // Process each property and convert to a Zod type
    Object.entries(jsonSchema.properties).forEach(([propName, propSchema]: [string, any]) => {
      const propType = propSchema.type;
      
      // Basic type mapping
      if (propType === 'string') {
        zodSchema[propName] = z.string().describe(propSchema.description || '');
      } else if (propType === 'number' || propType === 'integer') {
        zodSchema[propName] = z.number().describe(propSchema.description || '');
      } else if (propType === 'boolean') {
        zodSchema[propName] = z.boolean().describe(propSchema.description || '');
      } else if (propType === 'array') {
        // Basic array support - defaults to array of any
        zodSchema[propName] = z.array(z.any()).describe(propSchema.description || '');
      } else if (propType === 'object') {
        // Recursively convert nested objects
        zodSchema[propName] = convertJsonSchemaToZod(propSchema).describe(propSchema.description || '');
      } else {
        // Default to any for complex or unknown types
        zodSchema[propName] = z.any().describe(propSchema.description || '');
      }
      
      // Mark as optional if not in required array
      if (
        !jsonSchema.required || 
        !Array.isArray(jsonSchema.required) || 
        !jsonSchema.required.includes(propName)
      ) {
        zodSchema[propName] = zodSchema[propName].optional();
      }
    });
    
    return z.object(zodSchema);
  } catch (error) {
    console.warn("Error converting JSON schema to Zod:", error);
    return z.object({});
  }
}

/**
 * Extract parameters from a tool definition
 * 
 * Handles different tool definition formats to extract a consistent
 * parameters object that can be used with FastMCP.
 */
export function extractToolParameters(tool: any): z.ZodType {
  // If the tool already has parameters, use them
  if (tool.parameters) {
    return tool.parameters;
  }
  
  // If it has an inputSchema, convert it to Zod
  if (tool.inputSchema) {
    return convertJsonSchemaToZod(tool.inputSchema);
  }
  
  // Default to empty object
  return z.object({});
}