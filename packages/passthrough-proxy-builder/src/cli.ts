#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { runWizard } from './prompts.js';
import { startProxy } from './proxy.js';
import { readConfig } from './config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('passthrough-proxy-builder')
  .description('CLI wizard for creating MCP passthrough proxies with hooks')
  .version(packageJson.version);

program
  .command('init')
  .description('Run the interactive wizard to configure your proxy')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 MCP Passthrough Proxy Builder\n'));
    try {
      await runWizard();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the proxy with an existing configuration')
  .option('-c, --config <path>', 'Path to config file', 'mcphooks.config.json')
  .action(async (options) => {
    try {
      const config = await readConfig(options.config);
      console.log(chalk.blue.bold('\n🚀 Starting MCP Passthrough Proxy\n'));
      await startProxy(config);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();