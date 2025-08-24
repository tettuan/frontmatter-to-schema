/**
 * Error utility functions for creating typed errors
 */

import type { IOError } from "./types.ts";

type IOErrorWithReason = IOError & { reason?: string };

/**
 * Creates an IOError with the provided details and message
 */
export function createError(
  error: Omit<IOError, "message">,
  message?: string,
): IOError & { message: string } {
  // Determine message based on error kind
  const defaultMessage = getDefaultMessage(error);

  return {
    ...error,
    message: message || defaultMessage,
  } as IOError & { message: string };
}

function getDefaultMessage(error: Omit<IOError, "message">): string {
  const errorWithReason = error as IOErrorWithReason;
  switch (error.kind) {
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "ReadError":
      return `Read error at ${error.path}: ${
        errorWithReason.reason || "unknown"
      }`;
    case "WriteError":
      return `Write error at ${error.path}: ${
        errorWithReason.reason || "unknown"
      }`;
    case "PermissionDenied":
      return `Permission denied: ${error.path}`;
    default:
      return "An IO error occurred";
  }
}
