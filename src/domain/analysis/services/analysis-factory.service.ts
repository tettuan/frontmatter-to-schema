/**
 * Analysis Factory Service - Smart Constructor Pattern
 *
 * Provides factory methods for creating schema-driven analysis components.
 * Extracted from schema-driven.ts for better organization and maintainability.
 */

import type {
  ExternalAnalysisService,
  PromptConfiguration,
  SchemaBasedAnalyzer,
  TemplateMapper,
} from "../../core/abstractions.ts";
import {
  GenericSchemaAnalyzer,
  TotalGenericSchemaAnalyzer,
} from "./schema-analyzer.service.ts";
import {
  SchemaGuidedTemplateMapper,
  TotalSchemaGuidedTemplateMapper,
} from "./template-mapper.service.ts";
import { SchemaAnalysisProcessor } from "./schema-processor.service.ts";

/**
 * Factory for creating schema-driven analysis components
 *
 * @deprecated Use AnalysisDomainFactory from component-factory.ts for better domain separation
 */
export class SchemaAnalysisFactory {
  static createAnalyzer<TSchema, TResult>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
  ): SchemaBasedAnalyzer<TSchema, TResult> {
    return new GenericSchemaAnalyzer<TSchema, TResult>(
      externalService,
      prompts,
    );
  }

  static createMapper<TSource, TTarget>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
  ): TemplateMapper<TSource, TTarget> {
    return new SchemaGuidedTemplateMapper<TSource, TTarget>(
      externalService,
      prompts,
    );
  }

  static createProcessor<TInput, TSchema, TOutput>(
    externalService: ExternalAnalysisService,
    prompts: PromptConfiguration,
    schema: TSchema,
    template: TOutput,
  ): SchemaAnalysisProcessor<TInput, TSchema, TOutput> {
    const analyzer = new TotalGenericSchemaAnalyzer<TSchema, unknown>(
      externalService,
      prompts,
    );
    const mapper = new TotalSchemaGuidedTemplateMapper<unknown, TOutput>(
      externalService,
      prompts,
    );

    return new SchemaAnalysisProcessor(analyzer, mapper, schema, template);
  }
}
