import { auth } from "@civic/auth-mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33008;

// Create your Express app
const app = express();
app.use(cors());

// Add auth middleware
app.use(await auth());

// Create your MCP server
async function getServer() {
  const server = new McpServer({
    name: "whoami-mcp-server",
    version: "1.0.0",
  });

  // Register your tools
  server.tool(
    "whoami",
    "Get information about the current user",
    {},
    async (_, extra) => {
      // Access the authenticated user's information
      const user = extra.authInfo?.extra?.sub;
      return {
        content: [
          {
            type: "text",
            text: `Hello ${user}!`,
          },
        ],
      };
    },
  );

  // Set up the transport layer
  // In production you may need session management
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  return { transport, server };
}

// Set up MCP endpoint
app.post("/mcp", async (req, res) => {
  const { transport, server } = await getServer();
  await transport.handleRequest(req, res, req.body);
  res.on("close", () => {
    transport.close();
    server.close();
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`MCP server with Civic Auth running at http://localhost:${PORT}`);
  console.log(
    `OAuth metadata available at http://localhost:${PORT}/.well-known/oauth-protected-resource`,
  );
  console.log("\nMCP clients will authenticate directly with Civic Auth!");
});
