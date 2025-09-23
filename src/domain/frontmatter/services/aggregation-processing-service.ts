import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { DerivationRule } from "../../aggregation/index.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import { MergeOperations } from "../utilities/merge-operations.ts";

/**
 * Aggregation Processing Service - Domain Service for DDD Phase 2
 *
 * Handles data aggregation and base property population following DDD principles.
 * Extracted from Stage 5 of the monolithic pipeline to reduce complexity and improve maintainability.
 *
 * Single Responsibility: Data aggregation using derivation rules and base property population
 * Follows Totality principles with Result<T,E> pattern and smart constructor
 */

/**
 * Configuration for Aggregation Processing Service following dependency injection pattern
 */
export interface AggregationProcessingServiceConfig {
  readonly aggregator: AggregationService;
  readonly basePropertyPopulator: BasePropertyPopulator;
  readonly mergeOperations: MergeOperations;
}

/**
 * Aggregation service interface for applying derivation rules
 */
export interface AggregationService {
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
 * Base property populator interface for schema-driven property setup
 */
export interface BasePropertyPopulator {
  populateFromSchema(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }>;
}

/**
 * Options for aggregation processing operation
 */
export interface AggregationProcessingOptions {
  readonly data: FrontmatterData[];
  readonly schema: Schema;
}

/**
 * Result type for aggregation processing operation
 */
export interface AggregationProcessingResult {
  readonly aggregatedData: FrontmatterData;
  readonly derivationRulesApplied: number;
  readonly basePropertiesPopulated: boolean;
  readonly processingMethod:
    | "with-derivation-rules"
    | "without-derivation-rules";
}

/**
 * Derivation rule conversion result
 */
export interface DerivationRuleConversion {
  readonly successfulRules: DerivationRule[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
}

/**
 * Aggregation Processing Service implementing Stage 5 logic from DDD architecture
 *
 * Responsibilities:
 * - Aggregate data using schema-derived derivation rules
 * - Handle empty data scenarios with proper structure creation
 * - Apply derivation rules to transform and enrich data
 * - Populate base properties from schema defaults
 * - Provide structured error handling with Result<T,E> pattern
 * - Log aggregation decisions for debugging and monitoring
 * - Address Issue #1024: Enhanced debugging with component-based filtering
 */
export class AggregationProcessingService {
  private readonly enhancedLogger: DebugLogger;

  private constructor(
    private readonly config: AggregationProcessingServiceConfig,
  ) {
    // Initialize enhanced logger for Issue #1024 resolution
    const loggerResult = createEnhancedDebugLogger("aggregation-processing");
    this.enhancedLogger = loggerResult.ok ? loggerResult.data : {
      log: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      error: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      warn: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      info: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      debug: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      trace: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      withContext: () => this,
    } as any;
  }

  /**
   * Smart Constructor following Totality principles
   * Validates configuration and ensures all required dependencies are present
   */
  static create(
    config: AggregationProcessingServiceConfig,
  ): Result<AggregationProcessingService, DomainError & { message: string }> {
    // Validate required dependencies
    if (!config?.aggregator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "AggregationService is required for data aggregation operations",
        }),
      };
    }

    if (!config?.basePropertyPopulator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "BasePropertyPopulator is required for base property population",
        }),
      };
    }

    if (!config?.mergeOperations) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "MergeOperations is required for data merging operations",
        }),
      };
    }

    return ok(new AggregationProcessingService(config));
  }

  /**
   * Process data aggregation and base property population
   * Implements Stage 5 logic: data aggregation using derivation rules and base property setup
   */
  aggregateAndPopulateBaseProperties(
    options: AggregationProcessingOptions,
    logger?: DebugLogger,
  ): Result<AggregationProcessingResult, DomainError & { message: string }> {
    // Use enhanced logger for Issue #1024 - improved debugging efficiency
    const activeLogger = logger || this.enhancedLogger;

    // Enhanced debugging with data structure analysis
    if ("analyzeDataStructure" in activeLogger) {
      (activeLogger as any).analyzeDataStructure(
        "aggregation-options",
        options,
      );
      (activeLogger as any).trackFlow("aggregation-start", {
        dataCount: options.data.length,
        hasSchema: !!options.schema,
      });
    }

    activeLogger?.debug(
      "Starting data aggregation with derivation rules",
      {
        operation: "aggregation",
        dataCount: options.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Get derivation rules from schema
    const derivationRules = options.schema.getDerivedRules();

    // Enhanced debugging for derivation rules analysis
    if ("analyzeDataStructure" in activeLogger) {
      (activeLogger as any).analyzeDataStructure(
        "derivation-rules",
        derivationRules,
      );
    }

    activeLogger?.info(
      `Found ${derivationRules.length} derivation rules`,
      {
        operation: "aggregation",
        rulesCount: derivationRules.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Perform data aggregation
    const aggregationResult = this.aggregateData(
      options.data,
      options.schema,
      activeLogger,
    );

    if (!aggregationResult.ok) {
      activeLogger?.error(
        "Data aggregation failed",
        {
          operation: "aggregation",
          error: aggregationResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return aggregationResult;
    }

    // Populate base properties from schema defaults
    if ("trackFlow" in activeLogger) {
      (activeLogger as any).trackFlow("base-property-population-start");
    }

    activeLogger?.debug(
      "Starting base property population",
      {
        operation: "base-property-population",
        timestamp: new Date().toISOString(),
      },
    );

    const basePropertyResult = this.config.basePropertyPopulator
      .populateFromSchema(
        aggregationResult.data.aggregatedData,
        options.schema,
      );

    if (!basePropertyResult.ok) {
      activeLogger?.error(
        "Base property population failed",
        {
          operation: "base-property-population",
          error: basePropertyResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return basePropertyResult;
    }

    if ("trackFlow" in activeLogger) {
      (activeLogger as any).trackFlow("aggregation-completion", {
        method: aggregationResult.data.processingMethod,
        rulesApplied: aggregationResult.data.derivationRulesApplied,
      });
    }

    activeLogger?.info(
      "Aggregation and base property population completed successfully",
      {
        operation: "aggregation-completion",
        method: aggregationResult.data.processingMethod,
        rulesApplied: aggregationResult.data.derivationRulesApplied,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({
      aggregatedData: basePropertyResult.data,
      derivationRulesApplied: aggregationResult.data.derivationRulesApplied,
      basePropertiesPopulated: true,
      processingMethod: aggregationResult.data.processingMethod,
    });
  }

  /**
   * Aggregate data using derivation rules from schema
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
    logger?: DebugLogger,
  ): Result<
    {
      aggregatedData: FrontmatterData;
      derivationRulesApplied: number;
      processingMethod: "with-derivation-rules" | "without-derivation-rules";
    },
    DomainError & { message: string }
  > {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      const result = this.aggregateWithDerivationRules(
        data,
        schema,
        derivationRules,
        logger,
      );

      if (!result.ok) {
        return result;
      }

      return ok({
        aggregatedData: result.data,
        derivationRulesApplied: derivationRules.length,
        processingMethod: "with-derivation-rules",
      });
    } else {
      const result = this.aggregateWithoutDerivationRules(data, schema, logger);

      if (!result.ok) {
        return result;
      }

      return ok({
        aggregatedData: result.data,
        derivationRulesApplied: 0,
        processingMethod: "without-derivation-rules",
      });
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
    logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      logger?.debug(
        "No frontmatter-part schema found, using direct merge",
        {
          operation: "aggregation-fallback",
          timestamp: new Date().toISOString(),
        },
      );
      return this.config.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      logger?.debug(
        "Creating empty structure for zero-data aggregation",
        {
          operation: "empty-structure-creation",
          timestamp: new Date().toISOString(),
        },
      );

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

    // Use SchemaPathResolver for structure creation
    logger?.debug(
      "Creating data structure using SchemaPathResolver",
      {
        operation: "data-structure-creation",
        dataCount: data.length,
        timestamp: new Date().toISOString(),
      },
    );

    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      logger?.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({
          operation: "data-structure-creation",
        }),
      );
      return structureResult;
    }

    logger?.debug(
      "Successfully created data structure",
      {
        operation: "data-structure-creation",
        timestamp: new Date().toISOString(),
      },
    );

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      logger?.error(
        "Failed to convert structure to FrontmatterData",
        {
          operation: "frontmatter-conversion",
          error: baseDataResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return baseDataResult;
    }

    logger?.debug(
      "Successfully converted structure to FrontmatterData",
      {
        operation: "frontmatter-conversion",
        timestamp: new Date().toISOString(),
      },
    );

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    logger?: DebugLogger,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    logger?.debug(
      "Processing aggregation without derivation rules",
      {
        operation: "simple-aggregation",
        dataCount: data.length,
        timestamp: new Date().toISOString(),
      },
    );

    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      logger?.debug(
        "No frontmatter-part schema found, using direct merge",
        {
          operation: "aggregation-fallback",
          timestamp: new Date().toISOString(),
        },
      );
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

    // Use SchemaPathResolver for structure creation
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
   * Applies derivation rules to base data using existing aggregator
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Convert schema rules to domain rules
    const ruleConversion = this.convertDerivationRules(derivationRules);
    const rules = ruleConversion.successfulRules;

    if (ruleConversion.failedRuleCount > 0) {
      // Log failed rule conversions but continue with successful ones
      for (const error of ruleConversion.errors) {
        console.warn(`Failed to convert derivation rule: ${error.message}`);
      }
    }

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

    return ok(mergeResult.data);
  }

  /**
   * Convert schema derivation rules to domain rules with explicit error handling
   */
  private convertDerivationRules(
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }>,
  ): DerivationRuleConversion {
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

    return {
      successfulRules,
      failedRuleCount,
      errors,
    };
  }

  /**
   * Get aggregation statistics for monitoring and debugging
   */
  getAggregationStats(
    data: FrontmatterData[],
    schema: Schema,
  ): {
    readonly dataCount: number;
    readonly derivationRulesCount: number;
    readonly hasFrontmatterPartSchema: boolean;
    readonly processingMethod:
      | "with-derivation-rules"
      | "without-derivation-rules";
  } {
    const derivationRules = schema.getDerivedRules();
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    return {
      dataCount: data.length,
      derivationRulesCount: derivationRules.length,
      hasFrontmatterPartSchema: frontmatterPartSchemaResult.ok,
      processingMethod: derivationRules.length > 0
        ? "with-derivation-rules"
        : "without-derivation-rules",
    };
  }
}
