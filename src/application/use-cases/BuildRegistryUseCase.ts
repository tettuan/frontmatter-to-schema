import type {
  FileReader,
  FileWriter,
} from "../../infrastructure/filesystem/file-system.ts";
import type { FrontMatterExtractor } from "../../domain/frontmatter/frontmatter-models.ts";
import type { ClaudeAnalyzer } from "../../domain/analysis/Analyzer.ts";
import { RegistryAggregator } from "../services/RegistryAggregator.ts";
import type { Registry } from "../../domain/core/types.ts";
import { LoggerFactory } from "../../domain/shared/logger.ts";

export class BuildRegistryUseCase {
  constructor(
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly extractor: FrontMatterExtractor,
    private readonly analyzer: ClaudeAnalyzer,
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
        const analysisResult = await this.analyzer.analyze(
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
