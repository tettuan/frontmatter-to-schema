import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { RecoveryStrategy } from "../../../application/strategies/recovery-strategy.ts";

/**
 * Recovery Strategy Registry (Legacy Compatibility)
 *
 * Registry for recovery strategies.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export class RecoveryStrategyRegistry {
  private strategies: Map<string, RecoveryStrategy> = new Map();

  static create(): Result<
    RecoveryStrategyRegistry,
    DomainError & { message: string }
  > {
    const registry = new RecoveryStrategyRegistry();

    // Register default strategy
    const defaultStrategyResult = RecoveryStrategy.createDefault();
    if (defaultStrategyResult.ok) {
      registry.strategies.set("default", defaultStrategyResult.data);
    }

    return ok(registry);
  }

  /**
   * Register a recovery strategy
   */
  register(
    name: string,
    strategy: RecoveryStrategy,
  ): Result<void, DomainError & { message: string }> {
    this.strategies.set(name, strategy);
    return ok(void 0);
  }

  /**
   * Get a recovery strategy by name
   */
  get(
    name: string,
  ): Result<RecoveryStrategy, DomainError & { message: string }> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Recovery strategy not found: ${name}`,
      }));
    }
    return ok(strategy);
  }

  /**
   * Get default recovery strategy
   */
  getDefault(): Result<RecoveryStrategy, DomainError & { message: string }> {
    return this.get("default");
  }

  /**
   * List all registered strategy names
   */
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Create registry with default strategies
   */
  static createWithDefaults(): Result<
    RecoveryStrategyRegistry,
    DomainError & { message: string }
  > {
    return RecoveryStrategyRegistry.create();
  }

  /**
   * Check if recovery is possible for given error kind
   */
  canRecover(errorKind: string): boolean {
    // Check if we have a strategy for this error kind
    return this.strategies.has(errorKind) || this.strategies.has("default");
  }

  /**
   * Get recovery strategy for specific error kind
   */
  getRecoveryStrategy(
    errorKind: string,
  ): Result<RecoveryStrategy, DomainError & { message: string }> {
    // Try to get specific strategy, fallback to default
    const strategy = this.strategies.get(errorKind);
    if (strategy) {
      return ok(strategy);
    }
    return this.getDefault();
  }
}
