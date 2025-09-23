/**
 * @fileoverview FrontmatterTransformationServiceLegacyFactory - Legacy Factory Methods Coordination
 * @description Extracts legacy factory methods from transformation service for backward compatibility
 * Following DDD boundaries and Totality principles for legacy method coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterTransformationService } from "../services/frontmatter-transformation-service.ts";
import { FrontmatterTransformationServiceFactory } from "../factories/frontmatter-transformation-service-factory.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { Aggregator } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "../services/frontmatter-data-creation-service.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";

/**
 * Configuration interface for legacy factory coordination dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterTransformationServiceLegacyFactoryConfig {
  readonly transformationServiceFactory:
    typeof FrontmatterTransformationServiceFactory;
}

/**
 * FrontmatterTransformationServiceLegacyFactory - Legacy Factory Methods Coordinator
 *
 * Responsibilities:
 * - Legacy factory method coordination for backward compatibility
 * - Delegation to modern factory implementation
 * - Deprecation warnings and migration guidance
 * - Backward compatibility maintenance
 *
 * Following DDD principles:
 * - Single responsibility: Legacy factory method coordination only
 * - Domain service: Legacy compatibility within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Clear deprecation boundaries: Isolated legacy patterns
 */
export class FrontmatterTransformationServiceLegacyFactory {
  private constructor(
    private readonly config:
      FrontmatterTransformationServiceLegacyFactoryConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates legacy factory coordinator with validated configuration
   */
  static create(
    config: FrontmatterTransformationServiceLegacyFactoryConfig,
  ): Result<
    FrontmatterTransformationServiceLegacyFactory,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.transformationServiceFactory) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Transformation service factory is required for legacy coordination",
        }),
      };
    }

    return ok(new FrontmatterTransformationServiceLegacyFactory(config));
  }

  /**
   * Factory method for creating FrontmatterTransformationService with enabled logging
   * Delegates to FrontmatterTransformationServiceFactory for DDD compliance
   */
  createWithEnabledLogging(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    debugLogger: DebugLogger,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    return this.config.transformationServiceFactory.createWithEnabledLogging(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      debugLogger,
      performanceSettings,
      schemaValidationService,
      frontmatterDataCreationService,
    );
  }

  /**
   * Factory method for creating FrontmatterTransformationService with disabled logging
   * Delegates to FrontmatterTransformationServiceFactory for DDD compliance
   */
  createWithDisabledLogging(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    return this.config.transformationServiceFactory.createWithDisabledLogging(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      performanceSettings,
      schemaValidationService,
      frontmatterDataCreationService,
    );
  }

  /**
   * Backward compatibility factory method for optional logger
   * Delegates to FrontmatterTransformationServiceFactory for DDD compliance
   * @deprecated Use createWithEnabledLogging() or createWithDisabledLogging() for explicit state management
   */
  createWithOptionalLogger(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    logger?: DebugLogger,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    return this.config.transformationServiceFactory.createWithOptionalLogger(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      performanceSettings,
      schemaValidationService,
      logger,
      frontmatterDataCreationService,
    );
  }

  /**
   * Validate legacy factory preconditions
   * Ensures proper context for legacy factory method execution
   */
  validateLegacyFactoryPreconditions(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
  ): Result<void, DomainError & { message: string }> {
    // Validate core dependencies
    if (!frontmatterProcessor) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Frontmatter processor is required for service creation",
        }),
      };
    }

    if (!aggregator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Aggregator is required for service creation",
        }),
      };
    }

    if (!basePropertyPopulator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Base property populator is required for service creation",
        }),
      };
    }

    if (!fileReader) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "File reader is required for service creation",
        }),
      };
    }

    if (!fileLister) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "File lister is required for service creation",
        }),
      };
    }

    if (!performanceSettings) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Performance settings are required for service creation",
        }),
      };
    }

    if (!schemaValidationService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Schema validation service is required for service creation",
        }),
      };
    }

    return ok(void 0);
  }
}
