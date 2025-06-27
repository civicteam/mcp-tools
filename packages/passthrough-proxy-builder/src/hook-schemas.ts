/**
 * Static imports of hook configuration schemas
 * 
 * This file statically imports all hook schemas so they can be bundled
 * with the CLI at build time, avoiding runtime dynamic import issues.
 */

import { configSchema as simpleLogSchema } from "@civic/simple-log-hook/hook";
import { configSchema as auditSchema } from "@civic/audit-hook/hook";
import { configSchema as guardrailSchema } from "@civic/guardrail-hook/hook";
import { configSchema as customDescriptionSchema } from "@civic/custom-description-hook/hook";
import { configSchema as explainSchema } from "@civic/explain-hook/hook";
import type { z } from "zod";
import type { BuiltInHookName } from "./hooks.js";

/**
 * Map of hook names to their configuration schemas
 */
export const HOOK_SCHEMAS: Record<BuiltInHookName, z.ZodSchema | undefined> = {
  SimpleLogHook: simpleLogSchema,
  AuditHook: auditSchema,
  GuardrailHook: guardrailSchema,
  CustomDescriptionHook: customDescriptionSchema,
  ExplainHook: explainSchema,
};

/**
 * Get the configuration schema for a specific hook
 */
export function getHookSchema(hookName: BuiltInHookName): z.ZodSchema | undefined {
  return HOOK_SCHEMAS[hookName];
}