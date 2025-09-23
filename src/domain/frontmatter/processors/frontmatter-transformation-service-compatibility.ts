/**
 * @fileoverview FrontmatterTransformationServiceCompatibility - Deprecated Compatibility Methods
 * @description Handles deprecated compatibility methods for transformation service backward compatibility
 * Following DDD boundaries and Totality principles for compatibility coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { FrontmatterPartProcessor } from "../processors/frontmatter-part-processor.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "../services/frontmatter-data-creation-service.ts";

/**
 * Configuration interface for compatibility service dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterTransformationServiceCompatibilityConfig {
  readonly debugLogger?: DebugLogger;
  readonly frontmatterDataCreationService?: FrontmatterDataCreationService;
}

/**
 * Result of converting schema derivation rules to domain rules.
 * Replaces silent error handling with explicit rule conversion tracking.
 */
export type RuleConversionResult = {
  readonly successfulRules: any[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
};

/**
 * FrontmatterTransformationServiceCompatibility - Deprecated Compatibility Methods Coordinator
 *
 * Responsibilities:
 * - Handle deprecated compatibility methods for backward compatibility
 * - Provide clear deprecation warnings and migration guidance
 * - Maintain legacy behavior while guiding toward modern processors
 * - Isolate deprecated functionality from core service logic
 *
 * Following DDD principles:
 * - Single responsibility: Compatibility method coordination only
 * - Domain service: Legacy compatibility within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Clear deprecation boundaries: Isolated legacy patterns
 */
export class FrontmatterTransformationServiceCompatibility {
  private constructor(
    private readonly config:
      FrontmatterTransformationServiceCompatibilityConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates compatibility coordinator with validated configuration
   */
  static create(
    config: FrontmatterTransformationServiceCompatibilityConfig,
  ): Result<
    FrontmatterTransformationServiceCompatibility,
    DomainError & { message: string }
  > {
    return ok(new FrontmatterTransformationServiceCompatibility(config));
  }

  /**
   * Legacy compatibility method for processFrontmatterParts
   * @deprecated Use FrontmatterPartProcessor directly for testing
   */
  processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): FrontmatterData[] {
    this.config.debugLogger?.warn(
      "Using deprecated processFrontmatterParts method",
      createLogContext({
        operation: "legacy-compatibility",
        deprecatedMethod: "processFrontmatterParts",
        migration: "Use FrontmatterPartProcessor directly",
      }),
    );

    const partProcessorResult = FrontmatterPartProcessor.create({
      frontmatterDataCreationService:
        this.config.frontmatterDataCreationService ??
          defaultFrontmatterDataCreationService,
      debugLogger: this.config.debugLogger,
    });
    if (!partProcessorResult.ok) {
      this.config.debugLogger?.error(
        "Failed to create part processor for legacy compatibility",
        createLogContext({
          operation: "legacy-compatibility",
          error: partProcessorResult.error.message,
        }),
      );
      return data; // Fallback to original data
    }

    const result = partProcessorResult.data.processFrontmatterParts(
      data,
      schema,
    );
    if (!result.ok) {
      this.config.debugLogger?.error(
        "Legacy part processing failed",
        createLogContext({
          operation: "legacy-compatibility",
          error: result.error.message,
        }),
      );
      return data; // Fallback to original data
    }

    return result.data;
  }

  /**
   * Legacy compatibility method for convertDerivationRules
   * @deprecated Use FrontmatterAggregationProcessor directly for testing
   */
  convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): RuleConversionResult {
    this.config.debugLogger?.warn(
      "Using deprecated convertDerivationRules method",
      createLogContext({
        operation: "legacy-compatibility",
        deprecatedMethod: "convertDerivationRules",
        migration: "Use FrontmatterAggregationProcessor directly",
      }),
    );

    const successfulRules: any[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    // Validate and convert derivation rules
    for (const rule of derivationRules) {
      // Validate rule - empty sourcePath or targetField should fail
      if (!rule.sourcePath || rule.sourcePath.trim() === "") {
        failedRuleCount++;
        errors.push(createError({
          kind: "InvalidFormat",
          format: "derivation-rule",
          value: JSON.stringify(rule),
        }, "Empty sourcePath is not allowed"));
        continue;
      }

      if (!rule.targetField || rule.targetField.trim() === "") {
        failedRuleCount++;
        errors.push(createError({
          kind: "InvalidFormat",
          format: "derivation-rule",
          value: JSON.stringify(rule),
        }, "Empty targetField is not allowed"));
        continue;
      }

      try {
        // Mock rule creation - simplified for compatibility
        successfulRules.push({
          getBasePath: () => rule.sourcePath.split("[")[0], // Remove array notation for compatibility
          getTargetField: () => rule.targetField,
          getPropertyPath: () => rule.sourcePath.split(".").pop() || "",
          isUnique: () => rule.unique,
        });
      } catch (error) {
        failedRuleCount++;
        errors.push(createError({
          kind: "InvalidFormat",
          format: "derivation-rule",
          value: JSON.stringify(rule),
        }, `Failed to convert rule: ${error}`));
      }
    }

    this.config.debugLogger?.info(
      "Legacy derivation rules conversion completed",
      createLogContext({
        operation: "legacy-compatibility",
        successfulRulesCount: successfulRules.length,
        failedRuleCount,
        totalRules: derivationRules.length,
      }),
    );

    return { successfulRules, failedRuleCount, errors };
  }

  /**
   * Validate compatibility preconditions
   * Ensures proper context for legacy compatibility operations
   */
  validateCompatibilityPreconditions(
    data: FrontmatterData[],
    schema?: Schema,
  ): Result<void, DomainError & { message: string }> {
    // Validate data context
    if (!data) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Data is required for compatibility operations",
        }),
      };
    }

    this.config.debugLogger?.debug(
      "Compatibility preconditions satisfied",
      createLogContext({
        operation: "compatibility-precondition-check",
        dataCount: data.length,
        schemaAvailable: !!schema,
      }),
    );

    return ok(void 0);
  }

  /**
   * Create compatibility context for logging and monitoring
   * Provides structured context for compatibility operations
   */
  createCompatibilityContext(
    operation: string,
    data: FrontmatterData[],
    schema?: Schema,
  ): Record<string, unknown> {
    return createLogContext({
      operation,
      compatibilityContext: {
        dataCount: data.length,
        schemaAvailable: !!schema,
        deprecationLevel: "legacy-compatibility",
        timestamp: new Date().toISOString(),
      },
    });
  }
}
