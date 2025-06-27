/**
 * Configuration Schema Types and Utilities
 *
 * Provides base types and utilities for hook configuration schemas
 */

import type { z } from "zod";

/**
 * Base type for hook configuration
 * All hook configs should be objects with a single level of properties
 */
export type HookConfig = Record<string, unknown>;

/**
 * Type for a hook with optional configuration schema
 * @template TConfig The type of configuration this hook accepts
 */
export interface ConfigurableHook<TConfig = HookConfig> {
  configure(config: TConfig | null): void;
}

/**
 * Type guard to check if a value is a Zod schema
 */
export function isZodSchema(value: unknown): value is z.ZodSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "_def" in value &&
    typeof (value as any).parse === "function"
  );
}

/**
 * Helper to safely get description from a Zod schema
 */
export function getSchemaDescription(schema: z.ZodSchema): string | undefined {
  const def = (schema as any)._def;
  return def?.description;
}

/**
 * Helper to check if a Zod schema field is optional
 */
export function isOptionalSchema(schema: z.ZodSchema): boolean {
  const def = (schema as any)._def;
  return def?.typeName === "ZodOptional" || def?.typeName === "ZodDefault";
}

/**
 * Helper to get the default value from a Zod schema if it has one
 */
export function getSchemaDefault(schema: z.ZodSchema): unknown | undefined {
  const def = (schema as any)._def;
  if (def?.typeName === "ZodDefault") {
    return def.defaultValue();
  }
  return undefined;
}
