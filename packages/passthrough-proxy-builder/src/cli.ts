import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { readConfig } from "./config.js";
import { type CLIOptions, runWizard } from "./prompts.js";
import { startProxy } from "./proxy.js";

// Read package.json version
const packageJson = { version: "1.0.0" }; // Hardcoded for bundled CLI

const program = new Command();

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n👋 Operation cancelled by user"));
  console.log(chalk.gray("Your project was not created.\n"));
  process.exit(0);
});

program
  .name("passthrough-proxy-builder")
  .description("CLI wizard for creating MCP passthrough proxies with hooks")
  .version(packageJson.version);

program
  .command("init [project-directory]")
  .description("Run the interactive wizard to configure your proxy")
  .option("--target-mode <mode>", "Target server mode: local or remote")
  .option("--target-command <command>", "Command to start local MCP server")
  .option("--target-url <url>", "URL of remote MCP server")
  .option("--proxy-port <port>", "Port for the proxy server", "3000")
  .option(
    "--hooks <hooks...>",
    "List of hooks to enable (e.g., SimpleLogHook AuditHook)",
  )
  .action(async (projectDirectory?: string, options?: CLIOptions) => {
    // Display welcome banner
    const banner = `
╔════════════════════════════════════════════════╗
║      🚀 MCP Passthrough Proxy Builder 🚀       ║
║                                                ║
║   Create custom MCP proxies with hooks in      ║
║   minutes, not hours!                          ║
╚════════════════════════════════════════════════╝`;
    console.log(chalk.cyan(banner));

    try {
      await runWizard(projectDirectory, options);
    } catch (error) {
      console.error(
        chalk.red("\n❌ Error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program
  .command("start")
  .description("Start the proxy with an existing configuration")
  .option("-c, --config <path>", "Path to config file", "mcphooks.config.json")
  .action(async (options) => {
    try {
      const config = await readConfig(options.config);
      console.log(chalk.blue.bold("\n🚀 Starting MCP Passthrough Proxy\n"));
      await startProxy(config);
    } catch (error) {
      console.error(
        chalk.red("\n❌ Error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program.parse();
