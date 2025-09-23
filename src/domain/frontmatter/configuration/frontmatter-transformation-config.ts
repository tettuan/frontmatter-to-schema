/**
 * @fileoverview FrontmatterTransformationConfig
 * @description Configuration object and factory for FrontmatterTransformationService
 * Following DDD dependency management patterns and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { Aggregator } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { DomainLogger } from "../../shared/services/domain-logger.ts";
import { FrontmatterDataCreationService } from "../services/frontmatter-data-creation-service.ts";
import type {
  FileLister,
  FileReader,
} from "../../../application/interfaces/file-system-interfaces.ts";

/**
 * Configuration object grouping related dependencies for FrontmatterTransformationService
 * Follows DDD dependency management patterns and Totality principles
 */
export interface FrontmatterTransformationConfig {
  readonly processor: FrontmatterProcessor;
  readonly fileSystem: {
    readonly reader: FileReader;
    readonly lister: FileLister;
  };
  readonly services: {
    readonly aggregator: Aggregator;
    readonly basePropertyPopulator: BasePropertyPopulator;
    readonly schemaValidation: SchemaValidationService;
    readonly dataCreation?: FrontmatterDataCreationService;
  };
  readonly settings: {
    readonly performance?: PerformanceSettings;
    readonly logger?: DomainLogger;
  };
}

/**
 * Factory for creating FrontmatterTransformationConfig with validation
 * Implements Smart Constructor pattern following Totality principles
 */
export class FrontmatterTransformationConfigFactory {
  /**
   * Create configuration with all required dependencies
   */
  static create(
    processor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: FileReader,
    fileLister: FileLister,
    schemaValidation: SchemaValidationService,
    options?: {
      readonly dataCreation?: FrontmatterDataCreationService;
      readonly performance?: PerformanceSettings;
      readonly logger?: DomainLogger;
    },
  ): Result<
    FrontmatterTransformationConfig,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!processor) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterProcessor is required",
      }));
    }

    if (!aggregator) {
      return err(createError({
        kind: "InitializationError",
        message: "Aggregator is required",
      }));
    }

    if (!basePropertyPopulator) {
      return err(createError({
        kind: "InitializationError",
        message: "BasePropertyPopulator is required",
      }));
    }

    if (!fileReader) {
      return err(createError({
        kind: "InitializationError",
        message: "FileReader is required",
      }));
    }

    if (!fileLister) {
      return err(createError({
        kind: "InitializationError",
        message: "FileLister is required",
      }));
    }

    if (!schemaValidation) {
      return err(createError({
        kind: "InitializationError",
        message: "SchemaValidationService is required",
      }));
    }

    return ok({
      processor,
      fileSystem: {
        reader: fileReader,
        lister: fileLister,
      },
      services: {
        aggregator,
        basePropertyPopulator,
        schemaValidation,
        dataCreation: options?.dataCreation,
      },
      settings: {
        performance: options?.performance,
        logger: options?.logger,
      },
    });
  }
}
