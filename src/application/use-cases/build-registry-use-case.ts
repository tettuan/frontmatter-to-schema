import type {
  FileReader,
  FileWriter,
} from "../../infrastructure/filesystem/file-system.ts";
import type { FrontMatterExtractor } from "../../domain/frontmatter/frontmatter-models.ts";
import { RegistryAggregator } from "../services/registry-aggregator.ts";
import type { Registry } from "../../domain/core/types.ts";
import { LoggerFactory } from "../../domain/shared/logger.ts";
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
            // TODO: Implement proper SchemaAnalyzer usage with Schema parameter
            // For now, skip as we need proper Schema instance
            logger.debug(
              "SchemaAnalyzer not yet implemented for registry building",
              {
                filename: promptFile.filename,
              },
            );
            continue;
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
}
