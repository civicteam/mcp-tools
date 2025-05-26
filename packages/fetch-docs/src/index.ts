import { FastMCP } from "fastmcp";
import TurndownService from "turndown";
import { z } from "zod";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 33003;
const USE_STDIO =
  process.argv.includes("--stdio") || process.env.USE_STDIO === "true";

// Initialize TurndownService with minimal configuration
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Remove unnecessary elements
turndownService.addRule("removeUnnecessary", {
  filter: ["script", "style", "noscript", "iframe"],
  replacement: () => "",
});

type FetchUrlResult = { content: string } | { error: string };

const isSuccess = (result: FetchUrlResult): result is { content: string } =>
  "content" in result;

/**
 * Fetches content from a URL and converts HTML to Markdown
 */
async function fetchUrl(url: string): Promise<FetchUrlResult> {
  try {
    // Add timeout for better performance
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Convert to markdown only if HTML
    return {
      content: contentType.includes("text/html")
        ? turndownService.turndown(text)
        : text,
    };
  } catch (error) {
    return {
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Create minimal MCP server
const server = new FastMCP({
  name: "fetch-docs",
  version: "0.0.1",
});

// Add fetch tool with simplified response handling
server.addTool({
  name: "fetch",
  description: "Fetch content from a URL and convert HTML to Markdown",
  parameters: z.object({
    url: z.string().describe("URL to fetch"),
  }),
  execute: async ({ url }) => {
    const result = await fetchUrl(url);
    return {
      content: [
        {
          type: "text",
          text: isSuccess(result) ? result.content : result.error,
        },
      ],
    };
  },
});

// Configure minimal server transport
const serverConfig = USE_STDIO
  ? { transportType: "stdio" as const }
  : {
      transportType: "httpStream" as const,
      httpStream: {
        endpoint: "/stream" as const,
        port: PORT,
      },
    };

// Start server with minimal logging
server.start(serverConfig).then(() => {
  console.error(`Fetch Docs MCP ${USE_STDIO ? "STDIO" : `port ${PORT}`}`);
});
