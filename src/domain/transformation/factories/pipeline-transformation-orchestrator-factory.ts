/**
 * @fileoverview PipelineTransformationOrchestrator Factory
 * @description Factory for creating the new refactored domain architecture instead of monolithic service
 * Following DDD and Totality principles with proper dependency injection
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { PipelineTransformationOrchestrator } from "../services/pipeline-transformation-orchestrator.ts";
import { MarkdownDocumentProcessor } from "../../document/services/markdown-document-processor.ts";
import { SchemaValidationProcessor } from "../../schema-processing/services/schema-validation-processor.ts";
import { FrontmatterDataAggregator } from "../../data-aggregation/services/frontmatter-data-aggregator.ts";
import { FileDiscoveryService } from "../../frontmatter/services/file-discovery-service.ts";
import { FrontmatterProcessor } from "../../frontmatter/processors/frontmatter-processor.ts";
import { MergeOperations } from "../../frontmatter/utilities/merge-operations.ts";
import type { FrontmatterDataCreationService } from "../../frontmatter/services/frontmatter-data-creation-service.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";

/**
 * Configuration for PipelineTransformationOrchestrator Factory
 */
export interface PipelineTransformationOrchestratorConfig {
  readonly fileReader: DomainFileReader;
  readonly fileLister: DomainFileLister;
  readonly frontmatterProcessor: FrontmatterProcessor;
  readonly frontmatterDataCreationService: FrontmatterDataCreationService;
  readonly mergeOperations: MergeOperations;
}

/**
 * Factory for creating PipelineTransformationOrchestrator with proper domain architecture
 * Replaces the monolithic FrontmatterTransformationService with new DDD-based components
 *
 * Following DDD principles:
 * - Factory pattern for complex object creation
 * - Dependency injection for all domain services
 * - Clear separation of concerns between document, schema, and aggregation domains
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - Smart constructor pattern with validation
 * - No partial functions or exceptions
 */
export class PipelineTransformationOrchestratorFactory {
  /**
   * Create PipelineTransformationOrchestrator with the new domain architecture
   * This factory replaces the old monolithic FrontmatterTransformationService
   */
  static create(
    config: PipelineTransformationOrchestratorConfig,
  ): Result<
    PipelineTransformationOrchestrator,
    DomainError & { message: string }
  > {
    // Validate configuration
    if (!config.fileReader) {
      return err(createError({
        kind: "ConfigurationError",
        message: "DomainFileReader is required for pipeline orchestration",
      }));
    }

    if (!config.fileLister) {
      return err(createError({
        kind: "ConfigurationError",
        message: "DomainFileLister is required for pipeline orchestration",
      }));
    }

    if (!config.frontmatterProcessor) {
      return err(createError({
        kind: "ConfigurationError",
        message: "FrontmatterProcessor is required for pipeline orchestration",
      }));
    }

    if (!config.frontmatterDataCreationService) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "FrontmatterDataCreationService is required for pipeline orchestration",
      }));
    }

    if (!config.mergeOperations) {
      return err(createError({
        kind: "ConfigurationError",
        message: "MergeOperations is required for pipeline orchestration",
      }));
    }

    // Create DocumentProcessor
    const documentProcessorResult = MarkdownDocumentProcessor.create(
      config.fileReader,
      config.frontmatterProcessor,
    );
    if (!documentProcessorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create DocumentProcessor: ${documentProcessorResult.error.message}`,
      }));
    }

    // Create SchemaProcessor
    const schemaProcessorResult = SchemaValidationProcessor.create(
      config.frontmatterDataCreationService,
    );
    if (!schemaProcessorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create SchemaProcessor: ${schemaProcessorResult.error.message}`,
      }));
    }

    // Create DataAggregator
    const dataAggregatorResult = FrontmatterDataAggregator.create(
      config.mergeOperations,
      config.frontmatterDataCreationService,
    );
    if (!dataAggregatorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create DataAggregator: ${dataAggregatorResult.error.message}`,
      }));
    }

    // Create FileDiscoveryService
    const fileDiscoveryResult = FileDiscoveryService.create({
      fileLister: config.fileLister,
    });
    if (!fileDiscoveryResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create FileDiscoveryService: ${fileDiscoveryResult.error.message}`,
      }));
    }

    // Create BasePropertyPopulator for schema defaults
    const basePropertyPopulator = new BasePropertyPopulator();

    // Create PipelineTransformationOrchestrator
    const orchestratorResult = PipelineTransformationOrchestrator.create(
      documentProcessorResult.data,
      schemaProcessorResult.data,
      dataAggregatorResult.data,
      fileDiscoveryResult.data,
      basePropertyPopulator,
    );

    if (!orchestratorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create PipelineTransformationOrchestrator: ${orchestratorResult.error.message}`,
      }));
    }

    return ok(orchestratorResult.data);
  }

  /**
   * Create PipelineTransformationOrchestrator with default MergeOperations
   * Convenience method for common usage patterns
   */
  static createWithDefaults(
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    frontmatterProcessor: FrontmatterProcessor,
    frontmatterDataCreationService: FrontmatterDataCreationService,
  ): Result<
    PipelineTransformationOrchestrator,
    DomainError & { message: string }
  > {
    // Create default MergeOperations with the frontmatter data creation service
    const mergeOperations = new MergeOperations(frontmatterDataCreationService);

    return this.create({
      fileReader,
      fileLister,
      frontmatterProcessor,
      frontmatterDataCreationService,
      mergeOperations,
    });
  }
}
