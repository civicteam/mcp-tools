/**
 * Hook Configuration Prompts
 * 
 * Provides interactive prompts for configuring built-in hooks
 */

import chalk from "chalk";
import inquirer from "inquirer";
import type { z } from "zod";
import type { BuiltInHookName } from "./hooks.js";
import { 
  loadHookConfigSchema, 
  extractConfigFields,
  type ConfigField 
} from "./hook-config.js";

/**
 * Prompt for hook configuration
 */
export async function promptHookConfiguration(
  hookName: BuiltInHookName
): Promise<Record<string, unknown> | undefined> {
  // Try to load the hook's configuration schema
  let schema: z.ZodSchema | undefined;
  let fields: ConfigField[] = [];
  
  try {
    schema = await loadHookConfigSchema(hookName);
    if (schema) {
      fields = extractConfigFields(schema);
    }
  } catch (error) {
    // Schema loading failed, use predefined configurations
    fields = getPredefinedConfigFields(hookName);
  }
  
  if (fields.length === 0) {
    // No configurable fields
    return undefined;
  }
  
  // Ask if user wants to configure the hook
  const { wantsToConfigure } = await inquirer.prompt([
    {
      type: "confirm",
      name: "wantsToConfigure",
      message: `Would you like to configure ${hookName}?`,
      default: false,
    },
  ]);
  
  if (!wantsToConfigure) {
    return undefined;
  }
  
  console.log(chalk.blue(`\nConfiguring ${hookName}:\n`));
  
  // Build configuration object
  const config: Record<string, unknown> = {};
  
  // Prompt for each field
  for (const field of fields) {
    const value = await promptForField(field, hookName);
    if (value !== undefined) {
      config[field.name] = value;
    }
  }
  
  // Validate the configuration against the schema if available
  if (schema) {
    try {
      schema.parse(config);
      return config;
    } catch (error) {
      console.log(chalk.yellow("\nConfiguration validation failed. Using defaults."));
      return undefined;
    }
  }
  
  // No schema available, return config as-is
  return config;
}

/**
 * Prompt for a single configuration field
 */
async function promptForField(
  field: ConfigField,
  hookName: string
): Promise<unknown> {
  const fieldDescription = field.description || field.name;
  
  // Handle different field types
  if (field.type === "boolean") {
    const { value } = await inquirer.prompt([
      {
        type: "confirm",
        name: "value",
        message: fieldDescription,
        default: field.defaultValue ?? false,
      },
    ]);
    return value;
  }
  
  if (field.type.startsWith("enum")) {
    // Extract enum values from type string
    const enumMatch = field.type.match(/enum\((.*)\)/);
    if (enumMatch) {
      const choices = enumMatch[1].split(", ").map(v => v.trim());
      const { value } = await inquirer.prompt([
        {
          type: "list",
          name: "value",
          message: fieldDescription,
          choices,
          default: field.defaultValue,
        },
      ]);
      return value;
    }
  }
  
  if (field.type.startsWith("array")) {
    // Handle array types
    const { useArray } = await inquirer.prompt([
      {
        type: "confirm",
        name: "useArray",
        message: `Configure ${fieldDescription}?`,
        default: false,
      },
    ]);
    
    if (!useArray) {
      return field.defaultValue;
    }
    
    // For complex arrays, ask for JSON input
    const { jsonValue } = await inquirer.prompt([
      {
        type: "input",
        name: "jsonValue",
        message: `Enter ${fieldDescription} as JSON array:`,
        default: field.defaultValue ? JSON.stringify(field.defaultValue) : "[]",
        validate: (input) => {
          try {
            const parsed = JSON.parse(input);
            if (!Array.isArray(parsed)) {
              return "Please enter a valid JSON array";
            }
            return true;
          } catch {
            return "Please enter valid JSON";
          }
        },
      },
    ]);
    
    return JSON.parse(jsonValue);
  }
  
  // Default to string input
  const { value } = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: fieldDescription,
      default: field.defaultValue,
      when: () => field.required || field.defaultValue !== undefined,
    },
  ]);
  
  return value;
}

/**
 * Display hook configuration summary
 */
export function displayHookConfigSummary(
  hookName: string,
  config: Record<string, unknown>
): void {
  console.log(chalk.green(`\n✓ ${hookName} configured:`));
  for (const [key, value] of Object.entries(config)) {
    const displayValue = typeof value === "object" 
      ? JSON.stringify(value) 
      : String(value);
    console.log(chalk.gray(`  - ${key}: ${displayValue}`));
  }
}

/**
 * Get predefined configuration fields for hooks
 * This is a fallback when dynamic loading fails
 */
function getPredefinedConfigFields(hookName: BuiltInHookName): ConfigField[] {
  switch (hookName) {
    case "SimpleLogHook":
      return [
        {
          name: "logLevel",
          type: "enum(verbose, normal)",
          description: "Logging verbosity level",
          required: false,
          defaultValue: "normal",
        },
        {
          name: "prefix",
          type: "string",
          description: "Prefix for log messages",
          required: false,
        },
      ];
      
    case "AuditHook":
      return [
        {
          name: "loggers",
          type: "array<string>",
          description: "Types of loggers to enable (console, file)",
          required: false,
          defaultValue: ["console"],
        },
        {
          name: "fileLogPath",
          type: "string",
          description: "Path to the audit log file (when file logger is enabled)",
          required: false,
          defaultValue: "./audit.log",
        },
      ];
      
    case "GuardrailHook":
      return [
        {
          name: "allowedDomains",
          type: "array<string>",
          description: "List of allowed domains for URL-based tools",
          required: false,
        },
        {
          name: "blockedTools",
          type: "array<string>",
          description: "List of tool names to block completely",
          required: false,
        },
        {
          name: "enableDestructiveOperationCheck",
          type: "boolean",
          description: "Block tools with 'delete' or 'remove' in their names",
          required: false,
          defaultValue: true,
        },
      ];
      
    case "CustomDescriptionHook":
      return [
        {
          name: "toolDescriptions",
          type: "array<object>",
          description: "List of tool description replacements",
          required: false,
          defaultValue: [],
        },
      ];
      
    case "ExplainHook":
      return [
        {
          name: "reasonDescription",
          type: "string",
          description: "Custom description for the reason parameter added to tools",
          required: false,
        },
        {
          name: "makeOptional",
          type: "boolean",
          description: "Whether to make the reason parameter optional instead of required",
          required: false,
          defaultValue: false,
        },
      ];
      
    default:
      return [];
  }
}