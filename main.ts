import { FileReader } from "./src/infrastructure/filesystem/FileReader.ts";
import { FileWriter } from "./src/infrastructure/filesystem/FileWriter.ts";
import { FrontMatterExtractor } from "./src/domain/frontmatter/Extractor.ts";
import { ClaudeAnalyzer } from "./src/domain/analysis/Analyzer.ts";
import { BuildRegistryUseCase } from "./src/application/usecases/BuildRegistryUseCase.ts";

async function loadPrompt(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

async function main() {
  const PROMPTS_PATH = ".agent/climpt/prompts";
  const OUTPUT_PATH = ".agent/climpt/registry.json";
  const EXTRACT_PROMPT_PATH = "./src/prompts/extract-information.md";
  const MAPPING_PROMPT_PATH = "./src/prompts/map-to-template.md";

  try {
    const fileReader = new FileReader();
    const fileWriter = new FileWriter();
    const extractor = new FrontMatterExtractor();

    const extractPrompt = await loadPrompt(EXTRACT_PROMPT_PATH);
    const mappingPrompt = await loadPrompt(MAPPING_PROMPT_PATH);
    const analyzer = new ClaudeAnalyzer(extractPrompt, mappingPrompt);

    const useCase = new BuildRegistryUseCase(
      fileReader,
      fileWriter,
      extractor,
      analyzer,
    );

    const registry = await useCase.execute(PROMPTS_PATH, OUTPUT_PATH);

    console.log("\n✅ Registry build completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Total commands: ${registry.tools.commands.length}`);
    console.log(
      `   - Available configs: ${registry.tools.availableConfigs.length}`,
    );
    console.log(`   - Output: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("❌ Failed to build registry:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
