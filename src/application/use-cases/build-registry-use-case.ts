import type { Registry } from "../../domain/core/types.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { LoggerFactory } from "../../domain/shared/logger.ts";
import type { RegistryResourceLoadingService } from "../../domain/services/registry-resource-loading-service.ts";
import type { RegistryFileProcessingService } from "../../domain/services/registry-file-processing-service.ts";
import type { RegistryResultService } from "../../domain/services/registry-result-service.ts";
import type { SchemaAnalyzer } from "../../domain/services/interfaces.ts";

// Discriminated union for analyzer types following totality principle
export type RegistryAnalyzer =
  | { kind: "SchemaAnalyzer"; analyzer: SchemaAnalyzer }
  | { kind: "MockAnalyzer"; analyzer: MockAnalyzer }
  | { kind: "NoAnalyzer" };

// Type for mock analyzer used in tests
export interface MockAnalyzer {
  analyze(frontMatter: unknown, promptPath: string): Promise<{
    isValid: boolean;
    commands: unknown[];
  }>;
}

export class BuildRegistryUseCase {
  constructor(
    private readonly resourceLoadingService: RegistryResourceLoadingService,
    private readonly fileProcessingService: RegistryFileProcessingService,
    private readonly resultService: RegistryResultService,
    private readonly analyzer: RegistryAnalyzer,
  ) {}

  async execute(
    promptsPath: string,
    outputPath: string,
  ): Promise<Result<Registry, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger("build-registry");
    logger.info("Starting registry build process");

    // Step 1: Load prompt directory
    const resourceResult = await this.resourceLoadingService
      .loadPromptDirectory(
        promptsPath,
      );
    if (!resourceResult.ok) {
      logger.error("Failed to load prompt directory", {
        error: resourceResult.error.message,
      });
      return resourceResult;
    }

    // Step 2: Process all prompt files
    const processingResult = await this.fileProcessingService.processFiles(
      resourceResult.data,
      this.analyzer,
    );
    if (!processingResult.ok) {
      logger.error("Failed to process files", {
        error: processingResult.error.message,
      });
      return processingResult;
    }

    // Step 3: Aggregate and save results
    const finalResult = await this.resultService.aggregateAndSave(
      processingResult.data,
      outputPath,
    );
    if (!finalResult.ok) {
      logger.error("Failed to aggregate results", {
        error: finalResult.error.message,
      });
      return finalResult;
    }

    logger.info("Registry build completed", {
      outputPath,
      totalCommands: finalResult.data.tools.commands.length,
      availableConfigs: finalResult.data.tools.availableConfigs.join(", "),
    });

    return finalResult;
  }
}
