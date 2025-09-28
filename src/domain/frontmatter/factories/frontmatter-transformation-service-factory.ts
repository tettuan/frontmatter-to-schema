/**
 * @fileoverview FrontmatterTransformationService Factory
 * @description Factory methods for creating FrontmatterTransformationService with different logging configurations
 * Following DDD and Totality principles with proper error handling
 */

import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { Aggregator } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { DomainLoggerFactory } from "../../shared/services/domain-logger.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "../services/frontmatter-data-creation-service.ts";
import { FrontmatterTransformationService } from "../services/frontmatter-transformation-service.ts";
import { FrontmatterTransformationConfigFactory } from "../configuration/frontmatter-transformation-config.ts";
import { FrontmatterExtractionService } from "../services/frontmatter-extraction-service.ts";
import { FrontmatterValidationService } from "../services/frontmatter-validation-service.ts";

/**
 * Factory for creating FrontmatterTransformationService instances with different logging configurations
 * Follows DDD Factory pattern and Totality principles
 */
export class FrontmatterTransformationServiceFactory {
  /**
   * Factory method for creating FrontmatterTransformationService with enabled logging
   */
  static createWithEnabledLogging(
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
    const domainLogger = DomainLoggerFactory.createEnabled(debugLogger);

    return this.createServiceWithLogger(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      frontmatterDataCreationService,
      performanceSettings,
      domainLogger,
    );
  }

  /**
   * Factory method for creating FrontmatterTransformationService with disabled logging
   */
  static createWithDisabledLogging(
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
    const domainLogger = DomainLoggerFactory.createDisabled();

    return this.createServiceWithLogger(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      frontmatterDataCreationService,
      performanceSettings,
      domainLogger,
    );
  }

  /**
   * Backward compatibility factory method for optional logger
   * @deprecated Use createWithEnabledLogging() or createWithDisabledLogging() for explicit state management
   */
  static createWithOptionalLogger(
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
    const domainLogger = DomainLoggerFactory.fromOptional(logger);

    return this.createServiceWithLogger(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      frontmatterDataCreationService,
      performanceSettings,
      domainLogger,
    );
  }

  /**
   * Internal helper method to create service with configured domain logger
   * Follows DDD principles with proper error handling
   */
  private static createServiceWithLogger(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService: FrontmatterDataCreationService,
    performanceSettings: PerformanceSettings,
    domainLogger: any, // DomainLogger type
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    // Initialize extraction service
    const extractionResult = FrontmatterExtractionService.create(
      frontmatterProcessor,
    );
    if (!extractionResult.ok) {
      return { ok: false, error: extractionResult.error };
    }

    // Initialize validation service
    const validationResult = FrontmatterValidationService.create(
      schemaValidationService,
    );
    if (!validationResult.ok) {
      return { ok: false, error: validationResult.error };
    }

    const configResult = FrontmatterTransformationConfigFactory.create(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      {
        dataCreation: frontmatterDataCreationService,
        logger: domainLogger,
        performance: performanceSettings,
      },
    );

    if (!configResult.ok) {
      return { ok: false, error: configResult.error };
    }

    const serviceResult = FrontmatterTransformationService.create(
      configResult.data,
    );
    if (!serviceResult.ok) {
      return { ok: false, error: serviceResult.error };
    }

    return { ok: true, data: serviceResult.data };
  }
}
