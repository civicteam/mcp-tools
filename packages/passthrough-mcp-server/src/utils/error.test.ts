/**
 * Tests for error utility functions
 */

import { describe, expect, it } from "vitest";
import { messageFromError } from "./error.js";

describe("messageFromError", () => {
  it("should extract message from Error instance", () => {
    const error = new Error("Test error message");
    expect(messageFromError(error)).toBe("Test error message");
  });

  it("should return string errors as-is", () => {
    expect(messageFromError("String error")).toBe("String error");
  });

  it("should extract message property from objects", () => {
    const errorObject = { message: "Object error message", code: 500 };
    expect(messageFromError(errorObject)).toBe("Object error message");
  });

  it("should handle null", () => {
    expect(messageFromError(null)).toBe("Unknown error");
  });

  it("should handle undefined", () => {
    expect(messageFromError(undefined)).toBe("Unknown error");
  });

  it("should handle objects without message property", () => {
    const obj = { code: 404, status: "Not Found" };
    expect(messageFromError(obj)).toBe("Unknown error");
  });

  it("should handle non-string message properties", () => {
    const obj = { message: 123 };
    expect(messageFromError(obj)).toBe("123");
  });

  it("should handle empty string", () => {
    expect(messageFromError("")).toBe("");
  });

  it("should handle boolean values", () => {
    expect(messageFromError(true)).toBe("Unknown error");
    expect(messageFromError(false)).toBe("Unknown error");
  });

  it("should handle number values", () => {
    expect(messageFromError(42)).toBe("Unknown error");
    expect(messageFromError(0)).toBe("Unknown error");
  });
});
