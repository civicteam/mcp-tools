import { describe, expect, it } from "vitest";
import { createHookDefinition, loadHooks } from "./hookLoader.js";

describe("hookLoader", () => {
  describe("createHookDefinition", () => {
    it("should create a remote hook definition from URL", () => {
      const result = createHookDefinition({
        url: "http://localhost:8080",
        name: "CustomHook",
      });

      expect(result).toEqual({
        url: "http://localhost:8080",
        name: "CustomHook",
      });
    });

    it("should map built-in hook names to default ports", () => {
      const result = createHookDefinition({
        name: "AuditHook",
      });

      expect(result).toEqual({
        url: "http://localhost:33004",
        name: "AuditHook",
      });
    });

    it("should throw for unknown hook names", () => {
      expect(() =>
        createHookDefinition({
          name: "UnknownHook",
        }),
      ).toThrow("Invalid hook configuration");
    });

    it("should throw for empty configuration", () => {
      expect(() => createHookDefinition({})).toThrow(
        "Invalid hook configuration",
      );
    });
  });

  describe("loadHooks", () => {
    it("should load multiple hooks", () => {
      const hooks = loadHooks([
        { name: "SimpleLogHook" },
        { url: "http://localhost:9000", name: "CustomHook" },
        { name: "AuditHook" },
      ]);

      expect(hooks).toHaveLength(3);
      expect(hooks[0]).toEqual({
        url: "http://localhost:33006",
        name: "SimpleLogHook",
      });
      expect(hooks[1]).toEqual({
        url: "http://localhost:9000",
        name: "CustomHook",
      });
      expect(hooks[2]).toEqual({
        url: "http://localhost:33004",
        name: "AuditHook",
      });
    });

    it("should continue loading when one hook fails", () => {
      const hooks = loadHooks([
        { name: "SimpleLogHook" },
        { name: "InvalidHook" }, // This will fail
        { name: "AuditHook" },
      ]);

      expect(hooks).toHaveLength(2);
      expect(hooks[0].name).toBe("SimpleLogHook");
      expect(hooks[1].name).toBe("AuditHook");
    });
  });
});
