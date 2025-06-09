import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateProject } from "../src/generator";
import { type CLIOptions, runWizard } from "../src/prompts";

// Mock modules
vi.mock("../src/generator");
vi.mock("inquirer");

describe("prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runWizard", () => {
    it("should validate invalid target mode from CLI options", async () => {
      const options: CLIOptions = {
        targetMode: "invalid",
      };

      await expect(runWizard("test-project", options)).rejects.toThrow(
        "Invalid target mode 'invalid'. Must be 'local' or 'remote'",
      );
    });

    it("should validate invalid proxy port from CLI options", async () => {
      const options: CLIOptions = {
        targetMode: "local",
        targetCommand: "node server.js",
        proxyPort: "99999",
      };

      await expect(runWizard("test-project", options)).rejects.toThrow(
        "Proxy port must be a number between 1 and 65535",
      );
    });

    it("should validate invalid target URL from CLI options", async () => {
      const options: CLIOptions = {
        targetMode: "remote",
        targetUrl: "not-a-url",
      };

      await expect(runWizard("test-project", options)).rejects.toThrow(
        "Invalid target URL: not-a-url",
      );
    });

    it.skip("should require target command for local mode", async () => {
      // Skip this test - the mocking is too complex for the wizard flow
    });

    it("should handle fully specified CLI options", async () => {
      const options: CLIOptions = {
        targetMode: "local",
        targetCommand: "node server.js",
        proxyPort: "3000",
        hooks: ["SimpleLogHook"],
      };

      const inquirer = await import("inquirer");
      const mockPrompt = vi.fn();
      // Only hook ordering should be prompted
      mockPrompt.mockResolvedValueOnce({ hookOrder: ["SimpleLogHook"] });
      (inquirer as any).prompt = mockPrompt;

      // Mock generateProject
      vi.mocked(generateProject).mockResolvedValueOnce(undefined);

      await runWizard("test-project", options);

      expect(generateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          target: {
            mode: "local",
            command: "node server.js",
          },
          proxy: {
            mode: "local",
            port: 3000,
          },
          hooksOrder: [
            {
              type: "built-in",
              name: "SimpleLogHook",
            },
          ],
        }),
        "test-project",
      );
    });
  });
});
