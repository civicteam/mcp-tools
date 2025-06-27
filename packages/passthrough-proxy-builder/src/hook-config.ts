/**
 * Hook Configuration Discovery and Management
 * 
 * Provides functionality to discover and manage hook configurations
 * by dynamically loading hooks and extracting their Zod schemas
 */

import { type z } from "zod";
import type { BuiltInHookName } from "./hooks.js";
import { getBuiltInHookNames } from "./hooks.js";
import { getHookSchema } from "./hook-schemas.js";

/**
 * Hook configuration information
 */
export interface HookConfigInfo {
  name: string;
  schema?: z.ZodSchema;
  fields?: ConfigField[];
}

/**
 * Individual configuration field information
 */
export interface ConfigField {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
}

/**
 * Load a hook's configuration schema
 * Now uses static imports instead of dynamic loading
 */
export async function loadHookConfigSchema(
  hookName: BuiltInHookName
): Promise<z.ZodSchema | undefined> {
  return getHookSchema(hookName);
}

/**
 * Extract configuration fields from a Zod schema
 */
export function extractConfigFields(schema: z.ZodSchema): ConfigField[] {
  const fields: ConfigField[] = [];
  
  // Handle ZodObject schemas
  if (schema._def.typeName === "ZodObject") {
    const shape = (schema as any).shape;
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (isZodSchema(fieldSchema)) {
        fields.push(extractFieldInfo(key, fieldSchema as z.ZodSchema));
      }
    }
  }
  
  return fields;
}

/**
 * Extract information about a single field
 */
function extractFieldInfo(name: string, schema: z.ZodSchema): ConfigField {
  const def = (schema as any)._def;
  
  // Determine base type
  let baseType = def.typeName?.replace("Zod", "").toLowerCase() || "unknown";
  let required = true;
  let defaultValue: unknown;
  
  // Handle optional fields
  if (def.typeName === "ZodOptional") {
    required = false;
    const innerSchema = def.innerType;
    if (innerSchema?._def) {
      baseType = innerSchema._def.typeName?.replace("Zod", "").toLowerCase() || "unknown";
    }
  }
  
  // Handle default values
  if (def.typeName === "ZodDefault") {
    required = false;
    defaultValue = def.defaultValue();
    const innerSchema = def.innerType;
    if (innerSchema?._def) {
      baseType = innerSchema._def.typeName?.replace("Zod", "").toLowerCase() || "unknown";
    }
  }
  
  // Handle enums
  if (def.typeName === "ZodEnum") {
    baseType = `enum(${def.values.join(", ")})`;
  }
  
  // Handle arrays
  if (def.typeName === "ZodArray") {
    const elementType = def.type?._def?.typeName?.replace("Zod", "").toLowerCase() || "unknown";
    baseType = `array<${elementType}>`;
  }
  
  return {
    name,
    type: baseType,
    description: def.description,
    required,
    defaultValue,
  };
}

/**
 * Type guard to check if a value is a Zod schema
 */
function isZodSchema(value: unknown): value is z.ZodSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "_def" in value &&
    typeof (value as any).parse === "function"
  );
}

/**
 * Get configuration info for all built-in hooks
 */
export async function getAllHookConfigInfo(): Promise<HookConfigInfo[]> {
  const configInfos: HookConfigInfo[] = [];
  
  for (const hookName of getBuiltInHookNames()) {
    const schema = await loadHookConfigSchema(hookName);
    
    configInfos.push({
      name: hookName,
      schema,
      fields: schema ? extractConfigFields(schema) : undefined,
    });
  }
  
  return configInfos;
}