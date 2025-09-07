/**
 * Registry Analyzer Orchestrator Service
 *
 * Handles analyzer strategy coordination following SRP.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Applies Discriminated Union pattern and Totality principle.
 */

import type { DomainError, Result } from "../core/result.ts";
import type { FrontMatter as _FrontMatter } from "../models/entities.ts";
import { LoggerFactory } from "../shared/logger.ts";
import type { RegistrySchemaService } from "./registry-schema-service.ts";
import type { RegistryConversionService } from "./registry-conversion-service.ts";

/**
 * Registry analyzer types following Discriminated Union pattern
 */
export type RegistryAnalyzer =
  | {
    kind: "SchemaAnalyzer";
    analyzer: import("../services/interfaces.ts").SchemaAnalyzer;
  }
  | { kind: "MockAnalyzer"; analyzer: MockAnalyzer }
  | { kind: "NoAnalyzer" };

/**
 * Mock analyzer interface for testing
 */
export interface MockAnalyzer {
  analyze(frontMatter: unknown, promptPath: string): Promise<{
    isValid: boolean;
    commands: unknown[];
  }>;
}

/**
 * Prompt file interface
 */
export interface PromptFile {
  filename: string;
  path: string;
  content: string;
}

/**
 * Analysis result interface
 */
export interface AnalysisResult {
  isValid: boolean;
  commands?: unknown[];
  data?: unknown;
}

/**
 * Service responsible for analyzer strategy coordination
 * Following AI Complexity Control Framework - focused orchestration
 */
export class RegistryAnalyzerOrchestrator {
  private static readonly SERVICE_NAME = "registry-analyzer-orchestrator";

  constructor(
    private readonly schemaService: RegistrySchemaService,
    private readonly conversionService: RegistryConversionService,
  ) {}

  /**
   * Execute analyzer strategy with discriminated union pattern
   * Extracted from BuildRegistryUseCase.execute() lines 77-171
   * Applies Totality principle for exhaustive case handling
   */
  async executeAnalyzerStrategy(
    analyzer: RegistryAnalyzer,
    frontMatter: import("../frontmatter/frontmatter-models.ts").FrontMatter,
    promptFile: PromptFile,
  ): Promise<Result<AnalysisResult | null, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger(
      RegistryAnalyzerOrchestrator.SERVICE_NAME,
    );

    try {
      // Use discriminated union pattern for type-safe analyzer handling
      switch (analyzer.kind) {
        case "NoAnalyzer": {
          logger.debug("No analyzer configured, skipping", {
            filename: promptFile.filename,
          });
          return { ok: true, data: null };
        }

        case "MockAnalyzer": {
          return await this.handleMockAnalyzer(
            analyzer.analyzer,
            frontMatter,
            promptFile,
            logger,
          );
        }

        case "SchemaAnalyzer": {
          return await this.handleSchemaAnalyzer(
            analyzer.analyzer,
            frontMatter,
            promptFile,
            logger,
          );
        }

        default: {
          // Exhaustive check - TypeScript will error if we miss a case
          const _exhaustiveCheck: never = analyzer;
          const errorMessage = `Unhandled analyzer kind: ${
            String(_exhaustiveCheck)
          }`;

          logger.error("Unhandled analyzer kind", {
            analyzerKind: String(_exhaustiveCheck),
            filename: promptFile.filename,
          });

          return {
            ok: false,
            error: {
              kind: "InvalidState",
              expected: "valid analyzer kind",
              actual: String(_exhaustiveCheck),
              message: errorMessage,
            } as DomainError & { message: string },
          };
        }
      }
    } catch (error) {
      const errorMessage = `Error analyzing file: ${
        error instanceof Error ? error.message : String(error)
      }`;

      logger.error("Error analyzing file", {
        filename: promptFile.filename,
        error: errorMessage,
      });

      return {
        ok: false,
        error: {
          kind: "InvalidState",
          expected: "successful processing",
          actual: "processing error",
          message: errorMessage,
        } as DomainError & { message: string },
      };
    }
  }

  /**
   * Handle mock analyzer execution
   */
  private async handleMockAnalyzer(
    mockAnalyzer: MockAnalyzer,
    frontMatter: import("../frontmatter/frontmatter-models.ts").FrontMatter,
    promptFile: PromptFile,
    logger: ReturnType<typeof LoggerFactory.createLogger>,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    const analysisResult = await mockAnalyzer.analyze(
      frontMatter,
      promptFile.path,
    );

    if (analysisResult.isValid) {
      logger.debug("Extracted commands", {
        filename: promptFile.filename,
        commandCount: analysisResult.commands.length,
      });
    } else {
      logger.debug("No valid commands found", {
        filename: promptFile.filename,
      });
    }

    return { ok: true, data: analysisResult };
  }

  /**
   * Handle schema analyzer execution
   */
  private async handleSchemaAnalyzer(
    schemaAnalyzer: import("../services/interfaces.ts").SchemaAnalyzer,
    frontMatter: import("../frontmatter/frontmatter-models.ts").FrontMatter,
    promptFile: PromptFile,
    logger: ReturnType<typeof LoggerFactory.createLogger>,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    // Create default CLI schema
    const schemaResult = this.schemaService.createDefaultCliSchema();
    if (!schemaResult.ok) {
      logger.error("Failed to create CLI schema", {
        filename: promptFile.filename,
        error: schemaResult.error.message,
      });
      return schemaResult;
    }

    // Convert frontmatter following Totality principle
    const frontMatterConversionResult = this.conversionService
      .convertFrontMatterSafely(frontMatter);
    if (!frontMatterConversionResult.ok) {
      logger.debug("FrontMatter conversion failed", {
        filename: promptFile.filename,
        error: frontMatterConversionResult.error,
      });
      return {
        ok: false,
        error: {
          ...frontMatterConversionResult.error,
          message: "FrontMatter conversion failed",
        },
      };
    }

    // Analyze with schema
    const analysisResult = await schemaAnalyzer.analyze(
      frontMatterConversionResult.data,
      schemaResult.data,
    );

    if (analysisResult.ok) {
      const extractedData = analysisResult.data;
      const data = extractedData.getData();

      if (data && typeof data === "object" && "commands" in data) {
        logger.debug("Extracted commands via SchemaAnalyzer", {
          filename: promptFile.filename,
          commandCount: Array.isArray(data.commands) ? data.commands.length : 0,
        });

        return {
          ok: true,
          data: {
            isValid: true,
            data,
          },
        };
      } else {
        logger.debug("No command data found in analysis result", {
          filename: promptFile.filename,
        });

        return {
          ok: true,
          data: {
            isValid: false,
          },
        };
      }
    } else {
      logger.debug("SchemaAnalyzer failed", {
        filename: promptFile.filename,
        error: analysisResult.error.message,
      });

      return {
        ok: false,
        error: analysisResult.error,
      };
    }
  }
}
