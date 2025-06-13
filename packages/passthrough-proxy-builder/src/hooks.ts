// Built-in hooks configuration
// These will be bundled by esbuild at build time
const BUILT_IN_HOOKS = {
  AuditHook: "@civic/audit-hook",
  GuardrailHook: "@civic/guardrail-hook",
  ExplainHook: "@civic/explain-hook",
  CustomDescriptionHook: "@civic/custom-description-hook",
  SimpleLogHook: "@civic/simple-log-hook",
} as const;

export type BuiltInHookName = keyof typeof BUILT_IN_HOOKS;

function isBuiltInHook(name: string): name is BuiltInHookName {
  return name in BUILT_IN_HOOKS;
}

export function getBuiltInHookNames(): BuiltInHookName[] {
  return Object.keys(BUILT_IN_HOOKS) as BuiltInHookName[];
}

function getHookPackageName(hookName: BuiltInHookName): string {
  return BUILT_IN_HOOKS[hookName];
}
