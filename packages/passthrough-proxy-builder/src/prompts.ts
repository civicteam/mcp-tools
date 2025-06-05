import chalk from "chalk";
import inquirer from "inquirer";
import {
  type HookEntry,
  type MCPHooksConfig,
  getDefaultConfig,
} from "./config.js";
import { generateProject } from "./generator.js";
import { getBuiltInHookNames } from "./hooks.js";

export async function runWizard(): Promise<void> {
  const config = getDefaultConfig();

  // Step 1: Target server configuration
  const targetAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "targetMode",
      message: "Is your target MCP server running locally or remotely?",
      choices: [
        { name: "Local", value: "local" },
        { name: "Remote", value: "remote" },
      ],
    },
  ]);

  config.target.mode = targetAnswers.targetMode;

  if (config.target.mode === "local") {
    const localAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "command",
        message: "Enter the command to start your local MCP server:",
        default: "node dist/server.js --port 5555",
        validate: (input) => input.trim().length > 0 || "Command is required",
      },
    ]);
    config.target.command = localAnswers.command;
  } else {
    const remoteAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Enter the remote MCP server URL:",
        default: "https://api.my-mcp.com:8000",
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return "Please enter a valid URL";
          }
        },
      },
    ]);
    config.target.url = remoteAnswers.url;

    // For remote targets, ask about proxy location
    const proxyAnswers = await inquirer.prompt([
      {
        type: "list",
        name: "proxyMode",
        message:
          "Should your client connect to a local proxy or a remote proxy?",
        choices: [
          { name: "Local proxy", value: "local" },
          { name: "Remote proxy", value: "remote" },
          { name: "I'll decide later", value: "local" },
        ],
      },
    ]);
    config.proxy.mode =
      proxyAnswers.proxyMode === "I'll decide later"
        ? "local"
        : proxyAnswers.proxyMode;
  }

  // Step 2: Hook selection
  console.log(chalk.yellow("\n✓ Target server configured"));
  console.log(chalk.blue("\n🪝 Select hooks to add to your proxy:\n"));

  const builtInHooks = getBuiltInHookNames();
  const hookChoices = [
    ...builtInHooks.map((name) => ({
      name: name,
      value: name,
      checked: false,
    })),
    new inquirer.Separator(),
    {
      name: "Add Custom Hook (external URL)",
      value: "CUSTOM_HOOK",
      checked: false,
    },
  ];

  const { selectedHooks } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedHooks",
      message: "Select hooks (use Space to toggle, Enter to continue):",
      choices: hookChoices,
      validate: (input) =>
        input.length > 0 || "Please select at least one hook",
    },
  ]);

  // Process selected hooks
  const hooks: HookEntry[] = [];

  for (const hook of selectedHooks) {
    if (hook === "CUSTOM_HOOK") {
      // Handle custom hook - will be implemented in step 15
      console.log(
        chalk.gray("Custom hook URL prompt will be implemented in step 15"),
      );
    } else {
      // Built-in hook
      hooks.push(hook);
    }
  }

  config.hooksOrder = hooks;

  // Placeholder for hook ordering (step 10)
  if (hooks.length > 1) {
    console.log(chalk.gray("\nHook ordering will be implemented in step 10"));
  }

  // Generate the project
  await generateProject(config);
}
