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
  SchemaDefinition,
  SchemaVersion,
} from "../../domain/models/value-objects.ts";

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
  ): Promise<Registry> {
    const logger = LoggerFactory.createLogger("build-registry");
    logger.info("Starting registry build process");

    const promptList = await this.fileReader.readDirectory(promptsPath);
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
            const schema = this.createDefaultCliSchema();

            // Convert frontmatter from frontmatter-models interface to entities interface
            // The SchemaAnalyzer expects an entities.FrontMatter, but extractor returns frontmatter-models.FrontMatter
            // We need to properly cast this since they have compatible structures
            const frontMatterData =
              frontMatter as unknown as import("../../domain/models/entities.ts").FrontMatter;

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
            throw new Error(
              `Unhandled analyzer kind: ${String(_exhaustiveCheck)}`,
            );
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

    return registry;
  }

  /**
   * Create a default schema for CLI registry building
   * This schema defines the expected structure for CLI prompt frontmatter
   */
  private createDefaultCliSchema(): Schema {
    const schemaId = SchemaId.create("cli-registry-schema");
    if (!schemaId.ok) {
      throw new Error("Failed to create schema ID");
    }

    const schemaVersion = SchemaVersion.create("1.0.0");
    if (!schemaVersion.ok) {
      throw new Error("Failed to create schema version");
    }

    // Define the expected structure for CLI prompt frontmatter
    const cliSchemaDefinition = {
      type: "object",
      properties: {
        c1: { type: "string", description: "First command component (domain)" },
        c2: {
          type: "string",
          description: "Second command component (action)",
        },
        c3: { type: "string", description: "Third command component (target)" },
        title: { type: "string", description: "Human-readable command title" },
        description: { type: "string", description: "Command description" },
        usage: { type: "string", description: "Usage example" },
        options: {
          type: "object",
          description: "Available command options",
        },
      },
      required: ["c1", "c2", "c3"],
    };

    const schemaDefinition = SchemaDefinition.create(
      cliSchemaDefinition,
      "1.0.0",
    );
    if (!schemaDefinition.ok) {
      throw new Error("Failed to create schema definition");
    }

    return Schema.create(
      schemaId.data,
      schemaDefinition.data,
      schemaVersion.data,
      "Schema for CLI command registry building from prompt frontmatter",
    );
  }
}
