/**
 * @fileoverview FrontmatterAggregationService - Domain Service for data aggregation
 * @description Extracted from FrontmatterTransformationService to follow DDD boundaries
 * Following Aggregation Context responsibilities from domain-boundary.md
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { Aggregator, DerivationRule } from "../index.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import { MergeOperations } from "../../frontmatter/utilities/merge-operations.ts";

/**
 * Configuration for aggregation service dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface AggregationServiceConfig {
  readonly aggregator: Aggregator;
  readonly mergeOperations: MergeOperations;
  readonly debugLogger?: DebugLogger;
}

/**
 * Result of converting schema derivation rules to domain rules.
 * Replaces silent error handling with explicit rule conversion tracking.
 */
export type RuleConversionResult = {
  readonly successfulRules: DerivationRule[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
};

/**
 * FrontmatterAggregationService - Domain Service for Aggregation Context
 *
 * Responsibilities (from domain-boundary.md):
 * - Complex data aggregation and derivation rules processing
 * - Schema-driven structure creation and field derivation
 * - Integration of multiple frontmatter data sources
 *
 * Following DDD principles:
 * - Single responsibility: Data aggregation only
 * - Domain service: Cross-aggregate operations
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterAggregationService {
  private constructor(
    private readonly config: AggregationServiceConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates aggregation service with validated configuration
   */
  static create(
    config: AggregationServiceConfig,
  ): Result<FrontmatterAggregationService, DomainError & { message: string }> {
    if (!config?.aggregator) {
      return err(createError({
        kind: "InitializationError",
        message: "Aggregator is required for aggregation service",
      }));
    }

    if (!config?.mergeOperations) {
      return err(createError({
        kind: "InitializationError",
        message: "MergeOperations is required for aggregation service",
      }));
    }

    return ok(new FrontmatterAggregationService(config));
  }

  /**
   * Main aggregation coordination method
   * Determines aggregation strategy based on schema derivation rules
   */
  aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      return this.aggregateWithDerivationRules(data, schema, derivationRules);
    } else {
      return this.aggregateWithoutDerivationRules(data, schema);
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.config.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      const baseDataResult = emptyStructureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return baseDataResult;
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());

    this.config.debugLogger?.debug(
      "Creating data structure using SchemaPathResolver",
      createLogContext({
        operation: "data-structure-creation",
        inputs:
          `inputCount: ${data.length}, commandsArrayLength: ${commandsArray.length}`,
      }),
    );

    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      this.config.debugLogger?.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({
          operation: "data-structure-creation",
        }),
      );
      return structureResult;
    }

    this.config.debugLogger?.debug(
      "Successfully created data structure",
      createLogContext({
        operation: "data-structure-creation",
      }),
    );

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      this.config.debugLogger?.error(
        `Frontmatter conversion failed: ${baseDataResult.error.message}`,
        createLogContext({
          operation: "frontmatter-conversion",
        }),
      );
      return baseDataResult;
    }

    this.config.debugLogger?.debug(
      "Successfully converted structure to FrontmatterData",
      createLogContext({
        operation: "frontmatter-conversion",
        inputs: `dataKeys: ${
          Object.keys(baseDataResult.data.getData()).join(", ")
        }`,
      }),
    );

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.config.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      return emptyStructureResult.data.toFrontmatterData();
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Applies derivation rules to base data using existing aggregator.
   * Following Totality principles with explicit error tracking
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Convert schema rules to domain rules with explicit error tracking
    const ruleConversion = this.convertDerivationRules(derivationRules);

    // For backward compatibility, we continue processing even with failed rules
    const rules = ruleConversion.successfulRules;

    this.config.debugLogger?.debug(
      "Applying derivation rules while preserving frontmatter-part data",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `ruleCount: ${rules.length}, baseDataKeys: ${
          Object.keys(baseData.getData()).join(", ")
        }`,
      }),
    );

    // Apply derivation rules and merge with base data
    const aggregationResult = this.config.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Use aggregator's mergeWithBase to properly apply derived fields
    const mergeResult = this.config.aggregator.mergeWithBase(
      aggregationResult.data,
    );
    if (!mergeResult.ok) {
      return mergeResult;
    }

    const finalData = mergeResult.data;

    this.config.debugLogger?.debug(
      "Successfully applied derivation rules",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `finalDataKeys: ${Object.keys(finalData.getData()).join(", ")}`,
      }),
    );

    return ok(finalData);
  }

  /**
   * Convert schema derivation rules to domain derivation rules
   * Following Totality principles with explicit error tracking
   */
  private convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): RuleConversionResult {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];

    for (const rule of derivationRules) {
      try {
        const ruleResult = DerivationRule.create(
          rule.sourcePath,
          rule.targetField,
          rule.unique,
        );

        if (ruleResult.ok) {
          successfulRules.push(ruleResult.data);
        } else {
          errors.push(ruleResult.error);
        }
      } catch (_error) {
        // Fallback for unexpected errors - maintain totality
        errors.push(createError(
          {
            kind: "InvalidFormat",
            format: "derivation-rule",
            value: `${rule.sourcePath} -> ${rule.targetField}`,
            field: "derivationRule",
          },
          `Failed to convert rule: ${rule.sourcePath} -> ${rule.targetField}`,
        ));
      }
    }

    return {
      successfulRules,
      failedRuleCount: errors.length,
      errors,
    };
  }

  /**
   * Calculate derived fields from source data using derivation rules.
   * Preserves frontmatter-part data by computing only derived fields.
   */
  calculateDerivedFields(
    sourceData: FrontmatterData,
    rules: DerivationRule[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};

    this.config.debugLogger?.debug(
      "Calculating derived fields",
      createLogContext({
        operation: "derived-field-calculation",
        inputs: `ruleCount: ${rules.length}, sourceDataKeys: ${
          Object.keys(sourceData.getData()).join(", ")
        }`,
      }),
    );

    for (const rule of rules) {
      const sourceResult = sourceData.get(rule.getBasePath());
      if (sourceResult.ok && Array.isArray(sourceResult.data)) {
        this.config.debugLogger?.debug(
          `Processing rule: ${rule.getBasePath()} -> ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs:
              `sourceArrayLength: ${sourceResult.data.length}, isUnique: ${rule.isUnique()}`,
          }),
        );

        const values = sourceResult.data.map((item) => {
          if (typeof item === "object" && item !== null) {
            const itemResult = SafePropertyAccess.asRecord(item);
            if (itemResult.ok) {
              return itemResult.data[rule.getPropertyPath()];
            }
          }
          return item;
        }).filter((value) => value !== undefined);

        const finalValues = rule.isUnique() ? [...new Set(values)] : values;

        // Set derived field using targetField path
        const setFieldResult = this.setNestedProperty(
          derivedFields,
          rule.getTargetField(),
          finalValues,
        );
        if (!setFieldResult.ok) {
          this.config.debugLogger?.error(
            `Failed to set derived field: ${rule.getTargetField()}`,
            createLogContext({
              operation: "derived-field-calculation",
            }),
          );
          return setFieldResult;
        }

        this.config.debugLogger?.debug(
          `Successfully set derived field: ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs: `valueCount: ${finalValues.length}`,
          }),
        );
      } else {
        this.config.debugLogger?.debug(
          `Skipping rule - source not found or not array: ${rule.getBasePath()}`,
          createLogContext({
            operation: "derived-field-calculation",
          }),
        );
      }
    }

    // Convert derived fields to FrontmatterData
    const resultData = FrontmatterData.create(derivedFields);
    if (!resultData.ok) {
      return resultData;
    }

    return ok(resultData.data);
  }

  /**
   * Set nested property value following path notation
   * Helper method for derived field calculation
   */
  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }

      const propertyResult = SafePropertyAccess.asRecord(current[part]);
      if (!propertyResult.ok) {
        return err(createError({
          kind: "PropertyNotFound",
          path: parts.slice(0, i + 1).join("."),
        }, `Cannot navigate to property: ${parts.slice(0, i + 1).join(".")}`));
      }

      const newRecordResult = SafePropertyAccess.asRecord(propertyResult.data);
      if (newRecordResult.ok) {
        current = newRecordResult.data;
      } else {
        return err(createError({
          kind: "PropertyNotFound",
          path: parts.slice(0, i + 1).join("."),
        }, `Property is not a record: ${parts.slice(0, i + 1).join(".")}`));
      }
    }

    // Set the final property
    const finalProperty = parts[parts.length - 1];
    current[finalProperty] = value;

    return ok(void 0);
  }
}
