import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  RecoverableErrorKind,
  RecoveryStrategy,
  RecoveryStrategyConfig,
} from "../value-objects/recovery-strategy.ts";

/**
 * Registry configuration for recovery strategies
 */
export interface RecoveryStrategyRegistryConfig {
  readonly defaultStrategies: ReadonlyArray<RecoveryStrategyConfig>;
  readonly enableDynamicRegistration: boolean;
}

/**
 * Recovery Strategy Registry Domain Service
 *
 * Replaces hardcoded error recovery arrays with configurable,
 * extensible strategy pattern following DDD principles
 *
 * Following Totality: All methods return Result<T,E>
 */
export class RecoveryStrategyRegistry {
  private readonly strategies = new Map<
    RecoverableErrorKind,
    RecoveryStrategy[]
  >();

  private constructor(
    private readonly config: RecoveryStrategyRegistryConfig,
  ) {}

  /**
   * Smart constructor following Totality principle
   */
  static create(
    config: RecoveryStrategyRegistryConfig,
  ): Result<RecoveryStrategyRegistry, DomainError & { message: string }> {
    if (!config) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "RecoveryStrategyRegistryConfig is required",
        }),
      };
    }

    if (!Array.isArray(config.defaultStrategies)) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "defaultStrategies must be an array",
        }),
      };
    }

    const registry = new RecoveryStrategyRegistry(config);

    // Initialize with default strategies
    for (const strategyConfig of config.defaultStrategies) {
      const strategyResult = RecoveryStrategy.create(strategyConfig);
      if (!strategyResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ConfigurationError",
            message:
              `Failed to create default recovery strategy: ${strategyResult.error.message}`,
          }),
        };
      }

      const addResult = registry.addStrategy(strategyResult.data);
      if (!addResult.ok) {
        return addResult;
      }
    }

    return ok(registry);
  }

  /**
   * Create registry with default production strategies
   */
  static createWithDefaults(): Result<
    RecoveryStrategyRegistry,
    DomainError & { message: string }
  > {
    const defaultConfig: RecoveryStrategyRegistryConfig = {
      defaultStrategies: [
        {
          errorKind: "MissingRequired",
          strategy: { kind: "immediate", maxAttempts: 2 },
          priority: 8,
        },
        {
          errorKind: "InvalidType",
          strategy: { kind: "immediate", maxAttempts: 1 },
          priority: 7,
        },
        {
          errorKind: "InvalidFormat",
          strategy: { kind: "delayed", delayMs: 100, maxAttempts: 3 },
          priority: 6,
        },
        {
          errorKind: "FileNotFound",
          strategy: {
            kind: "exponential",
            baseDelayMs: 200,
            multiplier: 2,
            maxAttempts: 3,
          },
          priority: 9,
        },
        {
          errorKind: "ConfigurationError",
          strategy: { kind: "immediate", maxAttempts: 1 },
          priority: 5,
        },
        {
          errorKind: "InitializationError",
          strategy: {
            kind: "exponential",
            baseDelayMs: 500,
            multiplier: 2,
            maxAttempts: 2,
          },
          priority: 7,
        },
      ],
      enableDynamicRegistration: true,
    };

    return RecoveryStrategyRegistry.create(defaultConfig);
  }

  /**
   * Add a recovery strategy to the registry
   */
  addStrategy(
    strategy: RecoveryStrategy,
  ): Result<void, DomainError & { message: string }> {
    const errorKind = strategy.getErrorKind();

    if (!this.strategies.has(errorKind)) {
      this.strategies.set(errorKind, []);
    }

    const existingStrategies = this.strategies.get(errorKind)!;

    // Check for duplicate priorities
    const existingPriority = existingStrategies.find((s) =>
      s.getPriority() === strategy.getPriority()
    );
    if (existingPriority) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            `Strategy with priority ${strategy.getPriority()} already exists for error kind ${errorKind}`,
        }),
      };
    }

    existingStrategies.push(strategy);

    // Sort by priority (descending - higher priority first)
    existingStrategies.sort((a, b) => b.getPriority() - a.getPriority());

    return ok(undefined);
  }

  /**
   * Register a new strategy dynamically
   */
  registerStrategy(
    strategyConfig: RecoveryStrategyConfig,
  ): Result<void, DomainError & { message: string }> {
    if (!this.config.enableDynamicRegistration) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Dynamic strategy registration is disabled",
        }),
      };
    }

    const strategyResult = RecoveryStrategy.create(strategyConfig);
    if (!strategyResult.ok) {
      return strategyResult;
    }

    return this.addStrategy(strategyResult.data);
  }

  /**
   * Check if an error kind can be recovered from
   */
  canRecover(errorKind: string): boolean {
    const strategies = this.strategies.get(errorKind as RecoverableErrorKind);
    return strategies !== undefined && strategies.length > 0;
  }

  /**
   * Get recovery strategy for an error kind (highest priority)
   */
  getRecoveryStrategy(
    errorKind: string,
  ): Result<RecoveryStrategy | undefined, DomainError & { message: string }> {
    const strategies = this.strategies.get(errorKind as RecoverableErrorKind);

    if (!strategies || strategies.length === 0) {
      return ok(undefined);
    }

    // Return highest priority strategy (first in sorted array)
    return ok(strategies[0]);
  }

  /**
   * Get all recovery strategies for an error kind
   */
  getAllStrategies(
    errorKind: string,
  ): Result<readonly RecoveryStrategy[], DomainError & { message: string }> {
    const strategies = this.strategies.get(errorKind as RecoverableErrorKind);
    return ok(strategies ? [...strategies] : []);
  }

  /**
   * Get all registered error kinds
   */
  getRegisteredErrorKinds(): readonly RecoverableErrorKind[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Remove all strategies for an error kind
   */
  removeStrategiesFor(
    errorKind: RecoverableErrorKind,
  ): Result<void, DomainError & { message: string }> {
    if (!this.config.enableDynamicRegistration) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Dynamic strategy modification is disabled",
        }),
      };
    }

    this.strategies.delete(errorKind);
    return ok(undefined);
  }

  /**
   * Get total number of registered strategies
   */
  getStrategyCount(): number {
    let total = 0;
    for (const strategies of this.strategies.values()) {
      total += strategies.length;
    }
    return total;
  }

  /**
   * Validate registry consistency
   */
  validate(): Result<void, DomainError & { message: string }> {
    // Check that all error kinds have at least one strategy
    const errorKinds = this.getRegisteredErrorKinds();

    for (const errorKind of errorKinds) {
      const strategies = this.strategies.get(errorKind);
      if (!strategies || strategies.length === 0) {
        return {
          ok: false,
          error: createError({
            kind: "ConfigurationError",
            message: `No strategies registered for error kind: ${errorKind}`,
          }),
        };
      }

      // Check for priority gaps (optional validation)
      const priorities = strategies.map((s) => s.getPriority()).sort((a, b) =>
        b - a
      );
      for (let i = 0; i < priorities.length - 1; i++) {
        if (priorities[i] === priorities[i + 1]) {
          return {
            ok: false,
            error: createError({
              kind: "ConfigurationError",
              message: `Duplicate priority ${
                priorities[i]
              } found for error kind: ${errorKind}`,
            }),
          };
        }
      }
    }

    return ok(undefined);
  }
}
