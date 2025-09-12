/**
 * MaxFiles Value Object - Smart Constructor for file processing limits
 *
 * Eliminates hardcoded file limits and provides type-safe validation
 * following DDD and Totality principles
 *
 * Addresses Issue #677: CLI Hardcoding Violations
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type ValidationError } from "../core/result.ts";

/**
 * Configuration modes that determine appropriate file limits
 */
export type ProcessingMode =
  | { kind: "strict"; description: string }
  | { kind: "performance"; description: string }
  | { kind: "bulk"; description: string };

/**
 * MaxFiles - Validated file processing limit with business context
 *
 * Prevents resource exhaustion while allowing appropriate scaling
 * based on processing mode and system capabilities
 */
export class MaxFiles {
  private constructor(
    private readonly value: number,
    private readonly mode: ProcessingMode,
  ) {}

  /**
   * Create MaxFiles with validation
   * @param value - Number of files to allow
   * @param mode - Processing mode context for validation
   */
  static create(
    value: number,
    mode: ProcessingMode = {
      kind: "strict",
      description: "Conservative limits for reliability",
    },
  ): Result<MaxFiles, ValidationError & { message: string }> {
    // Basic validation
    if (value < 1) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value,
          min: 1,
        }, "MaxFiles must be at least 1"),
      };
    }

    // Mode-specific validation
    const limit = MaxFiles.getLimitForMode(mode);
    if (value > limit) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "OutOfRange",
            value,
            max: limit,
          },
          `MaxFiles ${value} exceeds limit for ${mode.kind} mode (max: ${limit})`,
        ),
      };
    }

    return {
      ok: true,
      data: new MaxFiles(value, mode),
    };
  }

  /**
   * Create MaxFiles with default value for mode
   */
  static createForMode(
    mode: ProcessingMode,
  ): Result<MaxFiles, ValidationError & { message: string }> {
    const defaultValue = MaxFiles.getDefaultForMode(mode);
    return MaxFiles.create(defaultValue, mode);
  }

  /**
   * Create MaxFiles with fallback default (strict mode, 1000 files)
   * Used when configuration fails and we need a safe fallback
   */
  static createDefault(): MaxFiles {
    const result = MaxFiles.create(1000, {
      kind: "strict",
      description: "Conservative limits for reliability",
    });
    if (!result.ok) {
      // This should never happen with known-good values, but provides safety
      throw new Error(
        `Failed to create default MaxFiles: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Get the configured file limit
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get the processing mode context
   */
  getMode(): ProcessingMode {
    return this.mode;
  }

  /**
   * Check if this limit allows processing a given number of files
   */
  allows(fileCount: number): boolean {
    return fileCount <= this.value;
  }

  /**
   * Get remaining capacity
   */
  remainingCapacity(currentCount: number): number {
    return Math.max(0, this.value - currentCount);
  }

  /**
   * Business rules: Get maximum limit for processing mode
   */
  private static getLimitForMode(mode: ProcessingMode): number {
    switch (mode.kind) {
      case "strict":
        return 1000; // Conservative limit for reliability
      case "performance":
        return 10000; // Higher limit for performance scenarios
      case "bulk":
        return 50000; // Maximum limit for bulk operations
    }
  }

  /**
   * Business rules: Get default value for processing mode
   */
  private static getDefaultForMode(mode: ProcessingMode): number {
    switch (mode.kind) {
      case "strict":
        return 100; // Very conservative default
      case "performance":
        return 1000; // Balanced default
      case "bulk":
        return 10000; // High throughput default
    }
  }

  /**
   * Create string representation for debugging
   */
  toString(): string {
    return `MaxFiles(${this.value}, ${this.mode.kind})`;
  }

  /**
   * Compare with another MaxFiles instance
   */
  equals(other: MaxFiles): boolean {
    return this.value === other.value && this.mode.kind === other.mode.kind;
  }
}

/**
 * Utility functions for common MaxFiles operations
 */
export const MaxFilesUtils = {
  /**
   * Create MaxFiles from CLI string argument
   */
  fromCliArg(
    arg: string,
  ): Result<MaxFiles, ValidationError & { message: string }> {
    const value = parseInt(arg, 10);
    if (isNaN(value)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: arg,
          message: `Cannot parse "${arg}" as number for MaxFiles`,
        }),
      };
    }

    // Default to performance mode for CLI usage
    return MaxFiles.create(value, {
      kind: "performance",
      description: "CLI performance mode",
    });
  },

  /**
   * Create appropriate MaxFiles based on system resources
   */
  fromSystemCapacity(availableMemoryMB: number): MaxFiles {
    if (availableMemoryMB < 512) {
      return MaxFiles.createDefault(); // Conservative for low memory
    } else if (availableMemoryMB < 2048) {
      const result = MaxFiles.createForMode({
        kind: "performance",
        description: "Medium memory system",
      });
      return result.ok ? result.data : MaxFiles.createDefault();
    } else {
      const result = MaxFiles.createForMode({
        kind: "bulk",
        description: "High memory system",
      });
      return result.ok ? result.data : MaxFiles.createDefault();
    }
  },

  /**
   * Common CLI defaults
   */
  CLI_DEFAULT: MaxFiles.createDefault(),
  get STRICT_DEFAULT(): MaxFiles {
    const result = MaxFiles.createForMode({
      kind: "strict",
      description: "Conservative limits for reliability",
    });
    return result.ok ? result.data : MaxFiles.createDefault();
  },
  get PERFORMANCE_DEFAULT(): MaxFiles {
    const result = MaxFiles.createForMode({
      kind: "performance",
      description: "Higher limits for performance",
    });
    return result.ok ? result.data : MaxFiles.createDefault();
  },
};
