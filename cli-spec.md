Updated CLI Spec for MCPHooks Proxy (Node.js/TypeScript)

⸻

1. Overview
   •	Goal: Provide a CLI "wizard" that generates and boots a pass-through proxy for any MCP server, with user-selected hooks.
   •	Language: Node.js (TypeScript + tsx)
   •	Prompts/UI: Inquirer.js (interactive arrow-key lists) + Commander.js for any flags/subcommands
   •	Config Output: JSON (one file, e.g. mcphooks.config.json)
   •	Built-in Hooks: All hooks from the monorepo are included as direct dependencies and instantiated programmatically
   •	Distribution: Published as @civic/passthrough-proxy-builder on npm, executable via npx
   •	Usage: `npx @civic/passthrough-proxy-builder init` (no installation required)
   •	Deployment (v1): Always produce a Dockerfile + instructions. (Later we can add "deploy to Fly.io/Cloudflare" steps.)

⸻

2. Wizard Flow
    1.	Initial Target/Proxy Choice
          •	Q1: "Is your target MCP server running locally or remotely?" (choices: Local / Remote)
          •	Q2 (if Remote): "Should your client connect to a local proxy or a remote proxy?" (choices: Local proxy / Remote proxy / I'll decide later)
          •	Note: v1 Docker approach treats "local" vs "remote" the same—users build the image and run it wherever they like. We'll still record their choice for future config hints.
          •	Q3 (if Local target): "Enter the command to start your local MCP server (e.g. node dist/server.js --port 5555):"
          •	The final proxy will spawn that command under the hood and proxy its STDIO.
          •	Q4 (if Remote target): "Enter the remote MCP server URL (e.g. https://api.my-mcp.com:8000)."
    2.	Hook Selection
          •	Display a multi-select list (toggle with Space) of all built-in hooks from the monorepo:
          •	✅ AuditHook
          •	✅ ExplainHook
          •	✅ CustomDescriptionHook
          •	✅ GuardRailHook
          •	✅ SimpleLogHook
          •	Extra option: CustomHook
          •	If chosen, prompt:
    1.	"Enter the full URL for your custom hook endpoint:"
    2.	"Give this custom hook a short alias/name:"
          •	Note: Built-in hooks no longer require URLs as they are imported directly from their packages
          •	Immediately add { alias, url } to the list; then ask "Add another CustomHook?" (Yes/No). Repeat as needed.
          •	Result: an ordered list of hook-identifiers (built-in names as strings or custom {alias:url} objects).
    3.	Hook Ordering
          •	Show selected hooks in a vertical list.
          •	UI Behavior:
          •	Navigate list with ↑/↓.
          •	Press Space on a hook → it "lifts" (highlighted) → move it with ↑/↓ → Space again to drop.
          •	After ordering, tab/↓ to a "Continue" option. Press Enter to confirm.
          •	Final ordering is captured in hooksOrder: [ … ].
    4.	(Skip per-hook config for now)
          •	All built-ins run with default settings.
          •	CustomHooks use the provided URL directly (no extra config).
          •	Future version can add per-hook prompt blocks here.
    5.	Deployment Output (Docker-only for v1)
          •	Dockerfile Template:

FROM node:18-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
COPY mcphooks.config.json ./mcphooks.config.json
RUN yarn build
EXPOSE 8080
CMD ["node", "dist/cli.js", "start-proxy", "--config", "mcphooks.config.json"]

		•	Adjust base image, build steps, and entrypoint as needed.

		•	Generate mcphooks.config.json containing:

{
"target": {
"mode": "local" | "remote",
// if local: "command": "<user-provided command>"
// if remote: "url": "https://…"
},
"proxy": {
"mode": "local" | "remote",           // (for future use)
"port": 8080                          // default or prompt if you like
},
"hooksOrder": [
// e.g. ["AuditHook", {"alias":"MyCustom","url":"https://…"}, "GuardRailHook"]
// Built-in hooks are just strings, custom hooks are objects with alias and url
]
}


		•	Post-wizard Instructions (printed in terminal):
		1.	docker build -t mcphooks-proxy .
		2.	docker run -p <hostPort>:8080 mcphooks-proxy
		3.	"Then point your MCP client at http://localhost:<hostPort>."

		6.	Summary & Exit
		•	Print a one-page summary:

=== MCPHooks Proxy Configured ===
Target: [Local or Remote] → <command or URL>
Hooks (in order):
1. AuditHook
2. MyCustom (https://…)
3. GuardRailHook
   Docker commands:
   docker build -t mcphooks-proxy .
   docker run -p 8080:8080 mcphooks-proxy
   ==================================


		•	Exit.

⸻

3. Distribution & Usage
   •	NPM Package: @civic/passthrough-proxy-builder
   •	Installation: NOT required - use npx directly
   •	Basic Usage:
     # Run the wizard
     npx @civic/passthrough-proxy-builder init
     
     # Or with a pre-existing config
     npx @civic/passthrough-proxy-builder start --config mcphooks.config.json
   •	What's Included:
     •	All built-in hooks are bundled with the CLI package
     •	No separate hook installation needed
     •	Single download includes everything
   •	Version Management:
     •	The CLI package manages compatible versions of all hooks
     •	Users always get a working combination of proxy + hooks

⸻

4. Implementation Details
   •	Package Name: @civic/passthrough-proxy-builder
   •	Directory Layout (monorepo)

/packages/passthrough-proxy-builder/
/src/
cli.ts           ← entrypoint (Commander setup)
prompts.ts       ← Inquirer prompt definitions
config.ts        ← Types/validation for mcphooks.config.json
generator.ts     ← Code that writes Dockerfile + config.json + helper scripts
hooks.ts         ← Maps hook names to their imported classes
/templates/
Dockerfile.ejs   ← Dockerfile template (EJS or similar)
README.ejs       ← (optional) template for user instructions
package.json
tsconfig.json


		•	Commander Setup (cli.ts)
		•	Executable name: passthrough-proxy-builder (or ppb for short)
		•	Primary command: init → runs the wizard
		•	Usage: `npx @civic/passthrough-proxy-builder init`
		•	(Optional) start --config mcphooks.config.json → skip wizard, run proxy directly with built-in hooks
		•	Prompt Definitions (prompts.ts)
		•	Use Inquirer.js to define each question block.
		•	For hook ordering, use inquirer-sortable-list or similar library that supports "lift and move" via arrow keys.
		•	Hook Registration (hooks.ts)
		•	Import all built-in hooks:

import { AuditHook } from '@mcphooks/audit-hook';
import { GuardRailHook } from '@mcphooks/guardrail-hook';
import { ExplainHook } from '@mcphooks/explain-hook';
import { CustomDescriptionHook } from '@mcphooks/custom-description-hook';
import { SimpleLogHook } from '@mcphooks/simple-log-hook';

export const BUILT_IN_HOOKS = {
  'AuditHook': AuditHook,
  'GuardRailHook': GuardRailHook,
  'ExplainHook': ExplainHook,
  'CustomDescriptionHook': CustomDescriptionHook,
  'SimpleLogHook': SimpleLogHook
};

		•	In the proxy runtime, programmatically instantiate hooks based on config:

for (const hookEntry of config.hooksOrder) {
  if (typeof hookEntry === 'string') {
    // Built-in hook - instantiate directly
    const HookClass = BUILT_IN_HOOKS[hookEntry];
    if (HookClass) {
      proxy.registerHook(new HookClass());
    }
  } else {
    // Custom external hook - connect via URL
    proxy.registerExternalHook(hookEntry.alias, hookEntry.url);
  }
}

		•	Config Validation (config.ts)
		•	Define a TypeScript interface:

// Simplified - built-in hooks are just strings now
type HookEntry = string | { alias: string; url: string };

interface TargetConfig {
mode: "local" | "remote";
command?: string;     // if local
url?: string;         // if remote
}
interface ProxyConfig {
mode: "local" | "remote"; // recorded for future
port: number;
}
interface MCPHooksConfig {
target: TargetConfig;
proxy: ProxyConfig;
hooksOrder: HookEntry[];
}


		•	After wizard, write mcphooks.config.json to disk.

		•	Dockerfile Generation (generator.ts)
		•	Render Dockerfile.ejs using the chosen Node base and copying in built CLI.
		•	Since all built-in hooks are now bundled within the proxy, the Docker image is simpler.
		•	Package.json Configuration
		•	Package includes all hooks as bundled dependencies:

{
  "name": "@civic/passthrough-proxy-builder",
  "version": "1.0.0",
  "bin": {
    "passthrough-proxy-builder": "./dist/cli.js",
    "ppb": "./dist/cli.js"
  },
  "dependencies": {
    "@mcphooks/audit-hook": "workspace:*",
    "@mcphooks/guardrail-hook": "workspace:*",
    "@mcphooks/explain-hook": "workspace:*",
    "@mcphooks/custom-description-hook": "workspace:*",
    "@mcphooks/simple-log-hook": "workspace:*",
    "@mcphooks/passthrough-proxy": "workspace:*",
    "commander": "^9.0.0",
    "inquirer": "^9.0.0",
    "ejs": "^3.1.0",
    "chalk": "^5.0.0"
  }
}

		•	Running the Proxy
		•	In v1, user always runs inside Docker: container's CMD runs node dist/cli.js start-proxy --config /app/mcphooks.config.json.
		•	The proxy instantiates built-in hooks programmatically, eliminating inter-process communication overhead.
		•	Custom hooks still connect via HTTP/WebSocket to their external URLs.

⸻

5. Future Considerations (Beyond v1)
    1.	Deploy-to-Cloud Feature
          •	Ask in wizard: "Would you like to deploy toFly.io / Cloudflare / GCP?"
          •	If yes, prompt for API key (or read from environment).
          •	Generate and run fly.toml or relevant Cloudflare Worker code.
    2.	SSL/Auth
          •	Auto-generate self-signed certs for HTTPS in local mode.
          •	Add username/password or JWT auth.
    3.	YAML Support
          •	Detect .yml or .yaml extension; parse/write via js-yaml.
    4.	Per-Hook Configuration
          •	After "Hook Ordering," ask additional questions for built-ins (e.g. "For GuardRailHook: upload wordlist?").
    5.	Standalone Binary Distribution
          •	Use pkg or nexe to ship single executable (no Docker) for local usage.

⸻

Detailed Implementation Plan:
1.	✅ Create packages/passthrough-proxy-builder directory structure in the monorepo
2.	✅ Initialize package.json with name @civic/passthrough-proxy-builder and all hook dependencies
3.	✅ Set up TypeScript configuration extending the monorepo's base tsconfig
4.	✅ Install Commander.js, Inquirer.js, EJS, and chalk as dependencies
5.	Create cli.ts with Commander setup and main entry point
6.	Define TypeScript interfaces for config structure in config.ts
7.	Create hooks.ts that imports and exports all built-in hook classes:
    a. Import each hook from its workspace package (e.g., from '@mcphooks/audit-hook')
    b. Configure esbuild/rollup to bundle all workspace dependencies at build time
    c. Set bundle: true to include all hook code in the output
    d. Mark only truly external dependencies (like 'fs', 'path') as external
    e. This creates a self-contained bundle with all hooks included in the npm package
8.	Implement target server prompts (local vs remote) in prompts.ts
9.	Build multi-select prompt for hook selection with custom hook option
10.	Create hook ordering prompt with arrow-key reordering functionality
11.	Add validation logic for user inputs and config structure
12.	Create Dockerfile.ejs template for generated Docker images
13.	Build generator.ts to write config.json and render Dockerfile
14.	Add file system utilities for creating output directories
15.	Implement custom hook URL prompt flow with alias naming
16.	Create formatted terminal output for summary and instructions
17.	Add error handling for file operations and user cancellations
18.	Set up bin entries in package.json for CLI executables
19.	Add build script with esbuild to bundle everything:
    a. Configure esbuild to bundle cli.ts as entry point
    b. Include all @mcphooks/* workspace packages in the bundle
    c. Output a single cli.js file containing all code
    d. Generate executable wrapper for bin entry
20.	Create integration tests that simulate the full wizard flow
21.	Update monorepo build configuration to include the new package
22.	Test the complete flow from npx command to running Docker container