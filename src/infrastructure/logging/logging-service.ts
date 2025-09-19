import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import {
  createLogContext,
  EnhancedDebugLogger,
} from "../../domain/shared/services/debug-logger.ts";

/**
 * Logging state using discriminated union for enhanced type safety
 * Following Totality principles for exhaustive state handling
 */
export type LoggingState =
  | {
    readonly kind: "enhanced-enabled";
    readonly logger: EnhancedDebugLogger;
  }
  | {
    readonly kind: "debug-enabled";
    readonly logger: EnhancedDebugLogger;
  }
  | {
    readonly kind: "disabled";
  };

/**
 * Logging configuration following Totality principle
 * Using Smart Constructor for validation
 */
export interface LoggingConfig {
  readonly logLevel: "debug" | "info" | "warn" | "error" | "disabled";
  readonly enableContext: boolean;
  readonly maxContextDepth: number;
}

/**
 * Logging Service
 * Infrastructure service for centralized logging with DDD boundaries
 * Following Totality principles with Result types and Smart Constructor
 */
export class LoggingService {
  private constructor(
    private readonly state: LoggingState,
    private readonly config: LoggingConfig,
  ) {}

  /**
   * Smart Constructor for LoggingService
   * Ensures all invariants are satisfied
   */
  static create(
    logger?: EnhancedDebugLogger,
    config?: Partial<LoggingConfig>,
  ): Result<LoggingService, DomainError & { message: string }> {
    const finalConfig: LoggingConfig = {
      logLevel: config?.logLevel ?? "info",
      enableContext: config?.enableContext ?? true,
      maxContextDepth: config?.maxContextDepth ?? 5,
    };

    // Validate max context depth
    if (finalConfig.maxContextDepth < 0 || finalConfig.maxContextDepth > 10) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Max context depth must be between 0 and 10",
      }));
    }

    // Create logging state based on logger availability
    const state: LoggingState = logger
      ? { kind: "enhanced-enabled", logger }
      : { kind: "disabled" };

    return ok(new LoggingService(state, finalConfig));
  }

  /**
   * Create a disabled logging service
   */
  static createDisabled(): LoggingService {
    return new LoggingService(
      { kind: "disabled" },
      {
        logLevel: "disabled",
        enableContext: false,
        maxContextDepth: 0,
      },
    );
  }

  /**
   * Log debug message with optional context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.state.kind === "disabled") return;
    if (!this.shouldLog("debug")) return;

    const logContext = this.config.enableContext && context
      ? createLogContext(context)
      : undefined;
    this.state.logger.debug(message, logContext);
  }

  /**
   * Log info message with optional context
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.state.kind === "disabled") return;
    if (!this.shouldLog("info")) return;

    const logContext = this.config.enableContext && context
      ? createLogContext(context)
      : undefined;
    this.state.logger.info(message, logContext);
  }

  /**
   * Log warning message with optional context
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.state.kind === "disabled") return;
    if (!this.shouldLog("warn")) return;

    const logContext = this.config.enableContext && context
      ? createLogContext(context)
      : undefined;
    this.state.logger.warn(message, logContext);
  }

  /**
   * Log error message with optional context
   */
  error(message: string, context?: Record<string, unknown>): void {
    if (this.state.kind === "disabled") return;
    if (!this.shouldLog("error")) return;

    const logContext = this.config.enableContext && context
      ? createLogContext(context)
      : undefined;
    this.state.logger.error(message, logContext);
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.state.kind !== "disabled";
  }

  /**
   * Get current log level
   */
  getLogLevel(): string {
    return this.config.logLevel;
  }

  /**
   * Check if a specific log level should be logged
   */
  private shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const levels = ["debug", "info", "warn", "error"];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= configLevelIndex;
  }
}

/**
 * Processing logger state type for backward compatibility
 * This type is used by PipelineOrchestrator and other services
 */
export type ProcessingLoggerState = LoggingState;

/**
 * Factory for creating LoggingService instances
 * Provides convenient creation methods following Totality principles
 */
export class LoggingServiceFactory {
  /**
   * Create logging service from ProcessingLoggerState
   * Maintains backward compatibility with existing code
   */
  static fromProcessingLoggerState(
    state: ProcessingLoggerState,
  ): LoggingService {
    if (state.kind === "disabled") {
      return LoggingService.createDisabled();
    }

    const result = LoggingService.create(state.logger, {
      logLevel: state.kind === "debug-enabled" ? "debug" : "info",
      enableContext: true,
      maxContextDepth: 5,
    });

    // Since we control the inputs, this should never fail
    if (!result.ok) {
      throw new Error(
        `Failed to create LoggingService: ${result.error.message}`,
      );
    }

    return result.data;
  }
}
