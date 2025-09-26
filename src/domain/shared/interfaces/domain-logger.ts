/**
 * @fileoverview Domain Logger Interface - DDD Compliant Logging Abstraction
 * @description Clean architecture logging interface following DDD and Totality principles
 * Replaces direct console dependencies in domain layer with proper abstraction
 */

import type { Result } from "../types/result.ts";
import type { DomainError } from "../types/errors.ts";

/**
 * Log Message Types using Discriminated Union pattern
 * Following Totality principle - all log types explicitly defined
 */
export type LogMessage =
  | { kind: "debug"; content: string }
  | { kind: "trace"; prefix: string; data: unknown }
  | { kind: "structured"; metadata: LogMetadata };

/**
 * Log Metadata for structured logging
 */
export interface LogMetadata {
  readonly operation: string;
  readonly domain: string;
  readonly location: string;
  readonly data?: unknown;
}

/**
 * Log Context Value Object
 * Smart Constructor pattern with validation following Totality principles
 */
export class LogContext {
  private constructor(
    readonly domain: string,
    readonly operation: string,
    readonly location: string,
  ) {}

  /**
   * Smart Constructor with validation
   * Returns Result<T,E> following Totality principle
   */
  static create(
    domain: string,
    operation: string,
    location: string,
  ): Result<LogContext, DomainError & { message: string }> {
    // Validate domain
    if (!domain || domain.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Log domain cannot be empty",
        },
      };
    }

    // Validate operation
    if (!operation || operation.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Log operation cannot be empty",
        },
      };
    }

    // Validate location
    if (!location || location.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Log location cannot be empty",
        },
      };
    }

    return {
      ok: true,
      data: new LogContext(
        domain.trim(),
        operation.trim(),
        location.trim(),
      ),
    };
  }

  /**
   * Create metadata from context
   */
  toMetadata(data?: unknown): LogMetadata {
    return {
      domain: this.domain,
      operation: this.operation,
      location: this.location,
      data,
    };
  }
}

/**
 * Domain Logger Interface
 * Clean architecture abstraction for logging operations
 * Domain layer depends only on this interface, not concrete implementations
 */
export interface DomainLogger {
  /**
   * Log debug information
   * @param context - Validated log context
   * @param message - Structured log message
   * @returns Result indicating success or failure
   */
  logDebug(
    context: LogContext,
    message: LogMessage,
  ): Result<void, DomainError & { message: string }>;

  /**
   * Log trace information for debugging
   * @param context - Validated log context
   * @param message - Structured log message
   * @returns Result indicating success or failure
   */
  logTrace(
    context: LogContext,
    message: LogMessage,
  ): Result<void, DomainError & { message: string }>;

  /**
   * Log structured data
   * @param context - Validated log context
   * @param data - Data to be logged
   * @returns Result indicating success or failure
   */
  logStructured(
    context: LogContext,
    data: unknown,
  ): Result<void, DomainError & { message: string }>;
}

/**
 * Helper functions for creating log messages
 * Following functional programming principles
 */
export const LogMessages = {
  debug: (content: string): LogMessage => ({
    kind: "debug",
    content,
  }),

  trace: (prefix: string, data: unknown): LogMessage => ({
    kind: "trace",
    prefix,
    data,
  }),

  structured: (metadata: LogMetadata): LogMessage => ({
    kind: "structured",
    metadata,
  }),
} as const;
