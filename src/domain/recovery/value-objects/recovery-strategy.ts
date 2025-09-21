import { Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Recovery strategy types following discriminated union pattern
 */
export type RecoveryStrategyType =
  | { readonly kind: "immediate"; readonly maxAttempts: number }
  | {
    readonly kind: "delayed";
    readonly delayMs: number;
    readonly maxAttempts: number;
  }
  | {
    readonly kind: "exponential";
    readonly baseDelayMs: number;
    readonly maxAttempts: number;
    readonly multiplier: number;
  }
  | { readonly kind: "none" };

/**
 * Error categories that can be recovered from
 * Using only valid DomainError kinds
 */
export type RecoverableErrorKind =
  | "MissingRequired"
  | "InvalidType"
  | "InvalidFormat"
  | "FileNotFound"
  | "ConfigurationError"
  | "InitializationError";

/**
 * Recovery strategy configuration for specific error kinds
 */
export interface RecoveryStrategyConfig {
  readonly errorKind: RecoverableErrorKind;
  readonly strategy: RecoveryStrategyType;
  readonly priority: number;
}

/**
 * Recovery strategy value object following Totality principles
 *
 * Eliminates hardcoded error recovery arrays by providing
 * configurable strategy pattern with type safety
 */
export class RecoveryStrategy {
  private constructor(
    private readonly config: RecoveryStrategyConfig,
  ) {}

  /**
   * Smart constructor following Totality principle
   */
  static create(
    config: RecoveryStrategyConfig,
  ): Result<RecoveryStrategy, DomainError & { message: string }> {
    // Validate priority range
    if (config.priority < 0 || config.priority > 10) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Recovery strategy priority must be between 0 and 10",
        }),
      };
    }

    // Validate strategy configuration
    switch (config.strategy.kind) {
      case "immediate":
        if (
          config.strategy.maxAttempts < 1 || config.strategy.maxAttempts > 10
        ) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message:
                "Immediate strategy maxAttempts must be between 1 and 10",
            }),
          };
        }
        break;
      case "delayed":
        if (config.strategy.delayMs < 0 || config.strategy.delayMs > 60000) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message: "Delayed strategy delayMs must be between 0 and 60000",
            }),
          };
        }
        if (
          config.strategy.maxAttempts < 1 || config.strategy.maxAttempts > 10
        ) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message: "Delayed strategy maxAttempts must be between 1 and 10",
            }),
          };
        }
        break;
      case "exponential":
        if (
          config.strategy.baseDelayMs < 0 || config.strategy.baseDelayMs > 10000
        ) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message:
                "Exponential strategy baseDelayMs must be between 0 and 10000",
            }),
          };
        }
        if (config.strategy.multiplier < 1 || config.strategy.multiplier > 5) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message:
                "Exponential strategy multiplier must be between 1 and 5",
            }),
          };
        }
        if (
          config.strategy.maxAttempts < 1 || config.strategy.maxAttempts > 10
        ) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message:
                "Exponential strategy maxAttempts must be between 1 and 10",
            }),
          };
        }
        break;
      case "none":
        // No validation needed for none strategy
        break;
      default: {
        // Exhaustive switch - TypeScript will catch missing cases
        const _exhaustive: never = config.strategy;
        return {
          ok: false,
          error: createError({
            kind: "ConfigurationError",
            message: `Unsupported recovery strategy kind: ${
              JSON.stringify(_exhaustive)
            }`,
          }),
        };
      }
    }

    return {
      ok: true,
      data: new RecoveryStrategy(config),
    };
  }

  /**
   * Get error kind this strategy applies to
   */
  getErrorKind(): RecoverableErrorKind {
    return this.config.errorKind;
  }

  /**
   * Get strategy type
   */
  getStrategyType(): RecoveryStrategyType {
    return this.config.strategy;
  }

  /**
   * Get strategy priority (higher number = higher priority)
   */
  getPriority(): number {
    return this.config.priority;
  }

  /**
   * Check if this strategy can recover from the given error kind
   */
  canRecover(errorKind: string): boolean {
    return this.config.errorKind === errorKind;
  }

  /**
   * Get max attempts for this strategy
   */
  getMaxAttempts(): number {
    switch (this.config.strategy.kind) {
      case "immediate":
        return this.config.strategy.maxAttempts;
      case "delayed":
        return this.config.strategy.maxAttempts;
      case "exponential":
        return this.config.strategy.maxAttempts;
      case "none":
        return 0;
      default: {
        // Exhaustive switch
        const _exhaustive: never = this.config.strategy;
        return 0;
      }
    }
  }

  /**
   * Calculate delay for attempt number
   */
  calculateDelay(attemptNumber: number): number {
    switch (this.config.strategy.kind) {
      case "immediate":
        return 0;
      case "delayed":
        return this.config.strategy.delayMs;
      case "exponential":
        return this.config.strategy.baseDelayMs *
          Math.pow(this.config.strategy.multiplier, attemptNumber - 1);
      case "none":
        return 0;
      default: {
        // Exhaustive switch
        const _exhaustive: never = this.config.strategy;
        return 0;
      }
    }
  }
}
