import { assertEquals } from "jsr:@std/assert";
import {
  AutoDetectResolution,
  ExplicitPathResolution,
  SchemaBasedResolution,
  TemplateResolutionContext,
  TemplateResolutionOrchestrator,
  toLegacyResult,
} from "../../../../../src/domain/template/services/template-resolution-strategy.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";
import { TEST_EXTENSIONS } from "../../../../helpers/test-extensions.ts";

/**
 * Template Resolution Strategy Tests
 * Comprehensive testing of the template resolution strategy pattern
 * Following DDD principles and Result<T,E> pattern validation
 */
Deno.test("TemplateResolutionStrategy", async (t) => {
  await t.step(
    "ExplicitPathResolution should resolve when explicit path provided",
    () => {
      const strategy = new ExplicitPathResolution();
      const context: TemplateResolutionContext = {
        kind: "explicit-path",
        schemaPath: "/path/to/schema.json",
        explicitTemplatePath: "/path/to/template.json",
        schemaDefinition: {},
        baseDirectory: "/base",
      };

      assertEquals(strategy.canResolve(context), true);

      const result = strategy.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        const legacy = toLegacyResult(result.data);
        assertEquals(legacy.mainTemplatePath, "/path/to/template.json");
        assertEquals(legacy.hasDualTemplate, false);
        assertEquals(legacy.resolutionStrategy, "explicit-path");
      }
    },
  );

  await t.step(
    "ExplicitPathResolution should fail when no explicit path",
    () => {
      const strategy = new ExplicitPathResolution();
      const context: TemplateResolutionContext = {
        kind: "schema-based",
        schemaPath: "/path/to/schema.json",
        schemaDefinition: {},
        baseDirectory: "/base",
      };

      assertEquals(strategy.canResolve(context), false);

      const result = strategy.resolve(context);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error, "Context is not explicit-path type");
      }
    },
  );

  await t.step(
    "SchemaBasedResolution should resolve from x-template property",
    () => {
      const strategy = new SchemaBasedResolution();
      const context: TemplateResolutionContext = {
        kind: "schema-based",
        schemaPath: "/path/to/schema.json",
        schemaDefinition: {
          [TEST_EXTENSIONS.TEMPLATE]: "template.json",
          [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "items.json",
        },
        baseDirectory: "/base",
      };

      assertEquals(strategy.canResolve(context), true);

      const result = strategy.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "dual");
        if (result.data.kind === "dual") {
          assertEquals(result.data.mainTemplatePath, "/base/template.json");
          assertEquals(result.data.itemsTemplatePath, "/base/items.json");
          assertEquals(result.data.resolutionStrategy, "schema-derived");
        }
      }
    },
  );

  await t.step("SchemaBasedResolution should handle absolute paths", () => {
    const strategy = new SchemaBasedResolution();
    const context: TemplateResolutionContext = {
      kind: "schema-based",
      schemaPath: "/path/to/schema.json",
      schemaDefinition: {
        [TEST_EXTENSIONS.TEMPLATE]: "/absolute/template.json",
      },
      baseDirectory: "/base",
    };

    const result = strategy.resolve(context);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.kind, "single");
      if (result.data.kind === "single") {
        assertEquals(result.data.templatePath, "/absolute/template.json");
      }
    }
  });

  await t.step("SchemaBasedResolution should fail without x-template", () => {
    const strategy = new SchemaBasedResolution();
    const context: TemplateResolutionContext = {
      kind: "schema-based",
      schemaPath: "/path/to/schema.json",
      schemaDefinition: {},
      baseDirectory: "/base",
    };

    assertEquals(strategy.canResolve(context), false);

    const result = strategy.resolve(context);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error,
        "Schema does not contain valid x-template property",
      );
    }
  });

  await t.step("AutoDetectResolution should generate candidate paths", () => {
    const strategy = new AutoDetectResolution();
    const context: TemplateResolutionContext = {
      kind: "schema-based",
      schemaPath: "/path/to/my-schema.json",
      schemaDefinition: {},
      baseDirectory: "/base",
    };

    assertEquals(strategy.canResolve(context), true);

    const result = strategy.resolve(context);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data.kind,
        "single",
      );
      if (result.data.kind === "single") {
        assertEquals(
          result.data.templatePath,
          "/base/my-schema_template.json",
        );
        assertEquals(result.data.resolutionStrategy, "auto-detect");
      }
    }
  });

  await t.step(
    "TemplateResolutionOrchestrator should use first applicable strategy",
    () => {
      const orchestrator = new TemplateResolutionOrchestrator();
      const context: TemplateResolutionContext = {
        kind: "explicit-path",
        schemaPath: "/path/to/schema.json",
        explicitTemplatePath: "/explicit/template.json",
        schemaDefinition: {
          [TEST_EXTENSIONS.TEMPLATE]: "schema-template.json",
        },
        baseDirectory: "/base",
      };

      const result = orchestrator.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should use explicit path strategy first
        assertEquals(result.data.kind, "single");
        if (result.data.kind === "single") {
          assertEquals(result.data.templatePath, "/explicit/template.json");
          assertEquals(result.data.resolutionStrategy, "explicit-path");
        }
      }
    },
  );

  await t.step(
    "TemplateResolutionOrchestrator should fall back to next strategy",
    () => {
      const orchestrator = new TemplateResolutionOrchestrator();
      const context: TemplateResolutionContext = {
        kind: "schema-based",
        schemaPath: "/path/to/schema.json",
        schemaDefinition: {
          [TEST_EXTENSIONS.TEMPLATE]: "schema-template.json",
        },
        baseDirectory: "/base",
      };

      const result = orchestrator.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should use schema-based strategy
        assertEquals(result.data.kind, "single");
        if (result.data.kind === "single") {
          assertEquals(
            result.data.templatePath,
            "/base/schema-template.json",
          );
          assertEquals(result.data.resolutionStrategy, "schema-derived");
        }
      }
    },
  );

  await t.step(
    "TemplateResolutionOrchestrator should use auto-detect as fallback",
    () => {
      const orchestrator = new TemplateResolutionOrchestrator();
      const context: TemplateResolutionContext = {
        kind: "schema-based",
        schemaPath: "/path/to/fallback-schema.json",
        schemaDefinition: {},
        baseDirectory: "/base",
      };

      const result = orchestrator.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should use auto-detect strategy
        assertEquals(result.data.kind, "single");
        if (result.data.kind === "single") {
          assertEquals(
            result.data.templatePath,
            "/base/fallback-schema_template.json",
          );
          assertEquals(result.data.resolutionStrategy, "auto-detect");
        }
      }
    },
  );

  await t.step(
    "TemplateResolutionOrchestrator should support custom strategies",
    () => {
      const orchestrator = new TemplateResolutionOrchestrator();

      // Add custom strategy at the beginning
      const customStrategy = {
        name: "custom-test",
        canResolve: (_context: TemplateResolutionContext) => true,
        resolve: (
          _context: TemplateResolutionContext,
        ): Result<
          {
            kind: "single";
            templatePath: string;
            resolutionStrategy: string;
          },
          string
        > => {
          return {
            ok: true,
            data: {
              kind: "single",
              templatePath: "/custom/template.json",
              resolutionStrategy: "custom-test",
            },
          } as const;
        },
      };

      orchestrator.addStrategy(customStrategy);

      const strategies = orchestrator.getAvailableStrategies();
      assertEquals(strategies[0], "custom-test");
      assertEquals(strategies.includes("explicit-path"), true);
      assertEquals(strategies.includes("schema-derived"), true);
      assertEquals(strategies.includes("auto-detect"), true);
    },
  );

  await t.step(
    "TemplateResolutionOrchestrator should handle Windows paths",
    () => {
      const strategy = new SchemaBasedResolution();
      const context: TemplateResolutionContext = {
        kind: "schema-based",
        schemaPath: "C:\\path\\to\\schema.json",
        schemaDefinition: {
          [TEST_EXTENSIONS.TEMPLATE]: "C:\\absolute\\template.json",
        },
        baseDirectory: "C:\\base",
      };

      const result = strategy.resolve(context);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "single");
        if (result.data.kind === "single") {
          assertEquals(
            result.data.templatePath,
            "C:\\absolute\\template.json",
          );
        }
      }
    },
  );
});
