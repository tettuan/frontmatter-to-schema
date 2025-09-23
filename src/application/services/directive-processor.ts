/**
 * @fileoverview Directive Processor Application Service - Issue #900
 * @description Orchestrates the processing of schema directives in correct dependency order
 */

import { ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { ErrorHandler } from "../../domain/shared/services/unified-error-handler.ts";
import {
  DirectiveOrderManager,
  DirectiveType,
  ProcessingOrder,
} from "../../domain/schema/directive-order.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import {
  DomainLogger,
  NullDomainLogger,
} from "../../domain/shared/services/domain-logger.ts";
import { ExtractFromProcessor } from "../../domain/schema/services/extract-from-processor.ts";

/**
 * Directive processing context for a single execution
 */
export interface DirectiveProcessingContext {
  readonly executionId: string;
  readonly schema: Schema;
  readonly inputData: FrontmatterData[];
  readonly processingOrder: ProcessingOrder;
  readonly startTime: number;
}

/**
 * Processing result for a single directive stage
 */
export interface StageProcessingResult {
  readonly stage: number;
  readonly directives: readonly DirectiveType[];
  readonly processedData: FrontmatterData[];
  readonly processingTime: number;
  readonly success: boolean;
  readonly errors: readonly (DomainError & { message: string })[];
}

/**
 * Complete directive processing result
 */
export interface DirectiveProcessingResult {
  readonly success: boolean;
  readonly finalData: FrontmatterData[];
  readonly stageResults: readonly StageProcessingResult[];
  readonly totalProcessingTime: number;
  readonly directivesProcessed: readonly DirectiveType[];
  readonly processingOrder: ProcessingOrder;
}

/**
 * Application service for managing directive processing with proper ordering
 */
export class DirectiveProcessor {
  private readonly orderManager: DirectiveOrderManager;

  private constructor(
    orderManager: DirectiveOrderManager,
    private readonly domainLogger: DomainLogger = new NullDomainLogger(),
  ) {
    this.orderManager = orderManager;
  }

  /**
   * Smart Constructor following Totality principles
   */
  static async create(
    domainLogger?: DomainLogger,
    configPath?: string,
  ): Promise<Result<DirectiveProcessor, DomainError & { message: string }>> {
    const orderManagerResult = await DirectiveOrderManager.create(configPath);
    if (!orderManagerResult.ok) {
      return orderManagerResult;
    }

    return ok(
      new DirectiveProcessor(
        orderManagerResult.data,
        domainLogger ?? new NullDomainLogger(),
      ),
    );
  }

  /**
   * Process all directives in the schema according to dependency order
   */
  async processDirectives(
    schema: Schema,
    inputData: FrontmatterData[],
  ): Promise<
    Result<DirectiveProcessingResult, DomainError & { message: string }>
  > {
    const executionId = `directive-proc-${Date.now()}-${
      Math.random().toString(36).substring(2, 9)
    }`;
    const startTime = performance.now();

    this.domainLogger.logInfo(
      "directive-processing",
      `[DIRECTIVE-ORDER-DEBUG] Starting directive processing pipeline`,
      {
        executionId,
        inputDataCount: inputData.length,
        schemaId: schema.getPath().toString(),
      },
    );

    // Detect directives present in schema
    const presentDirectivesResult = this.detectPresentDirectives(schema);
    if (!presentDirectivesResult.ok) {
      return presentDirectivesResult;
    }

    const presentDirectives = presentDirectivesResult.data;

    this.domainLogger.logDebug(
      "directive-detection",
      `[DIRECTIVE-ORDER-DEBUG] Detected directives in schema`,
      {
        executionId,
        presentDirectives,
        directiveCount: presentDirectives.length,
      },
    );

    // Determine processing order
    const orderResult = this.orderManager.determineProcessingOrder(
      presentDirectives,
    );
    if (!orderResult.ok) {
      return orderResult;
    }

    const processingOrder = orderResult.data;

    this.domainLogger.logInfo(
      "directive-order",
      `[DIRECTIVE-ORDER-DEBUG] Determined directive processing order`,
      {
        executionId,
        orderedDirectives: processingOrder.orderedDirectives,
        stageCount: processingOrder.stages.length,
        dependencyGraph: processingOrder.dependencyGraph,
      },
    );

    // Create processing context
    const context: DirectiveProcessingContext = {
      executionId,
      schema,
      inputData,
      processingOrder,
      startTime,
    };

    // Process each stage in order
    const stageResults: StageProcessingResult[] = [];
    let currentData = inputData;

    for (const stage of processingOrder.stages) {
      this.domainLogger.logDebug(
        "stage-processing",
        `[DIRECTIVE-ORDER-DEBUG] Processing stage ${stage.stage}: ${stage.description}`,
        {
          executionId,
          stage: stage.stage,
          directives: stage.directives,
          description: stage.description,
          inputDataCount: currentData.length,
        },
      );

      const stageResult = await this.processStage(
        stage,
        currentData,
        context,
      );

      stageResults.push(stageResult);

      if (!stageResult.success) {
        this.domainLogger.logError(
          "stage-processing",
          `[DIRECTIVE-ORDER-DEBUG] Stage ${stage.stage} processing failed`,
          {
            executionId,
            stage: stage.stage,
            errors: stageResult.errors,
          },
        );

        // For now, continue processing despite errors
        // Future enhancement: configurable error handling strategy
      }

      currentData = stageResult.processedData;
    }

    const totalProcessingTime = performance.now() - startTime;

    const result: DirectiveProcessingResult = {
      success: stageResults.every((r) => r.success),
      finalData: currentData,
      stageResults,
      totalProcessingTime,
      directivesProcessed: processingOrder.orderedDirectives,
      processingOrder,
    };

    this.domainLogger.logInfo(
      "directive-processing",
      `[DIRECTIVE-ORDER-DEBUG] Completed directive processing pipeline`,
      {
        executionId,
        success: result.success,
        totalProcessingTime: result.totalProcessingTime,
        finalDataCount: result.finalData.length,
        stagesProcessed: result.stageResults.length,
      },
    );

    return ok(result);
  }

  /**
   * Process a single stage with all its directives
   */
  private async processStage(
    stage: {
      readonly stage: number;
      readonly directives: readonly DirectiveType[];
      readonly description: string;
    },
    inputData: FrontmatterData[],
    context: DirectiveProcessingContext,
  ): Promise<StageProcessingResult> {
    const stageStartTime = performance.now();
    const errors: (DomainError & { message: string })[] = [];
    let processedData = inputData;

    this.domainLogger.logDebug(
      "stage-execution",
      `[DIRECTIVE-ORDER-DEBUG] Processing sequence: ${stage.stage}. ${stage.description}`,
      {
        executionId: context.executionId,
        stage: stage.stage,
        directives: stage.directives,
        inputDataCount: inputData.length,
      },
    );

    // Process each directive in the stage
    for (const directive of stage.directives) {
      this.domainLogger.logDebug(
        "directive-execution",
        `[DIRECTIVE-ORDER-DEBUG] Processing directive: ${directive}`,
        {
          executionId: context.executionId,
          directive,
          stage: stage.stage,
          dataCount: processedData.length,
        },
      );

      try {
        // This is a placeholder for actual directive processing
        // Each directive type would have its own processing logic
        const directiveResult = await this.processDirective(
          directive,
          processedData,
          context,
        );

        if (!directiveResult.ok) {
          errors.push(directiveResult.error);
          this.domainLogger.logError(
            "directive-execution",
            `[DIRECTIVE-ORDER-DEBUG] Directive ${directive} processing failed`,
            {
              executionId: context.executionId,
              directive,
              error: directiveResult.error,
            },
          );
        } else {
          processedData = directiveResult.data;
          this.domainLogger.logDebug(
            "directive-execution",
            `[DIRECTIVE-ORDER-DEBUG] Directive ${directive} processing completed`,
            {
              executionId: context.executionId,
              directive,
              outputDataCount: processedData.length,
            },
          );
        }
      } catch (error) {
        const domainErrorResult = ErrorHandler.validation({
          operation: "processStage",
          method: "processDirective",
        }).invalidType("valid directive", directive);
        if (!domainErrorResult.ok) {
          errors.push(domainErrorResult.error);
        }

        this.domainLogger.logError(
          "directive-execution",
          `[DIRECTIVE-ORDER-DEBUG] Unexpected error in directive ${directive}`,
          {
            executionId: context.executionId,
            directive,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );
      }
    }

    const processingTime = performance.now() - stageStartTime;

    return {
      stage: stage.stage,
      directives: stage.directives,
      processedData,
      processingTime,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Process an individual directive with actual implementation
   */
  private async processDirective(
    directive: DirectiveType,
    data: FrontmatterData[],
    context: DirectiveProcessingContext,
  ): Promise<Result<FrontmatterData[], DomainError & { message: string }>> {
    this.domainLogger.logDebug(
      "directive-processing",
      `[DIRECTIVE-ORDER-DEBUG] Processing ${directive} with ${data.length} data items`,
      {
        executionId: context.executionId,
        directive,
        dataCount: data.length,
      },
    );

    // Implement actual directive processing logic
    switch (directive) {
      case "x-extract-from":
        return await this.processExtractFromDirective(data, context);

      case "x-frontmatter-part":
        // Already handled by FrontmatterTransformationService in pipeline
        // This processor focuses on post-frontmatter-part directives
        return ok(data);

      case "x-derived-from":
        // Future implementation for DerivationProcessor
        this.domainLogger.logDebug(
          "directive-processing",
          `[DIRECTIVE-ORDER-DEBUG] x-derived-from directive not yet implemented`,
          { executionId: context.executionId },
        );
        return ok(data);

      case "x-jmespath-filter":
        // Future implementation for JMESPathFilterService
        this.domainLogger.logDebug(
          "directive-processing",
          `[DIRECTIVE-ORDER-DEBUG] x-jmespath-filter directive not yet implemented`,
          { executionId: context.executionId },
        );
        return ok(data);

      default:
        this.domainLogger.logDebug(
          "directive-processing",
          `[DIRECTIVE-ORDER-DEBUG] Unknown directive ${directive}, skipping`,
          { executionId: context.executionId, directive },
        );
        return ok(data);
    }
  }

  /**
   * Process x-extract-from directive using ExtractFromProcessor
   */
  private async processExtractFromDirective(
    data: FrontmatterData[],
    context: DirectiveProcessingContext,
  ): Promise<Result<FrontmatterData[], DomainError & { message: string }>> {
    const extractFromProcessorResult = ExtractFromProcessor.create();
    if (!extractFromProcessorResult.ok) {
      return extractFromProcessorResult;
    }

    const processor = extractFromProcessorResult.data;
    const processedData: FrontmatterData[] = [];

    for (const dataItem of data) {
      // Get x-extract-from directives from schema
      const directivesResult = context.schema.getExtractFromDirectives();
      if (!directivesResult.ok) {
        this.domainLogger.logError(
          "directive-processing",
          `[DIRECTIVE-ORDER-DEBUG] Failed to get extract-from directives: ${directivesResult.error.message}`,
          { executionId: context.executionId },
        );
        continue; // Skip this data item but continue processing others
      }

      if (directivesResult.data.length === 0) {
        // No x-extract-from directives, pass data through unchanged
        processedData.push(dataItem);
        continue;
      }

      // Process x-extract-from directives
      const processResult = await processor.processDirectives(
        dataItem,
        directivesResult.data,
      );

      if (!processResult.ok) {
        this.domainLogger.logError(
          "directive-processing",
          `[DIRECTIVE-ORDER-DEBUG] Failed to process extract-from directives: ${processResult.error.message}`,
          { executionId: context.executionId },
        );
        continue; // Skip this data item but continue processing others
      }

      processedData.push(processResult.data);
    }

    this.domainLogger.logDebug(
      "directive-processing",
      `[DIRECTIVE-ORDER-DEBUG] Processed ${data.length} items with x-extract-from, resulting in ${processedData.length} items`,
      {
        executionId: context.executionId,
        inputCount: data.length,
        outputCount: processedData.length,
      },
    );

    return ok(processedData);
  }

  /**
   * Detect which directives are present in the schema
   */
  private detectPresentDirectives(
    schema: Schema,
  ): Result<readonly DirectiveType[], DomainError & { message: string }> {
    const supportedDirectives = this.orderManager.getSupportedDirectives();
    const presentDirectives: DirectiveType[] = [];

    // FEATURE: Schema analysis for directive detection to be enhanced
    // This will involve traversing the schema and checking for x-* extensions
    // Current implementation provides basic detection

    // Check for x-frontmatter-part
    const frontmatterPartResult = schema.findFrontmatterPartSchema();
    if (frontmatterPartResult.ok) {
      const directive = supportedDirectives.find((d) =>
        d === "x-frontmatter-part"
      );
      if (directive) {
        presentDirectives.push(directive);
      }
    }

    // Check for other directives by examining schema extensions
    // This is a simplified detection - real implementation would be more thorough
    const schemaData = schema.getDefinition().getRawSchema();
    for (const directive of supportedDirectives) {
      if (
        directive !== "x-frontmatter-part" &&
        this.hasDirectiveInSchema(schemaData, directive)
      ) {
        presentDirectives.push(directive);
      }
    }

    this.domainLogger.logDebug(
      "directive-detection",
      `Detected ${presentDirectives.length} directives in schema`,
      {
        presentDirectives,
        supportedDirectives,
      },
    );

    return ok(presentDirectives);
  }

  /**
   * Helper method to check if a directive exists in schema
   */
  private hasDirectiveInSchema(schemaData: any, directive: string): boolean {
    const checkObject = (obj: any): boolean => {
      if (!obj || typeof obj !== "object") {
        return false;
      }

      if (obj[directive]) {
        return true;
      }

      for (const value of Object.values(obj)) {
        if (checkObject(value)) {
          return true;
        }
      }

      return false;
    };

    return checkObject(schemaData);
  }

  /**
   * Get processing order for given directives (public interface)
   */
  getProcessingOrder(
    directives: readonly DirectiveType[],
  ): Result<ProcessingOrder, DomainError & { message: string }> {
    return this.orderManager.determineProcessingOrder(directives);
  }

  /**
   * Get supported directive types
   */
  getSupportedDirectives(): readonly DirectiveType[] {
    return this.orderManager.getSupportedDirectives();
  }
}
