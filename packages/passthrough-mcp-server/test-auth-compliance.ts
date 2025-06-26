#!/usr/bin/env tsx
/**
 * Auth Compliance Test for httpStream Transport
 * 
 * Tests that the passthrough-mcp-server correctly forwards authorization headers
 * to the target server when using httpStream transport.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const WHOAMI_PORT = 33008;
const PASSTHROUGH_PORT = 34000;

/**
 * Create an MCP client
 */
function createMCPClient(): Client {
  return new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });
}

/**
 * Main test function
 */
async function runAuthComplianceTest(): Promise<void> {
  try {
    console.log("=== Auth Compliance Test for httpStream Transport ===\n");
    
    console.log("Assuming servers are already running:");
    console.log(`- Whoami server on port ${WHOAMI_PORT}`);
    console.log(`- Passthrough server on port ${PASSTHROUGH_PORT} (configured to target whoami server)\n`);
    
    // Step 3: Test unauthenticated request (should fail)
    console.log("3. Testing unauthenticated request (should fail)");
    const unauthClient = createMCPClient();
    const unauthTransport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${PASSTHROUGH_PORT}/mcp`)
    );
    
    try {
      await unauthClient.connect(unauthTransport);
      const tools = await unauthClient.listTools();
      console.error("   ✗ FAILED: Unauthenticated request should have failed");
      console.error("   Found tools:", tools);
      process.exit(1);
    } catch (error: any) {
      console.log("   ✓ Correctly rejected unauthenticated request:", error.message);
    }
    console.log();
    
    // Step 4: Test authenticated request (should succeed)
    console.log("4. Testing authenticated request (should succeed)");
    const authToken = "test-user-token";
    const authClient = createMCPClient();
    const authTransport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${PASSTHROUGH_PORT}/mcp`),
      {
        requestInit: {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      } as any
    );
    
    try {
      await authClient.connect(authTransport);
      
      // List tools
      const toolsResult = await authClient.listTools();
      console.log("   ✓ Successfully listed tools:", toolsResult.tools.map(t => t.name).join(", "));
      
      // Call whoami tool
      const whoamiResult = await authClient.callTool({
        name: "whoami",
        arguments: {}
      });
      console.log("   ✓ Successfully called whoami tool:", whoamiResult.content[0]?.text);
      
      // Verify the response contains the authenticated user
      const responseText = whoamiResult.content[0]?.text || "";
      if (!responseText.includes("Hello test-user-token!")) {
        console.error("   ✗ FAILED: Expected authenticated response");
        process.exit(1);
      }
      console.log("   ✓ Auth headers correctly passed through\n");
      
    } catch (error: any) {
      console.error("   ✗ FAILED: Authenticated request failed:", error);
      process.exit(1);
    }
    
    // Step 5: Test with different auth token
    console.log("5. Testing with different auth token");
    const authToken2 = "another-user-token";
    const authClient2 = createMCPClient();
    const authTransport2 = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${PASSTHROUGH_PORT}/mcp`),
      {
        requestInit: {
          headers: {
            "Authorization": `Bearer ${authToken2}`
          }
        }
      } as any
    );
    
    try {
      await authClient2.connect(authTransport2);
      
      const whoamiResult2 = await authClient2.callTool({
        name: "whoami",
        arguments: {}
      });
      const responseText2 = whoamiResult2.content[0]?.text || "";
      
      if (!responseText2.includes("Hello another-user-token!")) {
        console.error("   ✗ FAILED: Expected different authenticated response");
        process.exit(1);
      }
      console.log("   ✓ Different auth token correctly handled:", responseText2);
      
    } catch (error: any) {
      console.error("   ✗ FAILED: Second authenticated request failed:", error);
      process.exit(1);
    }
    
    console.log("\n=== All auth compliance tests passed! ===");
    
  } catch (error) {
    console.error("\n=== Test failed with error ===");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runAuthComplianceTest().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});