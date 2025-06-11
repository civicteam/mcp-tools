import chalk from "chalk";
import inquirer from "inquirer";
import {
  type HookEntry,
  type MCPHooksConfig,
  type TargetConfig,
  getDefaultConfig,
} from "./config.js";
import { generateProject } from "./generator.js";
import { type BuiltInHookName, getBuiltInHookNames } from "./hooks.js";

export interface CLIOptions {
  targetMode?: string;
  targetCommand?: string;
  targetUrl?: string;
  proxyPort?: string;
  hooks?: string[];
}

export async function runWizard(
  initialProjectDirectory?: string,
  options?: CLIOptions,
): Promise<void> {
  // Step 0: Get project directory if not provided
  let projectDirectory: string;

  if (initialProjectDirectory) {
    projectDirectory = initialProjectDirectory;
  } else {
    const { directory } = await inquirer.prompt([
      {
        type: "input",
        name: "directory",
        message: "What is your project named?",
        default: "my-mcp-proxy",
        validate: (input) => {
          if (!input.trim()) return "Project name is required";
          if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
            return "Project name can only contain letters, numbers, hyphens, and underscores";
          }
          if (input.startsWith("-") || input.startsWith("_")) {
            return "Project name cannot start with a hyphen or underscore";
          }
          return true;
        },
      },
    ]);
    projectDirectory = directory;
  }

  console.log(chalk.green(`\n✓ Creating project in ./${projectDirectory}\n`));

  const config = getDefaultConfig();

  // Set proxy port if provided
  if (options?.proxyPort) {
    const port = Number.parseInt(options.proxyPort, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error("Proxy port must be a number between 1 and 65535");
    }
    config.proxy.port = port;
  }

  // Step 1: Target server configuration
  let targetMode: "local" | "remote";

  if (options?.targetMode) {
    if (options.targetMode !== "local" && options.targetMode !== "remote") {
      throw new Error(
        `Invalid target mode '${options.targetMode}'. Must be 'local' or 'remote'`,
      );
    }
    targetMode = options.targetMode;
    console.log(chalk.green(`✓ Target mode: ${options.targetMode}`));
  } else {
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
    targetMode = targetAnswers.targetMode;
  }

  // Create the target config based on mode
  if (targetMode === "local") {
    let command: string;
    if (options?.targetCommand) {
      command = options.targetCommand;
      console.log(chalk.green(`✓ Target command: ${options.targetCommand}`));
    } else {
      const localAnswers = await inquirer.prompt([
        {
          type: "input",
          name: "command",
          message: "Enter the command to start your local MCP server:",
          default: "node dist/server.js --port 5555",
          validate: (input) => input.trim().length > 0 || "Command is required",
        },
      ]);
      command = localAnswers.command;
    }
    config.target = { command };
  } else {
    let url: string;
    if (options?.targetUrl) {
      try {
        new URL(options.targetUrl);
      } catch {
        throw new Error(`Invalid target URL: ${options.targetUrl}`);
      }
      url = options.targetUrl;
      console.log(chalk.green(`✓ Target URL: ${options.targetUrl}`));
    } else {
      const remoteAnswers = await inquirer.prompt([
        {
          type: "input",
          name: "url",
          message: "Enter the remote MCP server URL:",
          default: "https://ai.civic.com/hub/mcp",
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
      url = remoteAnswers.url;
    }
    config.target = { url };
  }

  console.log(chalk.green("\n✓ Target server configured"));

  // Step 3: Hook selection
  const builtInHookNames = getBuiltInHookNames();
  const selectedHooks: HookEntry[] = [];

  // Handle CLI-provided hooks
  if (options?.hooks && options.hooks.length > 0) {
    for (const hookName of options.hooks) {
      if (builtInHookNames.includes(hookName as BuiltInHookName)) {
        selectedHooks.push({
          type: "built-in",
          name: hookName as BuiltInHookName,
        });
      } else {
        // Treat as custom hook URL
        try {
          new URL(hookName);
          selectedHooks.push({
            type: "custom",
            alias: new URL(hookName).hostname,
            url: hookName,
          });
        } catch {
          console.warn(
            chalk.yellow(
              `Warning: "${hookName}" is not a built-in hook or valid URL, skipping`,
            ),
          );
        }
      }
    }
    console.log(
      chalk.green(
        `✓ Selected hooks: ${selectedHooks.map((h) => (h.type === "built-in" ? h.name : h.alias)).join(", ")}`,
      ),
    );
  } else {
    // Interactive hook selection
    console.log(chalk.blue("\n🪝 Select hooks to add to your proxy:\n"));

    let selectingHooks = true;
    while (selectingHooks) {
      const availableChoices = [
        ...builtInHookNames.map((name) => ({
          name,
          value: name,
        })),
        { name: "➕ Add Custom Hook URL...", value: "custom" },
        { name: "✅ Done selecting hooks", value: "done" },
      ];

      const { selectedHook } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedHook",
          message: `Select a hook to add (${selectedHooks.length} selected):`,
          choices: availableChoices,
        },
      ]);

      if (selectedHook === "done") {
        selectingHooks = false;
      } else if (selectedHook === "custom") {
        // Custom hook flow
        const { customUrl, customAlias } = await inquirer.prompt([
          {
            type: "input",
            name: "customUrl",
            message: "Enter the custom hook URL:",
            validate: (input) => {
              try {
                new URL(input);
                return true;
              } catch {
                return "Please enter a valid URL";
              }
            },
          },
          {
            type: "input",
            name: "customAlias",
            message: "Enter a friendly name for this hook:",
            default: (answers: { customUrl: string }) => {
              try {
                return new URL(answers.customUrl).hostname;
              } catch {
                return "custom-hook";
              }
            },
            validate: (input) =>
              input.trim().length > 0 || "Hook name is required",
          },
        ]);

        selectedHooks.push({
          type: "custom",
          alias: customAlias,
          url: customUrl,
        });
        console.log(chalk.green(`✓ Added custom hook: ${customAlias}`));
      } else {
        // Built-in hook selected
        selectedHooks.push({
          type: "built-in",
          name: selectedHook as BuiltInHookName,
        });
        console.log(chalk.green(`✓ Added hook: ${selectedHook}`));
      }
    }
  }

  // Step 4: Hook ordering
  if (selectedHooks.length > 1) {
    console.log(chalk.blue("\n🔄 Configure hook execution order:\n"));

    const orderedHooks = [...selectedHooks];
    let ordering = true;

    while (ordering) {
      // Display current order
      console.log(chalk.gray("\nCurrent order:"));
      orderedHooks.forEach((hook, index) => {
        const name = hook.type === "built-in" ? hook.name : hook.alias;
        console.log(chalk.gray(`  ${index + 1}. ${name}`));
      });

      const choices = orderedHooks.map((hook, index) => {
        const name = hook.type === "built-in" ? hook.name : hook.alias;
        return {
          name: `${index + 1}. ${name}`,
          value: index,
        };
      });
      choices.push({
        name: chalk.green("✓ Continue with this order"),
        value: -1,
      });

      const { selectedHook } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedHook",
          message: "Select a hook to move (or continue):",
          choices,
        },
      ]);

      if (selectedHook === -1) {
        ordering = false;
      } else {
        // Ask to move up or down
        const moveChoices = [];

        if (selectedHook > 0) {
          moveChoices.push({ name: "↑ Move up", value: "up" });
        }

        if (selectedHook < orderedHooks.length - 1) {
          moveChoices.push({ name: "↓ Move down", value: "down" });
        }

        moveChoices.push({ name: chalk.yellow("✗ Cancel"), value: "cancel" });

        const { direction } = await inquirer.prompt([
          {
            type: "list",
            name: "direction",
            message: `Move "${orderedHooks[selectedHook].type === "built-in" ? orderedHooks[selectedHook].name : orderedHooks[selectedHook].alias}":`,
            choices: moveChoices,
          },
        ]);

        if (direction !== "cancel") {
          const [movedHook] = orderedHooks.splice(selectedHook, 1);
          const newIndex =
            direction === "up" ? selectedHook - 1 : selectedHook + 1;
          orderedHooks.splice(newIndex, 0, movedHook);
          console.log(chalk.green("\n✓ Hook moved!"));
        }
      }
    }

    config.hooksOrder = orderedHooks;
  } else {
    config.hooksOrder = selectedHooks;
  }

  // Generate the project
  try {
    await generateProject(config, projectDirectory);
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to generate project:"));
    console.error(chalk.red(`   ${error}`));
    process.exit(1);
  }
}
