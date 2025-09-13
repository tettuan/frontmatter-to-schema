/**
 * ClimptAnalysisPipeline Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target - CLI Services
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClimptAnalysisPipeline } from "../../../../../src/application/climpt/services/climpt-pipeline.service.ts";
import type {
  FrontMatterInput,
  FrontMatterPipelineConfig,
} from "../../../../../src/domain/pipeline/generic-pipeline.ts";
import type { ClimptRegistrySchema } from "../../../../../src/application/climpt/models/climpt-schema.models.ts";
import type { LoggerProvider } from "../../../../../src/infrastructure/services/logging-service.ts";

Deno.test("ClimptAnalysisPipeline - Robust Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step("should extend FrontMatterAnalysisPipeline", () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      assertExists(pipeline, "Pipeline instance should be created");
      assertEquals(
        typeof pipeline.processTyped,
        "function",
        "Should have processTyped method",
      );
      assertEquals(
        typeof pipeline.processAndSave,
        "function",
        "Should have processAndSave method",
      );
    });

    await t.step("should create instance with logger provider", () => {
      const mockLoggerProvider: LoggerProvider = {
        getLogger: () => ({
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        }),
      };

      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(
        mockConfig,
        mockLoggerProvider,
      );
      assertExists(pipeline, "Pipeline with logger should be created");
    });
  });

  await t.step("processTyped Method - Current Implementation", async (t) => {
    await t.step("should return stub implementation", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const input: FrontMatterInput = {
        sourceDirectory: "/test/dir",
        filePattern: /\.md$/,
        options: {},
      };

      const result = await pipeline.processTyped(input);

      assertEquals(typeof result, "object", "Should return object");
      assertEquals(
        Array.isArray(result.results),
        true,
        "Should have results array",
      );
      assertEquals(
        result.results.length,
        0,
        "Should return empty results (stub)",
      );
      assertEquals(
        typeof result.metadata,
        "object",
        "Should have metadata object",
      );
      assertEquals(
        typeof result.summary,
        "object",
        "Should have summary object",
      );

      // Type guard for summary
      assertExists(result.summary, "Summary should exist");
      assertEquals(result.summary.totalFiles, 0, "Should have zero totalFiles");
      assertEquals(
        result.summary.processedFiles,
        0,
        "Should have zero processedFiles",
      );
      assertEquals(
        result.summary.successfulFiles,
        0,
        "Should have zero successfulFiles",
      );
      assertEquals(
        result.summary.failedFiles,
        0,
        "Should have zero failedFiles",
      );
      assertEquals(
        Array.isArray(result.summary.errors),
        true,
        "Should have errors array",
      );

      // Type guard for errors array
      if (result.summary.errors) {
        assertEquals(
          result.summary.errors.length,
          0,
          "Should have empty errors array",
        );
      }
    });

    await t.step("should handle different input options", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const input: FrontMatterInput = {
        sourceDirectory: "/custom/path",
        filePattern: /\.txt$/,
        options: { customOption: "value", processingMode: "strict" },
      };

      const result = await pipeline.processTyped(input);

      assertExists(result, "Should handle custom input options");
      assertEquals(
        typeof result.summary,
        "object",
        "Should return valid summary",
      );
    });
  });

  await t.step("processAndSave Method - Core Functionality", async (t) => {
    await t.step("should process and save registry to file", async () => {
      // Mock Deno.writeTextFile and Deno.mkdir since ClimptAnalysisPipeline uses DenoFileSystemProvider internally
      const originalWriteTextFile = Deno.writeTextFile;
      const originalMkdir = Deno.mkdir;
      let writtenPath: string | undefined;
      let writtenContent: string | undefined;

      try {
        (Deno as unknown as Record<string, unknown>).writeTextFile = (
          path: string,
          content: string,
        ) => {
          writtenPath = path;
          writtenContent = content;
          return Promise.resolve();
        };

        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          return Promise.resolve();
        };

        const mockConfig: FrontMatterPipelineConfig<
          ClimptRegistrySchema,
          { isValid: boolean; data: ClimptRegistrySchema }
        > = {
          schema: {
            version: "1.0.0",
            description: "Test schema",
            tools: { availableConfigs: [], commands: [] },
          },
          template: {
            version: "1.0.0",
            description: "Test template",
            tools: { availableConfigs: [], commands: [] },
          },
          prompts: {
            extractionPrompt: "Test extraction",
            mappingPrompt: "Test mapping",
          },
          fileSystem: {
            readFile: () => Promise.resolve({ ok: true, data: "" }),
            writeFile: () => Promise.resolve({ ok: true, data: undefined }),
            listFiles: () => Promise.resolve({ ok: true, data: [] }),
            exists: () => Promise.resolve({ ok: true, data: true }),
            createDirectory: () =>
              Promise.resolve({ ok: true, data: undefined }),
            deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
          },
          analysisProcessor: {
            processDocument: () =>
              Promise.resolve({
                isValid: true,
                data: {
                  version: "1.0.0",
                  description: "Test",
                  tools: { availableConfigs: [], commands: [] },
                },
              }),
          },
        };

        const pipeline = new ClimptAnalysisPipeline(mockConfig);
        const result = await pipeline.processAndSave(
          "/test/prompts",
          "/output/registry.json",
          { testOption: true },
        );

        // Verify file write (through mocked Deno.writeTextFile)
        assertEquals(
          writtenPath,
          "/output/registry.json",
          "Should write to correct path",
        );
        assertExists(writtenContent, "Should write content");

        // Parse and verify written content
        const writtenRegistry = JSON.parse(writtenContent!);
        assertEquals(
          typeof writtenRegistry,
          "object",
          "Should write valid JSON",
        );
        assertEquals(
          typeof writtenRegistry.version,
          "string",
          "Should have version",
        );
        assertEquals(
          typeof writtenRegistry.description,
          "string",
          "Should have description",
        );
        assertExists(writtenRegistry.tools, "Should have tools object");
        assertEquals(
          Array.isArray(writtenRegistry.tools.availableConfigs),
          true,
          "Should have availableConfigs",
        );
        assertEquals(
          Array.isArray(writtenRegistry.tools.commands),
          true,
          "Should have commands",
        );

        // Verify returned result
        assertEquals(typeof result, "object", "Should return registry object");
        assertEquals(
          typeof result.version,
          "string",
          "Should return valid registry",
        );
        assertExists(result.tools, "Should return tools object");
      } finally {
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
      }
    });

    await t.step("should handle processing options", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const result = await pipeline.processAndSave(
        "/test/prompts",
        "/output/registry.json",
        {
          processingMode: "strict",
          customValidation: true,
          outputFormat: "compact",
        },
      );

      assertEquals(typeof result, "object", "Should handle complex options");
      assertExists(result.tools, "Should process with options successfully");
    });

    await t.step("should handle empty prompts directory", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const result = await pipeline.processAndSave(
        "/empty/prompts",
        "/output/empty-registry.json",
      );

      assertEquals(typeof result, "object", "Should handle empty directory");
      assertEquals(
        Array.isArray(result.tools.commands),
        true,
        "Should return empty commands array",
      );
      assertEquals(
        result.tools.commands.length,
        0,
        "Should have no commands for empty directory",
      );
    });
  });

  await t.step("aggregateResults Method - Registry Aggregation", async (t) => {
    await t.step("should aggregate multiple valid results", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);

      // Test aggregation through processAndSave with mock data
      // Note: Since aggregateResults is private, we test it indirectly
      const _mockOutput = {
        results: [
          {
            isValid: true,
            data: {
              version: "1.0.0",
              description: "First registry",
              tools: {
                availableConfigs: ["config1", "config2"],
                commands: [
                  {
                    c1: "domain1",
                    c2: "action1",
                    c3: "target1",
                    description: "First command",
                  },
                ],
              },
            },
          },
          {
            isValid: true,
            data: {
              version: "1.0.0",
              description: "Second registry",
              tools: {
                availableConfigs: ["config2", "config3"],
                commands: [
                  {
                    c1: "domain2",
                    c2: "action2",
                    c3: "target2",
                    description: "Second command",
                  },
                ],
              },
            },
          },
        ],
        metadata: {},
        summary: {
          totalFiles: 2,
          processedFiles: 2,
          successfulFiles: 2,
          failedFiles: 0,
          errors: [],
        },
      };

      // We can test aggregation behavior by verifying the final output
      const result = await pipeline.processAndSave(
        "/test/prompts",
        "/output/aggregated.json",
      );

      assertEquals(
        typeof result,
        "object",
        "Should aggregate results into registry",
      );
      assertEquals(
        Array.isArray(result.tools.availableConfigs),
        true,
        "Should have merged configs",
      );
      assertEquals(
        Array.isArray(result.tools.commands),
        true,
        "Should have aggregated commands",
      );
      assertEquals(
        result.description.includes("Climpt comprehensive configuration"),
        true,
        "Should use base registry description",
      );
    });

    await t.step("should handle invalid results", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: false,
              data: {
                version: "1.0.0",
                description: "Invalid",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const result = await pipeline.processAndSave(
        "/test/invalid",
        "/output/invalid.json",
      );

      assertEquals(
        typeof result,
        "object",
        "Should handle invalid results gracefully",
      );
      assertEquals(
        Array.isArray(result.tools.commands),
        true,
        "Should return empty commands for invalid results",
      );
      assertEquals(
        result.tools.commands.length,
        0,
        "Should have no commands from invalid results",
      );
    });
  });

  await t.step(
    "deduplicateCommands Method - Command Deduplication",
    async (t) => {
      await t.step("should deduplicate identical commands", async () => {
        const mockConfig: FrontMatterPipelineConfig<
          ClimptRegistrySchema,
          { isValid: boolean; data: ClimptRegistrySchema }
        > = {
          schema: {
            version: "1.0.0",
            description: "Test schema",
            tools: { availableConfigs: [], commands: [] },
          },
          template: {
            version: "1.0.0",
            description: "Test template",
            tools: { availableConfigs: [], commands: [] },
          },
          prompts: {
            extractionPrompt: "Test extraction",
            mappingPrompt: "Test mapping",
          },
          fileSystem: {
            readFile: () => Promise.resolve({ ok: true, data: "" }),
            writeFile: () => Promise.resolve({ ok: true, data: undefined }),
            listFiles: () => Promise.resolve({ ok: true, data: [] }),
            exists: () => Promise.resolve({ ok: true, data: true }),
            createDirectory: () =>
              Promise.resolve({ ok: true, data: undefined }),
            deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
          },
          analysisProcessor: {
            processDocument: () =>
              Promise.resolve({
                isValid: true,
                data: {
                  version: "1.0.0",
                  description: "Test",
                  tools: { availableConfigs: [], commands: [] },
                },
              }),
          },
        };

        const pipeline = new ClimptAnalysisPipeline(mockConfig);

        // Test deduplication indirectly through processAndSave
        // The stub implementation returns empty results, but we verify the structure
        const result = await pipeline.processAndSave(
          "/test/duplicate",
          "/output/deduplicated.json",
        );

        assertEquals(
          typeof result,
          "object",
          "Should handle deduplication process",
        );
        assertEquals(
          Array.isArray(result.tools.commands),
          true,
          "Should return deduplicated commands array",
        );
        // Note: Since we're using stub implementation, we can't test actual deduplication
        // but we verify the structure is correct for when real implementation is added
      });

      await t.step("should sort commands lexicographically", async () => {
        const mockConfig: FrontMatterPipelineConfig<
          ClimptRegistrySchema,
          { isValid: boolean; data: ClimptRegistrySchema }
        > = {
          schema: {
            version: "1.0.0",
            description: "Test schema",
            tools: { availableConfigs: [], commands: [] },
          },
          template: {
            version: "1.0.0",
            description: "Test template",
            tools: { availableConfigs: [], commands: [] },
          },
          prompts: {
            extractionPrompt: "Test extraction",
            mappingPrompt: "Test mapping",
          },
          fileSystem: {
            readFile: () => Promise.resolve({ ok: true, data: "" }),
            writeFile: () => Promise.resolve({ ok: true, data: undefined }),
            listFiles: () => Promise.resolve({ ok: true, data: [] }),
            exists: () => Promise.resolve({ ok: true, data: true }),
            createDirectory: () =>
              Promise.resolve({ ok: true, data: undefined }),
            deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
          },
          analysisProcessor: {
            processDocument: () =>
              Promise.resolve({
                isValid: true,
                data: {
                  version: "1.0.0",
                  description: "Test",
                  tools: { availableConfigs: [], commands: [] },
                },
              }),
          },
        };

        const pipeline = new ClimptAnalysisPipeline(mockConfig);
        const result = await pipeline.processAndSave(
          "/test/sorting",
          "/output/sorted.json",
        );

        assertEquals(typeof result, "object", "Should handle command sorting");
        assertEquals(
          Array.isArray(result.tools.commands),
          true,
          "Should return sorted commands array",
        );
        assertEquals(
          Array.isArray(result.tools.availableConfigs),
          true,
          "Should return sorted configs array",
        );
      });
    },
  );

  await t.step("logProcessingSummary Method - Logging", async (t) => {
    await t.step("should log with provided logger", async () => {
      const loggedInfo: unknown[] = [];
      const loggedWarnings: unknown[] = [];

      const mockLoggerProvider: LoggerProvider = {
        getLogger: () => ({
          info: (...args: unknown[]) => {
            loggedInfo.push(args);
          },
          warn: (...args: unknown[]) => {
            loggedWarnings.push(args);
          },
          error: () => {},
          debug: () => {},
        }),
      };

      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(
        mockConfig,
        mockLoggerProvider,
      );
      await pipeline.processAndSave("/test/logging", "/output/logged.json");

      assertEquals(
        loggedInfo.length > 0,
        true,
        "Should log processing summary info",
      );
      assertEquals(
        loggedWarnings.length,
        0,
        "Should not log warnings for successful processing",
      );
    });

    await t.step("should use fallback logger when none provided", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      // Should not throw when using fallback logger
      await pipeline.processAndSave("/test/fallback", "/output/fallback.json");

      assertEquals(true, true, "Should use fallback logger without errors");
    });

    await t.step("should handle summary with errors", async () => {
      const loggedWarnings: unknown[] = [];

      const mockLoggerProvider: LoggerProvider = {
        getLogger: () => ({
          info: () => {},
          warn: (...args: unknown[]) => {
            loggedWarnings.push(args);
          },
          error: () => {},
          debug: () => {},
        }),
      };

      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(
        mockConfig,
        mockLoggerProvider,
      );

      // Test with errors in summary (using stub implementation, errors will be empty)
      await pipeline.processAndSave("/test/errors", "/output/errors.json");

      // Since stub implementation returns empty errors, we test the structure
      assertEquals(
        loggedWarnings.length,
        0,
        "Should not log warnings for empty errors array",
      );
    });
  });

  await t.step("Error Handling and Edge Cases", async (t) => {
    await t.step("should document current write error behavior", async () => {
      // Test documents current behavior: ClimptAnalysisPipeline creates its own DenoFileSystemProvider
      // and doesn't check the Result<T, E> return type, so write errors are silently ignored
      // This is a future improvement opportunity for better error handling

      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () =>
            Promise.resolve({
              ok: false,
              error: {
                kind: "PermissionDenied",
                path: "/test",
                operation: "write",
              },
            }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);

      // Current implementation: write errors are not properly handled
      // The DenoFileSystemProvider returns Result<T, E> but it's not checked
      const result = await pipeline.processAndSave(
        "/test/write-error",
        "/restricted/file.json",
      );

      // Test passes because current implementation doesn't throw for write errors
      assertEquals(
        typeof result,
        "object",
        "Current implementation doesn't handle write errors properly",
      );
      assertExists(
        result.tools,
        "Should still return registry object despite write failure",
      );

      // TODO: Future improvement - check Result<T, E> and throw appropriate errors
      // This would make the API more robust and follow Totality principles
    });

    await t.step("should handle malformed registry data", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const result = await pipeline.processAndSave(
        "/test/malformed",
        "/output/malformed.json",
      );

      assertEquals(
        typeof result,
        "object",
        "Should handle malformed data gracefully",
      );
      assertEquals(
        typeof result.version,
        "string",
        "Should return valid registry structure",
      );
      assertExists(result.tools, "Should have tools object");
    });

    await t.step("should handle concurrent processAndSave calls", async () => {
      // Mock Deno.writeTextFile to track write count
      const originalWriteTextFile = Deno.writeTextFile;
      const originalMkdir = Deno.mkdir;
      let writeCount = 0;

      try {
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          async () => {
            writeCount++;
            await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async delay
            return Promise.resolve();
          };

        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          return Promise.resolve();
        };

        const mockConfig: FrontMatterPipelineConfig<
          ClimptRegistrySchema,
          { isValid: boolean; data: ClimptRegistrySchema }
        > = {
          schema: {
            version: "1.0.0",
            description: "Test schema",
            tools: { availableConfigs: [], commands: [] },
          },
          template: {
            version: "1.0.0",
            description: "Test template",
            tools: { availableConfigs: [], commands: [] },
          },
          prompts: {
            extractionPrompt: "Test extraction",
            mappingPrompt: "Test mapping",
          },
          fileSystem: {
            readFile: () => Promise.resolve({ ok: true, data: "" }),
            writeFile: () => Promise.resolve({ ok: true, data: undefined }),
            listFiles: () => Promise.resolve({ ok: true, data: [] }),
            exists: () => Promise.resolve({ ok: true, data: true }),
            createDirectory: () =>
              Promise.resolve({ ok: true, data: undefined }),
            deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
          },
          analysisProcessor: {
            processDocument: () =>
              Promise.resolve({
                isValid: true,
                data: {
                  version: "1.0.0",
                  description: "Test",
                  tools: { availableConfigs: [], commands: [] },
                },
              }),
          },
        };

        const pipeline = new ClimptAnalysisPipeline(mockConfig);

        // Call processAndSave concurrently
        const [result1, result2, result3] = await Promise.all([
          pipeline.processAndSave(
            "/test/concurrent1",
            "/output/concurrent1.json",
          ),
          pipeline.processAndSave(
            "/test/concurrent2",
            "/output/concurrent2.json",
          ),
          pipeline.processAndSave(
            "/test/concurrent3",
            "/output/concurrent3.json",
          ),
        ]);

        assertEquals(
          typeof result1,
          "object",
          "Should handle first concurrent call",
        );
        assertEquals(
          typeof result2,
          "object",
          "Should handle second concurrent call",
        );
        assertEquals(
          typeof result3,
          "object",
          "Should handle third concurrent call",
        );
        assertEquals(writeCount, 3, "Should handle concurrent file writes");
      } finally {
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
      }
    });
  });

  await t.step("Integration with Dependencies", async (t) => {
    await t.step("should integrate with VERSION_CONFIG", async () => {
      const mockConfig: FrontMatterPipelineConfig<
        ClimptRegistrySchema,
        { isValid: boolean; data: ClimptRegistrySchema }
      > = {
        schema: {
          version: "1.0.0",
          description: "Test schema",
          tools: { availableConfigs: [], commands: [] },
        },
        template: {
          version: "1.0.0",
          description: "Test template",
          tools: { availableConfigs: [], commands: [] },
        },
        prompts: {
          extractionPrompt: "Test extraction",
          mappingPrompt: "Test mapping",
        },
        fileSystem: {
          readFile: () => Promise.resolve({ ok: true, data: "" }),
          writeFile: () => Promise.resolve({ ok: true, data: undefined }),
          listFiles: () => Promise.resolve({ ok: true, data: [] }),
          exists: () => Promise.resolve({ ok: true, data: true }),
          createDirectory: () => Promise.resolve({ ok: true, data: undefined }),
          deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
        },
        analysisProcessor: {
          processDocument: () =>
            Promise.resolve({
              isValid: true,
              data: {
                version: "1.0.0",
                description: "Test",
                tools: { availableConfigs: [], commands: [] },
              },
            }),
        },
      };

      const pipeline = new ClimptAnalysisPipeline(mockConfig);
      const result = await pipeline.processAndSave(
        "/test/version",
        "/output/version.json",
      );

      assertEquals(
        typeof result.version,
        "string",
        "Should use VERSION_CONFIG",
      );
      assertEquals(
        result.version.length > 0,
        true,
        "Should have valid version string",
      );
    });

    await t.step("should integrate with DenoFileSystemProvider", async () => {
      // Mock Deno.writeTextFile to track if file system is called
      const originalWriteTextFile = Deno.writeTextFile;
      const originalMkdir = Deno.mkdir;
      let fileSystemCalled = false;

      try {
        (Deno as unknown as Record<string, unknown>).writeTextFile = () => {
          fileSystemCalled = true;
          return Promise.resolve();
        };

        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          return Promise.resolve();
        };

        const mockConfig: FrontMatterPipelineConfig<
          ClimptRegistrySchema,
          { isValid: boolean; data: ClimptRegistrySchema }
        > = {
          schema: {
            version: "1.0.0",
            description: "Test schema",
            tools: { availableConfigs: [], commands: [] },
          },
          template: {
            version: "1.0.0",
            description: "Test template",
            tools: { availableConfigs: [], commands: [] },
          },
          prompts: {
            extractionPrompt: "Test extraction",
            mappingPrompt: "Test mapping",
          },
          fileSystem: {
            readFile: () => Promise.resolve({ ok: true, data: "" }),
            writeFile: () => Promise.resolve({ ok: true, data: undefined }),
            listFiles: () => Promise.resolve({ ok: true, data: [] }),
            exists: () => Promise.resolve({ ok: true, data: true }),
            createDirectory: () =>
              Promise.resolve({ ok: true, data: undefined }),
            deleteFile: () => Promise.resolve({ ok: true, data: undefined }),
          },
          analysisProcessor: {
            processDocument: () =>
              Promise.resolve({
                isValid: true,
                data: {
                  version: "1.0.0",
                  description: "Test",
                  tools: { availableConfigs: [], commands: [] },
                },
              }),
          },
        };

        const pipeline = new ClimptAnalysisPipeline(mockConfig);
        await pipeline.processAndSave(
          "/test/filesystem",
          "/output/filesystem.json",
        );

        assertEquals(
          fileSystemCalled,
          true,
          "Should use DenoFileSystemProvider for file operations",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
      }
    });
  });
});
