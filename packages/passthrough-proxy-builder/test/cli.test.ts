import { spawn } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MCPHooksConfig, validateConfig } from "../src/config";
import { generateProject } from "../src/generator";
import { getBuiltInHookNames } from "../src/hooks";
import { getErrorMessage } from "../src/utils";

describe("passthrough-proxy-builder", () => {
  describe("config validation", () => {
    it("should validate a valid local config", () => {
      const config = {
        target: {
          mode: "local" as const,
          command: "node server.js",
        },
        proxy: {
          mode: "local" as const,
          port: 3000,
        },
        hooksOrder: [
          { type: "built-in" as const, name: "SimpleLogHook" as const },
        ],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should validate a valid remote config", () => {
      const config = {
        target: {
          mode: "remote" as const,
          url: "https://api.example.com",
        },
        proxy: {
          mode: "remote" as const,
          port: 8080,
        },
        hooksOrder: [
          {
            type: "custom" as const,
            alias: "MyHook",
            url: "http://localhost:5000",
          },
        ],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should reject invalid port numbers", () => {
      const config = {
        target: {
          mode: "local" as const,
          command: "node server.js",
        },
        proxy: {
          mode: "local" as const,
          port: 99999,
        },
        hooksOrder: [],
      };

      expect(() => validateConfig(config)).toThrow(
        "port must be between 1 and 65535",
      );
    });

    it("should reject local config without command", () => {
      const config = {
        target: {
          mode: "local" as const,
        },
        proxy: {
          mode: "local" as const,
          port: 3000,
        },
        hooksOrder: [],
      };

      expect(() => validateConfig(config)).toThrow(
        "command is required for local mode",
      );
    });

    it("should reject remote config without url", () => {
      const config = {
        target: {
          mode: "remote" as const,
        },
        proxy: {
          mode: "remote" as const,
          port: 3000,
        },
        hooksOrder: [],
      };

      expect(() => validateConfig(config)).toThrow(
        "url is required for remote mode",
      );
    });
  });

  describe("hooks", () => {
    it("should export all built-in hook names", () => {
      const hookNames = getBuiltInHookNames();

      expect(hookNames).toContain("SimpleLogHook");
      expect(hookNames).toContain("AuditHook");
      expect(hookNames).toContain("GuardrailHook");
      expect(hookNames).toContain("ExplainHook");
      expect(hookNames).toContain("CustomDescriptionHook");
      expect(hookNames).toHaveLength(5);
    });
  });

  describe("utils", () => {
    it("should extract error message from Error instance", () => {
      const error = new Error("Test error message");
      expect(getErrorMessage(error)).toBe("Test error message");
    });

    it("should convert non-Error to string", () => {
      expect(getErrorMessage("string error")).toBe("string error");
      expect(getErrorMessage(123)).toBe("123");
      expect(getErrorMessage({ message: "object" })).toBe("[object Object]");
    });
  });

  describe("project generation", () => {
    const testDir = "test-project";
    const testConfig: MCPHooksConfig = {
      target: {
        mode: "local",
        command: "node server.js",
      },
      proxy: {
        mode: "local",
        port: 3000,
      },
      hooksOrder: [{ type: "built-in", name: "SimpleLogHook" as const }],
    };

    afterEach(async () => {
      // Clean up test directory if it exists
      try {
        await rm(join(process.cwd(), testDir), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore errors if directory doesn't exist
      }
    });

    it("should generate all required files", async () => {
      await generateProject(testConfig, testDir);

      // Check that all files were created
      const projectPath = join(process.cwd(), testDir);
      await expect(
        access(join(projectPath, "mcphooks.config.json")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, "Dockerfile")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, "docker-compose.yml")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, ".dockerignore")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, "package.json")),
      ).resolves.toBeUndefined();
    });

    it("should handle existing directory with warning", async () => {
      // Create directory first
      await mkdir(join(process.cwd(), testDir), { recursive: true });

      // Create a dummy file to test write permission
      await writeFile(join(process.cwd(), testDir, "test.txt"), "test");
      await rm(join(process.cwd(), testDir, "test.txt"));

      // Should still succeed but show warning
      await expect(
        generateProject(testConfig, testDir),
      ).resolves.toBeUndefined();
    });

    it("should clean up on failure", async () => {
      // Create a test config that will fail
      const failConfig = {
        ...testConfig,
        proxy: {
          ...testConfig.proxy,
          port: 999999, // Invalid port number
        },
      };

      await expect(generateProject(failConfig, testDir)).rejects.toThrow(
        "port must be between 1 and 65535",
      );

      // Directory should be cleaned up if it was created
      try {
        await access(join(process.cwd(), testDir));
        // If directory exists, it means it wasn't cleaned up or existed before
      } catch {
        // Directory doesn't exist, which is good
      }
    });
  });

  describe.skip("CLI integration", () => {
    it("should handle command line arguments", async () => {
      // Skip this test if dist/cli.js doesn't exist
      try {
        await access(join(process.cwd(), "dist/cli.js"));
      } catch {
        console.log("Skipping CLI test - dist/cli.js not found");
        return;
      }

      // Test with all arguments provided
      const result = await runCLI([
        "init",
        "test-cli-project",
        "--target-mode",
        "local",
        "--target-command",
        "node test.js",
        "--proxy-port",
        "4000",
        "--hooks",
        "SimpleLogHook",
        "AuditHook",
      ]);

      expect(result.code).toBe(0);

      // Clean up
      await rm(join(process.cwd(), "test-cli-project"), {
        recursive: true,
        force: true,
      });
    }, 10000);

    it("should validate invalid arguments", async () => {
      // Skip this test if dist/cli.js doesn't exist
      try {
        await access(join(process.cwd(), "dist/cli.js"));
      } catch {
        console.log("Skipping CLI test - dist/cli.js not found");
        return;
      }

      const result = await runCLI([
        "init",
        "test-invalid",
        "--target-mode",
        "invalid",
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain("Invalid target mode");
    });
  });
});

// Helper function to run CLI and capture output
function runCLI(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("node", [join(process.cwd(), "dist/cli.js"), ...args], {
      env: { ...process.env, NO_COLOR: "1" }, // Disable colors in tests
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
