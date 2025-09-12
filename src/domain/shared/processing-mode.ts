/**
 * ProcessingMode Discriminated Union
 *
 * Represents the two distinct processing modes for frontmatter-to-schema:
 * - Individual: Each markdown file produces a separate output
 * - ArrayBased: Multiple markdown files populate a single array property
 *
 * Implements Totality principles with type-safe pattern matching
 */

import type { FilePath } from "../core/file-path.ts";
import type { ArrayTarget } from "../schema/value-objects/array-target.ts";

/**
 * Discriminated Union for processing modes
 *
 * Individual Mode: Traditional one-file-to-one-output processing
 * ArrayBased Mode: Multiple files combined into schema array property
 */
export type ProcessingMode =
  | {
    readonly kind: "Individual";
    readonly files: readonly FilePath[];
  }
  | {
    readonly kind: "ArrayBased";
    readonly targetArray: ArrayTarget;
    readonly files: readonly FilePath[];
  };

/**
 * Type guard to check if mode is Individual
 */
export function isIndividualMode(
  mode: ProcessingMode,
): mode is Extract<ProcessingMode, { kind: "Individual" }> {
  return mode.kind === "Individual";
}

/**
 * Type guard to check if mode is ArrayBased
 */
export function isArrayBasedMode(
  mode: ProcessingMode,
): mode is Extract<ProcessingMode, { kind: "ArrayBased" }> {
  return mode.kind === "ArrayBased";
}

/**
 * Pattern matching helper for ProcessingMode
 *
 * Provides type-safe exhaustive pattern matching over processing modes
 */
export function matchProcessingMode<T>(
  mode: ProcessingMode,
  handlers: {
    Individual: (files: readonly FilePath[]) => T;
    ArrayBased: (targetArray: ArrayTarget, files: readonly FilePath[]) => T;
  },
): T {
  switch (mode.kind) {
    case "Individual": {
      return handlers.Individual(mode.files);
    }
    case "ArrayBased": {
      return handlers.ArrayBased(mode.targetArray, mode.files);
    }
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = mode;
      throw new Error(
        `Unhandled ProcessingMode: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

/**
 * Factory functions for creating ProcessingMode instances
 */
export const ProcessingMode = {
  /**
   * Create Individual processing mode
   */
  individual(files: readonly FilePath[]): ProcessingMode {
    return {
      kind: "Individual",
      files,
    };
  },

  /**
   * Create ArrayBased processing mode
   */
  arrayBased(
    targetArray: ArrayTarget,
    files: readonly FilePath[],
  ): ProcessingMode {
    return {
      kind: "ArrayBased",
      targetArray,
      files,
    };
  },
} as const;
