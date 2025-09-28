/**
 * @fileoverview FrontmatterProcessingConfigurationCoordinator - Configuration Processing Coordination
 * @description Extracts processing configuration setup and coordination from transformation service
 * Following DDD boundaries and Totality principles for configuration coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterConfigurationProcessor } from "./frontmatter-configuration-processor.ts";
import { FrontmatterProcessingMonitoringService } from "./frontmatter-processing-monitoring-service.ts";
import { ProcessingBounds } from "../../shared/types/processing-bounds.ts";
import { ProcessingOptionsState } from "../configuration/processing-options-factory.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";

/**
 * Configuration interface for processing configuration coordinator dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterProcessingConfigurationCoordinatorConfig {
  readonly configurationProcessor: FrontmatterConfigurationProcessor;
  readonly monitoringService: FrontmatterProcessingMonitoringService;
  readonly debugLogger?: DebugLogger;
}

/**
 * Processing configuration setup result
 * Encapsulates configuration setup with tracking metadata
 */
export interface ProcessingConfigurationResult {
  readonly bounds: ProcessingBounds;
  readonly legacyOptions?: { parallel?: boolean; maxWorkers?: number };
  readonly configurationSetup: boolean;
  readonly memoryTracking: boolean;
  readonly boundsLogging: boolean;
}

/**
 * FrontmatterProcessingConfigurationCoordinator - Configuration Processing Coordinator
 *
 * Responsibilities:
 * - Processing configuration setup coordination
 * - Memory bounds variance tracking coordination
 * - Processing bounds initialization logging
 * - Configuration state management
 *
 * Following DDD principles:
 * - Single responsibility: Configuration processing coordination only
 * - Domain service: Configuration coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Cross-service coordination: Clean integration with monitoring service
 */
export class FrontmatterProcessingConfigurationCoordinator {
  private constructor(
    private readonly config:
      FrontmatterProcessingConfigurationCoordinatorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates configuration coordinator with validated configuration
   */
  static create(
    config: FrontmatterProcessingConfigurationCoordinatorConfig,
  ): Result<
    FrontmatterProcessingConfigurationCoordinator,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.configurationProcessor) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Configuration processor is required for coordination",
        }),
      };
    }

    if (!config.monitoringService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Monitoring service is required for configuration coordination",
        }),
      };
    }

    return ok(new FrontmatterProcessingConfigurationCoordinator(config));
  }

  /**
   * Coordinate processing configuration setup
   * Handles configuration setup, memory tracking, and bounds logging
   */
  coordinateProcessingConfiguration(
    fileCount: number,
    processingBounds?: ProcessingBounds,
    legacyOptions?: { parallel?: boolean; maxWorkers?: number },
    processingOptionsState?: ProcessingOptionsState,
  ): Result<ProcessingConfigurationResult, DomainError & { message: string }> {
    this.config.debugLogger?.debug(
      "Starting processing configuration coordination",
      createLogContext({
        operation: "configuration-coordination",
        fileCount,
        boundsKind: processingBounds?.kind,
      }),
    );

    // Stage 1: Setup processing configuration using configuration processor
    const configResult = this.config.configurationProcessor
      .setupProcessingConfiguration(
        fileCount,
        processingBounds,
        legacyOptions,
        processingOptionsState,
      );

    if (!configResult.ok) {
      this.config.debugLogger?.error(
        "Failed to setup processing configuration",
        createLogContext({
          operation: "configuration-setup",
          error: configResult.error.message,
        }),
      );
      return configResult;
    }

    const actualBounds = configResult.data.bounds;
    const actualLegacyOptions = configResult.data.legacyOptions;

    // Stage 2: Delegate memory bounds variance tracking to monitoring service
    const memoryTrackingResult = this.config.monitoringService
      .trackMemoryBoundsVariance(
        processingBounds,
        actualBounds,
        fileCount,
      );

    let memoryTracking = false;
    if (!memoryTrackingResult.ok) {
      this.config.debugLogger?.warn(
        "Failed to track memory bounds variance",
        createLogContext({
          operation: "memory-variance-tracking",
          error: memoryTrackingResult.error.message,
        }),
      );
    } else {
      memoryTracking = true;
    }

    // Stage 3: Delegate bounds initialization logging to monitoring service
    const boundsLogResult = this.config.monitoringService
      .logProcessingBoundsInitialization(
        actualBounds.kind,
        fileCount,
      );

    let boundsLogging = false;
    if (!boundsLogResult.ok) {
      this.config.debugLogger?.warn(
        "Failed to log bounds initialization",
        createLogContext({
          operation: "bounds-logging",
          error: boundsLogResult.error.message,
        }),
      );
    } else {
      boundsLogging = true;
    }

    // Create configuration result with tracking metadata
    const result: ProcessingConfigurationResult = {
      bounds: actualBounds,
      legacyOptions: actualLegacyOptions,
      configurationSetup: true,
      memoryTracking,
      boundsLogging,
    };

    this.config.debugLogger?.info(
      "Processing configuration coordination completed",
      createLogContext({
        operation: "configuration-coordination",
        result: {
          boundsKind: result.bounds.kind,
          memoryTracking: result.memoryTracking,
          boundsLogging: result.boundsLogging,
        },
      }),
    );

    return ok(result);
  }

  /**
   * Validate configuration coordination preconditions
   * Ensures proper context for configuration processing
   */
  validateConfigurationPreconditions(
    fileCount: number,
    processingBounds?: ProcessingBounds,
  ): Result<void, DomainError & { message: string }> {
    // Validate file count
    if (fileCount < 0) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "File count must be non-negative for configuration processing",
        }),
      };
    }

    this.config.debugLogger?.debug(
      "Configuration coordination preconditions satisfied",
      createLogContext({
        operation: "configuration-precondition-check",
        fileCount,
        boundsKind: processingBounds?.kind,
      }),
    );

    return ok(void 0);
  }

  /**
   * Handle configuration coordination errors
   * Provides structured error handling for configuration failures
   */
  handleConfigurationError(
    error: DomainError & { message: string },
    fallbackBounds: ProcessingBounds,
    fallbackOptions?: { parallel?: boolean; maxWorkers?: number },
  ): Result<ProcessingConfigurationResult, DomainError & { message: string }> {
    this.config.debugLogger?.warn(
      "Configuration coordination failed, using fallback",
      createLogContext({
        operation: "configuration-error-handling",
        error: error.message,
        fallbackBoundsKind: fallbackBounds.kind,
      }),
    );

    // Return fallback result with original configuration
    const fallbackResult: ProcessingConfigurationResult = {
      bounds: fallbackBounds,
      legacyOptions: fallbackOptions ?? { parallel: false, maxWorkers: 1 },
      configurationSetup: false,
      memoryTracking: false,
      boundsLogging: false,
    };

    return ok(fallbackResult);
  }

  /**
   * Create configuration context for logging and monitoring
   * Provides structured context for configuration operations
   */
  createConfigurationContext(
    operation: string,
    fileCount: number,
    processingBounds?: ProcessingBounds,
  ): Record<string, unknown> {
    return createLogContext({
      operation,
      configurationContext: {
        fileCount,
        boundsKind: processingBounds?.kind,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
