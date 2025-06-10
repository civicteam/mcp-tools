/**
 * Stdio Transport for Local MCP Servers
 * 
 * Implements a transport that spawns a local process and communicates
 * with it via stdio (stdin/stdout).
 */

import { spawn } from "node:child_process";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";

export class StdioClientTransport implements Transport {
  private process: ReturnType<typeof spawn> | null = null;
  private onMessageHandler: ((message: JSONRPCMessage) => void) | null = null;
  private onCloseHandler: (() => void) | null = null;
  private onErrorHandler: ((error: Error) => void) | null = null;
  private buffer = "";

  constructor(private command: string) {}

  async start(): Promise<void> {
    // Parse command into executable and args
    const parts = this.command.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    logger.info(`Starting local MCP server: ${this.command}`);

    this.process = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    // Handle stdout (messages from the server)
    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (logging from the server)
    this.process.stderr?.on("data", (data: Buffer) => {
      logger.debug(`[target stderr] ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on("exit", (code) => {
      logger.info(`Local MCP server exited with code ${code}`);
      this.onCloseHandler?.();
    });

    this.process.on("error", (error) => {
      logger.error(`Failed to start local MCP server: ${error}`);
      this.onErrorHandler?.(error as Error);
    });

    // Wait a bit for the process to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JSONRPCMessage;
          this.onMessageHandler?.(message);
        } catch (error) {
          logger.error(`Failed to parse message from target: ${error}`);
          logger.error(`Raw message: ${line}`);
        }
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new Error("Transport not started");
    }

    const messageStr = JSON.stringify(message) + "\n";
    this.process.stdin.write(messageStr);
  }

  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.onMessageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.onCloseHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.onErrorHandler = handler;
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}