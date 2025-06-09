# MCP Passthrough Proxy Builder

A CLI wizard for creating Model Context Protocol (MCP) passthrough proxies with hooks in minutes.

## Quick Start

```bash
npx @civic/passthrough-proxy-builder init my-proxy
```

Or use the shorter alias:

```bash
npx @civic/ppb init my-proxy
```

## Features

- 🚀 Interactive wizard for easy configuration
- 🪝 Built-in hooks (SimpleLog, Audit, Guardrail, Explain, CustomDescription)
- 🔗 Support for custom hooks via URLs
- 🐳 Automatic Dockerfile generation
- 📝 TypeScript configuration support
- ⚡ Fast setup with sensible defaults

## Usage

### Interactive Mode

Run the wizard interactively:

```bash
npx @civic/passthrough-proxy-builder init [project-name]
```

### Non-Interactive Mode

Provide all options via command line:

```bash
npx @civic/passthrough-proxy-builder init my-proxy \
  --target-mode remote \
  --target-url "https://api.example.com:8000" \
  --proxy-port 3000 \
  --hooks SimpleLogHook AuditHook
```

### Options

- `--target-mode <mode>` - Target server mode: `local` or `remote`
- `--target-command <command>` - Command to start local MCP server
- `--target-url <url>` - URL of remote MCP server
- `--proxy-port <port>` - Port for the proxy server (default: 3000)
- `--hooks <hooks...>` - List of hooks to enable

## Available Hooks

- **SimpleLogHook** - Logs all MCP messages
- **AuditHook** - Tracks and audits MCP operations
- **GuardrailHook** - Enforces security policies
- **ExplainHook** - Adds explanations to responses
- **CustomDescriptionHook** - Modifies tool descriptions

## Custom Hooks

You can add custom hooks by selecting "Add Custom Hook" in the wizard and providing:
- Hook URL (HTTP endpoint)
- Alias (friendly name)

## Generated Files

The CLI creates:
- `mcphooks.config.json` - Proxy configuration
- `Dockerfile` - Ready-to-build Docker image
- `.dockerignore` - Docker ignore rules
- `package.json` - Node.js package configuration

## Building and Running

After generation:

```bash
cd my-proxy
docker build -t mcp-proxy .
docker run -p 3000:3000 mcp-proxy
```

## License

MIT