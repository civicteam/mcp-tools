import { describe, expect, it } from "vitest";
import {
  type HookResponse,
  HookResponseSchema,
  type ToolCall,
  type ToolCallMetadata,
  ToolCallMetadataSchema,
  ToolCallSchema,
} from "./types.js";

describe("ToolCallMetadataSchema", () => {
  it("should validate correct metadata", () => {
    const validMetadata: ToolCallMetadata = {
      sessionId: "test-session",
      timestamp: "2024-01-01T00:00:00Z",
      source: "test-source",
    };

    const result = ToolCallMetadataSchema.parse(validMetadata);
    expect(result).toEqual(validMetadata);
  });

  it("should validate metadata without optional source", () => {
    const validMetadata = {
      sessionId: "test-session",
      timestamp: "2024-01-01T00:00:00Z",
    };

    const result = ToolCallMetadataSchema.parse(validMetadata);
    expect(result).toEqual(validMetadata);
  });

  it("should allow additional properties with passthrough", () => {
    const metadataWithExtra = {
      sessionId: "test-session",
      timestamp: "2024-01-01T00:00:00Z",
      extraField: "extra-value",
    };

    const result = ToolCallMetadataSchema.parse(metadataWithExtra);
    expect(result).toEqual(metadataWithExtra);
  });

  it("should fail on missing required fields", () => {
    expect(() => ToolCallMetadataSchema.parse({})).toThrow();
    expect(() => ToolCallMetadataSchema.parse({ sessionId: "test" })).toThrow();
    expect(() =>
      ToolCallMetadataSchema.parse({ timestamp: "2024-01-01" }),
    ).toThrow();
  });
});

describe("ToolCallSchema", () => {
  it("should validate correct tool call", () => {
    const validToolCall: ToolCall = {
      name: "test-tool",
      arguments: { key: "value" },
    };

    const result = ToolCallSchema.parse(validToolCall);
    expect(result).toEqual(validToolCall);
  });

  it("should validate tool call with metadata", () => {
    const validToolCall: ToolCall = {
      name: "test-tool",
      arguments: { key: "value" },
      metadata: {
        sessionId: "test-session",
        timestamp: "2024-01-01T00:00:00Z",
      },
    };

    const result = ToolCallSchema.parse(validToolCall);
    expect(result).toEqual(validToolCall);
  });

  it("should accept any type for arguments", () => {
    const testCases = [
      { arguments: null },
      { arguments: "string" },
      { arguments: 123 },
      { arguments: true },
      { arguments: [] },
      { arguments: {} },
      { arguments: undefined },
    ];

    for (const testCase of testCases) {
      const toolCall = {
        name: "test-tool",
        ...testCase,
      };

      const result = ToolCallSchema.parse(toolCall);
      expect(result.arguments).toBe(testCase.arguments);
    }
  });

  it("should fail on missing required fields", () => {
    expect(() => ToolCallSchema.parse({})).toThrow();
    // arguments field accepts undefined as it's z.unknown()
    const parsed = ToolCallSchema.parse({ name: "test" });
    expect(parsed).toEqual({ name: "test", arguments: undefined });
    expect(() => ToolCallSchema.parse({ arguments: {} })).toThrow();
  });

  it("should fail on invalid metadata", () => {
    const invalidToolCall = {
      name: "test-tool",
      arguments: {},
      metadata: { invalid: "metadata" },
    };

    expect(() => ToolCallSchema.parse(invalidToolCall)).toThrow();
  });
});

describe("HookResponseSchema", () => {
  it("should validate continue response", () => {
    const validResponse: HookResponse = {
      response: "continue",
      body: { modified: "data" },
    };

    const result = HookResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  it("should validate abort response with reason", () => {
    const validResponse: HookResponse = {
      response: "abort",
      body: null,
      reason: "Security violation detected",
    };

    const result = HookResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  it("should validate response without optional reason", () => {
    const validResponse: HookResponse = {
      response: "continue",
      body: "result",
    };

    const result = HookResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  it("should accept any type for body", () => {
    const testCases = [
      { body: null },
      { body: "string" },
      { body: 123 },
      { body: true },
      { body: [] },
      { body: {} },
      { body: undefined },
    ];

    for (const testCase of testCases) {
      const response = {
        response: "continue" as const,
        ...testCase,
      };

      const result = HookResponseSchema.parse(response);
      expect(result.body).toBe(testCase.body);
    }
  });

  it("should fail on invalid response type", () => {
    const invalidResponse = {
      response: "invalid",
      body: {},
    };

    expect(() => HookResponseSchema.parse(invalidResponse)).toThrow();
  });

  it("should fail on missing required fields", () => {
    expect(() => HookResponseSchema.parse({})).toThrow();
    // body field accepts undefined as it's z.unknown()
    const parsed = HookResponseSchema.parse({ response: "continue" });
    expect(parsed).toEqual({ response: "continue", body: undefined });
    expect(() => HookResponseSchema.parse({ body: {} })).toThrow();
  });
});

describe("Type exports", () => {
  it("should export ToolCall type", () => {
    const toolCall: ToolCall = {
      name: "test",
      arguments: {},
    };
    expect(toolCall).toBeDefined();
  });

  it("should export HookResponse type", () => {
    const response: HookResponse = {
      response: "continue",
      body: {},
    };
    expect(response).toBeDefined();
  });

  it("should export ToolCallMetadata type", () => {
    const metadata: ToolCallMetadata = {
      sessionId: "test",
      timestamp: "2024-01-01",
    };
    expect(metadata).toBeDefined();
  });
});
