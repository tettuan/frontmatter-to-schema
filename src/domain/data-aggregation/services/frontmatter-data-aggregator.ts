import { err, ok, Result } from "../../shared/types/result.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import { MergeOperations } from "../../frontmatter/utilities/merge-operations.ts";
import { DerivationRule } from "../../../domain/aggregation/value-objects/derivation-rule.ts";
import type { FrontmatterDataCreationService } from "../../frontmatter/services/frontmatter-data-creation-service.ts";
import {
  AggregatedData,
  AggregationError,
  AggregationMetadata,
  DataAggregator,
} from "../interfaces/data-aggregator.ts";

/**
 * Implementation of DataAggregator focused on data aggregation and derivation.
 * Extracts complex aggregation logic from FrontmatterTransformationService.
 *
 * Following DDD principles:
 * - Single Responsibility: Data aggregation and derivation only
 * - Domain boundaries: Clear separation from document processing and schema validation
 * - Dependency Inversion: Uses injected services through interfaces
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - No partial functions or exceptions
 * - Comprehensive error handling through discriminated unions
 */
export class FrontmatterDataAggregator implements DataAggregator {
  private constructor(
    private readonly mergeOperations: MergeOperations,
    private readonly frontmatterDataCreationService:
      FrontmatterDataCreationService,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates a data aggregator with validated dependencies
   */
  static create(
    mergeOperations: MergeOperations,
    frontmatterDataCreationService: FrontmatterDataCreationService,
  ): Result<FrontmatterDataAggregator, AggregationError & { message: string }> {
    if (!mergeOperations) {
      return err({
        kind: "AggregatorCreationFailure",
        cause: "MergeOperations is required",
        message: "MergeOperations dependency is required for data aggregation",
      });
    }

    if (!frontmatterDataCreationService) {
      return err({
        kind: "AggregatorCreationFailure",
        cause: "FrontmatterDataCreationService is required",
        message:
          "FrontmatterDataCreationService dependency is required for data aggregation",
      });
    }

    return ok(
      new FrontmatterDataAggregator(
        mergeOperations,
        frontmatterDataCreationService,
      ),
    );
  }

  /**
   * Main aggregation method that dispatches to appropriate strategy
   * Extracted from original FrontmatterTransformationService.aggregateData()
   */
  aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<AggregatedData, AggregationError & { message: string }> {
    const startTime = Date.now();
    const schemaRules = schema.getDerivedRules();

    // Convert schema rules to DerivationRule objects
    const derivationRuleResults = schemaRules.map((rule) =>
      DerivationRule.create(rule.sourcePath, rule.targetField, rule.unique)
    );

    // Check for any conversion errors
    const derivationRules: DerivationRule[] = [];
    for (const result of derivationRuleResults) {
      if (!result.ok) {
        return err({
          kind: "DerivationRuleProcessingFailure",
          rule: "schema-rule-conversion",
          cause: result.error.message,
          message:
            `Failed to create DerivationRule from schema: ${result.error.message}`,
        });
      }
      derivationRules.push(result.data);
    }

    let aggregationResult: Result<
      FrontmatterData,
      AggregationError & { message: string }
    >;
    let strategy: "with-derivation" | "without-derivation" | "direct-merge";

    if (derivationRules.length > 0) {
      strategy = "with-derivation";
      aggregationResult = this.aggregateWithDerivationRules(
        data,
        schema,
        derivationRules,
      );
    } else {
      strategy = "without-derivation";
      aggregationResult = this.aggregateWithoutDerivationRules(data, schema);
    }

    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    const processingTime = Date.now() - startTime;
    const metadata: AggregationMetadata = {
      inputCount: data.length,
      hasDerivationRules: derivationRules.length > 0,
      derivationRuleCount: derivationRules.length,
      aggregationStrategy: strategy,
      processingTime,
    };

    return ok({
      aggregatedFrontmatter: aggregationResult.data,
      aggregationMetadata: metadata,
    });
  }

  /**
   * Aggregate data with derivation rules using schema-driven approach
   * Extracted from original FrontmatterTransformationService.aggregateWithDerivationRules()
   */
  aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: DerivationRule[],
  ): Result<FrontmatterData, AggregationError & { message: string }> {
    try {
      const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

      if (!frontmatterPartSchemaResult.ok) {
        // No frontmatter-part schema, use direct merge
        const mergeResult = this.mergeOperations.mergeDataDirectly(data);
        if (!mergeResult.ok) {
          return err({
            kind: "DataMergingFailure",
            operation: "direct-merge-fallback",
            cause: mergeResult.error.message,
            message:
              `Direct merge fallback failed: ${mergeResult.error.message}`,
          });
        }
        return ok(mergeResult.data);
      }

      // Handle empty data by creating empty structure
      if (data.length === 0) {
        return this.handleEmptyDataWithSchema(schema, derivationRules);
      }

      // Use SchemaPathResolver for structure creation
      const commandsArray = data.map((item) => item.getData());
      const structureResult = SchemaPathResolver.resolveDataStructure(
        schema,
        commandsArray,
      );

      if (!structureResult.ok) {
        return err({
          kind: "SchemaStructureCreationFailure",
          cause: structureResult.error.message,
          message:
            `Schema structure creation failed: ${structureResult.error.message}`,
        });
      }

      const baseDataResult = structureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return err({
          kind: "SchemaStructureCreationFailure",
          cause: baseDataResult.error.message,
          message:
            `Failed to convert structure to FrontmatterData: ${baseDataResult.error.message}`,
        });
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    } catch (error) {
      return err({
        kind: "AggregationFailure",
        strategy: "with-derivation",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Aggregation with derivation rules failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Aggregate data without derivation rules using direct merging
   * Extracted from original FrontmatterTransformationService.aggregateWithoutDerivationRules()
   */
  aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, AggregationError & { message: string }> {
    try {
      const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

      if (!frontmatterPartSchemaResult.ok) {
        // No frontmatter-part schema, use direct merge
        const mergeResult = this.mergeOperations.mergeDataDirectly(data);
        if (!mergeResult.ok) {
          return err({
            kind: "DataMergingFailure",
            operation: "direct-merge-no-schema",
            cause: mergeResult.error.message,
            message:
              `Direct merge without schema failed: ${mergeResult.error.message}`,
          });
        }
        return ok(mergeResult.data);
      }

      // Handle frontmatter-part schema case
      if (data.length === 0) {
        return this.handleEmptyDataWithSchema(schema, []);
      }

      // Use merge operations for data combination
      const mergeResult = this.mergeOperations.mergeDataDirectly(data);
      if (!mergeResult.ok) {
        return err({
          kind: "DataMergingFailure",
          operation: "merge-with-schema",
          cause: mergeResult.error.message,
          message:
            `Data merging with schema failed: ${mergeResult.error.message}`,
        });
      }
      return ok(mergeResult.data);
    } catch (error) {
      return err({
        kind: "AggregationFailure",
        strategy: "without-derivation",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Aggregation without derivation rules failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Apply derivation rules to base data
   * Extracted from original FrontmatterTransformationService.applyDerivationRules()
   */
  applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: DerivationRule[],
  ): Result<FrontmatterData, AggregationError & { message: string }> {
    if (derivationRules.length === 0) {
      return ok(baseData);
    }

    try {
      const derivedFieldsResult = this.calculateDerivedFields(
        [baseData],
        derivationRules,
      );

      if (!derivedFieldsResult.ok) {
        return derivedFieldsResult;
      }

      const derivedFields = derivedFieldsResult.data;
      const baseDataObj = baseData.getData();

      // Merge derived fields with base data
      const mergedData = { ...baseDataObj, ...derivedFields };

      const resultDataResult = this.frontmatterDataCreationService
        .createFromRaw(mergedData);

      if (!resultDataResult.ok) {
        return err({
          kind: "DataMergingFailure",
          operation: "derived-field-merge",
          cause: resultDataResult.error.message,
          message:
            `Failed to merge derived fields: ${resultDataResult.error.message}`,
        });
      }

      return ok(resultDataResult.data);
    } catch (error) {
      return err({
        kind: "DerivationRuleProcessingFailure",
        rule: "multiple-rules",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to apply derivation rules: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Calculate derived fields from source data
   * Simplified implementation focusing on core functionality
   */
  calculateDerivedFields(
    sourceData: FrontmatterData[],
    derivationRules: DerivationRule[],
  ): Result<Record<string, unknown>, AggregationError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};

    for (const rule of derivationRules) {
      try {
        const values: unknown[] = [];

        for (const data of sourceData) {
          const value = this.extractValue(
            data.getData(),
            rule.getSourceExpression(),
          );
          if (value !== undefined) {
            if (Array.isArray(value)) {
              values.push(...value);
            } else {
              values.push(value);
            }
          }
        }

        // Apply unique filtering if requested
        const finalValues = rule.isUnique()
          ? Array.from(new Set(values.map((v) => JSON.stringify(v)))).map((v) =>
            JSON.parse(v)
          )
          : values;

        derivedFields[rule.getTargetField()] = finalValues;
      } catch (error) {
        return err({
          kind: "FieldCalculationFailure",
          field: rule.getTargetField(),
          cause: error instanceof Error ? error.message : "Unknown error",
          message:
            `Failed to calculate derived field '${rule.getTargetField()}': ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
        });
      }
    }

    return ok(derivedFields);
  }

  /**
   * Handle empty data with schema by creating empty structure
   */
  private handleEmptyDataWithSchema(
    schema: Schema,
    derivationRules: DerivationRule[],
  ): Result<FrontmatterData, AggregationError & { message: string }> {
    const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
      schema,
    );
    if (!emptyStructureResult.ok) {
      return err({
        kind: "EmptyDataHandlingFailure",
        cause: emptyStructureResult.error.message,
        message:
          `Failed to create empty structure: ${emptyStructureResult.error.message}`,
      });
    }

    const baseDataResult = emptyStructureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      return err({
        kind: "EmptyDataHandlingFailure",
        cause: baseDataResult.error.message,
        message:
          `Failed to convert empty structure to FrontmatterData: ${baseDataResult.error.message}`,
      });
    }

    if (derivationRules.length > 0) {
      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    return ok(baseDataResult.data);
  }

  /**
   * Extract value from object using dot-notation path
   */
  private extractValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;

    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
