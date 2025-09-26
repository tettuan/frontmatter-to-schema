/**
 * @fileoverview FrontmatterTransformationService Adapter
 * @description Adapter that makes PipelineTransformationOrchestrator compatible with existing FrontmatterTransformationService interface
 * Following DDD and Totality principles with proper adapter pattern implementation
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
} from "../../shared/types/processing-bounds.ts";
import { PipelineTransformationOrchestrator } from "../services/pipeline-transformation-orchestrator.ts";
import type { TransformationConfig } from "../interfaces/transformation-orchestrator.ts";

/**
 * Interface defining only the methods actually used by the application layer
 * This allows for duck typing compatibility with FrontmatterTransformationService
 */
export interface TransformationServiceInterface {
  transformDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>>;
}

/**
 * Adapter that implements the FrontmatterTransformationService interface
 * but delegates to the new PipelineTransformationOrchestrator architecture
 *
 * This allows the existing CLI and application layer to use the new refactored
 * domain architecture without breaking changes.
 *
 * Following DDD principles:
 * - Adapter pattern for interface compatibility
 * - Delegates to domain orchestrator for business logic
 * - Clean separation between legacy interface and new architecture
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - Comprehensive error handling through discriminated unions
 * - No partial functions or exceptions
 */
export class FrontmatterTransformationServiceAdapter
  implements TransformationServiceInterface {
  private constructor(
    private readonly orchestrator: PipelineTransformationOrchestrator,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates an adapter with validated orchestrator dependency
   */
  static create(
    orchestrator: PipelineTransformationOrchestrator,
  ): Result<
    FrontmatterTransformationServiceAdapter,
    DomainError & { message: string }
  > {
    if (!orchestrator) {
      return err(createError({
        kind: "ConfigurationError",
        message: "PipelineTransformationOrchestrator is required for adapter",
      }));
    }

    return ok(new FrontmatterTransformationServiceAdapter(orchestrator));
  }

  /**
   * Implementation of the legacy transformDocuments interface
   * Delegates to the new PipelineTransformationOrchestrator
   */
  async transformDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    try {
      // Convert legacy parameters to new TransformationConfig
      const transformationConfig = this.createTransformationConfig(
        inputPattern,
        validationRules,
        schema,
        processingBounds,
        options,
      );

      if (!transformationConfig.ok) {
        return transformationConfig;
      }

      // Delegate to the new orchestrator
      const orchestrationResult = await this.orchestrator
        .orchestrateTransformation(
          transformationConfig.data,
        );

      if (!orchestrationResult.ok) {
        return err(createError({
          kind: "ExtractionFailed",
          message:
            `Transformation orchestration failed: ${orchestrationResult.error.message}`,
        }));
      }

      // Convert the new result format back to legacy format
      return ok(orchestrationResult.data.transformedData);
    } catch (error) {
      return err(createError({
        kind: "ExtractionFailed",
        message: `Adapter transformation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  /**
   * Convert legacy interface parameters to new TransformationConfig
   * Maps old API to new domain architecture configuration
   */
  private createTransformationConfig(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Result<TransformationConfig, DomainError & { message: string }> {
    try {
      // Handle processing bounds - create default if not provided
      let finalProcessingBounds: ProcessingBounds;
      if (processingBounds) {
        finalProcessingBounds = processingBounds;
      } else {
        // We need to estimate file count for default bounds, use a reasonable default
        const defaultBoundsResult = ProcessingBoundsFactory.createDefault(100);
        if (!defaultBoundsResult.ok) {
          return err(createError({
            kind: "ConfigurationError",
            message:
              `Failed to create default processing bounds: ${defaultBoundsResult.error.message}`,
          }));
        }
        finalProcessingBounds = defaultBoundsResult.data;
      }

      // Create transformation config
      const config: TransformationConfig = {
        inputPattern,
        validationRules,
        schema,
        processingBounds: finalProcessingBounds,
        processingOptions: {
          parallel: options?.parallel || false,
          maxWorkers: options?.maxWorkers || 4,
        },
      };

      return ok(config);
    } catch (error) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Failed to create transformation config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }
}
