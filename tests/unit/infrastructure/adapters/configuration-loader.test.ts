import { assertEquals, assertExists } from "jsr:@std/assert";
import { ConfigurationLoader } from "../../../../src/infrastructure/adapters/configuration-loader.ts";
import {
  ConfigPath,
  OutputPath,
} from "../../../../src/domain/models/value-objects.ts";
import { isError, isOk } from "../../../../src/domain/shared/result.ts";
import { join } from "jsr:@std/path";
import type {
  AggregatedResult,
  AnalysisResult,
} from "../../../../src/domain/models/entities.ts";

Deno.test("ConfigurationLoader - Fixed Tests", async (t) => {
  const loader = new ConfigurationLoader();
  const testDir = await Deno.makeTempDir();

  await t.step("should handle non-existent configuration file", async () => {
    const configPath = join(testDir, "nonexistent.json");

    const pathResult = ConfigPath.create(configPath);
    if (isOk(pathResult)) {
      const result = await loader.loadProcessingConfig(pathResult.data);
      assertEquals(isError(result), true);

      if (isError(result)) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    }
  });

  await t.step("should handle invalid JSON in configuration file", async () => {
    const configPath = join(testDir, "invalid.json");
    await Deno.writeTextFile(configPath, "{ invalid json }");

    const pathResult = ConfigPath.create(configPath);
    if (isOk(pathResult)) {
      const result = await loader.loadProcessingConfig(pathResult.data);
      assertEquals(isError(result), true);

      if (isError(result)) {
        assertEquals(result.error.kind, "ReadError");
      }
    }
  });

  await t.step("should load analysis configuration", async () => {
    const configPath = join(testDir, "analysis_config.json");
    const config = {
      promptsPath: "./prompts",
      extractionPrompt: "Extract frontmatter",
      mappingPrompt: "Map to schema",
      aiProvider: "claude",
      aiConfig: {
        model: "claude-3-sonnet",
        maxTokens: 4000,
        temperature: 0.7,
      },
    };

    await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));

    const pathResult = ConfigPath.create(configPath);
    if (isOk(pathResult)) {
      const result = await loader.loadAnalysisConfig(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const analysisConfig = result.data;
        assertEquals(analysisConfig.aiProvider, "claude");
        assertEquals(analysisConfig.extractionPrompt, "Extract frontmatter");
      }
    }
  });

  await t.step("should load schema from file", async () => {
    const schemaPath = join(testDir, "schema.json");
    const schema = {
      id: "test-schema",
      version: "1.0.0",
      description: "Test schema",
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string" },
      },
      required: ["title"],
    };

    await Deno.writeTextFile(schemaPath, JSON.stringify(schema, null, 2));

    const pathResult = ConfigPath.create(schemaPath);
    if (isOk(pathResult)) {
      const result = await loader.load(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "test-schema");
      }
    }
  });

  await t.step("should append analysis result", async () => {
    const outputPath = join(testDir, "append_output.json");

    const pathResult = OutputPath.create(outputPath);
    if (isOk(pathResult)) {
      // Create a mock analysis result with proper structure
      const mockAnalysisResult = {
        getMappedData: () => ({
          toJSON: () => JSON.stringify({ title: "Test", date: "2024-01-01" }),
        }),
      };

      const result = await loader.append(
        mockAnalysisResult as AnalysisResult,
        pathResult.data,
      );
      assertEquals(isOk(result), true);

      // Verify file was created
      const fileContent = await Deno.readTextFile(outputPath);
      assertEquals(fileContent.includes("Test"), true);
    }
  });

  await t.step("should save aggregated results", async () => {
    const outputPath = join(testDir, "aggregated.json");

    const pathResult = OutputPath.create(outputPath);
    if (isOk(pathResult)) {
      // Create mock aggregated results with toOutput method
      const aggregatedResult = {
        toOutput: () =>
          JSON.stringify({
            results: [
              { documentPath: "doc1.md", frontMatter: { title: "Doc 1" } },
              { documentPath: "doc2.md", frontMatter: { title: "Doc 2" } },
            ],
            summary: {
              totalDocuments: 2,
              successfullyProcessed: 2,
              failedProcessing: 0,
            },
            metadata: {
              aggregatedAt: new Date().toISOString(),
              processingDuration: "100ms",
            },
          }),
      };

      const result = await loader.save(
        aggregatedResult as AggregatedResult,
        pathResult.data,
      );
      assertEquals(isOk(result), true);

      // Verify file was created
      const fileContent = await Deno.readTextFile(outputPath);
      const parsed = JSON.parse(fileContent);
      assertEquals(parsed.summary.totalDocuments, 2);
    }
  });

  await t.step("should handle permission errors when saving", async () => {
    // Try to save to a read-only location
    const outputPath = "/root/protected/output.json";

    const pathResult = OutputPath.create(outputPath);
    if (isOk(pathResult)) {
      const mockResult = {
        toOutput: () => "{}",
      };
      const result = await loader.save(
        mockResult as AggregatedResult,
        pathResult.data,
      );

      if (isError(result)) {
        assertEquals(
          result.error.kind === "PermissionDenied" ||
            result.error.kind === "WriteError",
          true,
        );
      }
    }
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});
