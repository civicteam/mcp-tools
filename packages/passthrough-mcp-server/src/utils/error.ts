/**
 * Error utility functions
 */

/**
 * Convert an error to a string message
 *
 * @param error - The error to convert
 * @returns A string representation of the error
 */
export function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Unknown error";
}
