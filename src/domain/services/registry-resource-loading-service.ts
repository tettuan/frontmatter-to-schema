/**
 * Registry Resource Loading Service
 *
 * Handles prompt directory resource acquisition following SRP.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Applies Totality principle with Result types.
 */

import type { DomainError, Result } from "../core/result.ts";
import type { FileReader } from "../../infrastructure/filesystem/file-system.ts";
import { LoggerFactory } from "../shared/logger.ts";

/**
 * Prompt list interface for resource loading
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
 * Service responsible for loading prompt directory resources
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class RegistryResourceLoadingService {
  private static readonly SERVICE_NAME = "registry-resource-loading";

  constructor(private readonly fileReader: FileReader) {}

  /**
   * Load prompt directory with enhanced error handling
   * Extracted from BuildRegistryUseCase.execute() lines 51-62
   */
  async loadPromptDirectory(
    promptsPath: string,
  ): Promise<Result<PromptList, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger(
      RegistryResourceLoadingService.SERVICE_NAME,
    );
    logger.info("Loading prompt directory", { path: promptsPath });

    const promptListResult = await this.fileReader.readDirectory(promptsPath);
    if (!promptListResult.ok) {
      const enhancedError = {
        ...promptListResult.error,
        message:
          `Failed to read prompts directory: ${promptListResult.error.message}`,
      };

      logger.error("Failed to read prompts directory", {
        error: enhancedError.message,
        path: promptsPath,
      });

      return {
        ok: false,
        error: enhancedError,
      };
    }

    const promptList = promptListResult.data;
    logger.info("Successfully loaded prompt directory", {
      count: promptList.count,
      path: promptsPath,
    });

    return promptListResult;
  }
}
