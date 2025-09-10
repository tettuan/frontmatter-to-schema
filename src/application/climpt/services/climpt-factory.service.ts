/**
 * Climpt Pipeline Factory Service - Pipeline Factory Implementation
 *
 * Factory for creating Climpt-specific analysis pipelines.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type { FrontMatterPipelineConfig } from "../../../domain/pipeline/generic-pipeline.ts";
import type { LoggerProvider } from "../../../domain/core/logging-service.ts";
import { SchemaAnalysisFactory } from "../../../domain/analysis/schema-driven.ts";
import type { ClimptRegistrySchema } from "../models/climpt-schema.models.ts";
import { ClaudeCLIService } from "./claude-cli.service.ts";
import { DenoFileSystemProvider } from "./deno-filesystem.service.ts";
import { ClimptConfigurationProvider } from "./climpt-configuration.service.ts";
import { ClimptAnalysisPipeline } from "./climpt-pipeline.service.ts";

/**
 * Enhanced Factory for creating Climpt-specific analysis pipelines
 * Uses the unified component factory architecture
 * @deprecated Use MasterComponentFactory.createDomainComponents(ComponentDomain.Pipeline) for production use
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

    // Direct processor creation - simpler and more direct than factory pattern
    const analysisProcessor = SchemaAnalysisFactory.createProcessor(
      claudeService,
      prompts,
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
