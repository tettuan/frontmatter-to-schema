/**
 * Registry Result Service
 *
 * Handles result aggregation and persistence following SRP.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Applies Totality principle with Result types.
 */

import type { DomainError, Result } from "../core/result.ts";
import type { FileWriter } from "../../infrastructure/filesystem/file-system.ts";
import type { Registry } from "../core/types.ts";
import { LoggerFactory } from "../shared/logger.ts";
import type { RegistryAggregator } from "../../application/services/registry-aggregator.ts";

/**
 * Processed results interface from file processing
 */
export interface ProcessedResults {
  totalProcessed: number;
  successfulExtractions: number;
  aggregator: RegistryAggregator;
}

/**
 * Service responsible for result aggregation and persistence
 * Following AI Complexity Control Framework - focused on final output
 */
export class RegistryResultService {
  private static readonly SERVICE_NAME = "registry-result-service";

  constructor(
    private readonly fileWriter: FileWriter,
  ) {}

  /**
   * Aggregate results and save to output path
   * Extracted from BuildRegistryUseCase.execute() lines 180-189
   * Handles final registry building and persistence
   */
  async aggregateAndSave(
    results: ProcessedResults,
    outputPath: string,
  ): Promise<Result<Registry, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger(
      RegistryResultService.SERVICE_NAME,
    );

    logger.info("Starting result aggregation", {
      totalProcessed: results.totalProcessed,
      successfulExtractions: results.successfulExtractions,
    });

    try {
      // Build registry from aggregated results
      const registry = results.aggregator.build();

      // Write registry to output file
      await this.fileWriter.writeJson(outputPath, registry);

      logger.info("Registry aggregation and save completed", {
        outputPath,
        totalCommands: registry.tools.commands.length,
        availableConfigs: registry.tools.availableConfigs.join(", "),
        totalProcessed: results.totalProcessed,
        successfulExtractions: results.successfulExtractions,
      });

      return { ok: true, data: registry };
    } catch (error) {
      const errorMessage = `Error during registry aggregation: ${
        error instanceof Error ? error.message : String(error)
      }`;

      logger.error("Registry aggregation failed", {
        outputPath,
        error: errorMessage,
        totalProcessed: results.totalProcessed,
      });

      return {
        ok: false,
        error: {
          kind: "InvalidState",
          expected: "successful registry aggregation",
          actual: "aggregation error",
          message: errorMessage,
        } as DomainError & { message: string },
      };
    }
  }
}
