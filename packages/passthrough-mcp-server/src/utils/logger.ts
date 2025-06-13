/**
 * Logger Module
 *
 * Provides a simple logging interface that defaults to console.log
 * Can be configured to redirect all output to console.error for stdio mode
 */

export interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Default logger implementation using console
 */
let currentLogger: Logger = {
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message),
  debug: (message: string) => console.log(message),
};

/**
 * Logger implementation that sends all output to console.error
 * Used for stdio transport mode to avoid interfering with stdout
 */
const stderrLogger: Logger = {
  info: (message: string) => console.error(message),
  error: (message: string) => console.error(message),
  warn: (message: string) => console.error(message),
  debug: (message: string) => console.error(message),
};

/**
 * Configure the logger to use stderr for all output
 * This is used when the server transport is stdio
 */
export function configureLoggerForStdio(): void {
  currentLogger = stderrLogger;
}

/**
 * Get the logger instance
 */
function getLogger(): Logger {
  return currentLogger;
}

/**
 * Convenience export for direct logging
 */
export const logger = new Proxy({} as Logger, {
  get(_target, prop: keyof Logger) {
    return currentLogger[prop];
  },
});
