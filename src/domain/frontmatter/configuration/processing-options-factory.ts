/**
 * @fileoverview ProcessingOptionsFactory
 * @description Factory for creating processing options with discriminated unions
 * Follows Totality principles by eliminating optional dependencies
 */

/**
 * Processing options state using discriminated union for enhanced type safety
 * Follows Totality principles by eliminating optional dependencies
 */
export type ProcessingOptionsState =
  | { readonly kind: "sequential" }
  | { readonly kind: "parallel"; readonly maxWorkers: number }
  | {
    readonly kind: "adaptive";
    readonly baseWorkers: number;
    readonly maxFileThreshold: number;
  };

/**
 * Factory for creating ProcessingOptionsState instances following Totality principles
 */
export class ProcessingOptionsFactory {
  /**
   * Create sequential processing state - processes one file at a time
   */
  static createSequential(): ProcessingOptionsState {
    return { kind: "sequential" };
  }

  /**
   * Create parallel processing state with fixed worker count
   * @param maxWorkers - Number of workers (defaults to performance settings)
   */
  static createParallel(maxWorkers?: number): ProcessingOptionsState {
    // Use default from performance settings if not specified
    const defaultWorkers = maxWorkers ?? 4; // Fallback if performance settings unavailable
    return { kind: "parallel", maxWorkers: Math.max(1, defaultWorkers) };
  }

  /**
   * Create adaptive processing state - switches based on file count
   */
  static createAdaptive(
    baseWorkers: number = 4,
    maxFileThreshold: number = 2, // Updated default to match performance settings
  ): ProcessingOptionsState {
    return {
      kind: "adaptive",
      baseWorkers: Math.max(1, baseWorkers),
      maxFileThreshold: Math.max(1, maxFileThreshold),
    };
  }

  /**
   * Create processing options state from legacy optional object (for backward compatibility)
   * @deprecated Use explicit factory methods instead
   */
  static fromOptional(
    options?: { parallel?: boolean; maxWorkers?: number },
  ): ProcessingOptionsState {
    if (!options) {
      return ProcessingOptionsFactory.createSequential();
    }

    if (options.parallel === true) {
      return ProcessingOptionsFactory.createParallel(options.maxWorkers);
    }

    return ProcessingOptionsFactory.createSequential();
  }
}
