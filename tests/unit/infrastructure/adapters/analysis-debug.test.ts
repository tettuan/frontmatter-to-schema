import { assert } from "jsr:@std/assert";
import { ConfigurationLoader } from "../../../../src/infrastructure/adapters/configuration-loader.ts";
import { ConfigPath } from "../../../../src/domain/models/value-objects.ts";
import { join } from "jsr:@std/path";

Deno.test("Debug Analysis Config", async () => {
  const testDir = await Deno.makeTempDir();
  const loader = new ConfigurationLoader();

  const configPath = join(testDir, "analysis-config.json");
  const config = {
    promptsPath: "./prompts",
    extractionPrompt: "Extract data from frontmatter",
    mappingPrompt: "Map data to template",
    aiProvider: "claude",
    aiConfig: {
      apiKey: "test-api-key",
      model: "claude-3-sonnet",
      maxTokens: 8000,
      temperature: 0.3,
    },
  };

  await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));

  const pathResult = ConfigPath.create(configPath);
  assert(pathResult.ok);

  const result = await loader.loadAnalysisConfig(pathResult.data);
  console.log("Analysis config result:", result);

  if (result.ok) {
    console.log("prompts path:", result.data.promptsPath?.getValue());
  } else {
    console.log("Error:", result.error);
  }

  await Deno.remove(testDir, { recursive: true });
});
