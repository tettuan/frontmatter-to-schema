/**
 * @fileoverview Frontmatter Validation Orchestrator
 * @description Orchestrates validation logic for frontmatter data
 * Following DDD and Totality principles - replaces scattered validation logic
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { FrontmatterValidationService } from "./frontmatter-validation-service.ts";
import {
  completeValidation,
  failValidation,
  startValidation,
  ValidationState,
} from "../types/transformation-states.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";

/**
 * Validation context containing all necessary information
 */
export interface ValidationContext {
  readonly schema: Schema;
  readonly validationRules: ValidationRules;
  readonly hasFrontmatterPart: boolean;
  readonly logger?: DebugLogger;
}

/**
 * Validation result with detailed information
 */
export interface ValidationResult {
  readonly state: ValidationState;
  readonly effectiveRules: ValidationRules;
  readonly adjustedForFrontmatterPart: boolean;
}

/**
 * Service responsible for orchestrating validation logic
 * Centralizes validation concerns from FrontmatterTransformationService
 */
export class FrontmatterValidationOrchestrator {
  private constructor(
    private readonly schemaValidationService: SchemaValidationService,
    private readonly frontmatterValidationService: FrontmatterValidationService,
  ) {}

  /**
   * Smart constructor following Totality principles
   */
  static create(
    schemaValidationService: SchemaValidationService,
    frontmatterValidationService: FrontmatterValidationService,
  ): Result<
    FrontmatterValidationOrchestrator,
    DomainError & { message: string }
  > {
    if (!schemaValidationService) {
      return ErrorHandler.validation({
        operation: "FrontmatterValidationOrchestrator",
        method: "create",
      }).missingRequired("schemaValidationService");
    }

    if (!frontmatterValidationService) {
      return ErrorHandler.validation({
        operation: "FrontmatterValidationOrchestrator",
        method: "create",
      }).missingRequired("frontmatterValidationService");
    }

    return ok(
      new FrontmatterValidationOrchestrator(
        schemaValidationService,
        frontmatterValidationService,
      ),
    );
  }

  /**
   * Prepare validation rules based on schema configuration
   * Handles x-frontmatter-part adjustments
   */
  prepareValidationRules(
    context: ValidationContext,
  ): Result<ValidationRules, DomainError & { message: string }> {
    const { schema, validationRules, logger } = context;

    // Check if schema has x-frontmatter-part
    const frontmatterPartResult = this.checkFrontmatterPart(schema);

    if (!frontmatterPartResult.ok) {
      // Use original rules if check fails
      logger?.warn("Failed to check frontmatter part, using original rules", {
        operation: "validation-preparation",
        error: frontmatterPartResult.error.message,
        timestamp: new Date().toISOString(),
      });
      return ok(validationRules);
    }

    if (!frontmatterPartResult.data) {
      // No frontmatter part, use original rules
      return ok(validationRules);
    }

    // Get adjusted validation rules for frontmatter part
    const adjustedRulesResult = this.schemaValidationService
      .getValidationRulesForFrontmatterPart(schema);

    if (!adjustedRulesResult.ok) {
      logger?.warn("Failed to get adjusted validation rules", {
        operation: "validation-preparation",
        error: adjustedRulesResult.error.message,
        timestamp: new Date().toISOString(),
      });
      return ok(validationRules); // Fallback to original rules
    }

    logger?.info("Using adjusted validation rules for frontmatter part", {
      operation: "validation-preparation",
      originalRules: validationRules.getRules().length,
      adjustedRules: adjustedRulesResult.data.getRules().length,
      timestamp: new Date().toISOString(),
    });

    return ok(adjustedRulesResult.data);
  }

  /**
   * Validate frontmatter data
   * Returns validation state following Totality principles
   */
  validateData(
    data: unknown,
    rules: ValidationRules,
    logger?: DebugLogger,
  ): ValidationResult {
    // Start validation
    let state: ValidationState = startValidation(data, rules);

    // First convert unknown data to FrontmatterData
    const frontmatterDataResult = FrontmatterData.create(data);
    if (!frontmatterDataResult.ok) {
      state = failValidation(data, [frontmatterDataResult.error]);
      logger?.warn("Failed to create FrontmatterData", {
        operation: "data-validation",
        status: "failed",
        error: frontmatterDataResult.error.message,
        timestamp: new Date().toISOString(),
      });
      return {
        state,
        effectiveRules: rules,
        adjustedForFrontmatterPart: false,
      };
    }

    // Perform validation
    const validationResult = this.frontmatterValidationService
      .validateAgainstRules(
        frontmatterDataResult.data,
        rules,
      );

    if (validationResult.ok) {
      state = completeValidation(frontmatterDataResult.data);
      logger?.debug("Validation completed successfully", {
        operation: "data-validation",
        status: "success",
        timestamp: new Date().toISOString(),
      });
    } else {
      state = failValidation(data, [validationResult.error]);
      logger?.warn("Validation failed", {
        operation: "data-validation",
        status: "failed",
        error: validationResult.error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      state,
      effectiveRules: rules,
      adjustedForFrontmatterPart: false,
    };
  }

  /**
   * Batch validate multiple data items
   * Processes validation for multiple items efficiently
   */
  batchValidate(
    dataItems: unknown[],
    rules: ValidationRules,
    logger?: DebugLogger,
  ): Result<ValidationState[], DomainError & { message: string }> {
    const results: ValidationState[] = [];
    const errors: Array<DomainError & { message: string }> = [];

    for (let i = 0; i < dataItems.length; i++) {
      const item = dataItems[i];
      const result = this.validateData(item, rules, logger);

      results.push(result.state);

      if (result.state.kind === "validation_failed") {
        errors.push(...result.state.errors);
      }
    }

    if (errors.length > 0) {
      logger?.warn(`Batch validation completed with ${errors.length} errors`, {
        operation: "batch-validation",
        totalItems: dataItems.length,
        failedItems: errors.length,
        timestamp: new Date().toISOString(),
      });
    }

    return ok(results);
  }

  /**
   * Check if schema has frontmatter part configuration
   * Total function that handles all cases
   */
  private checkFrontmatterPart(
    schema: Schema,
  ): Result<boolean, DomainError & { message: string }> {
    try {
      const frontmatterPartResult = schema.findFrontmatterPartSchema();

      if (!frontmatterPartResult.ok) {
        // No frontmatter part found is not an error
        return ok(false);
      }

      return ok(true);
    } catch (error) {
      return ErrorHandler.schema({
        operation: "FrontmatterValidationOrchestrator",
        method: "checkFrontmatterPart",
      }).invalid(
        `Failed to check frontmatter part: ${error}`,
      );
    }
  }

  /**
   * Create validation summary
   * Provides summary of validation results
   */
  createValidationSummary(
    states: ValidationState[],
  ): {
    total: number;
    validated: number;
    failed: number;
    errors: Array<DomainError & { message: string }>;
  } {
    const summary = {
      total: states.length,
      validated: 0,
      failed: 0,
      errors: [] as Array<DomainError & { message: string }>,
    };

    for (const state of states) {
      switch (state.kind) {
        case "validated":
          summary.validated++;
          break;
        case "validation_failed":
          summary.failed++;
          summary.errors.push(...state.errors);
          break;
          // Other states don't contribute to summary
      }
    }

    return summary;
  }

  /**
   * Apply schema migration if needed
   * Handles legacy schema format migration
   */
  applySchemaAlocationIfNeeded(
    schema: Schema,
    logger?: DebugLogger,
  ): Result<Schema, DomainError & { message: string }> {
    // Check if schema needs migration
    const needsMigration = this.checkIfNeedsMigration(schema);

    if (!needsMigration) {
      return ok(schema);
    }

    logger?.info("Applying schema migration", {
      operation: "schema-migration",
      schemaPath: schema.getPath(),
      timestamp: new Date().toISOString(),
    });

    // This would be implemented based on actual migration needs
    // For now, return the schema unchanged
    return ok(schema);
  }

  /**
   * Check if schema needs migration
   * Determines if schema is in legacy format
   */
  private checkIfNeedsMigration(schema: Schema): boolean {
    // Check for legacy patterns
    const definition = schema.getDefinition();

    // Check if this is an object schema that might have $schema property
    const propertiesResult = definition.getProperties();
    if (propertiesResult.ok) {
      const properties = propertiesResult.data;
      if (properties["$schema"]) {
        const schemaProperty = properties["$schema"];
        if (schemaProperty.kind === "enum") {
          // Check if any enum value contains draft-04
          return schemaProperty.values.some((value: unknown) =>
            typeof value === "string" && value.includes("draft-04")
          );
        }
      }
    }

    return false;
  }
}
