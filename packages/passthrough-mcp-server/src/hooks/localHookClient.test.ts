import {
  AbstractHook,
  type HookResponse,
  type ToolCall,
} from "@civic/hook-common";
import { LocalHookClient } from "@civic/hook-common";
import { describe, expect, it } from "vitest";

// Test hook that logs to an array
class TestLoggingHook extends AbstractHook {
  public logs: string[] = [];

  get name(): string {
    return "TestLoggingHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    this.logs.push(`REQUEST: ${toolCall.name}`);
    return {
      response: "continue",
      body: toolCall,
    };
  }

  async processResponse(
    response: unknown,
    originalToolCall: ToolCall,
  ): Promise<HookResponse> {
    this.logs.push(`RESPONSE: ${originalToolCall.name}`);
    return {
      response: "continue",
      body: response,
    };
  }
}

// Test hook that blocks certain operations
class TestValidationHook extends AbstractHook {
  get name(): string {
    return "TestValidationHook";
  }

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    if (toolCall.name.includes("dangerous")) {
      return {
        response: "abort",
        body: null,
        reason: "Dangerous operation blocked",
      };
    }
    return {
      response: "continue",
      body: toolCall,
    };
  }
}

describe("LocalHookClient", () => {
  it("should wrap a Hook instance and expose its name", () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    expect(client.name).toBe("TestLoggingHook");
  });

  it("should process requests through the hook", async () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    const toolCall: ToolCall = {
      name: "fetch",
      arguments: { url: "https://example.com" },
    };

    const response = await client.processRequest(toolCall);

    expect(response.response).toBe("continue");
    expect(response.body).toEqual(toolCall);
    expect(hook.logs).toContain("REQUEST: fetch");
  });

  it("should process responses through the hook", async () => {
    const hook = new TestLoggingHook();
    const client = new LocalHookClient(hook);

    const toolCall: ToolCall = {
      name: "fetch",
      arguments: { url: "https://example.com" },
    };

    const toolResponse = { data: "test response" };

    const response = await client.processResponse(toolResponse, toolCall);

    expect(response.response).toBe("continue");
    expect(response.body).toEqual(toolResponse);
    expect(hook.logs).toContain("RESPONSE: fetch");
  });

  it("should handle hook rejections", async () => {
    const hook = new TestValidationHook();
    const client = new LocalHookClient(hook);

    const toolCall: ToolCall = {
      name: "dangerousOperation",
      arguments: {},
    };

    const response = await client.processRequest(toolCall);

    expect(response.response).toBe("abort");
    expect(response.reason).toBe("Dangerous operation blocked");
  });

  it("should handle hook errors gracefully", async () => {
    // Create a hook that throws an error
    class ErrorHook extends AbstractHook {
      get name(): string {
        return "ErrorHook";
      }

      async processRequest(): Promise<HookResponse> {
        throw new Error("Hook error");
      }
    }

    const hook = new ErrorHook();
    const client = new LocalHookClient(hook);

    const toolCall: ToolCall = {
      name: "test",
      arguments: {},
    };

    // Should return continue response on error
    const response = await client.processRequest(toolCall);

    expect(response.response).toBe("continue");
    expect(response.body).toEqual(toolCall);
  });
});
