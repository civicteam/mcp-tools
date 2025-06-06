import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { readConfig } from "./config.js";
import { runWizard } from "./prompts.js";
import { startProxy } from "./proxy.js";

// Read package.json version
const packageJson = { version: "1.0.0" }; // Hardcoded for bundled CLI

const program = new Command();

program
  .name("passthrough-proxy-builder")
  .description("CLI wizard for creating MCP passthrough proxies with hooks")
  .version(packageJson.version);

program
  .command("init [project-directory]")
  .description("Run the interactive wizard to configure your proxy")
  .action(async (projectDirectory?: string) => {
    console.log(chalk.blue.bold("\n🚀 MCP Passthrough Proxy Builder\n"));
    try {
      await runWizard(projectDirectory);
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
