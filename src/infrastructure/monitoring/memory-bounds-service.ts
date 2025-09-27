/**
 * @fileoverview Memory Bounds Service
 * @description Infrastructure service for memory bounds monitoring following DDD principles
 * Extracted from FrontmatterTransformationService as part of Issue #1080 complexity reduction
 */

import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
  ProcessingState,
} from "../../domain/shared/types/processing-bounds.ts";

/**
 * Configuration for MemoryBoundsService
 * Following DDD smart constructor pattern with validation
 */
export interface MemoryBoundsServiceConfig {
  readonly bounds: ProcessingBounds;
}

/**
 * Memory Bounds Service
 *
 * Infrastructure service that encapsulates ProcessingBoundsMonitor functionality
 * and provides clean interface for memory bounds monitoring in domain services.
 *
 * Responsibilities:
 * - Memory bounds monitoring and state checking
 * - Memory growth validation following O(log n) constraints
 * - Processing state management and threshold checking
 * - Clean abstraction over ProcessingBoundsMonitor implementation
 *
 * Part of Issue #1080 DDD refactoring to reduce complexity in FrontmatterTransformationService
 */
export class MemoryBoundsService {
  private readonly monitor: ProcessingBoundsMonitor;

  private constructor(config: MemoryBoundsServiceConfig) {
    this.monitor = ProcessingBoundsMonitor.create(config.bounds);
  }

  /**
   * Smart constructor for MemoryBoundsService
   * Following Totality principles with comprehensive validation
   */
  static create(
    config: MemoryBoundsServiceConfig,
  ): Result<MemoryBoundsService, DomainError & { message: string }> {
    if (!config) {
      return {
        ok: false,
        error: {
          kind: "InitializationError",
          message: "MemoryBoundsService configuration is required",
        },
      };
    }

    if (!config.bounds) {
      return {
        ok: false,
        error: {
          kind: "InitializationError",
          message: "ProcessingBounds are required for memory bounds service",
        },
      };
    }

    return {
      ok: true,
      data: new MemoryBoundsService(config),
    };
  }

  /**
   * Check current processing state against memory bounds
   * Returns processing state for decision making in domain services
   */
  checkProcessingState(filesProcessed: number): ProcessingState {
    return this.monitor.checkState(filesProcessed);
  }

  /**
   * Validate memory growth against O(log n) constraints
   * Returns validation result for memory efficiency monitoring
   */
  validateMemoryGrowth(
    filesProcessed: number,
  ): Result<void, DomainError & { message: string }> {
    const validationResult = this.monitor.validateMemoryGrowth(filesProcessed);

    if (!validationResult.ok) {
      // Convert PerformanceError to DomainError for consistent error handling
      return {
        ok: false,
        error: {
          kind: "MemoryMonitorError",
          content: validationResult.error.message,
          message: validationResult.error.message,
        },
      };
    }

    return { ok: true, data: void 0 };
  }

  /**
   * Get processing bounds configuration
   * Provides access to bounds configuration for domain services
   */
  getProcessingBounds(): ProcessingBounds {
    return this.monitor.getBounds();
  }

  /**
   * Check if processing is within acceptable bounds
   * Convenience method for quick bounds checking
   */
  isWithinBounds(filesProcessed: number): boolean {
    const state = this.checkProcessingState(filesProcessed);
    return state.kind === "within_bounds" || state.kind === "approaching_limit";
  }

  /**
   * Check if processing has exceeded limits
   * Convenience method for failure condition detection
   */
  hasExceededLimits(filesProcessed: number): boolean {
    const state = this.checkProcessingState(filesProcessed);
    return state.kind === "exceeded_limit";
  }

  /**
   * Get underlying ProcessingBoundsMonitor for legacy compatibility
   * @deprecated Use MemoryBoundsService methods instead of direct monitor access
   * This method provides backward compatibility during the DDD migration phase
   */
  getUnderlyingMonitor(): ProcessingBoundsMonitor {
    return this.monitor;
  }
}

/**
 * Factory class for creating MemoryBoundsService instances
 * Provides convenient creation methods following DDD factory pattern
 */
export class MemoryBoundsServiceFactory {
  /**
   * Create MemoryBoundsService with bounded processing limits
   */
  static createBounded(
    memoryLimitMB: number,
    fileLimit: number,
    timeLimitSeconds: number,
  ): Result<MemoryBoundsService, DomainError & { message: string }> {
    const boundsResult = ProcessingBoundsFactory.createBounded(
      memoryLimitMB,
      fileLimit,
      timeLimitSeconds,
    );

    if (!boundsResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InitializationError",
          message:
            `Failed to create processing bounds: ${boundsResult.error.message}`,
        },
      };
    }

    return MemoryBoundsService.create({ bounds: boundsResult.data });
  }

  /**
   * Create MemoryBoundsService with unbounded processing
   */
  static createUnbounded(): Result<
    MemoryBoundsService,
    DomainError & { message: string }
  > {
    const bounds = ProcessingBoundsFactory.createUnbounded();
    return MemoryBoundsService.create({ bounds });
  }

  /**
   * Create MemoryBoundsService with default bounds based on file count
   */
  static createDefault(
    fileCount: number,
  ): Result<MemoryBoundsService, DomainError & { message: string }> {
    const boundsResult = ProcessingBoundsFactory.createDefault(fileCount);

    if (!boundsResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InitializationError",
          message:
            `Failed to create default processing bounds: ${boundsResult.error.message}`,
        },
      };
    }

    return MemoryBoundsService.create({ bounds: boundsResult.data });
  }
}
