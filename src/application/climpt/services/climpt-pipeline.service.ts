/**
 * Climpt Analysis Pipeline Service - Pipeline Implementation
 *
 * Implements Climpt-specific pipeline extending the generic pipeline.
 * Extracted from climpt-adapter.ts for better organization.
 */

import {
  FrontMatterAnalysisPipeline,
  type FrontMatterInput,
  type FrontMatterOutput,
  type FrontMatterPipelineConfig,
} from "../../../domain/pipeline/generic-pipeline.ts";
import type { Logger } from "../../../domain/shared/logger.ts";
import type { LoggerProvider } from "../../../infrastructure/services/logging-service.ts";
import { VERSION_CONFIG } from "../../../config/version.ts";
import type {
  ClimptCommand,
  ClimptRegistrySchema,
} from "../models/climpt-schema.models.ts";
import { DenoFileSystemProvider } from "./deno-filesystem.service.ts";

/**
 * Climpt-specific pipeline that extends the generic pipeline with additional functionality
 */
export class ClimptAnalysisPipeline extends FrontMatterAnalysisPipeline<
  ClimptRegistrySchema,
  { isValid: boolean; data: ClimptRegistrySchema }
> {
  constructor(
    config: FrontMatterPipelineConfig<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >,
    private readonly loggerProvider?: LoggerProvider,
  ) {
    super(config);
  }

  override processTyped(
    _input: FrontMatterInput,
  ): Promise<
    FrontMatterOutput<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >
  > {
    // For now, return a stub implementation matching the expected type
    return Promise.resolve({
      results: [],
      metadata: {},
      summary: {
        totalFiles: 0,
        processedFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        errors: [],
      },
    });
  }

  async processAndSave(
    promptsDir: string,
    outputPath: string,
    options?: Record<string, unknown>,
  ): Promise<ClimptRegistrySchema> {
    const input: FrontMatterInput = {
      sourceDirectory: promptsDir,
      filePattern: /\.md$/,
      options,
    };

    const output = await this.processTyped(input);

    // Aggregate all successful results into a single registry
    const aggregatedRegistry = this.aggregateResults(output);

    // Save to file
    const fileSystem = new DenoFileSystemProvider();
    await fileSystem.writeFile(
      outputPath,
      JSON.stringify(aggregatedRegistry, null, 2),
    );

    // Log summary
    this.logProcessingSummary(output.summary);

    return aggregatedRegistry;
  }

  private aggregateResults(
    output: FrontMatterOutput<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >,
  ): ClimptRegistrySchema {
    const baseRegistry: ClimptRegistrySchema = {
      version: VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: ["code", "docs", "git", "meta", "spec", "test"],
        commands: [],
      },
    };

    const allCommands: ClimptCommand[] = [];
    const configsSet = new Set(baseRegistry.tools.availableConfigs);

    for (const result of output.results) {
      if (result.isValid && result.data.tools?.commands) {
        // Add commands
        allCommands.push(...result.data.tools.commands);

        // Merge available configs
        if (result.data.tools.availableConfigs) {
          result.data.tools.availableConfigs.forEach((config) =>
            configsSet.add(config)
          );
        }
      }
    }

    return {
      ...baseRegistry,
      tools: {
        availableConfigs: Array.from(configsSet).sort(),
        commands: this.deduplicateCommands(allCommands),
      },
    };
  }

  private deduplicateCommands(commands: ClimptCommand[]): ClimptCommand[] {
    const seen = new Set<string>();
    const deduplicated: ClimptCommand[] = [];

    for (const command of commands) {
      const key = `${command.c1}/${command.c2}/${command.c3}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(command);
      }
    }

    return deduplicated.sort((a, b) =>
      a.c1.localeCompare(b.c1) || a.c2.localeCompare(b.c2) ||
      a.c3.localeCompare(b.c3)
    );
  }

  private logProcessingSummary(summary: unknown): void {
    const summaryObj = summary as {
      totalFiles?: number;
      processedFiles?: number;
      successfulFiles?: number;
      failedFiles?: number;
      errors?: string[];
    };

    const logger = this.loggerProvider?.getLogger("climpt-summary") ??
      // Fallback for backward compatibility - proper Logger implementation
      new (class implements Logger {
        info(): void {}
        warn(): void {}
        error(): void {}
        debug(): void {}
      })();

    logger.info("Processing summary", {
      totalFiles: summaryObj.totalFiles ?? "N/A",
      processedFiles: summaryObj.processedFiles ?? "N/A",
      successfulFiles: summaryObj.successfulFiles ?? "N/A",
      failedFiles: summaryObj.failedFiles ?? "N/A",
    });

    if (summaryObj.errors && summaryObj.errors.length > 0) {
      logger.warn("Processing errors encountered", {
        errorCount: summaryObj.errors.length,
        errors: summaryObj.errors,
      });
    }
  }
}
