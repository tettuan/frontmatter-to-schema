/**
 * @fileoverview Frontmatter Configuration Service
 * @description Manages configuration concerns for frontmatter transformation
 * Following DDD bounded contexts and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
} from "../../shared/types/processing-bounds.ts";
import {
  ProcessingStrategyState,
  StateTransitions,
} from "../types/transformation-states.ts";

/**
 * Configuration state for frontmatter processing
 * Replaces scattered configuration logic with centralized management
 */
export interface FrontmatterProcessingConfiguration {
  readonly performanceSettings: PerformanceSettings;
  readonly processingStrategy: ProcessingStrategyState;
  readonly processingBounds: ProcessingBounds;
  readonly enableDebugLogging: boolean;
  readonly enableMemoryMonitoring: boolean;
}

/**
 * Service responsible for managing frontmatter configuration
 * Extracts configuration logic from FrontmatterTransformationService
 */
export class FrontmatterConfigurationService {
  private constructor(
    private readonly defaultPerformanceSettings: PerformanceSettings,
    private readonly defaultProcessingBounds: ProcessingBounds,
  ) {}

  /**
   * Smart constructor following Totality principles
   */
  static create(
    performanceSettings?: PerformanceSettings,
  ): Result<
    FrontmatterConfigurationService,
    DomainError & { message: string }
  > {
    // Get default performance settings if not provided
    let settings = performanceSettings;
    if (!settings) {
      const defaultSettingsResult = PerformanceSettings.createDefault();
      if (!defaultSettingsResult.ok) {
        return err(defaultSettingsResult.error);
      }
      settings = defaultSettingsResult.data;
    }

    // Create default processing bounds with estimated file count
    const boundsResult = ProcessingBoundsFactory.createDefault(100); // Default estimate
    if (!boundsResult.ok) {
      return err(boundsResult.error);
    }

    return ok(
      new FrontmatterConfigurationService(
        settings,
        boundsResult.data,
      ),
    );
  }

  /**
   * Build configuration for processing
   * Total function - always returns a valid configuration
   */
  buildConfiguration(
    fileCount: number,
    requestedStrategy?: ProcessingStrategyState,
    customBounds?: ProcessingBounds,
  ): Result<
    FrontmatterProcessingConfiguration,
    DomainError & { message: string }
  > {
    // Determine processing strategy
    const processingStrategy = StateTransitions.determineProcessingStrategy(
      fileCount,
      requestedStrategy,
    );

    // Use custom bounds or default
    const processingBounds = customBounds || this.defaultProcessingBounds;

    // Determine debug logging based on file count and strategy
    const enableDebugLogging = this.shouldEnableDebugLogging(
      fileCount,
      processingStrategy,
    );

    // Determine memory monitoring based on strategy
    const enableMemoryMonitoring = this.shouldEnableMemoryMonitoring(
      processingStrategy,
    );

    const config: FrontmatterProcessingConfiguration = {
      performanceSettings: this.defaultPerformanceSettings,
      processingStrategy,
      processingBounds,
      enableDebugLogging,
      enableMemoryMonitoring,
    };

    return ok(config);
  }

  /**
   * Determine if debug logging should be enabled
   * Total function with clear decision logic
   */
  private shouldEnableDebugLogging(
    fileCount: number,
    strategy: ProcessingStrategyState,
  ): boolean {
    // Enable debug for complex processing scenarios
    switch (strategy.kind) {
      case "sequential":
        return fileCount > 100; // Enable for large sequential processing
      case "parallel":
        return true; // Always enable for parallel to track worker coordination
      case "adaptive":
        return true; // Always enable for adaptive to track strategy changes
    }
  }

  /**
   * Determine if memory monitoring should be enabled
   * Total function based on strategy
   */
  private shouldEnableMemoryMonitoring(
    strategy: ProcessingStrategyState,
  ): boolean {
    switch (strategy.kind) {
      case "sequential":
        return true; // Monitor for gradual memory growth
      case "parallel":
        return true; // Monitor for memory spikes
      case "adaptive":
        return true; // Monitor to help adapt strategy
    }
  }

  /**
   * Validate configuration consistency
   * Ensures configuration is internally consistent
   */
  validateConfiguration(
    config: FrontmatterProcessingConfiguration,
  ): Result<void, DomainError & { message: string }> {
    // Validate processing bounds based on kind
    switch (config.processingBounds.kind) {
      case "bounded":
        if (config.processingBounds.fileLimit <= 0) {
          return ErrorHandler.validation({
            operation: "FrontmatterConfigurationService",
            method: "validateConfiguration",
          }).outOfRange(config.processingBounds.fileLimit, 1);
        }
        if (config.processingBounds.memoryLimit <= 0) {
          return ErrorHandler.validation({
            operation: "FrontmatterConfigurationService",
            method: "validateConfiguration",
          }).outOfRange(config.processingBounds.memoryLimit, 1);
        }
        break;
      case "unbounded":
        // No validation needed for unbounded
        break;
    }

    // Validate strategy-specific constraints
    switch (config.processingStrategy.kind) {
      case "parallel":
        if (config.processingStrategy.workers <= 0) {
          return ErrorHandler.validation({
            operation: "FrontmatterConfigurationService",
            method: "validateConfiguration",
          }).outOfRange(config.processingStrategy.workers, 1);
        }
        break;

      case "adaptive":
        if (config.processingStrategy.baseWorkers <= 0) {
          return ErrorHandler.validation({
            operation: "FrontmatterConfigurationService",
            method: "validateConfiguration",
          }).outOfRange(config.processingStrategy.baseWorkers, 1);
        }
        if (config.processingStrategy.threshold <= 0) {
          return ErrorHandler.validation({
            operation: "FrontmatterConfigurationService",
            method: "validateConfiguration",
          }).outOfRange(config.processingStrategy.threshold, 1);
        }
        break;

      case "sequential":
        // No additional validation needed
        break;
    }

    return ok(void 0);
  }

  /**
   * Get optimal worker count for parallel processing
   * Total function that always returns valid worker count
   */
  getOptimalWorkerCount(fileCount: number): number {
    const cpuCount = navigator?.hardwareConcurrency || 4; // Default to 4 if not available

    // Heuristics for optimal worker count
    if (fileCount <= 10) {
      return Math.min(2, cpuCount);
    } else if (fileCount <= 50) {
      return Math.min(4, cpuCount);
    } else if (fileCount <= 100) {
      return Math.min(6, cpuCount);
    } else {
      return Math.min(8, cpuCount);
    }
  }

  /**
   * Create configuration for testing
   * Provides predictable configuration for tests
   */
  static createTestConfiguration(): FrontmatterProcessingConfiguration {
    const defaultSettings = PerformanceSettings.createDefault();
    const bounds = ProcessingBoundsFactory.createBounded(512, 100, 30);

    return {
      performanceSettings: defaultSettings.ok
        ? defaultSettings.data
        : {} as PerformanceSettings,
      processingStrategy: { kind: "sequential" },
      processingBounds: bounds.ok ? bounds.data : { kind: "unbounded" },
      enableDebugLogging: false,
      enableMemoryMonitoring: false,
    };
  }
}
