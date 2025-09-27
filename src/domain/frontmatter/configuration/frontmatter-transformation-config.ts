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
import { FrontmatterPartProcessor } from "../processors/frontmatter-part-processor.ts";
import { MemoryBoundsService } from "../../../infrastructure/monitoring/memory-bounds-service.ts";
import { MergeOperations } from "../utilities/merge-operations.ts";
import { FieldOperations } from "../utilities/field-operations.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";

/**
 * Configuration object grouping related dependencies for FrontmatterTransformationService
 * Follows DDD dependency management patterns and Totality principles
 */
export interface FrontmatterTransformationConfig {
  readonly processor: FrontmatterProcessor;
  readonly fileSystem: {
    readonly reader: DomainFileReader;
    readonly lister: DomainFileLister;
  };
  readonly services: {
    readonly aggregator: Aggregator;
    readonly basePropertyPopulator: BasePropertyPopulator;
    readonly schemaValidation: SchemaValidationService;
    readonly frontmatterPartProcessor: FrontmatterPartProcessor;
    readonly memoryBounds: MemoryBoundsService;
    readonly dataCreation?: FrontmatterDataCreationService;
    readonly mergeOperations?: MergeOperations;
    readonly fieldOperations?: FieldOperations;
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
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    schemaValidation: SchemaValidationService,
    frontmatterPartProcessor: FrontmatterPartProcessor,
    memoryBoundsService: MemoryBoundsService,
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
        message: "DomainFileReader is required",
      }));
    }

    if (!fileLister) {
      return err(createError({
        kind: "InitializationError",
        message: "DomainFileLister is required",
      }));
    }

    if (!schemaValidation) {
      return err(createError({
        kind: "InitializationError",
        message: "SchemaValidationService is required",
      }));
    }

    if (!frontmatterPartProcessor) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterPartProcessor is required",
      }));
    }

    if (!memoryBoundsService) {
      return err(createError({
        kind: "InitializationError",
        message: "MemoryBoundsService is required",
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
        frontmatterPartProcessor,
        memoryBounds: memoryBoundsService,
        dataCreation: options?.dataCreation,
      },
      settings: {
        performance: options?.performance,
        logger: options?.logger,
      },
    });
  }
}
