/**
 * Climpt Pipeline Factory Service - Pipeline Factory Implementation
 *
 * Factory for creating Climpt-specific analysis pipelines.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type { FrontMatterPipelineConfig } from "../../../domain/pipeline/generic-pipeline.ts";
import type { LoggerProvider } from "../../../infrastructure/services/logging-service.ts";
import { ComponentFactory } from "../../../domain/core/component-factory.ts";
import type { ClimptRegistrySchema } from "../models/climpt-schema.models.ts";
import { ClaudeCLIService } from "./claude-cli.service.ts";
import { DenoFileSystemProvider } from "./deno-filesystem.service.ts";
import { ClimptConfigurationProvider } from "./climpt-configuration.service.ts";
import { ClimptAnalysisPipeline } from "./climpt-pipeline.service.ts";

/**
 * Enhanced Factory for creating Climpt-specific analysis pipelines
 * Uses the unified component factory architecture
 * @internal For Climpt-specific integration only
 */
export class ClimptPipelineFactory {
  static async create(
    schemaPath?: string,
    templatePath?: string,
    extractPromptPath?: string,
    mapPromptPath?: string,
    loggerProvider?: LoggerProvider,
  ): Promise<ClimptAnalysisPipeline> {
    // Initialize services and providers
    const claudeService = new ClaudeCLIService();
    const fileSystem = new DenoFileSystemProvider();
    const configProvider = new ClimptConfigurationProvider(
      schemaPath,
      templatePath,
      extractPromptPath,
      mapPromptPath,
    );

    // Load configuration
    const [schema, template, prompts] = await Promise.all([
      configProvider.getSchema(),
      configProvider.getTemplate(),
      configProvider.getPrompts(),
    ]);

    // Direct processor creation using component factory
    const componentFactory = new ComponentFactory();
    const _components = componentFactory.createAnalysisComponents();

    // Create analysis processor with components
    const { TotalGenericSchemaAnalyzer } = await import(
      "../../../domain/analysis/services/schema-analyzer.service.ts"
    );
    const { TotalSchemaGuidedTemplateMapper } = await import(
      "../../../domain/analysis/services/template-mapper.service.ts"
    );
    const { SchemaAnalysisProcessor } = await import(
      "../../../domain/analysis/services/schema-processor.service.ts"
    );

    const analyzer = new TotalGenericSchemaAnalyzer(claudeService, prompts);
    const mapper = new TotalSchemaGuidedTemplateMapper(claudeService, prompts);
    const analysisProcessor = new SchemaAnalysisProcessor(
      analyzer,
      mapper,
      schema,
      template,
    );

    // Create pipeline configuration
    const config: FrontMatterPipelineConfig<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    > = {
      schema,
      template,
      prompts,
      fileSystem,
      analysisProcessor,
    };

    // Create ClimptAnalysisPipeline with the unified configuration
    return new ClimptAnalysisPipeline(config, loggerProvider);
  }

  static async createDefault(): Promise<ClimptAnalysisPipeline> {
    return await this.create();
  }

  // Removed createWithUnifiedFactory method - deprecated factory pattern eliminated
}
