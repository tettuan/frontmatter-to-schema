import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { DerivationRule } from "../../aggregation/index.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";
import { createLogContext } from "../../shared/services/debug-logger.ts";

/**
 * Domain service for processing data aggregation operations (DDD Compliant Version).
 *
 * Following DDD principles:
 * - Belongs to Aggregation Processing bounded context
 * - Single responsibility: Data aggregation with derivation rules
 * - Implements Totality principle with Result<T,E> pattern
 * - Uses Smart Constructor pattern for safe instantiation
 * - Maintains <300 lines for AI complexity compliance
 *
 * Addresses Issue #1021: Extracted from 1026-line pipeline to improve DDD compliance
 */
export class AggregationProcessingServiceV2 {
  private readonly logger: DebugLogger;

  private constructor(
    private readonly aggregator: AggregatorPort,
    private readonly mergeOperations: MergeOperationsPort,
    logger?: DebugLogger,
  ) {
    if (logger) {
      this.logger = logger;
    } else {
      const loggerResult = createEnhancedDebugLogger("aggregation-processing");
      if (loggerResult.ok) {
        this.logger = loggerResult.data;
      } else {
        this.logger = this.createNoOpLogger();
      }
    }
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    aggregator: AggregatorPort,
    mergeOperations: MergeOperationsPort,
    logger?: DebugLogger,
  ): Result<
    AggregationProcessingServiceV2,
    DomainError & { message: string }
  > {
    if (!aggregator) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Aggregator is required for AggregationProcessingService",
      }));
    }

    if (!mergeOperations) {
      return err(createError({
        kind: "ConfigurationError",
        message: "MergeOperations is required for AggregationProcessingService",
      }));
    }

    if (!aggregator.aggregate || !aggregator.mergeWithBase) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "Aggregator must implement aggregate and mergeWithBase methods",
      }));
    }

    if (!mergeOperations.mergeDataDirectly) {
      return err(createError({
        kind: "ConfigurationError",
        message: "MergeOperations must implement mergeDataDirectly method",
      }));
    }

    return ok(
      new AggregationProcessingServiceV2(aggregator, mergeOperations, logger),
    );
  }

  /**
   * Aggregates frontmatter data based on schema configuration.
   * Main public method for domain aggregation operations.
   */
  aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (!data) {
      return err(createError({
        kind: "MissingRequired",
        field: "data",
        message: "Data array is required for aggregation",
      }));
    }

    if (!schema) {
      return err(createError({
        kind: "MissingRequired",
        field: "schema",
        message: "Schema is required for aggregation",
      }));
    }

    this.logger.debug(
      "Starting data aggregation process",
      {
        operation: "data-aggregation",
        dataCount: data.length,
        timestamp: new Date().toISOString(),
      },
    );

    const derivationRules = schema.getDerivedRules();
    this.logger.info(
      `Found ${derivationRules.length} derivation rules in schema`,
      {
        operation: "data-aggregation",
        derivationRulesCount: derivationRules.length,
        timestamp: new Date().toISOString(),
      },
    );

    if (derivationRules.length > 0) {
      return this.aggregateWithDerivationRules(data, schema, derivationRules);
    } else {
      return this.aggregateWithoutDerivationRules(data, schema);
    }
  }

  /**
   * Handles aggregation with derivation rules.
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      this.logger.warn(
        "No frontmatter part schema found, falling back to direct merge",
        {
          operation: "aggregation-with-derivation",
          timestamp: new Date().toISOString(),
        },
      );
      return this.mergeOperations.mergeDataDirectly(data);
    }

    if (data.length === 0) {
      return this.handleEmptyDataWithDerivation(schema, derivationRules);
    }

    const structureResult = this.createDataStructure(data, schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      return baseDataResult;
    }

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules.
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      this.logger.warn(
        "No frontmatter part schema found, falling back to direct merge",
        {
          operation: "aggregation-simple",
          timestamp: new Date().toISOString(),
        },
      );
      return this.mergeOperations.mergeDataDirectly(data);
    }

    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }
      return emptyStructureResult.data.toFrontmatterData();
    }

    const structureResult = this.createDataStructure(data, schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Creates data structure using SchemaPathResolver.
   */
  private createDataStructure(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<any, DomainError & { message: string }> {
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      this.logger.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({ operation: "data-structure-creation" }),
      );
    }

    return structureResult;
  }

  /**
   * Handles empty data case with derivation rules.
   */
  private handleEmptyDataWithDerivation(
    schema: Schema,
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): Result<FrontmatterData, DomainError & { message: string }> {
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

  /**
   * Applies derivation rules to base data.
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const ruleConversion = this.convertDerivationRules(derivationRules);

    if (ruleConversion.failedRuleCount > 0) {
      this.logger.warn(
        `${ruleConversion.failedRuleCount} derivation rules failed conversion`,
        {
          operation: "derivation-rule-conversion",
          timestamp: new Date().toISOString(),
        },
      );
    }

    const rules = ruleConversion.successfulRules;
    const aggregationResult = this.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );

    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    const mergeResult = this.aggregator.mergeWithBase(aggregationResult.data);
    if (!mergeResult.ok) {
      return mergeResult;
    }

    return ok(mergeResult.data);
  }

  /**
   * Converts schema derivation rules to domain rules.
   */
  private convertDerivationRules(
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): {
    successfulRules: DerivationRule[];
    failedRuleCount: number;
    errors: Array<DomainError & { message: string }>;
  } {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }

  /**
   * Creates a no-op logger as fallback.
   */
  private createNoOpLogger(): DebugLogger {
    return {
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

/**
 * Port interface for aggregator service.
 */
export interface AggregatorPort {
  aggregate(
    data: FrontmatterData[],
    rules: DerivationRule[],
    baseData: FrontmatterData,
  ): Result<FrontmatterData, DomainError & { message: string }>;

  mergeWithBase(
    data: FrontmatterData,
  ): Result<FrontmatterData, DomainError & { message: string }>;
}

/**
 * Port interface for merge operations.
 */
export interface MergeOperationsPort {
  mergeDataDirectly(
    data: FrontmatterData[],
  ): Result<FrontmatterData, DomainError & { message: string }>;
}
