import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ejs from "ejs";
import { type MCPHooksConfig, writeConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateProject(config: MCPHooksConfig): Promise<void> {
  const outputDir = process.cwd();

  try {
    // Step 1: Write config file
    console.log(chalk.blue("\n📝 Writing configuration..."));
    const configPath = join(outputDir, "mcphooks.config.json");
    await writeConfig(configPath, config);
    console.log(chalk.green("✓ Created mcphooks.config.json"));

    // Step 2: Generate Dockerfile
    console.log(chalk.blue("\n🐳 Generating Dockerfile..."));
    const dockerfilePath = join(outputDir, "Dockerfile");
    await generateDockerfile(dockerfilePath, config);
    console.log(chalk.green("✓ Created Dockerfile"));

    // Step 3: Create .dockerignore
    console.log(chalk.blue("\n📄 Creating .dockerignore..."));
    const dockerignorePath = join(outputDir, ".dockerignore");
    await writeFile(dockerignorePath, generateDockerignore(), "utf-8");
    console.log(chalk.green("✓ Created .dockerignore"));

    // Step 4: Create basic package.json if it doesn't exist
    const packageJsonPath = join(outputDir, "package.json");
    try {
      await readFile(packageJsonPath);
    } catch {
      console.log(chalk.blue("\n📦 Creating package.json..."));
      await writeFile(packageJsonPath, generatePackageJson(config), "utf-8");
      console.log(chalk.green("✓ Created package.json"));
    }

    // Step 5: Show summary and instructions
    showSummary(config);
  } catch (error) {
    console.error(chalk.red("\n❌ Error generating project:"), error);
    throw error;
  }
}

async function generateDockerfile(
  path: string,
  config: MCPHooksConfig,
): Promise<void> {
  const templatePath = join(__dirname, "..", "templates", "Dockerfile.ejs");
  const template = await readFile(templatePath, "utf-8");
  const dockerfile = ejs.render(template, { config });
  await writeFile(path, dockerfile, "utf-8");
}

function generateDockerignore(): string {
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

function generatePackageJson(config: MCPHooksConfig): string {
  const pkg = {
    name: "mcp-passthrough-proxy",
    version: "1.0.0",
    description: "MCP Passthrough Proxy with hooks",
    type: "module",
    scripts: {
      start: "node dist/cli.js start-proxy --config mcphooks.config.json",
      build: "echo 'No build required'",
    },
    dependencies: {
      "@civic/passthrough-proxy-builder": "^1.0.0",
    },
    engines: {
      node: ">=18.0.0",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

function showSummary(config: MCPHooksConfig): void {
  console.log(chalk.cyan("\n=== MCPHooks Proxy Configured ==="));
  console.log(
    chalk.white(
      `Target: ${config.target.mode === "local" ? "Local" : "Remote"} → ${
        config.target.mode === "local"
          ? config.target.command
          : config.target.url
      }`,
    ),
  );

  console.log(chalk.white("\nHooks (in order):"));
  config.hooksOrder.forEach((hook, index) => {
    const hookName =
      typeof hook === "string" ? hook : `${hook.alias} (${hook.url})`;
    console.log(chalk.white(`  ${index + 1}. ${hookName}`));
  });

  console.log(chalk.cyan("\nDocker commands:"));
  console.log(chalk.green("  docker build -t mcphooks-proxy ."));
  console.log(
    chalk.green(
      `  docker run -p ${config.proxy.port}:${config.proxy.port} mcphooks-proxy`,
    ),
  );

  console.log(chalk.cyan("\nNext steps:"));
  console.log(chalk.white("  1. Review the generated files"));
  console.log(chalk.white("  2. Build and run the Docker container"));
  console.log(
    chalk.white(
      `  3. Point your MCP client at http://localhost:${config.proxy.port}`,
    ),
  );

  console.log(chalk.cyan("==================================\n"));
}
