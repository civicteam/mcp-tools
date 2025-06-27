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
import { promptHookConfiguration, displayHookConfigSummary } from "./prompts-config.js";

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
        const hookEntry: HookEntry = {
          type: "built-in",
          name: hookName as BuiltInHookName,
        };
        
        // Prompt for configuration even for CLI-provided hooks
        const config = await promptHookConfiguration(hookName as BuiltInHookName);
        if (config) {
          hookEntry.config = config;
          displayHookConfigSummary(hookName, config);
        }
        
        selectedHooks.push(hookEntry);
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

    // Step 1: Select built-in hooks with checkbox
    const { selectedBuiltInHooks } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedBuiltInHooks",
        message:
          "Select built-in hooks (use Space to toggle, Enter to continue):",
        choices: builtInHookNames.map((name) => ({
          name,
          value: name,
        })),
      },
    ]);

    // Add selected built-in hooks and configure them
    for (const hookName of selectedBuiltInHooks) {
      const hookEntry: HookEntry = {
        type: "built-in",
        name: hookName as BuiltInHookName,
      };
      
      // Prompt for configuration
      const config = await promptHookConfiguration(hookName as BuiltInHookName);
      if (config) {
        hookEntry.config = config;
        displayHookConfigSummary(hookName, config);
      }
      
      selectedHooks.push(hookEntry);
    }

    if (selectedBuiltInHooks.length > 0) {
      console.log(
        chalk.green(
          `✓ Added ${selectedBuiltInHooks.length} built-in hook${selectedBuiltInHooks.length > 1 ? "s" : ""}`,
        ),
      );
    }

    // Step 2: Ask about custom hooks
    const { wantsCustomHooks } = await inquirer.prompt([
      {
        type: "confirm",
        name: "wantsCustomHooks",
        message: "Would you like to add custom hooks?",
        default: false,
      },
    ]);

    if (wantsCustomHooks) {
      let addingCustomHooks = true;
      while (addingCustomHooks) {
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

        const { addAnother } = await inquirer.prompt([
          {
            type: "confirm",
            name: "addAnother",
            message: "Would you like to add another custom hook?",
            default: false,
          },
        ]);

        if (!addAnother) {
          addingCustomHooks = false;
        }
      }
    }
  }

  // Step 4: Hook ordering
  if (selectedHooks.length > 1) {
    console.log(chalk.blue("\n🔄 Configure hook execution order:\n"));
    console.log(
      chalk.gray(
        "Use ↑/↓ to navigate, Enter to select a hook, Enter again to move it",
      ),
    );

    const orderedHooks = [...selectedHooks];
    let ordering = true;
    let selectedIndex = -1; // -1 means no hook is selected

    while (ordering) {
      // Create choices array with visual indicators
      const choices = orderedHooks.map((hook, index) => {
        const name = hook.type === "built-in" ? hook.name : hook.alias;
        const prefix = index === selectedIndex ? "▶ " : "  ";
        const suffix = index === selectedIndex ? " ◀" : "";
        return {
          name: `${prefix}${index + 1}. ${name}${suffix}`,
          value: index,
        };
      });

      // Add continue option
      choices.push({
        name: chalk.green("✓ Continue with this order"),
        value: -1,
      });

      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message:
            selectedIndex === -1
              ? "Select a hook to move:"
              : "Select destination:",
          choices,
          default: selectedIndex === -1 ? 0 : selectedIndex,
        },
      ]);

      if (action === -1) {
        // User chose to continue
        ordering = false;
      } else if (selectedIndex === -1) {
        // No hook selected, so select this one
        selectedIndex = action;
      } else {
        // A hook is already selected, so this is the destination
        if (action !== selectedIndex) {
          // Move the hook
          const movedHook = orderedHooks[selectedIndex];
          // Remove from old position first
          orderedHooks.splice(selectedIndex, 1);

          // When user clicks "N. HookName", they want their hook at position N
          // 'action' is the 0-based index of what they clicked (N-1)
          // After removal, we need to insert at the right position
          const targetPosition = action + 1; // Convert to 1-based position

          // Calculate insertion index
          let insertAt: number;
          if (selectedIndex < action) {
            // Moving down: target position stays the same after removal
            // Position N = index N-1 in the new array
            insertAt = targetPosition - 1;
          } else {
            // Moving up: insertion point is same as clicked index
            insertAt = action;
          }

          // Insert at the new position
          orderedHooks.splice(insertAt, 0, movedHook);
        }
        selectedIndex = -1; // Deselect after moving
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
