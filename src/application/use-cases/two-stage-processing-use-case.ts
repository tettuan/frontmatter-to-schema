/**
 * TwoStageProcessingUseCase - Orchestrates the two-stage processing pipeline
 *
 * Implements the complete two-stage architecture as specified in requirements:
 * Stage 1: Individual command processing (成果A→成果B→成果C→成果D)
 * Stage 2: Registry aggregation (成果D[]→最終成果物Z)
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { ExtractedData, Template } from "../../domain/models/entities.ts";
import type { Schema } from "../../domain/models/entities.ts";
import {
  type Command,
  CommandProcessingContext,
  CommandProcessor,
} from "../../domain/models/command-processor.ts";
import {
  type Registry,
  RegistryBuilder,
  type RegistryBuildingContext,
} from "../../domain/models/registry-builder.ts";
import type { Logger } from "../../domain/shared/logger.ts";

/**
 * Two-stage processing configuration
 */
export interface TwoStageProcessingConfig {
  // Stage 1 configuration
  commandSchema: Schema;
  commandTemplate: Template;

  // Stage 2 configuration
  registrySchema: Schema;
  registryTemplate: Template;

  // Optional configuration
  version?: string;
  description?: string;
  strictMode?: boolean;
  logger?: Logger;
}

/**
 * Two-stage processing result
 */
export interface TwoStageProcessingResult {
  stage1Result: {
    processedCommands: Command[];
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
  };
  stage2Result: {
    registry: Registry;
    availableConfigs: string[];
    totalCommands: number;
  };
  processingTimeMs: number;
}

/**
 * TwoStageProcessingUseCase - Main orchestrator for two-stage processing
 */
export class TwoStageProcessingUseCase {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Execute complete two-stage processing pipeline
   */
  async execute(
    documents: ExtractedData[],
    config: TwoStageProcessingConfig,
  ): Promise<
    Result<TwoStageProcessingResult, DomainError & { message: string }>
  > {
    const startTime = Date.now();

    try {
      this.logger?.info(
        "[TwoStageProcessing] Starting two-stage processing pipeline",
        {
          totalDocuments: documents.length,
          strictMode: config.strictMode || false,
        },
      );

      // Stage 1: Process individual commands
      this.logger?.info(
        "[TwoStageProcessing] === Stage 1: Processing individual commands ===",
      );
      const stage1Result = await this.executeStage1(documents, config);
      if (!stage1Result.ok) {
        return stage1Result;
      }

      this.logger?.info("[TwoStageProcessing] Stage 1 completed", {
        processedCommands: stage1Result.data.processedCommands.length,
        successfulDocuments: stage1Result.data.successfulDocuments,
        failedDocuments: stage1Result.data.failedDocuments,
      });

      // Stage 2: Build registry structure
      this.logger?.info(
        "[TwoStageProcessing] === Stage 2: Building registry structure ===",
      );
      const stage2Result = await this.executeStage2(
        stage1Result.data.processedCommands,
        config,
      );
      if (!stage2Result.ok) {
        return stage2Result;
      }

      this.logger?.info("[TwoStageProcessing] Stage 2 completed", {
        availableConfigs: stage2Result.data.availableConfigs.length,
        totalCommands: stage2Result.data.totalCommands,
      });

      const processingTimeMs = Date.now() - startTime;

      const result: TwoStageProcessingResult = {
        stage1Result: stage1Result.data,
        stage2Result: stage2Result.data,
        processingTimeMs,
      };

      this.logger?.info(
        "[TwoStageProcessing] Two-stage processing completed successfully",
        {
          processingTimeMs,
          totalCommands: result.stage2Result.totalCommands,
          availableConfigs: result.stage2Result.availableConfigs,
        },
      );

      return { ok: true, data: result };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      this.logger?.error("[TwoStageProcessing] Two-stage processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs,
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "two-stage-processing",
          error: createDomainError({
            kind: "InvalidFormat",
            input: "two-stage-processing",
            expectedFormat: "valid processing pipeline",
          }),
        }),
      };
    }
  }

  /**
   * Execute Stage 1: Individual command processing (成果A→成果B→成果C→成果D)
   */
  async executeStage1(
    documents: ExtractedData[],
    config: TwoStageProcessingConfig,
  ): Promise<
    Result<{
      processedCommands: Command[];
      totalDocuments: number;
      successfulDocuments: number;
      failedDocuments: number;
    }, DomainError & { message: string }>
  > {
    try {
      // Create CommandProcessor
      const processorResult = CommandProcessor.create();
      if (!processorResult.ok) {
        return processorResult;
      }

      // Prepare processing context using smart constructor
      const contextResult = CommandProcessingContext.fromStrictMode(
        config.commandSchema,
        config.commandTemplate,
        config.strictMode || false,
      );
      if (!contextResult.ok) {
        return contextResult;
      }
      const context = contextResult.data;

      // Process all documents
      const commandsResult = await processorResult.data.processDocuments(
        documents,
        context,
      );
      if (!commandsResult.ok) {
        return commandsResult;
      }

      const totalDocuments = documents.length;
      const successfulDocuments = commandsResult.data.length;
      const failedDocuments = totalDocuments - successfulDocuments;

      this.logger?.info("[Stage1] Document processing completed", {
        totalDocuments,
        successfulDocuments,
        failedDocuments,
        strictMode: config.strictMode,
      });

      return {
        ok: true,
        data: {
          processedCommands: commandsResult.data,
          totalDocuments,
          successfulDocuments,
          failedDocuments,
        },
      };
    } catch (error) {
      this.logger?.error("[Stage1] Stage 1 processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "two-stage-processing",
          error: createDomainError({
            kind: "InvalidFormat",
            input: "stage-1-processing",
            expectedFormat: "valid command processing",
          }),
        }),
      };
    }
  }

  /**
   * Execute Stage 2: Registry aggregation (成果D[]→最終成果物Z)
   */
  async executeStage2(
    commands: Command[],
    config: TwoStageProcessingConfig,
  ): Promise<
    Result<{
      registry: Registry;
      availableConfigs: string[];
      totalCommands: number;
    }, DomainError & { message: string }>
  > {
    try {
      // Create RegistryBuilder
      const builderResult = RegistryBuilder.create();
      if (!builderResult.ok) {
        return builderResult;
      }

      // Prepare building context
      const context: RegistryBuildingContext = {
        registrySchema: config.registrySchema,
        registryTemplate: config.registryTemplate,
        version: config.version,
        description: config.description,
      };

      // Build registry
      const registryResult = await builderResult.data.buildRegistry(
        commands,
        context,
      );
      if (!registryResult.ok) {
        return registryResult;
      }

      const registry = registryResult.data;
      const availableConfigs = registry.tools.availableConfigs;
      const totalCommands = registry.tools.commands.length;

      this.logger?.info("[Stage2] Registry building completed", {
        availableConfigs: availableConfigs.join(", "),
        totalCommands,
        version: registry.version,
      });

      return {
        ok: true,
        data: {
          registry,
          availableConfigs,
          totalCommands,
        },
      };
    } catch (error) {
      this.logger?.error("[Stage2] Stage 2 processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "two-stage-processing",
          error: createDomainError({
            kind: "InvalidFormat",
            input: "stage-2-processing",
            expectedFormat: "valid registry building",
          }),
        }),
      };
    }
  }

  /**
   * Get stage 1 only - useful for debugging or intermediate output
   */
  async executeStage1Only(
    documents: ExtractedData[],
    config: Pick<
      TwoStageProcessingConfig,
      "commandSchema" | "commandTemplate" | "strictMode"
    >,
  ): Promise<Result<Command[], DomainError & { message: string }>> {
    const stage1Result = await this.executeStage1(documents, {
      ...config,
      registrySchema: config.commandSchema,
      registryTemplate: config.commandTemplate,
    });

    if (!stage1Result.ok) {
      return stage1Result;
    }

    return { ok: true, data: stage1Result.data.processedCommands };
  }

  /**
   * Get stage 2 only - useful when commands are pre-processed
   */
  async executeStage2Only(
    commands: Command[],
    config: Pick<
      TwoStageProcessingConfig,
      "registrySchema" | "registryTemplate" | "version" | "description"
    >,
  ): Promise<Result<Registry, DomainError & { message: string }>> {
    const stage2Result = await this.executeStage2(commands, {
      ...config,
      commandSchema: config.registrySchema,
      commandTemplate: config.registryTemplate,
    });

    if (!stage2Result.ok) {
      return stage2Result;
    }

    return { ok: true, data: stage2Result.data.registry };
  }
}
