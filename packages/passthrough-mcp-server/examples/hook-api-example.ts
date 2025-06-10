/**
 * Example: Using the Hook API
 *
 * This example demonstrates how to use the hook API
 * for integrating hooks into your services.
 */

import {
  AbstractHook,
  type HookClient,
  type HookResponse,
  type HookResult,
  type ToolCall,
  applyHooks,
  createHookClient,
  createHookClients,
} from "@civic/passthrough-mcp-server";

/**
 * Example: Create a validation hook using AbstractHook
 */
class ValidationHook extends AbstractHook {
  name = "validation-hook";

  private allowedTools = ["search", "calculate", "format"];

  async processRequest(toolCall: ToolCall): Promise<HookResponse> {
    // Check if tool is allowed
    if (!this.allowedTools.includes(toolCall.name)) {
      return {
        response: "abort",
        reason: `Tool '${toolCall.name}' is not allowed`,
        body: { error: "Forbidden tool" },
      };
    }

    // All validations passed
    return { response: "continue", body: toolCall };
  }
}

/**
 * Example integration showing how to use the hook API
 */
async function processToolCallWithHooks(toolCall: ToolCall): Promise<unknown> {
  // Create hook clients from definitions
  const hooks: HookClient[] = createHookClients([
    new ValidationHook(), // Local hook instance
    { url: "http://audit-service.example.com/hook" }, // Remote hook URL
  ]);

  // Apply request hooks
  const requestResult: HookResult = await applyHooks(
    "request",
    hooks,
    toolCall,
  );

  if (requestResult.rejected) {
    console.error("Request rejected:", requestResult.rejectionReason);
    return {
      error: requestResult.rejectionReason,
      status: "rejected",
    };
  }

  // Process the tool call (this would be your actual tool execution)
  const response = await executeToolCall(requestResult.data as ToolCall);

  // Apply response hooks
  const responseResult: HookResult = await applyHooks(
    "response",
    hooks,
    response,
    { toolCall: requestResult.data as ToolCall },
  );

  if (responseResult.rejected) {
    console.error("Response rejected:", responseResult.rejectionReason);
    return {
      error: responseResult.rejectionReason,
      status: "rejected",
    };
  }

  return responseResult.data;
}

/**
 * Integration pattern for service classes
 */
class ToolService {
  private hooks: HookClient[];

  constructor(
    hookDefinitions: Array<AbstractHook | { url: string; name?: string }>,
  ) {
    this.hooks = createHookClients(hookDefinitions);
  }

  async execute(toolCall: ToolCall): Promise<unknown> {
    // Apply request hooks
    const { data, rejected, rejectionReason } = await applyHooks(
      "request",
      this.hooks,
      toolCall,
    );

    if (rejected) {
      throw new Error(`Request rejected: ${rejectionReason}`);
    }

    // Execute the tool
    const response = await this.executeInternal(data as ToolCall);

    // Apply response hooks
    const responseResult = await applyHooks("response", this.hooks, response, {
      toolCall: data as ToolCall,
    });

    if (responseResult.rejected) {
      throw new Error(`Response rejected: ${responseResult.rejectionReason}`);
    }

    return responseResult.data;
  }

  private async executeInternal(toolCall: ToolCall): Promise<unknown> {
    // Your actual tool execution logic here
    console.log(`Executing tool: ${toolCall.name}`);
    return {
      result: `Executed ${toolCall.name}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// Helper function to simulate tool execution
async function executeToolCall(toolCall: ToolCall): Promise<unknown> {
  console.log(`Executing tool: ${toolCall.name}`);

  // Simulate different tool responses
  switch (toolCall.name) {
    case "search":
      return {
        results: [
          { title: "Result 1", url: "https://example.com/1" },
          { title: "Result 2", url: "https://example.com/2" },
        ],
        query: (toolCall.arguments as { query: string }).query,
      };

    case "calculate":
      return {
        result: 42,
        expression: (toolCall.arguments as { expression: string }).expression,
      };

    default:
      return {
        result: `Executed ${toolCall.name}`,
        timestamp: new Date().toISOString(),
      };
  }
}

// Example usage
async function main() {
  // Example 1: Direct usage
  console.log("=== Example 1: Direct Usage ===");
  const searchCall: ToolCall = {
    name: "search",
    arguments: { query: "MCP hooks" },
  };

  const result1 = await processToolCallWithHooks(searchCall);
  console.log("Search result:", result1);

  // Example 2: Forbidden tool
  console.log("\n=== Example 2: Forbidden Tool ===");
  const forbiddenCall: ToolCall = {
    name: "delete",
    arguments: { id: "123" },
  };

  const result2 = await processToolCallWithHooks(forbiddenCall);
  console.log("Forbidden result:", result2);

  // Example 3: Using the service class
  console.log("\n=== Example 3: Service Class Usage ===");
  const service = new ToolService([
    new ValidationHook(),
    // Add more hooks as needed
  ]);

  try {
    const result3 = await service.execute({
      name: "calculate",
      arguments: { expression: "2 + 2" },
    });
    console.log("Calculation result:", result3);
  } catch (error) {
    console.error("Service error:", error);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
