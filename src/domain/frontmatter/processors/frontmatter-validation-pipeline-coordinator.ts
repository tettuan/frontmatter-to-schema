/**
 * @fileoverview FrontmatterValidationPipelineCoordinator - Domain Service for Validation Pipeline Coordination
 * @description Extracts validation rules processing and orchestration from transformation service
 * Following DDD boundaries and Totality principles for validation coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";

/**
 * Configuration interface for validation pipeline coordinator dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterValidationPipelineCoordinatorConfig {
  readonly schemaValidationService: SchemaValidationService;
  readonly debugLogger?: DebugLogger;
}

/**
 * Validation rules processing result
 * Encapsulates effective validation rules determination with tracking
 */
export interface ValidationRulesProcessingResult {
  readonly effectiveRules: ValidationRules;
  readonly rulesSource: "original" | "schema-derived";
  readonly rulesCount: number;
  readonly usingResolvedSchema: boolean;
}

/**
 * FrontmatterValidationPipelineCoordinator - Domain Service for Validation Pipeline Coordination
 *
 * Responsibilities:
 * - Validation rules processing and determination
 * - Cross-domain validation coordination (Schema ↔ Frontmatter)
 * - Validation orchestration and error handling
 * - Validation context management
 *
 * Following DDD principles:
 * - Single responsibility: Validation pipeline coordination only
 * - Domain service: Validation coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Cross-domain boundary management: Clean integration with Schema domain
 */
export class FrontmatterValidationPipelineCoordinator {
  private constructor(
    private readonly config: FrontmatterValidationPipelineCoordinatorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates validation coordinator with validated configuration
   */
  static create(
    config: FrontmatterValidationPipelineCoordinatorConfig,
  ): Result<
    FrontmatterValidationPipelineCoordinator,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.schemaValidationService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Schema validation service is required for validation coordination",
        }),
      };
    }

    return ok(new FrontmatterValidationPipelineCoordinator(config));
  }

  /**
   * Coordinate validation rules processing
   * Determines effective validation rules from original rules and schema derivation
   */
  coordinateValidationRulesProcessing(
    originalValidationRules: ValidationRules,
    schema: Schema,
  ): Result<
    ValidationRulesProcessingResult,
    DomainError & { message: string }
  > {
    this.config.debugLogger?.debug(
      "Starting validation rules coordination",
      createLogContext({
        operation: "validation-rules-coordination",
        inputs:
          `originalRulesCount: ${originalValidationRules.getRules().length}`,
      }),
    );

    // Stage 0: Check for x-frontmatter-part and adjust validation rules if needed
    // When x-frontmatter-part is defined, individual files should be validated
    // against the array element schema, not the top-level schema
    let effectiveValidationRules = originalValidationRules;
    let rulesSource: "original" | "schema-derived" = "original";
    let usingResolvedSchema = false;

    // Use schema validation service to get proper validation rules for frontmatter part
    // This follows DDD boundaries: Schema domain provides validation rules to frontmatter domain
    const validationRulesResult = this.config.schemaValidationService
      .getValidationRulesForFrontmatterPart(schema);

    if (validationRulesResult.ok) {
      effectiveValidationRules = validationRulesResult.data;
      rulesSource = "schema-derived";
      usingResolvedSchema = true;

      this.config.debugLogger?.info(
        "Generated validation rules from resolved schema",
        createLogContext({
          operation: "validation-adjustment",
          totalRules: effectiveValidationRules.getRules().length,
          usingResolvedSchema: true,
        }),
      );
    } else {
      this.config.debugLogger?.warn(
        "Failed to get validation rules from schema service, using default rules",
        createLogContext({
          error: validationRulesResult.error.message,
          operation: "validation-adjustment",
        }),
      );
      // Keep using original validation rules as fallback
    }

    const result: ValidationRulesProcessingResult = {
      effectiveRules: effectiveValidationRules,
      rulesSource,
      rulesCount: effectiveValidationRules.getRules().length,
      usingResolvedSchema,
    };

    this.config.debugLogger?.debug(
      "Validation rules coordination completed",
      createLogContext({
        operation: "validation-rules-coordination",
        result: {
          rulesSource: result.rulesSource,
          rulesCount: result.rulesCount,
          usingResolvedSchema: result.usingResolvedSchema,
        },
      }),
    );

    return ok(result);
  }

  /**
   * Log validation rules processing result
   * Provides structured logging for validation rules determination
   */
  logValidationRulesProcessing(
    result: ValidationRulesProcessingResult,
  ): Result<void, DomainError & { message: string }> {
    if (result.rulesSource === "schema-derived") {
      this.config.debugLogger?.info(
        `Generated validation rules from resolved schema`,
        createLogContext({
          operation: "validation-adjustment",
          totalRules: result.rulesCount,
          usingResolvedSchema: result.usingResolvedSchema,
        }),
      );
    } else {
      this.config.debugLogger?.debug(
        `Using original validation rules`,
        createLogContext({
          operation: "validation-adjustment",
          totalRules: result.rulesCount,
          usingResolvedSchema: result.usingResolvedSchema,
        }),
      );
    }

    return ok(void 0);
  }

  /**
   * Validate validation rules processing preconditions
   * Ensures proper context for validation rules determination
   */
  validateProcessingPreconditions(
    originalValidationRules: ValidationRules,
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    // Validate original validation rules
    if (!originalValidationRules) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Original validation rules are required for processing",
        }),
      };
    }

    // Validate schema context
    if (!schema) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Schema is required for validation rules processing",
        }),
      };
    }

    this.config.debugLogger?.debug(
      "Validation processing preconditions satisfied",
      createLogContext({
        operation: "validation-precondition-check",
        originalRulesCount: originalValidationRules.getRules().length,
        schemaAvailable: !!schema,
      }),
    );

    return ok(void 0);
  }

  /**
   * Handle validation rules processing errors
   * Provides structured error handling for validation coordination failures
   */
  handleValidationRulesError(
    error: DomainError & { message: string },
    fallbackRules: ValidationRules,
  ): Result<
    ValidationRulesProcessingResult,
    DomainError & { message: string }
  > {
    this.config.debugLogger?.warn(
      "Validation rules processing failed, using fallback",
      createLogContext({
        operation: "validation-error-handling",
        error: error.message,
        fallbackRulesCount: fallbackRules.getRules().length,
      }),
    );

    // Return fallback result with original rules
    const fallbackResult: ValidationRulesProcessingResult = {
      effectiveRules: fallbackRules,
      rulesSource: "original",
      rulesCount: fallbackRules.getRules().length,
      usingResolvedSchema: false,
    };

    return ok(fallbackResult);
  }

  /**
   * Create validation context for logging and monitoring
   * Provides structured context for validation operations
   */
  createValidationContext(
    operation: string,
    validationRules: ValidationRules,
    schema?: Schema,
  ): Record<string, unknown> {
    return createLogContext({
      operation,
      validationContext: {
        rulesCount: validationRules.getRules().length,
        schemaAvailable: !!schema,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
