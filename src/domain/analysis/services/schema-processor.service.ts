/**
 * Schema Analysis Processor Service - Smart Constructor Pattern
 *
 * Implements comprehensive analysis processing combining schema analysis and template mapping.
 * Extracted from schema-driven.ts for better organization and maintainability.
 */

import type {
  AnalysisContext,
  ProcessingResult,
} from "../../core/abstractions.ts";
import type { TotalSchemaBasedAnalyzer } from "./schema-analyzer.service.ts";
import type { TotalTemplateMapper } from "./template-mapper.service.ts";

/**
 * Comprehensive analysis processor that combines schema analysis and template mapping
 */
export class SchemaAnalysisProcessor<TInput, TSchema, TOutput> {
  constructor(
    private readonly analyzer: TotalSchemaBasedAnalyzer<TSchema, unknown>,
    private readonly mapper: TotalTemplateMapper<unknown, TOutput>,
    private readonly schema: TSchema,
    private readonly template: TOutput,
  ) {}

  async process(
    input: TInput,
    context: AnalysisContext = {},
  ): Promise<ProcessingResult<TOutput>> {
    // Step 1: Schema-driven analysis
    const analysisResult = await this.analyzer.analyze(
      input,
      this.schema,
      context,
    );

    if (!analysisResult.ok) {
      return {
        data: this.template,
        metadata: new Map(context.metadata),
        isValid: false,
        errors: [analysisResult.error.message],
      };
    }

    // Step 2: Template mapping
    const mappedResult = await this.mapper.map(
      analysisResult.data,
      this.template,
      this.schema,
    );

    if (!mappedResult.ok) {
      return {
        data: this.template,
        metadata: new Map(context.metadata),
        isValid: false,
        errors: [mappedResult.error.message],
      };
    }

    return {
      data: mappedResult.data,
      metadata: new Map(context.metadata),
      isValid: true,
      errors: [],
    };
  }

  async processMany(
    inputs: TInput[],
    baseContext: AnalysisContext = {},
  ): Promise<ProcessingResult<TOutput>[]> {
    const results: ProcessingResult<TOutput>[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const context = {
        ...baseContext,
        metadata: new Map(baseContext.metadata),
        options: { ...baseContext.options, index: i },
      };

      const result = await this.process(inputs[i], context);
      results.push(result);
    }

    return results;
  }
}
