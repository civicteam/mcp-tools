import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import ejs from "ejs";
import { type MCPHooksConfig, writeConfig } from "./config.js";
import { DOCKERFILE_TEMPLATE, DOCKER_COMPOSE_TEMPLATE } from "./templates.js";
import { getErrorMessage } from "./utils.js";

export async function generateProject(
  config: MCPHooksConfig,
  projectDirectory: string,
): Promise<void> {
  const outputDir = join(process.cwd(), projectDirectory);
  let createdNewDirectory = false;

  try {
    // Step 0: Check if directory exists and permissions
    try {
      await access(outputDir);
      console.log(
        chalk.yellow(
          `⚠️  Directory ${projectDirectory} already exists. Files may be overwritten.`,
        ),
      );

      // Check if we have write permissions
      try {
        await access(outputDir, constants.W_OK);
      } catch {
        throw new Error(
          `No write permission for directory: ${projectDirectory}`,
        );
      }
    } catch (error) {
      // If error is not ENOENT (directory doesn't exist), re-throw it
      if (
        error instanceof Error &&
        error.message.includes("write permission")
      ) {
        throw error;
      }
      // Directory doesn't exist, which is good
    }

    // Create project directory
    const dirExists = await access(outputDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      createdNewDirectory = true;
    }

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create directory ${projectDirectory}: ${getErrorMessage(error)}`,
      );
    }

    // Step 1: Write config file
    console.log(chalk.blue("\n📝 Writing configuration..."));
    const configPath = join(outputDir, "mcphooks.config.json");
    try {
      await writeConfig(configPath, config);
      console.log(chalk.green("✓ Created mcphooks.config.json"));
    } catch (error) {
      throw new Error(`Failed to write config file: ${getErrorMessage(error)}`);
    }

    // Step 2: Generate Dockerfile
    console.log(chalk.blue("\n🐳 Generating Dockerfile..."));
    const dockerfilePath = join(outputDir, "Dockerfile");
    try {
      await generateDockerfile(dockerfilePath, config);
      console.log(chalk.green("✓ Created Dockerfile"));
    } catch (error) {
      throw new Error(
        `Failed to generate Dockerfile: ${getErrorMessage(error)}`,
      );
    }

    // Step 3: Generate docker-compose.yml
    console.log(chalk.blue("\n🐳 Generating docker-compose.yml..."));
    const dockerComposePath = join(outputDir, "docker-compose.yml");
    try {
      await generateDockerCompose(dockerComposePath, config);
      console.log(chalk.green("✓ Created docker-compose.yml"));
    } catch (error) {
      throw new Error(
        `Failed to generate docker-compose.yml: ${getErrorMessage(error)}`,
      );
    }

    // Step 4: Create .dockerignore
    console.log(chalk.blue("\n📄 Creating .dockerignore..."));
    const dockerignorePath = join(outputDir, ".dockerignore");
    try {
      await writeFile(dockerignorePath, generateDockerIgnore(), "utf-8");
      console.log(chalk.green("✓ Created .dockerignore"));
    } catch (error) {
      throw new Error(
        `Failed to create .dockerignore: ${getErrorMessage(error)}`,
      );
    }

    // Step 5: Show summary and instructions
    showSummary(config, projectDirectory);
  } catch (error) {
    // Display user-friendly error message
    console.error(chalk.red("\n❌ Failed to generate project"));

    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));

      // Provide helpful suggestions based on error type
      if (error.message.includes("permission")) {
        console.error(
          chalk.yellow(
            "\n💡 Try running with elevated permissions or choose a different directory",
          ),
        );
      } else if (error.message.includes("ENOSPC")) {
        console.error(
          chalk.yellow(
            "\n💡 Your disk appears to be full. Free up some space and try again",
          ),
        );
      } else if (error.message.includes("EACCES")) {
        console.error(
          chalk.yellow("\n💡 Permission denied. Check directory permissions"),
        );
      }
    } else {
      console.error(chalk.red(`   ${String(error)}`));
    }

    // Clean up created directory if we created it and generation failed
    if (createdNewDirectory) {
      try {
        const { rm } = await import("node:fs/promises");
        await rm(outputDir, { recursive: true, force: true });
        console.error(
          chalk.gray("\n🧹 Cleaned up partially created directory"),
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    throw error;
  }
}

async function generateDockerfile(
  path: string,
  config: MCPHooksConfig,
): Promise<void> {
  const dockerfile = ejs.render(DOCKERFILE_TEMPLATE, { config });
  await writeFile(path, dockerfile, "utf-8");
}

async function generateDockerCompose(
  path: string,
  config: MCPHooksConfig,
): Promise<void> {
  const dockerCompose = ejs.render(DOCKER_COMPOSE_TEMPLATE, { config });
  await writeFile(path, dockerCompose, "utf-8");
}

function generateDockerIgnore(): string {
  return `node_modules
.git
.gitignore
*.log
.DS_Store
.env
.env.*
dist
build
coverage
.vscode
.idea
*.swp
*.swo
`;
}

function showSummary(config: MCPHooksConfig, projectDirectory: string): void {
  const boxWidth = 60;
  const line = "═".repeat(boxWidth);
  const thinLine = "─".repeat(boxWidth);

  console.log(chalk.cyan(`\n╔${line}╗`));
  console.log(
    chalk.cyan("║") +
      chalk.green.bold(
        " ✅ MCP Proxy Successfully Configured!".padEnd(boxWidth),
      ) +
      chalk.cyan("║"),
  );
  console.log(chalk.cyan(`╚${line}╝`));

  // Configuration Summary
  console.log(chalk.yellow("\n📋 Configuration Summary:"));
  console.log(thinLine);

  // Target Server
  console.log(chalk.white("🎯 Target Server:"));
  if (config.target.mode === "local") {
    console.log(chalk.gray("   Mode: ") + chalk.white("Local"));
    console.log(
      chalk.gray("   Command: ") + chalk.white(config.target.command),
    );
  } else {
    console.log(chalk.gray("   Mode: ") + chalk.white("Remote"));
    console.log(chalk.gray("   URL: ") + chalk.white(config.target.url));
  }

  // Proxy Settings
  console.log(chalk.white("\n🔌 Proxy Settings:"));
  console.log(chalk.gray("   Port: ") + chalk.white(config.proxy.port));
  console.log(chalk.gray("   Mode: ") + chalk.white(config.proxy.mode));

  // Hooks
  console.log(chalk.white("\n🪝 Hooks (execution order):"));
  if (config.hooksOrder.length === 0) {
    console.log(chalk.gray("   No hooks configured"));
  } else {
    config.hooksOrder.forEach((hook, index) => {
      if (hook.type === "built-in") {
        console.log(chalk.gray(`   ${index + 1}. `) + chalk.white(hook.name));
      } else {
        console.log(
          chalk.gray(`   ${index + 1}. `) +
            chalk.white(hook.alias) +
            chalk.gray(` → ${hook.url}`),
        );
      }
    });
  }

  // Files Generated
  console.log(chalk.yellow("\n📁 Files Generated:"));
  console.log(thinLine);
  console.log(chalk.gray(`   ./${projectDirectory}/`));
  console.log(chalk.gray("   ├── mcphooks.config.json") + chalk.green(" ✓"));
  console.log(chalk.gray("   ├── Dockerfile") + chalk.green(" ✓"));
  console.log(chalk.gray("   ├── docker-compose.yml") + chalk.green(" ✓"));
  console.log(chalk.gray("   └── .dockerignore") + chalk.green(" ✓"));

  // Docker Commands
  console.log(chalk.yellow("\n🐳 Docker Commands:"));
  console.log(thinLine);
  console.log(chalk.gray("   Quick start with Docker Compose:"));
  console.log(`   ${chalk.cyan("$")} ${chalk.white(`cd ${projectDirectory}`)}`);
  console.log(
    `   ${chalk.cyan("$")} ${chalk.white("docker compose up")}`,
  );
  console.log(chalk.gray("\n   Or build and run manually:"));
  console.log(
    `   ${chalk.cyan("$")} ${chalk.white("docker build -t mcp-proxy .")}`,
  );
  console.log(
    `   ${chalk.cyan("$")} ${chalk.white(`docker run -p ${config.proxy.port}:${config.proxy.port} mcp-proxy`)}`,
  );

  // Next Steps
  console.log(chalk.yellow("\n🚀 Next Steps:"));
  console.log(thinLine);
  console.log(chalk.white("   1. Review the generated configuration files"));
  console.log(
    chalk.white("   2. Start the proxy with: ") + chalk.cyan("docker compose up"),
  );
  console.log(chalk.white("   3. Configure your MCP client to connect to:"));
  console.log(chalk.green(`      http://localhost:${config.proxy.port}`));

  // Tips
  console.log(chalk.yellow("\n💡 Tips:"));
  console.log(thinLine);
  console.log(
    chalk.gray("   • You can modify mcphooks.config.json to change settings"),
  );
  console.log(
    chalk.gray(
      "   • Add environment variables to docker run for runtime config",
    ),
  );
  console.log(
    chalk.gray("   • Use docker logs to debug any connection issues"),
  );

  console.log(chalk.cyan(`\n╔${line}╗`));
  console.log(
    chalk.cyan("║") +
      chalk.green.bold(" Happy proxying! 🎉".padEnd(boxWidth)) +
      chalk.cyan("║"),
  );
  console.log(chalk.cyan(`╚${line}╝\n`));
}
