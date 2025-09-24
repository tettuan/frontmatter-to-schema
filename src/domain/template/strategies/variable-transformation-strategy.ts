import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";

/**
 * Strategy interface for variable transformations
 * Implements strategy pattern to eliminate hardcoding
 */
export interface VariableTransformationStrategy {
  /**
   * Check if this strategy can apply to the given variable
   */
  canApply(baseName: string, property: string): boolean;

  /**
   * Apply the transformation to the base value
   */
  apply(
    baseValue: unknown,
  ): Result<unknown, TemplateError & { message: string }>;
}

/**
 * Strategy for handling "full" property transformations
 * Returns the base value as-is for any variable with .full property
 */
export class FullPropertyStrategy implements VariableTransformationStrategy {
  canApply(_baseName: string, property: string): boolean {
    return property === "full";
  }

  apply(
    baseValue: unknown,
  ): Result<unknown, TemplateError & { message: string }> {
    return { ok: true, data: baseValue };
  }
}

/**
 * Registry for managing variable transformation strategies
 */
export class VariableTransformationRegistry {
  private strategies: VariableTransformationStrategy[] = [];

  constructor() {
    // Register default strategies
    this.register(new FullPropertyStrategy());
  }

  /**
   * Register a new transformation strategy
   */
  register(strategy: VariableTransformationStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Find applicable strategy for the given variable
   */
  findStrategy(
    baseName: string,
    property: string,
  ): VariableTransformationStrategy | undefined {
    return this.strategies.find((strategy) =>
      strategy.canApply(baseName, property)
    );
  }
}
