/**
 * Registry File Processing Service
 *
 * Handles individual file processing orchestration following SRP.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Applies Totality principle with Result types.
 */

import type { DomainError, Result } from "../core/result.ts";
import type { FrontMatterExtractor as SimpleFrontMatterExtractor } from "../frontmatter/frontmatter-models.ts";
import { LoggerFactory } from "../shared/logger.ts";
import type {
  PromptFile,
  RegistryAnalyzer,
  RegistryAnalyzerOrchestrator,
} from "./registry-analyzer-orchestrator.ts";
import { RegistryAggregator } from "../../application/services/registry-aggregator.ts";

/**
 * Prompt list interface for file processing
 */
export interface PromptList {
  count: number;
  getAll(): Array<{
    filename: string;
    path: string;
    content: string;
  }>;
}

/**
 * Processed results interface
 */
export interface ProcessedResults {
  totalProcessed: number;
  successfulExtractions: number;
  aggregator: RegistryAggregator;
}

/**
 * Service responsible for individual file processing orchestration
 * Following AI Complexity Control Framework - focused orchestration
 */
export class RegistryFileProcessingService {
  private static readonly SERVICE_NAME = "registry-file-processing";

  constructor(
    private readonly extractor: SimpleFrontMatterExtractor,
    private readonly analyzerOrchestrator: RegistryAnalyzerOrchestrator,
  ) {}

  /**
   * Process all files in prompt list with analyzer strategy
   * Extracted from BuildRegistryUseCase.execute() lines 64-178
   * Applies Result types for comprehensive error handling
   */
  async processFiles(
    promptList: PromptList,
    analyzer: RegistryAnalyzer,
  ): Promise<Result<ProcessedResults, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger(
      RegistryFileProcessingService.SERVICE_NAME,
    );
    const aggregator = new RegistryAggregator();
    let totalProcessed = 0;
    let successfulExtractions = 0;

    logger.info("Starting file processing", { count: promptList.count });

    for (const promptFile of promptList.getAll()) {
      totalProcessed++;
      logger.debug("Processing prompt file", { filename: promptFile.filename });

      try {
        const processResult = await this.processIndividualFile(
          promptFile,
          analyzer,
          aggregator,
          logger,
        );

        if (processResult.ok && processResult.data.extracted) {
          successfulExtractions++;
        }
      } catch (error) {
        logger.error("Unexpected error processing file", {
          filename: promptFile.filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("File processing completed", {
      totalProcessed,
      successfulExtractions,
    });

    return {
      ok: true,
      data: {
        totalProcessed,
        successfulExtractions,
        aggregator,
      },
    };
  }

  /**
   * Process individual file with frontmatter extraction and analysis
   */
  private async processIndividualFile(
    promptFile: PromptFile,
    analyzer: RegistryAnalyzer,
    aggregator: RegistryAggregator,
    logger: ReturnType<typeof LoggerFactory.createLogger>,
  ): Promise<
    Result<{ extracted: boolean }, DomainError & { message: string }>
  > {
    // Extract frontmatter
    const frontMatter = this.extractor.extract(promptFile.content);
    if (!frontMatter) {
      logger.debug("No frontmatter found, skipping", {
        filename: promptFile.filename,
      });
      return { ok: true, data: { extracted: false } };
    }

    // Execute analyzer strategy through orchestrator
    const analysisResult = await this.analyzerOrchestrator
      .executeAnalyzerStrategy(
        analyzer,
        frontMatter,
        promptFile,
      );

    if (!analysisResult.ok) {
      logger.debug("Analysis failed", {
        filename: promptFile.filename,
        error: analysisResult.error.message,
      });
      return analysisResult;
    }

    // Handle analysis results
    const analysis = analysisResult.data;
    if (analysis === null) {
      return { ok: true, data: { extracted: false } };
    }

    if (analysis.isValid) {
      // Add to aggregator based on analysis type
      if (analysis.commands) {
        aggregator.addAnalysisResult({
          isValid: true,
          commands: analysis.commands,
        });
      } else if (analysis.data) {
        aggregator.addAnalysisResult(analysis.data);
      }

      logger.debug("Successfully extracted data", {
        filename: promptFile.filename,
        hasCommands: !!analysis.commands,
        hasData: !!analysis.data,
      });

      return { ok: true, data: { extracted: true } };
    } else {
      logger.debug("No valid data found", {
        filename: promptFile.filename,
      });
      return { ok: true, data: { extracted: false } };
    }
  }
}
