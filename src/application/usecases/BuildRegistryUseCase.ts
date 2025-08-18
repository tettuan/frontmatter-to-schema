import type { FileReader } from "../../infrastructure/filesystem/FileReader.ts";
import type { FileWriter } from "../../infrastructure/filesystem/FileWriter.ts";
import type { FrontMatterExtractor } from "../../domain/frontmatter/Extractor.ts";
import type { ClaudeAnalyzer } from "../../domain/analysis/Analyzer.ts";
import { RegistryBuilder } from "../services/RegistryBuilder.ts";
import type { Registry } from "../../domain/registry/types.ts";

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
    console.log("Starting registry build process...");

    const promptList = await this.fileReader.readDirectory(promptsPath);
    console.log(`Found ${promptList.count} prompt files`);

    const builder = new RegistryBuilder();

    for (const promptFile of promptList.getAll()) {
      console.log(`Processing: ${promptFile.filename}`);

      const frontMatter = this.extractor.extract(promptFile.content);
      if (!frontMatter) {
        console.log(`  No frontmatter found, skipping`);
        continue;
      }

      try {
        const analysisResult = await this.analyzer.analyze(
          frontMatter,
          promptFile.path,
        );

        if (analysisResult.isValid) {
          builder.addAnalysisResult(analysisResult);
          console.log(`  Extracted ${analysisResult.commands.length} commands`);
        } else {
          console.log(`  No valid commands found`);
        }
      } catch (error) {
        console.error(`  Error analyzing file: ${error}`);
      }
    }

    const registry = builder.build();
    await this.fileWriter.writeJson(outputPath, registry);

    console.log(`Registry saved to: ${outputPath}`);
    console.log(`Total commands: ${registry.tools.commands.length}`);
    console.log(
      `Available configs: ${registry.tools.availableConfigs.join(", ")}`,
    );

    return registry;
  }
}
