import { access, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MCPHooksConfig } from "../src/config";
import { generateProject } from "../src/generator";

describe("generator", () => {
  const testProjects: string[] = [];

  afterEach(async () => {
    // Clean up test projects
    for (const project of testProjects) {
      try {
        await rm(join(process.cwd(), project), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore errors
      }
    }
    testProjects.length = 0;
  });

  describe("generateProject", () => {
    it("should generate a complete project structure", async () => {
      const projectName = "test-gen-complete";
      testProjects.push(projectName);

      const config: MCPHooksConfig = {
        target: {
          mode: "local",
          command: "npx some-mcp-server",
        },
        proxy: {
          mode: "local",
          port: 3000,
        },
        hooksOrder: [
          { type: "built-in", name: "SimpleLogHook" },
          { type: "built-in", name: "AuditHook" },
        ],
      };

      await generateProject(config, projectName);

      const projectPath = join(process.cwd(), projectName);

      // Verify all files exist
      await expect(
        access(join(projectPath, "mcphooks.config.json")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, "Dockerfile")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, ".dockerignore")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, "package.json")),
      ).resolves.toBeUndefined();

      // Verify config content
      const configContent = await readFile(
        join(projectPath, "mcphooks.config.json"),
        "utf-8",
      );
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.target.mode).toBe("local");
      expect(savedConfig.target.command).toBe("npx some-mcp-server");
      expect(savedConfig.proxy.port).toBe(3000);
      expect(savedConfig.hooksOrder).toHaveLength(2);

      // Verify Dockerfile content
      const dockerfile = await readFile(
        join(projectPath, "Dockerfile"),
        "utf-8",
      );
      expect(dockerfile).toContain("FROM node:20-alpine");
      expect(dockerfile).toContain("EXPOSE 3000");
      expect(dockerfile).toContain("EXPOSE 3000");

      // Verify .dockerignore
      const dockerignore = await readFile(
        join(projectPath, ".dockerignore"),
        "utf-8",
      );
      expect(dockerignore).toContain("node_modules");
      expect(dockerignore).toContain(".git");

      // Verify package.json
      const packageJson = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf-8"),
      );
      expect(packageJson.name).toBe("mcp-passthrough-proxy");
      expect(
        packageJson.dependencies["@civic/passthrough-proxy-builder"],
      ).toBeDefined();
    });

    it("should handle remote target configuration", async () => {
      const projectName = "test-gen-remote";
      testProjects.push(projectName);

      const config: MCPHooksConfig = {
        target: {
          mode: "remote",
          url: "https://api.example.com",
        },
        proxy: {
          mode: "remote",
          port: 8080,
        },
        hooksOrder: [],
      };

      await generateProject(config, projectName);

      const dockerfile = await readFile(
        join(process.cwd(), projectName, "Dockerfile"),
        "utf-8",
      );
      expect(dockerfile).toContain("EXPOSE 8080");
      expect(dockerfile).toContain("EXPOSE 8080");
    });

    it("should handle custom hooks in configuration", async () => {
      const projectName = "test-gen-custom-hooks";
      testProjects.push(projectName);

      const config: MCPHooksConfig = {
        target: {
          mode: "local",
          command: "node server.js",
        },
        proxy: {
          mode: "local",
          port: 3000,
        },
        hooksOrder: [
          { type: "built-in", name: "SimpleLogHook" },
          {
            type: "custom",
            alias: "MyHook",
            url: "http://localhost:5000",
          },
        ],
      };

      await generateProject(config, projectName);

      const configContent = await readFile(
        join(process.cwd(), projectName, "mcphooks.config.json"),
        "utf-8",
      );
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.hooksOrder[1].type).toBe("custom");
      expect(savedConfig.hooksOrder[1].alias).toBe("MyHook");
      expect(savedConfig.hooksOrder[1].url).toBe("http://localhost:5000");
    });

    it("should handle existing directory gracefully", async () => {
      const projectName = "test-gen-existing";
      testProjects.push(projectName);

      // Create directory first
      const projectPath = join(process.cwd(), projectName);
      await mkdir(projectPath, { recursive: true });

      // Create a test file to verify write permission
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(join(projectPath, "test.txt"), "test"),
      );
      await rm(join(projectPath, "test.txt"));

      const config: MCPHooksConfig = {
        target: {
          mode: "local",
          command: "node server.js",
        },
        proxy: {
          mode: "local",
          port: 3000,
        },
        hooksOrder: [],
      };

      // Should not throw
      await expect(
        generateProject(config, projectName),
      ).resolves.toBeUndefined();

      // Files should still be created
      await expect(
        access(join(projectPath, "mcphooks.config.json")),
      ).resolves.toBeUndefined();
    });

    it("should not overwrite existing package.json", async () => {
      const projectName = "test-gen-preserve-package";
      testProjects.push(projectName);

      // Create directory and existing package.json
      const projectPath = join(process.cwd(), projectName);
      await mkdir(projectPath, { recursive: true });

      const existingPackageJson = {
        name: "existing-project",
        version: "2.0.0",
        description: "Should not be overwritten",
      };
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        join(projectPath, "package.json"),
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8",
      );

      // Test write permission first
      await writeFile(join(projectPath, "test.txt"), "test");
      await rm(join(projectPath, "test.txt"));

      const config: MCPHooksConfig = {
        target: {
          mode: "local",
          command: "node server.js",
        },
        proxy: {
          mode: "local",
          port: 3000,
        },
        hooksOrder: [],
      };

      await generateProject(config, projectName);

      // Verify package.json was not overwritten
      const packageJson = JSON.parse(
        await readFile(join(projectPath, "package.json"), "utf-8"),
      );
      expect(packageJson.name).toBe("existing-project");
      expect(packageJson.version).toBe("2.0.0");
    });

    it("should handle file system errors gracefully", async () => {
      const projectName = "test-filesystem-error";
      testProjects.push(projectName);

      // Create an invalid config that will fail validation
      const config: MCPHooksConfig = {
        target: {
          mode: "local",
          command: "", // Empty command should fail
        },
        proxy: {
          mode: "local",
          port: 3000,
        },
        hooksOrder: [],
      };

      await expect(generateProject(config, projectName)).rejects.toThrow();
    });
  });
});
