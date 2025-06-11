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
          command: "npx some-mcp-server",
        },
        proxy: {
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
        access(join(projectPath, "docker-compose.yml")),
      ).resolves.toBeUndefined();
      await expect(
        access(join(projectPath, ".dockerignore")),
      ).resolves.toBeUndefined();

      // Verify config content
      const configContent = await readFile(
        join(projectPath, "mcphooks.config.json"),
        "utf-8",
      );
      const savedConfig = JSON.parse(configContent);
      expect(savedConfig.target.command).toBe("npx some-mcp-server");
      expect(savedConfig.proxy.port).toBe(3000);
      expect(savedConfig.hooks).toHaveLength(2);

      // Verify Dockerfile content
      const dockerfile = await readFile(
        join(projectPath, "Dockerfile"),
        "utf-8",
      );
      expect(dockerfile).toContain("FROM node:20-alpine");
      expect(dockerfile).toContain("EXPOSE 3000");

      // Verify docker-compose content
      const dockerCompose = await readFile(
        join(projectPath, "docker-compose.yml"),
        "utf-8",
      );
      expect(dockerCompose).toContain("version: '3.8'");
      expect(dockerCompose).toContain("container_name: mcp-proxy");
      expect(dockerCompose).toContain(
        "TARGET_SERVER_COMMAND=npx some-mcp-server",
      );

      // Verify .dockerignore
      const dockerignore = await readFile(
        join(projectPath, ".dockerignore"),
        "utf-8",
      );
      expect(dockerignore).toContain("node_modules");
      expect(dockerignore).toContain(".git");
    });

    it("should handle remote target configuration", async () => {
      const projectName = "test-gen-remote";
      testProjects.push(projectName);

      const config: MCPHooksConfig = {
        target: {
          url: "https://api.example.com",
        },
        proxy: {
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
          command: "node server.js",
        },
        proxy: {
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
      expect(savedConfig.hooks).toHaveLength(2);
      expect(savedConfig.hooks[0].name).toBe("SimpleLogHook");
      expect(savedConfig.hooks[1].name).toBe("MyHook");
      expect(savedConfig.hooks[1].url).toBe("http://localhost:5000");
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
          command: "node server.js",
        },
        proxy: {
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

    it("should handle file system errors gracefully", async () => {
      const projectName = "test-filesystem-error";
      testProjects.push(projectName);

      // Create an invalid config that will fail validation
      const config: MCPHooksConfig = {
        target: {
          command: "node server.js",
        },
        proxy: {
          port: 70000, // Invalid port number
        },
        hooksOrder: [],
      };

      await expect(generateProject(config, projectName)).rejects.toThrow();
    });
  });
});
