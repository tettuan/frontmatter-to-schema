/**
 * Exit Handler Service
 *
 * Provides configurable application exit behavior to eliminate hardcoded Deno.exit() calls.
 * Follows Totality principles by providing total functions that handle all exit scenarios.
 *
 * This service abstracts exit behavior from the CLI layer, enabling:
 * - Configurable exit codes and behavior
 * - Proper error reporting before exit
 * - Testing without actual process termination
 * - Flexible deployment configurations
 */

import type { DomainError, Result } from "../../domain/core/result.ts";

/**
 * Exit configuration options
 */
export interface ExitConfiguration {
  readonly mode: "immediate" | "graceful" | "testing";
  readonly errorCode: number;
  readonly successCode: number;
  readonly reportErrors: boolean;
}

/**
 * Exit context for error reporting
 */
export interface ExitContext {
  readonly operation: string;
  readonly error?: DomainError;
  readonly additionalInfo?: Record<string, unknown>;
}

/**
 * Exit handler result types
 */
export type ExitResult = Result<void, never>;

/**
 * Exit Handler Service Interface
 *
 * Provides total functions for handling application exit scenarios.
 * All methods return Result types following Totality principles.
 */
export interface ExitHandler {
  /**
   * Handle application error and exit gracefully
   *
   * @param context - Context information for error reporting
   * @returns Result indicating exit processing (never fails)
   */
  handleError(context: ExitContext): ExitResult;

  /**
   * Handle successful application completion
   *
   * @param context - Context information for success reporting
   * @returns Result indicating exit processing (never fails)
   */
  handleSuccess(context: ExitContext): ExitResult;

  /**
   * Check if handler will actually exit the process
   * Useful for testing and conditional logic
   *
   * @returns true if process will terminate
   */
  willExit(): boolean;
}

/**
 * Default exit configuration for production use
 */
export const DEFAULT_EXIT_CONFIG: ExitConfiguration = {
  mode: "immediate",
  errorCode: 1,
  successCode: 0,
  reportErrors: true,
};

/**
 * Testing exit configuration that prevents actual exit
 */
export const TESTING_EXIT_CONFIG: ExitConfiguration = {
  mode: "testing",
  errorCode: 1,
  successCode: 0,
  reportErrors: false,
};

/**
 * Configurable Exit Handler Implementation
 *
 * Smart Constructor pattern with dependency injection for configuration.
 * Provides total functions that handle all exit scenarios without throwing.
 */
export class ConfigurableExitHandler implements ExitHandler {
  private constructor(
    private readonly config: ExitConfiguration,
    private readonly logger?: {
      error: (message: string, context?: Record<string, unknown>) => void;
      info: (message: string, context?: Record<string, unknown>) => void;
    },
  ) {}

  /**
   * Smart Constructor for Exit Handler
   *
   * @param config - Exit configuration options
   * @param logger - Optional logger for error reporting
   * @returns Result containing configured exit handler
   */
  static create(
    config: ExitConfiguration = DEFAULT_EXIT_CONFIG,
    logger?: {
      error: (message: string, context?: Record<string, unknown>) => void;
      info: (message: string, context?: Record<string, unknown>) => void;
    },
  ): Result<ConfigurableExitHandler, never> {
    return {
      ok: true,
      data: new ConfigurableExitHandler(config, logger),
    };
  }

  /**
   * Handle application error with configured behavior
   */
  handleError(context: ExitContext): ExitResult {
    // Report error if configured
    if (this.config.reportErrors && this.logger && context.error) {
      this.logger.error(`Application error in ${context.operation}`, {
        errorKind: context.error.kind,
        errorDetails: context.error,
        additionalInfo: context.additionalInfo,
      });
    }

    // Handle exit based on configuration
    switch (this.config.mode) {
      case "immediate":
        Deno.exit(this.config.errorCode);
        break;
      case "graceful":
        // Give time for logs to flush before exit
        setTimeout(() => Deno.exit(this.config.errorCode), 10);
        break;
      case "testing":
        // No actual exit in testing mode
        break;
    }

    return { ok: true, data: undefined };
  }

  /**
   * Handle successful application completion
   */
  handleSuccess(context: ExitContext): ExitResult {
    // Report success if configured
    if (this.logger) {
      this.logger.info(
        `Application completed successfully: ${context.operation}`,
        {
          additionalInfo: context.additionalInfo,
        },
      );
    }

    // Handle exit based on configuration
    switch (this.config.mode) {
      case "immediate":
        Deno.exit(this.config.successCode);
        break;
      case "graceful":
        // Give time for logs to flush before exit
        setTimeout(() => Deno.exit(this.config.successCode), 10);
        break;
      case "testing":
        // No actual exit in testing mode
        break;
    }

    return { ok: true, data: undefined };
  }

  /**
   * Check if handler will actually exit the process
   */
  willExit(): boolean {
    return this.config.mode !== "testing";
  }
}

/**
 * Exit Handler Factory
 *
 * Provides convenient creation methods for common exit handler configurations.
 */
export class ExitHandlerFactory {
  /**
   * Create exit handler for production use
   */
  static createProduction(
    logger?: {
      error: (message: string, context?: Record<string, unknown>) => void;
      info: (message: string, context?: Record<string, unknown>) => void;
    },
  ): Result<ExitHandler, never> {
    return ConfigurableExitHandler.create(DEFAULT_EXIT_CONFIG, logger);
  }

  /**
   * Create exit handler for testing (no actual exit)
   */
  static createTesting(): Result<ExitHandler, never> {
    return ConfigurableExitHandler.create(TESTING_EXIT_CONFIG);
  }

  /**
   * Create exit handler with custom configuration
   */
  static createCustom(
    config: ExitConfiguration,
    logger?: {
      error: (message: string, context?: Record<string, unknown>) => void;
      info: (message: string, context?: Record<string, unknown>) => void;
    },
  ): Result<ExitHandler, never> {
    return ConfigurableExitHandler.create(config, logger);
  }
}
