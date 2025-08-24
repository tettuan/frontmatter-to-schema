/**
 * Error helper functions for creating typed errors
 * Following DDD and Totality principles
 */

import {
  type AIError,
  createError,
  type ProcessingError,
  type ValidationError,
} from "./types.ts";

/**
 * Create a validation error with a message
 */
export function createValidationError(
  kind: ValidationError["kind"],
  details?: Partial<ValidationError>,
  message?: string,
): ValidationError & { message: string } {
  const error = { kind, ...details } as ValidationError;
  return createError(error, message);
}

/**
 * Create a processing error with a message
 */
export function createProcessingError(
  kind: ProcessingError["kind"],
  details?: Partial<ProcessingError>,
  message?: string,
): ProcessingError & { message: string } {
  const error = { kind, ...details } as ProcessingError;
  return createError(error, message);
}

/**
 * Create an AI error with a message
 */
export function createAIError(
  kind: AIError["kind"],
  details?: Partial<AIError>,
  message?: string,
): AIError & { message: string } {
  const error = { kind, ...details } as AIError;
  return createError(error, message);
}
