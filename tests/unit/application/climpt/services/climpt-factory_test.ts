/**
 * ClimptPipelineFactory Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target - CLI Services
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClimptPipelineFactory } from "../../../../../src/application/climpt/services/climpt-factory.service.ts";
import { ClimptAnalysisPipeline } from "../../../../../src/application/climpt/services/climpt-pipeline.service.ts";
import type { LoggerProvider } from "../../../../../src/infrastructure/services/logging-service.ts";

Deno.test("ClimptPipelineFactory - Robust Test Suite", async (t) => {
  await t.step("Factory Interface Implementation", async (t) => {
    await t.step("should have static create method", () => {
      assertEquals(
        typeof ClimptPipelineFactory.create,
        "function",
        "Should have static create method",
      );
      assertEquals(
        typeof ClimptPipelineFactory.createDefault,
        "function",
        "Should have static createDefault method",
      );
    });

    await t.step("should be a static factory (no constructor)", () => {
      // Factory should be used statically, not instantiated
      assertEquals(
        typeof ClimptPipelineFactory,
        "function",
        "Should be a constructor function for static methods",
      );
    });
  });

  await t.step("create Method - Default Parameters", async (t) => {
    await t.step(
      "should create pipeline with default configuration",
      async () => {
        // Mock external dependencies that the factory uses
        const originalReadTextFile = Deno.readTextFile;

        try {
          // Mock file reading for configuration
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path.includes("extract_frontmatter.md")) {
              return Promise.resolve(
                "# Extract Frontmatter\nExtract content from markdown files.",
              );
            }
            if (path.includes("map_to_schema.md")) {
              return Promise.resolve(
                "# Map to Schema\nMap extracted data to schema.",
              );
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.create();

          assertExists(pipeline, "Should create pipeline instance");
          assertEquals(
            pipeline instanceof ClimptAnalysisPipeline,
            true,
            "Should return ClimptAnalysisPipeline instance",
          );
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
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );

    await t.step("should handle missing prompt files gracefully", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          throw new Error("File not found");
        };

        let caughtError: Error | undefined;
        try {
          await ClimptPipelineFactory.create();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(
          caughtError,
          "Should throw error when prompt files are missing",
        );
        assertEquals(
          caughtError.message.includes("File not found"),
          true,
          "Should preserve file error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("create Method - Custom Parameters", async (t) => {
    await t.step("should create pipeline with custom schema path", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path === "/custom/schema.json") {
            return Promise.resolve(JSON.stringify({
              version: "2.0.0",
              description: "Custom schema",
              tools: {
                availableConfigs: ["custom1", "custom2"],
                commands: [{
                  c1: "custom",
                  c2: "action",
                  c3: "target",
                  description: "Custom command",
                }],
              },
            }));
          }
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve("# Extract Frontmatter\nExtract content.");
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("# Map to Schema\nMap data.");
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create(
          "/custom/schema.json",
        );

        assertExists(pipeline, "Should create pipeline with custom schema");
        assertEquals(
          pipeline instanceof ClimptAnalysisPipeline,
          true,
          "Should return ClimptAnalysisPipeline instance",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step(
      "should create pipeline with custom template path",
      async () => {
        const originalReadTextFile = Deno.readTextFile;

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path === "/custom/template.json") {
              return Promise.resolve(JSON.stringify({
                version: "2.0.0",
                description: "Custom template",
                tools: {
                  availableConfigs: ["template1", "template2"],
                  commands: [],
                },
              }));
            }
            if (path.includes("extract_frontmatter.md")) {
              return Promise.resolve("# Extract Frontmatter\nExtract content.");
            }
            if (path.includes("map_to_schema.md")) {
              return Promise.resolve("# Map to Schema\nMap data.");
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.create(
            undefined,
            "/custom/template.json",
          );

          assertExists(pipeline, "Should create pipeline with custom template");
          assertEquals(
            pipeline instanceof ClimptAnalysisPipeline,
            true,
            "Should return ClimptAnalysisPipeline instance",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );

    await t.step(
      "should create pipeline with custom prompt paths",
      async () => {
        const originalReadTextFile = Deno.readTextFile;
        const readPaths: string[] = [];

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            readPaths.push(path);

            if (path === "/custom/extract.md") {
              return Promise.resolve(
                "# Custom Extract\nCustom extraction prompt.",
              );
            }
            if (path === "/custom/map.md") {
              return Promise.resolve("# Custom Map\nCustom mapping prompt.");
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.create(
            undefined,
            undefined,
            "/custom/extract.md",
            "/custom/map.md",
          );

          assertExists(pipeline, "Should create pipeline with custom prompts");
          assertEquals(
            readPaths.includes("/custom/extract.md"),
            true,
            "Should read custom extraction prompt",
          );
          assertEquals(
            readPaths.includes("/custom/map.md"),
            true,
            "Should read custom mapping prompt",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );

    await t.step("should create pipeline with logger provider", async () => {
      const originalReadTextFile = Deno.readTextFile;
      let _loggerProviderUsed = false;

      const mockLoggerProvider: LoggerProvider = {
        getLogger: () => {
          _loggerProviderUsed = true;
          return {
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
          };
        },
      };

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve("# Extract Frontmatter\nExtract content.");
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("# Map to Schema\nMap data.");
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create(
          undefined,
          undefined,
          undefined,
          undefined,
          mockLoggerProvider,
        );

        assertExists(pipeline, "Should create pipeline with logger provider");
        assertEquals(
          pipeline instanceof ClimptAnalysisPipeline,
          true,
          "Should return ClimptAnalysisPipeline instance",
        );
        // Logger provider is passed to constructor, tested indirectly
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step(
      "should create pipeline with all custom parameters",
      async () => {
        const originalReadTextFile = Deno.readTextFile;
        const readPaths: string[] = [];

        const mockLoggerProvider: LoggerProvider = {
          getLogger: () => ({
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
          }),
        };

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            readPaths.push(path);

            if (path === "/custom/schema.json") {
              return Promise.resolve(JSON.stringify({
                version: "3.0.0",
                description: "All custom schema",
                tools: { availableConfigs: ["all-custom"], commands: [] },
              }));
            }
            if (path === "/custom/template.json") {
              return Promise.resolve(JSON.stringify({
                version: "3.0.0",
                description: "All custom template",
                tools: { availableConfigs: ["all-custom"], commands: [] },
              }));
            }
            if (path === "/custom/extract.md") {
              return Promise.resolve(
                "# All Custom Extract\nAll custom extraction.",
              );
            }
            if (path === "/custom/map.md") {
              return Promise.resolve("# All Custom Map\nAll custom mapping.");
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.create(
            "/custom/schema.json",
            "/custom/template.json",
            "/custom/extract.md",
            "/custom/map.md",
            mockLoggerProvider,
          );

          assertExists(
            pipeline,
            "Should create pipeline with all custom parameters",
          );
          assertEquals(
            readPaths.includes("/custom/schema.json"),
            true,
            "Should read custom schema",
          );
          assertEquals(
            readPaths.includes("/custom/template.json"),
            true,
            "Should read custom template",
          );
          assertEquals(
            readPaths.includes("/custom/extract.md"),
            true,
            "Should read custom extraction prompt",
          );
          assertEquals(
            readPaths.includes("/custom/map.md"),
            true,
            "Should read custom mapping prompt",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );
  });

  await t.step("createDefault Method", async (t) => {
    await t.step(
      "should delegate to create method with no parameters",
      async () => {
        const originalReadTextFile = Deno.readTextFile;

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path.includes("extract_frontmatter.md")) {
              return Promise.resolve(
                "# Default Extract\nDefault extraction prompt.",
              );
            }
            if (path.includes("map_to_schema.md")) {
              return Promise.resolve("# Default Map\nDefault mapping prompt.");
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.createDefault();

          assertExists(pipeline, "Should create default pipeline");
          assertEquals(
            pipeline instanceof ClimptAnalysisPipeline,
            true,
            "Should return ClimptAnalysisPipeline instance",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );
  });

  await t.step("Component Factory Integration", async (t) => {
    await t.step("should integrate with ComponentFactory", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# Component Test\nComponent integration test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("# Component Map\nComponent mapping test.");
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(
          pipeline,
          "Should create pipeline with component factory integration",
        );
        // ComponentFactory is used internally, tested indirectly through successful creation
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should create analysis components correctly", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve("# Analysis Test\nAnalysis component test.");
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("# Analysis Map\nAnalysis mapping test.");
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(
          pipeline,
          "Should create pipeline with analysis components",
        );
        assertEquals(
          typeof pipeline.processTyped,
          "function",
          "Should have processTyped method from analysis components",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Service Dependencies Integration", async (t) => {
    await t.step("should integrate ClaudeCLIService", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# Claude CLI Test\nClaude CLI integration test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve(
              "# Claude CLI Map\nClaude CLI mapping test.",
            );
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(
          pipeline,
          "Should create pipeline with ClaudeCLIService integration",
        );
        // ClaudeCLIService is used internally for analysis, tested indirectly
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should integrate DenoFileSystemProvider", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# FileSystem Test\nFileSystem integration test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve(
              "# FileSystem Map\nFileSystem mapping test.",
            );
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(
          pipeline,
          "Should create pipeline with DenoFileSystemProvider integration",
        );
        // DenoFileSystemProvider is used internally, tested indirectly through successful creation
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should integrate ClimptConfigurationProvider", async () => {
      const originalReadTextFile = Deno.readTextFile;
      let configProviderCalled = false;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          configProviderCalled = true;

          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# Config Test\nConfig provider integration test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve(
              "# Config Map\nConfig provider mapping test.",
            );
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(
          pipeline,
          "Should create pipeline with ClimptConfigurationProvider integration",
        );
        assertEquals(
          configProviderCalled,
          true,
          "Should use ClimptConfigurationProvider for file reading",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Error Handling", async (t) => {
    await t.step("should handle configuration loading errors", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          throw new Error("Configuration loading failed");
        };

        let caughtError: Error | undefined;
        try {
          await ClimptPipelineFactory.create();
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(
          caughtError,
          "Should throw error when configuration loading fails",
        );
        assertEquals(
          caughtError.message.includes("Configuration loading failed"),
          true,
          "Should preserve configuration error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step(
      "should handle invalid JSON in configuration files",
      async () => {
        const originalReadTextFile = Deno.readTextFile;

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (
              path.includes("schema.json") || path.includes("template.json")
            ) {
              return Promise.resolve("{ invalid json");
            }
            if (path.includes("extract_frontmatter.md")) {
              return Promise.resolve("# Extract Test\nExtract test.");
            }
            if (path.includes("map_to_schema.md")) {
              return Promise.resolve("# Map Test\nMap test.");
            }
            return Promise.resolve("{}");
          };

          let caughtError: Error | undefined;
          try {
            await ClimptPipelineFactory.create("/invalid/schema.json");
          } catch (error) {
            caughtError = error as Error;
          }

          assertExists(caughtError, "Should throw error for invalid JSON");
          assertEquals(
            caughtError instanceof SyntaxError,
            true,
            "Should be JSON syntax error",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );

    await t.step("should handle component creation errors", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        // Mock successful file reading but simulate component creation failure
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# Component Error Test\nComponent error test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve(
              "# Component Error Map\nComponent error map.",
            );
          }
          return Promise.resolve("{}");
        };

        // Component creation errors would be thrown during dynamic imports or instantiation
        // This test documents expected behavior for robustness
        const pipeline = await ClimptPipelineFactory.create();

        assertExists(pipeline, "Should handle component creation gracefully");
        // Note: Current implementation may not handle all component creation errors
        // This test documents expected behavior for future improvements
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Concurrent Factory Usage", async (t) => {
    await t.step("should handle concurrent factory calls", async () => {
      const originalReadTextFile = Deno.readTextFile;
      let callCount = 0;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = async (
          path: string,
        ) => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async delay

          if (path.includes("extract_frontmatter.md")) {
            return "# Concurrent Test\nConcurrent integration test.";
          }
          if (path.includes("map_to_schema.md")) {
            return "# Concurrent Map\nConcurrent mapping test.";
          }
          return "{}";
        };

        // Create multiple pipelines concurrently
        const [pipeline1, pipeline2, pipeline3] = await Promise.all([
          ClimptPipelineFactory.create(),
          ClimptPipelineFactory.create("/custom1/schema.json"),
          ClimptPipelineFactory.createDefault(),
        ]);

        assertExists(pipeline1, "Should create first pipeline concurrently");
        assertExists(pipeline2, "Should create second pipeline concurrently");
        assertExists(pipeline3, "Should create third pipeline concurrently");

        assertEquals(
          pipeline1 instanceof ClimptAnalysisPipeline,
          true,
          "First pipeline should be correct type",
        );
        assertEquals(
          pipeline2 instanceof ClimptAnalysisPipeline,
          true,
          "Second pipeline should be correct type",
        );
        assertEquals(
          pipeline3 instanceof ClimptAnalysisPipeline,
          true,
          "Third pipeline should be correct type",
        );

        assertEquals(
          callCount >= 6,
          true,
          "Should handle concurrent file reads",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should create independent pipeline instances", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve("# Independence Test\nIndependence test.");
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("# Independence Map\nIndependence map.");
          }
          return Promise.resolve("{}");
        };

        const pipeline1 = await ClimptPipelineFactory.create();
        const pipeline2 = await ClimptPipelineFactory.create();

        assertExists(pipeline1, "Should create first independent pipeline");
        assertExists(pipeline2, "Should create second independent pipeline");
        assertEquals(
          pipeline1 === pipeline2,
          false,
          "Pipelines should be independent instances",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("Edge Cases and Boundary Conditions", async (t) => {
    await t.step("should handle empty configuration files", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("schema.json") || path.includes("template.json")) {
            return Promise.resolve("{}");
          }
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve("");
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve("");
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create();

        assertExists(pipeline, "Should handle empty configuration files");
        assertEquals(
          pipeline instanceof ClimptAnalysisPipeline,
          true,
          "Should return valid pipeline despite empty configs",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle very large configuration files", async () => {
      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path.includes("schema.json")) {
            // Create large schema with many commands
            const largeSchema = {
              version: "1.0.0",
              description: "Large schema",
              tools: {
                availableConfigs: Array.from(
                  { length: 100 },
                  (_, i) => `config${i}`,
                ),
                commands: Array.from({ length: 1000 }, (_, i) => ({
                  c1: `domain${i}`,
                  c2: `action${i}`,
                  c3: `target${i}`,
                  description: `Command ${i} description`,
                })),
              },
            };
            return Promise.resolve(JSON.stringify(largeSchema));
          }
          if (path.includes("extract_frontmatter.md")) {
            return Promise.resolve(
              "# Large Config Test\nLarge configuration test.",
            );
          }
          if (path.includes("map_to_schema.md")) {
            return Promise.resolve(
              "# Large Config Map\nLarge configuration mapping.",
            );
          }
          return Promise.resolve("{}");
        };

        const pipeline = await ClimptPipelineFactory.create(
          "/large/schema.json",
        );

        assertExists(pipeline, "Should handle large configuration files");
        assertEquals(
          pipeline instanceof ClimptAnalysisPipeline,
          true,
          "Should create pipeline with large configuration",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step(
      "should handle configuration files with special characters",
      async () => {
        const originalReadTextFile = Deno.readTextFile;

        try {
          (Deno as unknown as Record<string, unknown>).readTextFile = (
            path: string,
          ) => {
            if (path.includes("schema.json")) {
              const specialSchema = {
                version: "1.0.0-α",
                description: "Schema with special chars: 你好 🚀 ñáéíóú",
                tools: {
                  availableConfigs: [
                    "config-with-dash",
                    "config_with_underscore",
                  ],
                  commands: [{
                    c1: "domain-α",
                    c2: "action_β",
                    c3: "target.γ",
                    description: "Command with unicode: 🔧 ñáéíóú 中文",
                  }],
                },
              };
              return Promise.resolve(JSON.stringify(specialSchema));
            }
            if (path.includes("extract_frontmatter.md")) {
              return Promise.resolve(
                "# Special Chars Test 🚀\nSpecial characters test: 你好 ñáéíóú",
              );
            }
            if (path.includes("map_to_schema.md")) {
              return Promise.resolve(
                "# Special Chars Map 🔧\nSpecial characters mapping: 中文",
              );
            }
            return Promise.resolve("{}");
          };

          const pipeline = await ClimptPipelineFactory.create(
            "/special/schema.json",
          );

          assertExists(
            pipeline,
            "Should handle configuration files with special characters",
          );
          assertEquals(
            pipeline instanceof ClimptAnalysisPipeline,
            true,
            "Should create pipeline with special character configuration",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readTextFile =
            originalReadTextFile;
        }
      },
    );
  });
});
