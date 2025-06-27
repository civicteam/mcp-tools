/**
 * Configuration Loader for Passthrough Bundle
 *
 * Loads and validates configuration from files
 */

import { readFileSync } from "node:fs";
import { type BundleConfig, bundleConfigSchema } from "./schema.js";

/**
 * Load configuration from a file path
 */
export function loadConfigFromFile(filePath: string): BundleConfig {
  try {
    const content = readFileSync(filePath, "utf-8");
    const rawConfig = JSON.parse(content);

    // Validate against schema
    const result = bundleConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      throw new Error(
        `Invalid configuration: ${result.error.errors.map((e) => e.message).join(", ")}`,
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load config from ${filePath}: ${error.message}`,
      );
    }
    throw error;
  }
}
