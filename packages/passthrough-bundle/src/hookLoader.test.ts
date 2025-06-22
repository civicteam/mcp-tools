import { describe, expect, it, vi } from "vitest";
import { createHookDefinition, loadHooks } from "./hookLoader.js";

// Mock the dynamic imports
vi.mock("@civic/simple-log-hook/hook", () => ({
  default: class SimpleLogHook {
    name = "SimpleLogHook";
    async processRequest(toolCall: unknown) {
      return { response: "continue", body: toolCall };
    }
    async processResponse(response: unknown) {
      return { response: "continue", body: response };
    }
  },
}));

vi.mock("@civic/audit-hook/hook", () => ({
  default: class AuditHook {
    name = "AuditHook";
    logger: unknown;
    constructor(logger: unknown) {
      this.logger = logger;
    }
    async processRequest(toolCall: unknown) {
      return { response: "continue", body: toolCall };
    }
    async processResponse(response: unknown) {
      return { response: "continue", body: response };
    }
  },
}));

vi.mock("@civic/guardrail-hook/hook", () => ({
  default: class GuardrailHook {
    name = "GuardrailHook";
    async processRequest(toolCall: unknown) {
      return { response: "continue", body: toolCall };
    }
    async processResponse(response: unknown) {
      return { response: "continue", body: response };
    }
  },
}));

describe("hookLoader", () => {
  describe("createHookDefinition", () => {
    it("should create a remote hook definition from URL", async () => {
      const result = await createHookDefinition({
        url: "http://localhost:8080",
        name: "CustomHook",
      });

      expect(result).toEqual({
        url: "http://localhost:8080",
        name: "CustomHook",
      });
    });

    it("should load built-in hook as Hook instance", async () => {
      const result = await createHookDefinition({
        name: "SimpleLogHook",
      });

      // Result should be a Hook instance
      expect(result).toHaveProperty("name", "SimpleLogHook");
      expect(result).toHaveProperty("processRequest");
      expect(result).toHaveProperty("processResponse");
    });

    it("should throw for unknown hook names", async () => {
      await expect(
        createHookDefinition({
          name: "UnknownHook",
        }),
      ).rejects.toThrow("Invalid hook configuration");
    });

    it("should throw for empty configuration", async () => {
      await expect(createHookDefinition({})).rejects.toThrow(
        "Invalid hook configuration",
      );
    });
  });

  describe("loadHooks", () => {
    it("should load multiple hooks", async () => {
      const hooks = await loadHooks([
        { name: "SimpleLogHook" },
        { url: "http://localhost:9000", name: "CustomHook" },
        { name: "AuditHook" },
      ]);

      expect(hooks).toHaveLength(3);
      // First hook should be a Hook instance
      expect(hooks[0]).toHaveProperty("name", "SimpleLogHook");
      expect(hooks[0]).toHaveProperty("processRequest");
      // Second hook should be a RemoteHookConfig
      expect(hooks[1]).toEqual({
        url: "http://localhost:9000",
        name: "CustomHook",
      });
      // Third hook should be a Hook instance
      expect(hooks[2]).toHaveProperty("name", "AuditHook");
      expect(hooks[2]).toHaveProperty("processRequest");
    });

    it("should continue loading when one hook fails", async () => {
      const hooks = await loadHooks([
        { name: "SimpleLogHook" },
        { name: "InvalidHook" }, // This will fail
        { name: "AuditHook" },
      ]);

      expect(hooks).toHaveLength(2);
      expect(hooks[0]).toHaveProperty("name", "SimpleLogHook");
      expect(hooks[1]).toHaveProperty("name", "AuditHook");
    });
  });
});
