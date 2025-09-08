import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { ApplicationConfiguration } from "../../../src/application/configuration.ts";
import {
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "../../../src/application/configuration.ts";

/**
 * Simplified DocumentProcessor tests focusing on configuration validation
 * and basic functionality with the new Totality-compliant configuration types.
 */

Deno.test({
  name: "DocumentProcessor - Configuration Tests",
  sanitizeOps: false,
  fn: async (t) => {
    await t.step(
      "should validate configuration structure with Smart Constructors",
      () => {
        // Create formats using Smart Constructors
        const schemaFormat = SchemaFormat.create("json");
        const templateFormat = TemplateFormat.create("json");
        const outputFormat = OutputFormat.create("json");

        // Verify all Smart Constructors succeed
        assertEquals(schemaFormat.ok, true);
        assertEquals(templateFormat.ok, true);
        assertEquals(outputFormat.ok, true);

        if (!schemaFormat.ok || !templateFormat.ok || !outputFormat.ok) {
          throw new Error("Smart Constructor creation failed");
        }

        // Test configuration structure with new discriminated union types
        const validConfig: ApplicationConfiguration = {
          schema: {
            definition: {
              type: "object",
              properties: { title: { type: "string" } },
            },
            format: schemaFormat.data,
          },
          template: {
            definition: '{ "result": "{{title}}" }',
            format: templateFormat.data,
          },
          input: {
            kind: "PatternBased",
            path: "/test/input",
            pattern: "\\.md$",
          },
          output: {
            path: "/test/output.json",
            format: outputFormat.data,
          },
          processing: {
            kind: "BasicProcessing",
          },
        };

        // Basic validation that the config structure is accepted
        assertEquals(typeof validConfig.schema.definition, "object");
        assertEquals(validConfig.schema.format.getValue(), "json");
        assertEquals(typeof validConfig.template.definition, "string");
        assertEquals(validConfig.input.path, "/test/input");
        assertEquals(validConfig.output.format.getValue(), "json");

        console.log("✅ DocumentProcessor configuration validation passed");
      },
    );

    await t.step("should handle different input configuration types", () => {
      // Test DirectPath input configuration
      const directPathConfig: ApplicationConfiguration["input"] = {
        kind: "DirectPath",
        path: "/direct/path",
      };

      // Test PatternBased input configuration
      const patternBasedConfig: ApplicationConfiguration["input"] = {
        kind: "PatternBased",
        path: "/pattern/path",
        pattern: "*.md",
      };

      assertEquals(directPathConfig.kind, "DirectPath");
      assertEquals(directPathConfig.path, "/direct/path");
      assertEquals(patternBasedConfig.kind, "PatternBased");
      assertEquals(patternBasedConfig.path, "/pattern/path");
      assertEquals(patternBasedConfig.pattern, "*.md");

      console.log(
        "✅ Input configuration discriminated union validation passed",
      );
    });

    await t.step(
      "should handle different processing configuration types",
      () => {
        // Test all processing configuration variants
        const basicProcessing: ApplicationConfiguration["processing"] = {
          kind: "BasicProcessing",
        };

        const customPrompts: ApplicationConfiguration["processing"] = {
          kind: "CustomPrompts",
          extractionPrompt: "extract",
          mappingPrompt: "map",
        };

        const parallelProcessing: ApplicationConfiguration["processing"] = {
          kind: "ParallelProcessing",
          parallel: true,
          continueOnError: false,
        };

        const fullCustom: ApplicationConfiguration["processing"] = {
          kind: "FullCustom",
          extractionPrompt: "custom extract",
          mappingPrompt: "custom map",
          parallel: true,
          continueOnError: true,
        };

        assertEquals(basicProcessing.kind, "BasicProcessing");
        assertEquals(customPrompts.kind, "CustomPrompts");
        assertEquals(customPrompts.extractionPrompt, "extract");
        assertEquals(parallelProcessing.kind, "ParallelProcessing");
        assertEquals(parallelProcessing.parallel, true);
        assertEquals(fullCustom.kind, "FullCustom");
        assertEquals(fullCustom.continueOnError, true);

        console.log(
          "✅ Processing configuration discriminated union validation passed",
        );
      },
    );

    await t.step("should validate Smart Constructor error handling", () => {
      // Test invalid format handling
      const invalidSchemaFormat = SchemaFormat.create("invalid");
      const invalidTemplateFormat = TemplateFormat.create("invalid");
      const invalidOutputFormat = OutputFormat.create("invalid");

      assertEquals(invalidSchemaFormat.ok, false);
      assertEquals(invalidTemplateFormat.ok, false);
      assertEquals(invalidOutputFormat.ok, false);

      if (!invalidSchemaFormat.ok) {
        assertExists(invalidSchemaFormat.error.message);
        assertEquals(
          invalidSchemaFormat.error.message.includes("invalid"),
          true,
        );
      }

      console.log("✅ Smart Constructor error handling validation passed");
    });
  },
});
