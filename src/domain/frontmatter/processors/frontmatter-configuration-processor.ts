/**
 * @fileoverview FrontmatterConfigurationProcessor - Domain Service for processing configuration
 * @description Extracts configuration setup and processing bounds logic from transformation service
 * Following DDD boundaries and Totality principles for configuration management
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
} from "../../shared/types/processing-bounds.ts";
import {
  ProcessingOptionsFactory,
  ProcessingOptionsState,
} from "../configuration/processing-options-factory.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";

/**
 * Configuration for frontmatter configuration processor dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterConfigurationProcessorConfig {
  readonly debugLogger?: DebugLogger;
}

/**
 * Processing configuration result containing bounds and options
 * Following Totality principles with explicit configuration state
 */
export interface ProcessingConfiguration {
  readonly bounds: ProcessingBounds;
  readonly options: ProcessingOptionsState;
  readonly legacyOptions?: {
    parallel?: boolean;
    maxWorkers?: number;
  };
}

/**
 * FrontmatterConfigurationProcessor - Domain Service for Configuration Context
 *
 * Responsibilities:
 * - Processing bounds setup and validation
 * - Processing options state conversion and management
 * - Configuration validation and error handling
 * - Debug logging coordination for configuration decisions
 *
 * Following DDD principles:
 * - Single responsibility: Configuration processing only
 * - Domain service: Configuration coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterConfigurationProcessor {
  private constructor(
    private readonly config: FrontmatterConfigurationProcessorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates configuration processor with validated configuration
   */
  static create(
    config: FrontmatterConfigurationProcessorConfig,
  ): Result<
    FrontmatterConfigurationProcessor,
    DomainError & { message: string }
  > {
    // Configuration processor doesn't require specific validation currently
    // but follows smart constructor pattern for future extensibility
    return ok(new FrontmatterConfigurationProcessor(config));
  }

  /**
   * Setup processing configuration from input parameters
   * Handles bounds creation, options conversion, and validation
   * Following Totality principles with comprehensive error handling
   */
  setupProcessingConfiguration(
    fileCount: number,
    processingBounds?: ProcessingBounds,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    this.config.debugLogger?.debug(
      "Starting processing configuration setup",
      createLogContext({
        operation: "configuration-setup",
        inputs:
          `fileCount: ${fileCount}, bounds: ${!!processingBounds}, options: ${!!legacyOptions}`,
      }),
    );

    // Setup processing bounds with fallback to factory defaults
    const boundsResult = this.setupProcessingBounds(
      fileCount,
      processingBounds,
    );
    if (!boundsResult.ok) {
      return boundsResult;
    }

    // Setup processing options state with conversion logic
    const optionsResult = this.setupProcessingOptions(
      legacyOptions,
      processingOptionsState,
    );
    if (!optionsResult.ok) {
      return optionsResult;
    }

    // Create legacy options for backward compatibility
    const legacyOptionsResult = this.convertToLegacyOptions(
      optionsResult.data,
    );
    if (!legacyOptionsResult.ok) {
      return legacyOptionsResult;
    }

    const configuration: ProcessingConfiguration = {
      bounds: boundsResult.data,
      options: optionsResult.data,
      legacyOptions: legacyOptionsResult.data,
    };

    this.logConfigurationVariance(configuration, fileCount);

    this.config.debugLogger?.debug(
      "Successfully completed processing configuration setup",
      createLogContext({
        operation: "configuration-setup",
        inputs:
          `boundsType: ${configuration.bounds.kind}, optionsType: ${configuration.options.kind}`,
      }),
    );

    return ok(configuration);
  }

  /**
   * Setup processing bounds with factory fallback
   * Follows Totality principles with proper error handling
   */
  private setupProcessingBounds(
    fileCount: number,
    processingBounds?: ProcessingBounds,
  ): Result<ProcessingBounds, DomainError & { message: string }> {
    if (processingBounds) {
      this.config.debugLogger?.debug(
        "Using provided processing bounds",
        createLogContext({
          operation: "bounds-setup",
          inputs:
            `boundsType: ${processingBounds.kind}, fileCount: ${fileCount}`,
        }),
      );
      return ok(processingBounds);
    }

    this.config.debugLogger?.debug(
      "Creating default processing bounds",
      createLogContext({
        operation: "bounds-setup",
        inputs: `fileCount: ${fileCount}`,
      }),
    );

    const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
      fileCount,
    );
    if (!defaultBoundsResult.ok) {
      this.config.debugLogger?.error(
        "Failed to create default processing bounds",
        createLogContext({
          operation: "bounds-setup",
          inputs:
            `fileCount: ${fileCount}, error: ${defaultBoundsResult.error.message}`,
        }),
      );
      return defaultBoundsResult;
    }

    return defaultBoundsResult;
  }

  /**
   * Setup processing options state with conversion and validation
   * Handles both legacy and new option formats
   */
  private setupProcessingOptions(
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
  ): Result<ProcessingOptionsState, DomainError & { message: string }> {
    if (processingOptionsState) {
      this.config.debugLogger?.debug(
        "Using provided processing options state",
        createLogContext({
          operation: "options-setup",
          inputs: `optionsType: ${processingOptionsState.kind}`,
        }),
      );
      return ok(processingOptionsState);
    }

    if (legacyOptions) {
      this.config.debugLogger?.debug(
        "Converting legacy options to processing options state",
        createLogContext({
          operation: "options-setup",
          inputs:
            `parallel: ${legacyOptions.parallel}, maxWorkers: ${legacyOptions.maxWorkers}`,
        }),
      );
      return ok(ProcessingOptionsFactory.fromOptional(legacyOptions));
    }

    this.config.debugLogger?.debug(
      "Creating default sequential processing options",
      createLogContext({
        operation: "options-setup",
        inputs: "no options provided",
      }),
    );

    return ok(ProcessingOptionsFactory.createSequential());
  }

  /**
   * Convert processing options state to legacy format for backward compatibility
   * Maintains compatibility with existing processing logic
   */
  private convertToLegacyOptions(
    processingOptionsState: ProcessingOptionsState,
  ): Result<
    { parallel?: boolean; maxWorkers?: number } | undefined,
    DomainError & { message: string }
  > {
    switch (processingOptionsState.kind) {
      case "sequential":
        return ok({ parallel: false });
      case "parallel":
        return ok({
          parallel: true,
          maxWorkers: processingOptionsState.maxWorkers,
        });
      case "adaptive":
        return ok({
          parallel: true,
          maxWorkers: processingOptionsState.baseWorkers,
        });
      default:
        return err(createError({
          kind: "InvalidFormat",
          format: "processing-options",
          value: JSON.stringify(processingOptionsState),
        }, "Unknown processing options state kind"));
    }
  }

  /**
   * Log configuration variance and decision factors
   * Provides detailed debugging information for configuration decisions
   */
  private logConfigurationVariance(
    configuration: ProcessingConfiguration,
    fileCount: number,
  ): void {
    // Debug: Processing bounds variance tracking
    this.config.debugLogger?.debug(
      "Processing bounds variance decision coordination",
      {
        operation: "processing-bounds-variance",
        boundsSource: "configuration-processor",
        boundsType: configuration.bounds.kind,
        fileCount: fileCount,
        varianceFactors: {
          boundsDetermination: "configuration-processor-managed",
          memoryPrediction: configuration.bounds.kind === "bounded"
            ? "constrained"
            : "unlimited",
          coordinationStrategy: "ProcessingCoordinator-alignment",
        },
        expectedVariance: "low",
        timestamp: new Date().toISOString(),
      },
    );

    // Memory bounds variance debug information
    const memoryBoundsVarianceDebug = {
      varianceTarget: "memory-bounds-monitoring-variance-control",
      boundsConfiguration: {
        providedBounds: true, // Always true when using configuration processor
        boundsType: configuration.bounds.kind,
        fileCount: fileCount,
        boundsCreationMethod: "configuration-processor-managed",
      },
      memoryMonitoringVarianceFactors: {
        dynamicBoundsCalculation: false, // Managed by processor
        fileCountImpact: fileCount,
        expectedMemoryGrowthPattern: configuration.bounds.kind === "bounded"
          ? "bounded-growth"
          : "unlimited-growth",
        monitoringOverhead: "per-file-check",
        boundsCheckingFrequency: "every-100-files",
      },
      memoryVariancePrediction: {
        estimatedPeakMemory: `${fileCount * 2}MB`,
        memoryGrowthRate: "O(n)-linear",
        monitoringImpact: `${Math.ceil(fileCount / 100) * 5}ms`,
        varianceControlMethod: "configuration-processor-coordination",
      },
    };

    this.config.debugLogger?.debug(
      "Memory bounds variance control through configuration processor",
      createLogContext({
        operation: "memory-variance-control",
        inputs: JSON.stringify(memoryBoundsVarianceDebug),
      }),
    );
  }
}
