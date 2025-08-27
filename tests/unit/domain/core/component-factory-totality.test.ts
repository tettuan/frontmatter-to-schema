/**
 * Tests for Component Factory with Totality Principles
 */

import { assert, assertEquals } from "jsr:@std/assert";
import {
  AnalysisDomainConfig,
  type ComponentDomain,
  type ComponentFactoryResult,
  createFactoryBuilder,
  PipelineDomainConfig,
  TemplateDomainConfig,
  TotalAnalysisDomainFactory,
  TotalMasterComponentFactory,
} from "../../../../src/domain/core/component-factory-totality.ts";

Deno.test("Component Factory with Totality", async (t) => {
  await t.step("Smart Constructors", async (t) => {
    await t.step("AnalysisDomainConfig validates timeout", () => {
      // Valid timeout
      const valid = AnalysisDomainConfig.create({ timeout: 5000 });
      assert(valid.ok);
      if (valid.ok) {
        assertEquals(valid.data.timeout, 5000);
      }

      // Invalid timeout - too low
      const tooLow = AnalysisDomainConfig.create({ timeout: -1 });
      assert(!tooLow.ok);
      if (!tooLow.ok) {
        assert(tooLow.error.message.includes("Timeout must be between"));
      }

      // Invalid timeout - too high
      const tooHigh = AnalysisDomainConfig.create({ timeout: 700000 });
      assert(!tooHigh.ok);
      if (!tooHigh.ok) {
        assert(tooHigh.error.message.includes("Timeout must be between"));
      }

      // Default timeout
      const defaultConfig = AnalysisDomainConfig.create();
      assert(defaultConfig.ok);
      if (defaultConfig.ok) {
        assertEquals(defaultConfig.data.timeout, 30000);
      }
    });

    await t.step("TemplateDomainConfig validates format", () => {
      // Valid format
      const valid = TemplateDomainConfig.create({ defaultFormat: "yaml" });
      assert(valid.ok);
      if (valid.ok) {
        assertEquals(valid.data.defaultFormat, "yaml");
      }

      // Invalid format
      const invalid = TemplateDomainConfig.create({ defaultFormat: "invalid" });
      assert(!invalid.ok);
      if (!invalid.ok) {
        assert(invalid.error.message.includes("Invalid format"));
        assert(invalid.error.message.includes("json, yaml, xml, toml"));
      }

      // Default values
      const defaultConfig = TemplateDomainConfig.create();
      assert(defaultConfig.ok);
      if (defaultConfig.ok) {
        assertEquals(defaultConfig.data.defaultFormat, "json");
        assertEquals(defaultConfig.data.strictMode, true);
      }
    });

    await t.step("PipelineDomainConfig validates retries", () => {
      // Valid retries
      const valid = PipelineDomainConfig.create({ maxRetries: 5 });
      assert(valid.ok);
      if (valid.ok) {
        assertEquals(valid.data.maxRetries, 5);
      }

      // Invalid retries - too low
      const tooLow = PipelineDomainConfig.create({ maxRetries: -1 });
      assert(!tooLow.ok);
      if (!tooLow.ok) {
        assert(tooLow.error.message.includes("Max retries must be between"));
      }

      // Invalid retries - too high
      const tooHigh = PipelineDomainConfig.create({ maxRetries: 15 });
      assert(!tooHigh.ok);
      if (!tooHigh.ok) {
        assert(tooHigh.error.message.includes("Max retries must be between"));
      }

      // Default values
      const defaultConfig = PipelineDomainConfig.create();
      assert(defaultConfig.ok);
      if (defaultConfig.ok) {
        assertEquals(defaultConfig.data.maxRetries, 3);
        assertEquals(defaultConfig.data.cacheEnabled, false);
      }
    });
  });

  await t.step("Discriminated Union Domains", async (t) => {
    await t.step("Analysis domain type safety", () => {
      const configResult = AnalysisDomainConfig.create();
      assert(configResult.ok);

      if (configResult.ok) {
        const domain: ComponentDomain = {
          kind: "analysis",
          config: configResult.data,
        };

        // Type guard works
        if (domain.kind === "analysis") {
          // TypeScript knows this is AnalysisDomainConfig
          assertEquals(domain.config.timeout, 30000);
        }
      }
    });

    await t.step("Template domain type safety", () => {
      const configResult = TemplateDomainConfig.create();
      assert(configResult.ok);

      if (configResult.ok) {
        const domain: ComponentDomain = {
          kind: "template",
          config: configResult.data,
        };

        // Type guard works
        if (domain.kind === "template") {
          // TypeScript knows this is TemplateDomainConfig
          assertEquals(domain.config.defaultFormat, "json");
        }
      }
    });

    await t.step("Pipeline domain type safety", () => {
      const configResult = PipelineDomainConfig.create();
      assert(configResult.ok);

      if (configResult.ok) {
        const domain: ComponentDomain = {
          kind: "pipeline",
          config: configResult.data,
        };

        // Type guard works
        if (domain.kind === "pipeline") {
          // TypeScript knows this is PipelineDomainConfig
          assertEquals(domain.config.maxRetries, 3);
        }
      }
    });
  });

  await t.step("Factory Result Types", async (t) => {
    await t.step("Component result discriminated union", () => {
      // Mock result for testing type safety
      const analysisResult: ComponentFactoryResult = {
        kind: "analysis",
        components: {
          engine: {} as unknown,
          processor: {} as unknown,
          schemaAnalyzer: {} as unknown,
          templateMapper: {} as unknown,
        },
      } as ComponentFactoryResult;

      // Type guard works
      if (analysisResult.kind === "analysis") {
        assert(analysisResult.components.engine !== undefined);
      }

      const templateResult: ComponentFactoryResult = {
        kind: "template",
        components: {
          formatHandler: {} as unknown,
          placeholderProcessor: {} as unknown,
        },
      } as ComponentFactoryResult;

      // Type guard works
      if (templateResult.kind === "template") {
        assert(templateResult.components.formatHandler !== undefined);
      }
    });
  });

  await t.step("Master Factory", async (t) => {
    await t.step("Prevents duplicate registration", () => {
      const master = new TotalMasterComponentFactory();

      const configResult = AnalysisDomainConfig.create();
      assert(configResult.ok);

      if (configResult.ok) {
        const factory1 = new TotalAnalysisDomainFactory(configResult.data);
        const factory2 = new TotalAnalysisDomainFactory(configResult.data);

        const result1 = master.registerFactory(factory1);
        assert(result1.ok);

        const result2 = master.registerFactory(factory2);
        assert(!result2.ok);
        if (!result2.ok) {
          assert(result2.error.message.includes("already registered"));
        }
      }
    });

    await t.step("Returns error for unregistered domain", async () => {
      const master = new TotalMasterComponentFactory();

      const configResult = AnalysisDomainConfig.create();
      assert(configResult.ok);

      if (configResult.ok) {
        const domain: ComponentDomain = {
          kind: "analysis",
          config: configResult.data,
        };

        const result = await master.createComponents(domain);
        assert(!result.ok);
        if (!result.ok) {
          assert(result.error.message.includes("No factory registered"));
        }
      }
    });
  });

  await t.step("Factory Builder", async (t) => {
    await t.step("Builds with all domains", () => {
      const builderResult = createFactoryBuilder()
        .withAnalysisDomain({ timeout: 5000 });

      assert(builderResult.ok);
      if (builderResult.ok) {
        const withTemplate = builderResult.data
          .withTemplateDomain({ defaultFormat: "yaml" });

        assert(withTemplate.ok);
        if (withTemplate.ok) {
          const withPipeline = withTemplate.data
            .withPipelineDomain({ maxRetries: 5 });

          assert(withPipeline.ok);
          if (withPipeline.ok) {
            const buildResult = withPipeline.data.build();
            assert(buildResult.ok);
          }
        }
      }
    });

    await t.step("Propagates validation errors", () => {
      const builderResult = createFactoryBuilder()
        .withAnalysisDomain({ timeout: -1 });

      assert(!builderResult.ok);
      if (!builderResult.ok) {
        assert(builderResult.error.message.includes("Timeout must be between"));
      }
    });

    await t.step("Prevents duplicate domains in builder", () => {
      const builder1 = createFactoryBuilder()
        .withAnalysisDomain();

      assert(builder1.ok);
      if (builder1.ok) {
        // Try to add analysis domain again
        const builder2 = builder1.data.withAnalysisDomain();
        assert(!builder2.ok);
        if (!builder2.ok) {
          assert(builder2.error.message.includes("already registered"));
        }
      }
    });
  });

  await t.step("Result Type Safety", async (t) => {
    await t.step("All operations return Result types", () => {
      // Config creation
      const config1 = AnalysisDomainConfig.create();
      assert("ok" in config1);
      assert(config1.ok === true || config1.ok === false);

      const config2 = TemplateDomainConfig.create();
      assert("ok" in config2);

      const config3 = PipelineDomainConfig.create();
      assert("ok" in config3);

      // Factory operations
      const master = new TotalMasterComponentFactory();
      if (config1.ok) {
        const factory = new TotalAnalysisDomainFactory(config1.data);
        const registerResult = master.registerFactory(factory);
        assert("ok" in registerResult);

        const validateResult = factory.validateDependencies();
        assert("ok" in validateResult);
      }

      // Builder operations
      const builderResult = createFactoryBuilder().withAnalysisDomain();
      assert("ok" in builderResult);
    });
  });
});
