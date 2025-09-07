/**
 * Error Handler Service
 *
 * Centralized error message generation and formatting service.
 * Eliminates code duplication and standardizes error handling.
 * Addresses issue #500: Code duplication patterns.
 */

import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Error message context for detailed error reporting
 */
export interface ErrorContext {
  operation: string;
  resource?: string;
  path?: string;
  details?: string;
}

/**
 * Centralized error handler service following DDD principles
 */
export class ErrorHandlerService {
  private static readonly SERVICE_NAME = "error-handler-service";

  /**
   * Generate standardized error message based on error type
   * Consolidates duplicate error handling patterns
   */
  static generateErrorMessage(
    error: DomainError & { message?: string },
    context?: ErrorContext,
  ): string {
    // Use existing message if available
    if (error.message) {
      return error.message;
    }

    // Generate message based on error kind
    let baseMessage = this.getBaseErrorMessage(error);

    // Add context if provided
    if (context) {
      baseMessage = this.enrichWithContext(baseMessage, context);
    }

    return baseMessage;
  }

  /**
   * Create enhanced error with context
   * Replaces duplicate error creation patterns
   */
  static createEnhancedError(
    error: DomainError,
    context: ErrorContext,
  ): DomainError & { message: string } {
    const message = this.generateErrorMessage(error, context);
    return createDomainError(error, message);
  }

  /**
   * Handle resource loading errors with consistent messaging
   * Consolidates duplicate patterns from resource services
   */
  static handleResourceLoadError(
    error: DomainError,
    resourceType: "schema" | "template" | "documents",
    path: string,
  ): DomainError & { message: string } {
    let reason = `Failed to load ${resourceType}`;

    if (error.kind === "FileNotFound") {
      reason = `${resourceType} file not found`;
    } else if (
      error.kind === "ReadError" && "details" in error && error.details
    ) {
      reason = `${resourceType} load error: ${error.details}`;
    } else if ("message" in error && typeof error.message === "string") {
      reason = error.message;
    }

    return createDomainError({
      kind: "ReadError",
      path: path,
      details: reason,
    });
  }

  /**
   * Get base error message for error kind
   */
  private static getBaseErrorMessage(error: DomainError): string {
    switch (error.kind) {
      case "FileNotFound":
        return `File not found${"path" in error ? `: ${error.path}` : ""}`;

      case "ReadError":
        return `Failed to read${"path" in error ? ` from ${error.path}` : ""}${
          "details" in error && error.details ? `: ${error.details}` : ""
        }`;

      case "InvalidFormat":
        return `Invalid format${"input" in error ? ` for ${error.input}` : ""}${
          "expectedFormat" in error ? `: expected ${error.expectedFormat}` : ""
        }`;

      case "InvalidState":
        return `Invalid state${
          "expected" in error ? `: expected ${error.expected}` : ""
        }${"actual" in error ? `, got ${error.actual}` : ""}`;

      default:
        return `Operation failed: ${error.kind}`;
    }
  }

  /**
   * Enrich error message with context
   */
  private static enrichWithContext(
    message: string,
    context: ErrorContext,
  ): string {
    const parts = [message];

    if (context.operation) {
      parts.unshift(`[${context.operation}]`);
    }

    if (context.resource) {
      parts.push(`(resource: ${context.resource})`);
    }

    if (context.details) {
      parts.push(`- ${context.details}`);
    }

    return parts.join(" ");
  }

  /**
   * Format error for logging with structured context
   */
  static formatForLogging(
    error: DomainError & { message?: string },
    context?: ErrorContext,
  ): {
    message: string;
    errorKind: string;
    context?: ErrorContext;
    details?: Record<string, unknown>;
  } {
    return {
      message: this.generateErrorMessage(error, context),
      errorKind: error.kind,
      context,
      details: this.extractErrorDetails(error),
    };
  }

  /**
   * Extract additional details from error
   */
  private static extractErrorDetails(
    error: DomainError,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    // Extract known properties
    if ("path" in error) details.path = error.path;
    if ("field" in error) details.field = error.field;
    if ("input" in error) details.input = error.input;
    if ("value" in error) details.value = error.value;
    if ("expectedFormat" in error) {
      details.expectedFormat = error.expectedFormat;
    }
    if ("details" in error) details.details = error.details;

    return details;
  }
}
