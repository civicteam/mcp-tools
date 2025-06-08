import chalk from "chalk";
import inquirer from "inquirer";
import {
  type HookEntry,
  type MCPHooksConfig,
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
  let projectDirectory = initialProjectDirectory;

  if (!projectDirectory) {
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
  if (options?.targetMode) {
    config.target.mode = options.targetMode as "local" | "remote";
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
    config.target.mode = targetAnswers.targetMode;
  }

  if (config.target.mode === "local") {
    if (options?.targetCommand) {
      config.target.command = options.targetCommand;
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
      config.target.command = localAnswers.command;
    }
  } else {
    if (options?.targetUrl) {
      config.target.url = options.targetUrl;
      console.log(chalk.green(`✓ Target URL: ${options.targetUrl}`));
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
    }

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

  // Process selected hooks
  const hooks: HookEntry[] = [];
  let selectedHooks: string[];

  if (options?.hooks && options.hooks.length > 0) {
    selectedHooks = options.hooks;
    console.log(chalk.green(`✓ Selected hooks: ${options.hooks.join(", ")}`));

    // Convert CLI hook names directly to HookEntry format
    const builtInHookNames = getBuiltInHookNames();
    for (const hookName of selectedHooks) {
      if (builtInHookNames.includes(hookName as BuiltInHookName)) {
        hooks.push({
          type: "built-in",
          name: hookName as BuiltInHookName,
        });
      } else {
        console.log(
          chalk.yellow(`Warning: Unknown hook '${hookName}' will be skipped`),
        );
      }
    }
  } else {
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

    const answers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedHooks",
        message: "Select hooks (use Space to toggle, Enter to continue):",
        choices: hookChoices,
        validate: (input) =>
          input.length > 0 || "Please select at least one hook",
      },
    ]);
    selectedHooks = answers.selectedHooks;

    // Process selected hooks from interactive prompts
    for (const hook of selectedHooks) {
      if (hook === "CUSTOM_HOOK") {
        // Handle custom hook
        console.log(chalk.blue("\n🔗 Configure custom hook:\n"));

        const customHookAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "Enter the URL of your custom hook:",
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
            name: "alias",
            message: "Enter an alias for this hook:",
            default: `CustomHook${hooks.filter((h) => h.type === "custom").length + 1}`,
            validate: (input) => {
              if (!input.trim()) return "Alias is required";
              if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                return "Alias can only contain letters, numbers, hyphens, and underscores";
              }
              // Check for duplicate aliases
              const existingAliases = hooks
                .filter(
                  (h): h is { type: "custom"; alias: string; url: string } =>
                    h.type === "custom",
                )
                .map((h) => h.alias);
              if (existingAliases.includes(input)) {
                return "This alias is already in use";
              }
              return true;
            },
          },
        ]);

        hooks.push({
          type: "custom",
          url: customHookAnswers.url,
          alias: customHookAnswers.alias,
        });

        // Ask if they want to add another custom hook
        const { addAnother } = await inquirer.prompt([
          {
            type: "confirm",
            name: "addAnother",
            message: "Do you want to add another custom hook?",
            default: false,
          },
        ]);

        if (addAnother) {
          selectedHooks.push("CUSTOM_HOOK");
        }
      } else {
        // Built-in hook
        hooks.push({
          type: "built-in",
          name: hook as BuiltInHookName,
        });
      }
    }
  }

  config.hooksOrder = hooks;

  // Step 3: Hook ordering (if multiple hooks selected)
  if (hooks.length > 1) {
    console.log(chalk.blue("\n🔄 Order your hooks (executed in sequence):\n"));

    const orderedHooks = [...hooks];
    let ordering = true;

    while (ordering) {
      // Display current order
      console.log(chalk.cyan("Current order:"));
      orderedHooks.forEach((hook, index) => {
        const hookName = hook.type === "built-in" ? hook.name : hook.alias;
        console.log(`  ${index + 1}. ${hookName}`);
      });

      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "Move a hook up/down", value: "move" },
            { name: "Continue with this order", value: "done" },
          ],
        },
      ]);

      if (action === "done") {
        ordering = false;
      } else {
        // Select hook to move
        const hookChoices = orderedHooks.map((hook, index) => {
          const hookName = hook.type === "built-in" ? hook.name : hook.alias;
          return {
            name: `${index + 1}. ${hookName}`,
            value: index,
          };
        });

        const { hookIndex } = await inquirer.prompt([
          {
            type: "list",
            name: "hookIndex",
            message: "Select hook to move:",
            choices: hookChoices,
          },
        ]);

        // Select direction
        const moveChoices = [];
        if (hookIndex > 0) moveChoices.push({ name: "Move up", value: "up" });
        if (hookIndex < orderedHooks.length - 1)
          moveChoices.push({ name: "Move down", value: "down" });

        if (moveChoices.length > 0) {
          const { direction } = await inquirer.prompt([
            {
              type: "list",
              name: "direction",
              message: "Move direction:",
              choices: moveChoices,
            },
          ]);

          // Perform the move
          const [movedHook] = orderedHooks.splice(hookIndex, 1);
          const newIndex = direction === "up" ? hookIndex - 1 : hookIndex + 1;
          orderedHooks.splice(newIndex, 0, movedHook);

          console.log(chalk.green("\n✓ Hook moved!\n"));
        }
      }
    }

    config.hooksOrder = orderedHooks;
  } else {
    config.hooksOrder = hooks;
  }

  // Generate the project
  // projectDirectory is guaranteed to be defined at this point
  if (!projectDirectory) {
    throw new Error("Project directory is required");
  }
  await generateProject(config, projectDirectory);
}
