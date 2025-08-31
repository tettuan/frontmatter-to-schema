/**
 * TwoStageProcessingOrchestrator
 *
 * Coordinates both CommandProcessorAdapter and RegistryBuilderAdapter to implement
 * the complete two-stage processing pipeline while maintaining backward compatibility
 * with existing single-stage processing.
 *
 * This orchestrator provides a unified interface for two-stage processing that can
 * coexist with existing processing workflows.
 */

import type {
  Document,
  Schema,
  Template,
} from "../../domain/models/entities.ts";
import type {
  FrontMatterExtractor,
  SchemaAnalyzer,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import {
  type Command,
  type CommandProcessingResult,
  CommandProcessorAdapter,
} from "./command-processor-adapter.ts";
import {
  type Registry,
  RegistryBuilderAdapter,
  type RegistryBuildingResult,
} from "./registry-builder-adapter.ts";

/**
 * Configuration for two-stage processing
 */
export interface TwoStageConfig {
  /** Schema for Stage 1 (command-level) processing */
  commandSchema: Schema;
  /** Template for Stage 1 (command-level) output */
  commandTemplate: Template;
  /** Schema for Stage 2 (registry-level) processing */
  registrySchema: Schema;
  /** Template for Stage 2 (registry-level) output */
  registryTemplate: Template;
  /** Processing options */
  options: {
    /** Maximum parallel documents to process in Stage 1 */
    maxConcurrency?: number;
    /** Whether to continue processing if some documents fail */
    continueOnError?: boolean;
    /** Whether to save intermediate results */
    saveIntermediateResults?: boolean;
  };
}

/**
 * Complete two-stage processing result using Totality principles
 */
export type TwoStageProcessingResult =
  | {
    kind: "Success";
    registry: Registry;
    processedCommands: Command[];
    stats: ProcessingStats;
  }
  | {
    kind: "Stage1Failed";
    failedDocuments: Array<{ path: string; error: CommandProcessingResult }>;
  }
  | { kind: "Stage2Failed"; commands: Command[]; error: RegistryBuildingResult }
  | { kind: "NoDocuments" }
  | {
    kind: "AllDocumentsFailed";
    errors: Array<{ path: string; error: CommandProcessingResult }>;
  };

/**
 * Processing statistics
 */
export interface ProcessingStats {
  /** Total documents processed */
  totalDocuments: number;
  /** Successfully processed documents */
  successfulDocuments: number;
  /** Failed documents */
  failedDocuments: number;
  /** Total commands generated */
  totalCommands: number;
  /** Unique categories (c1 values) */
  uniqueCategories: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * TwoStageProcessingOrchestrator
 *
 * Orchestrates the complete two-stage processing pipeline:
 * 1. Stage 1: Documents → Commands (via CommandProcessorAdapter)
 * 2. Stage 2: Commands → Registry (via RegistryBuilderAdapter)
 *
 * Maintains full backward compatibility and provides comprehensive error handling.
 */
export class TwoStageProcessingOrchestrator {
  private readonly stage1Adapter: CommandProcessorAdapter;
  private readonly stage2Adapter: RegistryBuilderAdapter;

  constructor(
    frontMatterExtractor: FrontMatterExtractor,
    schemaAnalyzer: SchemaAnalyzer,
    templateMapper: TemplateMapper,
  ) {
    this.stage1Adapter = new CommandProcessorAdapter(
      frontMatterExtractor,
      schemaAnalyzer,
      templateMapper,
    );
    this.stage2Adapter = new RegistryBuilderAdapter(templateMapper);
  }

  /**
   * Executes complete two-stage processing pipeline
   */
  async process(
    documents: Document[],
    config: TwoStageConfig,
  ): Promise<TwoStageProcessingResult> {
    const startTime = performance.now();

    // Validate input
    if (!documents || documents.length === 0) {
      return { kind: "NoDocuments" };
    }

    try {
      // Stage 1: Process documents to commands
      const stage1Result = await this.executeStage1(documents, config);

      if (stage1Result.kind !== "Success") {
        return stage1Result;
      }

      const { commands, failedDocuments } = stage1Result;
      // Stage 2: Build registry from commands
      const stage2Result = await this.executeStage2(commands, config);

      if (stage2Result.kind !== "Success") {
        return stage2Result;
      }

      const registry = stage2Result.registry;
      // Generate processing statistics
      const endTime = performance.now();
      const stats: ProcessingStats = {
        totalDocuments: documents.length,
        successfulDocuments: commands.length,
        failedDocuments: failedDocuments.length,
        totalCommands: registry.metadata.totalCommands,
        uniqueCategories: registry.metadata.totalCategories,
        processingTimeMs: Math.round(endTime - startTime),
      };

      return {
        kind: "Success",
        registry,
        processedCommands: commands,
        stats,
      };
    } catch (error) {
      throw error; // Re-throw unexpected errors
    }
  }

  /**
   * Executes Stage 1: Documents → Commands
   */
  private async executeStage1(
    documents: Document[],
    config: TwoStageConfig,
  ): Promise<
    | {
      kind: "Success";
      commands: Command[];
      failedDocuments: Array<{ path: string; error: CommandProcessingResult }>;
    }
    | {
      kind: "Stage1Failed";
      failedDocuments: Array<{ path: string; error: CommandProcessingResult }>;
    }
    | {
      kind: "AllDocumentsFailed";
      errors: Array<{ path: string; error: CommandProcessingResult }>;
    }
  > {
    const stage1Result = await this.stage1Adapter.processDocuments(
      documents,
      config.commandSchema,
      config.commandTemplate,
    );

    const { successful: commands, failed: failedDocuments } = stage1Result;

    // Check if all documents failed
    if (commands.length === 0 && failedDocuments.length > 0) {
      return {
        kind: "AllDocumentsFailed",
        errors: failedDocuments.map((f) => ({
          path: f.documentPath,
          error: f.error,
        })),
      };
    }

    // Check if we should continue on error
    if (failedDocuments.length > 0 && !config.options.continueOnError) {
      return {
        kind: "Stage1Failed",
        failedDocuments: failedDocuments.map((f) => ({
          path: f.documentPath,
          error: f.error,
        })),
      };
    }

    return {
      kind: "Success",
      commands,
      failedDocuments: failedDocuments.map((f) => ({
        path: f.documentPath,
        error: f.error,
      })),
    };
  }

  /**
   * Executes Stage 2: Commands → Registry
   */
  private async executeStage2(
    commands: Command[],
    config: TwoStageConfig,
  ): Promise<
    | { kind: "Success"; registry: Registry }
    | {
      kind: "Stage2Failed";
      commands: Command[];
      error: RegistryBuildingResult;
    }
  > {
    const stage2Result = await this.stage2Adapter.buildRegistry(
      commands,
      config.registrySchema,
      config.registryTemplate,
    );

    if (stage2Result.kind !== "Success") {
      return { kind: "Stage2Failed", commands, error: stage2Result };
    }

    return { kind: "Success", registry: stage2Result.registry };
  }

  /**
   * Provides access to Stage 1 processing only (for debugging/partial processing)
   */
  async processStage1Only(
    documents: Document[],
    commandSchema: Schema,
    commandTemplate: Template,
  ): Promise<{
    successful: Command[];
    failed: Array<{ documentPath: string; error: CommandProcessingResult }>;
  }> {
    return await this.stage1Adapter.processDocuments(
      documents,
      commandSchema,
      commandTemplate,
    );
  }

  /**
   * Provides access to Stage 2 processing only (for testing/reprocessing)
   */
  async processStage2Only(
    commands: Command[],
    registrySchema: Schema,
    registryTemplate: Template,
  ): Promise<RegistryBuildingResult> {
    return await this.stage2Adapter.buildRegistry(
      commands,
      registrySchema,
      registryTemplate,
    );
  }

  /**
   * Factory method for creating orchestrator with existing services
   */
  static create(
    frontMatterExtractor: FrontMatterExtractor,
    schemaAnalyzer: SchemaAnalyzer,
    templateMapper: TemplateMapper,
  ): TwoStageProcessingOrchestrator {
    return new TwoStageProcessingOrchestrator(
      frontMatterExtractor,
      schemaAnalyzer,
      templateMapper,
    );
  }
}
