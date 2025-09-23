import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";

/**
 * Domain service for adjusting validation rules based on schema context.
 *
 * Following DDD principles:
 * - Belongs to Schema Management bounded context
 * - Handles cross-entity operations between ValidationRules and Schema
 * - Implements Totality principle with Result<T,E> pattern
 * - Uses Smart Constructor pattern for safe instantiation
 *
 * Addresses Issue #1021: Extracted from 1026-line pipeline to improve DDD compliance
 */
export class ValidationRulesAdjustmentService {
  private readonly logger: DebugLogger;

  private constructor(
    private readonly schemaValidationService: SchemaValidationServicePort,
    logger?: DebugLogger,
  ) {
    if (logger) {
      this.logger = logger;
    } else {
      const loggerResult = createEnhancedDebugLogger(
        "validation-rules-adjustment",
      );
      if (loggerResult.ok) {
        this.logger = loggerResult.data;
      } else {
        // Create a no-op logger as fallback
        this.logger = {
          debug: () => ok(void 0),
          info: () => ok(void 0),
          warn: () => ok(void 0),
          error: () => ok(void 0),
          trace: () => ok(void 0),
          log: () => ok(void 0),
          withContext: () => this.logger,
        };
      }
    }
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    schemaValidationService: SchemaValidationServicePort,
    logger?: DebugLogger,
  ): Result<
    ValidationRulesAdjustmentService,
    DomainError & { message: string }
  > {
    if (!schemaValidationService) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "SchemaValidationService is required for ValidationRulesAdjustmentService",
      }));
    }

    if (!schemaValidationService.getValidationRulesForFrontmatterPart) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "SchemaValidationService must implement getValidationRulesForFrontmatterPart method",
      }));
    }

    return ok(
      new ValidationRulesAdjustmentService(schemaValidationService, logger),
    );
  }

  /**
   * Adjusts validation rules based on schema context with proper fallback strategy.
   *
   * Domain Logic:
   * 1. Attempts to derive validation rules from schema's frontmatter part
   * 2. Falls back to original rules if schema derivation fails
   * 3. Maintains audit trail through logging
   *
   * @param originalRules - The original validation rules to adjust
   * @param schema - The schema to derive rules from
   * @returns Result with adjusted validation rules or domain error
   */
  adjustRules(
    originalRules: ValidationRules,
    schema: Schema,
  ): Result<ValidationRules, DomainError & { message: string }> {
    // Input validation
    if (!originalRules) {
      return err(createError({
        kind: "MissingRequired",
        field: "originalRules",
        message: "Original validation rules are required",
      }));
    }

    if (!schema) {
      return err(createError({
        kind: "MissingRequired",
        field: "schema",
        message: "Schema is required for rule adjustment",
      }));
    }

    this.logger.debug(
      "Starting validation rules adjustment from schema",
      {
        operation: "validation-rule-adjustment",
        hasOriginalRules: true,
        originalRulesCount: originalRules.getRules().length,
        timestamp: new Date().toISOString(),
      },
    );

    // Attempt to derive validation rules from schema
    const schemaBasedRulesResult = this.deriveRulesFromSchema(schema);

    if (schemaBasedRulesResult.ok) {
      this.logger.info(
        "Successfully derived validation rules from schema",
        {
          operation: "validation-rule-adjustment",
          derivedRulesCount: schemaBasedRulesResult.data.getRules().length,
          usingResolvedSchema: true,
          timestamp: new Date().toISOString(),
        },
      );
      return ok(schemaBasedRulesResult.data);
    } else {
      // Fallback strategy: use original rules with warning
      this.logger.warn(
        "Failed to derive rules from schema, falling back to original rules",
        {
          operation: "validation-rule-adjustment",
          error: schemaBasedRulesResult.error.message,
          fallbackRulesCount: originalRules.getRules().length,
          timestamp: new Date().toISOString(),
        },
      );
      return ok(originalRules);
    }
  }

  /**
   * Derives validation rules from schema's frontmatter part configuration.
   *
   * Private domain method that encapsulates schema-specific rule derivation logic.
   */
  private deriveRulesFromSchema(
    schema: Schema,
  ): Result<ValidationRules, DomainError & { message: string }> {
    try {
      const validationRulesResult = this.schemaValidationService
        .getValidationRulesForFrontmatterPart(schema);

      if (!validationRulesResult.ok) {
        return err(createError({
          kind: "RenderFailed",
          message:
            `Schema validation service failed: ${validationRulesResult.error.message}`,
        }));
      }

      return ok(validationRulesResult.data);
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: `Unexpected error during schema rule derivation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }
}

/**
 * Port interface for schema validation service.
 * Defines the contract for schema-based validation rule generation.
 *
 * Following Hexagonal Architecture principles to maintain domain isolation.
 */
export interface SchemaValidationServicePort {
  getValidationRulesForFrontmatterPart(
    schema: Schema,
  ): Result<ValidationRules, DomainError & { message: string }>;
}
