import type {
  FileReader,
  FileWriter,
} from "../../infrastructure/filesystem/file-system.ts";
import type { FrontMatterExtractor } from "../../domain/frontmatter/frontmatter-models.ts";
import { RegistryAggregator } from "../services/registry-aggregator.ts";
import type { Registry } from "../../domain/core/types.ts";
import { LoggerFactory } from "../../domain/shared/logger.ts";
import type { SchemaAnalyzer } from "../../domain/services/interfaces.ts";
import { Schema, SchemaId } from "../../domain/models/entities.ts";
import {
  FrontMatterContent,
  SchemaDefinition,
  SchemaVersion,
} from "../../domain/models/value-objects.ts";
import { FrontMatter } from "../../domain/models/entities.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { DEFAULT_VALUES, SCHEMA_IDS } from "../../domain/constants/index.ts";
import { getSchemaConfigLoader } from "../../domain/config/schema-config-loader.ts";
import { COMMAND_FIELD_METADATA } from "../../domain/constants/command-fields.ts";

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
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly extractor: FrontMatterExtractor,
    private readonly analyzer: RegistryAnalyzer,
  ) {}

  async execute(
    promptsPath: string,
    outputPath: string,
  ): Promise<Result<Registry, DomainError & { message: string }>> {
    const logger = LoggerFactory.createLogger("build-registry");
    logger.info("Starting registry build process");

    const promptListResult = await this.fileReader.readDirectory(promptsPath);
    if (!promptListResult.ok) {
      logger.error("Failed to read prompts directory", {
        error: promptListResult.error.message,
        path: promptsPath,
      });
      return promptListResult;
    }
    const promptList = promptListResult.data;
    logger.info("Found prompt files", { count: promptList.count });

    const aggregator = new RegistryAggregator();

    for (const promptFile of promptList.getAll()) {
      logger.debug("Processing prompt file", { filename: promptFile.filename });

      const frontMatter = this.extractor.extract(promptFile.content);
      if (!frontMatter) {
        logger.debug("No frontmatter found, skipping", {
          filename: promptFile.filename,
        });
        continue;
      }

      try {
        // Use discriminated union pattern for type-safe analyzer handling
        switch (this.analyzer.kind) {
          case "NoAnalyzer": {
            continue;
          }

          case "MockAnalyzer": {
            const analysisResult = await this.analyzer.analyzer.analyze(
              frontMatter,
              promptFile.path,
            );

            if (analysisResult.isValid) {
              aggregator.addAnalysisResult(analysisResult);
              logger.debug("Extracted commands", {
                filename: promptFile.filename,
                commandCount: analysisResult.commands.length,
              });
            } else {
              logger.debug("No valid commands found", {
                filename: promptFile.filename,
              });
            }
            break;
          }

          case "SchemaAnalyzer": {
            // Create default CLI schema for registry building
            const schemaResult = await this.createDefaultCliSchema();
            if (!schemaResult.ok) {
              logger.error("Failed to create CLI schema", {
                filename: promptFile.filename,
                error: schemaResult.error.message,
              });
              continue;
            }
            const schema = schemaResult.data;

            // Convert frontmatter following Totality principle with type-safe transformation
            const frontMatterConversionResult = this.convertFrontMatterSafely(
              frontMatter,
            );
            if (!frontMatterConversionResult.ok) {
              logger.debug("FrontMatter conversion failed", {
                filename: promptFile.filename,
                error: frontMatterConversionResult.error,
              });
              break;
            }
            const frontMatterData = frontMatterConversionResult.data;

            const analysisResult = await this.analyzer.analyzer.analyze(
              frontMatterData,
              schema,
            );

            if (analysisResult.ok) {
              // The SchemaAnalyzer returns ExtractedData, which we need to transform
              // into the format expected by the aggregator
              const extractedData = analysisResult.data;
              const data = extractedData.getData();

              // Check if the extracted data contains command information
              if (data && typeof data === "object" && "commands" in data) {
                aggregator.addAnalysisResult(data);
                logger.debug("Extracted commands via SchemaAnalyzer", {
                  filename: promptFile.filename,
                  commandCount: Array.isArray(data.commands)
                    ? data.commands.length
                    : 0,
                });
              } else {
                logger.debug("No command data found in analysis result", {
                  filename: promptFile.filename,
                });
              }
            } else {
              logger.debug("SchemaAnalyzer failed", {
                filename: promptFile.filename,
                error: analysisResult.error.message,
              });
            }
            break;
          }

          default: {
            // Exhaustive check - TypeScript will error if we miss a case
            const _exhaustiveCheck: never = this.analyzer;
            // Log error instead of throwing to maintain Totality
            logger.error("Unhandled analyzer kind", {
              analyzerKind: String(_exhaustiveCheck),
              filename: promptFile.filename,
            });
            continue;
          }
        }
      } catch (error) {
        logger.error("Error analyzing file", {
          filename: promptFile.filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const registry = aggregator.build();
    await this.fileWriter.writeJson(outputPath, registry);

    logger.info("Registry build completed", {
      outputPath,
      totalCommands: registry.tools.commands.length,
      availableConfigs: registry.tools.availableConfigs.join(", "),
    });

    return { ok: true, data: registry };
  }

  /**
   * Create a default schema for CLI registry building
   * This schema defines the expected structure for CLI prompt frontmatter
   */
  private async createDefaultCliSchema(): Promise<
    Result<
      Schema,
      DomainError & { message: string }
    >
  > {
    const schemaId = SchemaId.create(SCHEMA_IDS.CLI_REGISTRY);
    if (!schemaId.ok) {
      return {
        ok: false,
        error: createDomainError(schemaId.error, "Failed to create schema ID"),
      };
    }

    const schemaVersion = SchemaVersion.create(DEFAULT_VALUES.SCHEMA_VERSION);
    if (!schemaVersion.ok) {
      return {
        ok: false,
        error: createDomainError(
          schemaVersion.error,
          "Failed to create schema version",
        ),
      };
    }

    // Define the expected structure for CLI prompt frontmatter using constants
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // Build properties from field metadata
    for (const [field, metadata] of Object.entries(COMMAND_FIELD_METADATA)) {
      properties[field] = {
        type: metadata.type,
        description: metadata.description,
      };
      if (metadata.required) {
        required.push(field);
      }
    }

    const cliSchemaDefinition = {
      type: "object",
      properties,
      required,
    };

    const schemaDefinition = SchemaDefinition.create(
      cliSchemaDefinition,
      DEFAULT_VALUES.SCHEMA_VERSION,
    );
    if (!schemaDefinition.ok) {
      return {
        ok: false,
        error: createDomainError(
          schemaDefinition.error,
          "Failed to create schema definition",
        ),
      };
    }

    const schema = Schema.create(
      schemaId.data,
      schemaDefinition.data,
      schemaVersion.data,
      "Schema for CLI command registry building from prompt frontmatter",
    );

    return { ok: true, data: schema };
  }

  /**
   * Type-safe conversion from frontmatter-models.FrontMatter to entities.FrontMatter
   * Following Totality principle to eliminate unsafe type casting
   */
  private convertFrontMatterSafely(
    sourceFrontMatter:
      import("../../domain/frontmatter/frontmatter-models.ts").FrontMatter,
  ): Result<
    import("../../domain/models/entities.ts").FrontMatter,
    DomainError
  > {
    try {
      // Create FrontMatterContent from the source data using smart constructor
      const contentResult = FrontMatterContent.fromObject(
        sourceFrontMatter.data,
      );
      if (!contentResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidState",
            expected: "valid FrontMatterContent",
            actual: "conversion failed",
          } as DomainError,
        };
      }

      // Create the target FrontMatter instance
      const targetFrontMatter = new FrontMatter(
        contentResult.data,
        sourceFrontMatter.raw,
      );

      return { ok: true, data: targetFrontMatter };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateMappingFailed",
          template: "FrontMatter conversion",
          source: sourceFrontMatter.data,
        } as DomainError,
      };
    }
  }
}
