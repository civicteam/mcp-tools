#!/usr/bin/env tsx
/**
 * Simple Auth Test
 * 
 * Basic test to verify auth headers are being forwarded
 */

const PASSTHROUGH_PORT = 34000;

async function testAuthHeaders() {
  console.log("=== Simple Auth Header Test ===\n");

  // Test 1: Send request with auth header
  console.log("1. Testing request with Authorization header");
  try {
    const response = await fetch(`http://localhost:${PASSTHROUGH_PORT}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-123'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        },
        id: 1
      })
    });

    console.log("   Response status:", response.status);
    console.log("   Response headers:", Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log("   Response body:", text);
    
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log("   Parsed response:", JSON.stringify(json, null, 2));
      } catch (e) {
        console.log("   (Could not parse as JSON)");
      }
    }
  } catch (error: any) {
    console.error("   Error:", error.message);
  }

  console.log("\n2. Testing request without Authorization header");
  try {
    const response = await fetch(`http://localhost:${PASSTHROUGH_PORT}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        },
        id: 2
      })
    });

    console.log("   Response status:", response.status);
    const text = await response.text();
    console.log("   Response body:", text);
  } catch (error: any) {
    console.error("   Error:", error.message);
  }
}

testAuthHeaders().catch(console.error);