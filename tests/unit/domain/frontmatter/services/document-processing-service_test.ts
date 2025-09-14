import { assertEquals } from "jsr:@std/assert";
import { DocumentProcessingService } from "../../../../../src/domain/frontmatter/services/document-processing-service.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { Aggregator } from "../../../../../src/domain/aggregation/index.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";

// Mock implementations
class MockFrontmatterProcessor {
  extract() {
    return ok({ frontmatter: {}, body: "" });
  }
  validate() {
    return ok(FrontmatterData.empty());
  }
}

class MockAggregator {
  aggregate() {
    return ok(FrontmatterData.empty());
  }
  mergeWithBase(data: any) {
    return ok(data);
  }
}

class MockBasePropertyPopulator {
  populate(data: any) {
    return ok(data);
  }
}

class MockFileReader {
  read() {
    return ok("test content");
  }
}

class MockFileLister {
  list() {
    return ok(["test.md"]);
  }
}

class MockSchema {
  constructor(
    private frontmatterPartPath: string | null,
    private derivationRules: any[] = [],
  ) {}

  findFrontmatterPartPath() {
    if (this.frontmatterPartPath === null) {
      return err({ kind: "FrontmatterPartNotFound" as const });
    }
    return ok(this.frontmatterPartPath);
  }

  findFrontmatterPartSchema() {
    if (this.frontmatterPartPath === null) {
      return err({ kind: "FrontmatterPartNotFound" as const });
    }
    return ok({});
  }

  getDerivedRules() {
    return this.derivationRules;
  }
}

// Create test data
const createTestFrontmatterData = (data: Record<string, any>) => {
  const result = FrontmatterData.create(data);
  if (!result.ok) throw new Error("Failed to create test data");
  return result.data;
};

Deno.test("DocumentProcessingService - aggregateData method", async (t) => {
  let service: DocumentProcessingService;

  const setup = () => {
    service = new DocumentProcessingService(
      new MockFrontmatterProcessor() as any,
      new MockAggregator() as any,
      new MockBasePropertyPopulator() as any,
      new MockFileReader() as any,
      new MockFileLister() as any,
    );
  };

  await t.step("should handle simple frontmatter-part aggregation", () => {
    setup();
    const schema = new MockSchema("commands") as unknown as Schema;
    const data = [
      createTestFrontmatterData({ c1: "git", c2: "commit" }),
      createTestFrontmatterData({ c1: "spec", c2: "analyze" }),
    ];

    // Access private method via any cast for testing
    const result = (service as any).aggregateData(data, schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const resultData = result.data.getData();
      assertEquals(Array.isArray(resultData.commands), true);
      assertEquals(resultData.commands.length, 2);
    }
  });

  await t.step("should handle nested frontmatter-part aggregation", () => {
    setup();
    const schema = new MockSchema("tools.commands") as unknown as Schema;
    const data = [
      createTestFrontmatterData({ c1: "git", c2: "commit" }),
      createTestFrontmatterData({ c1: "spec", c2: "analyze" }),
    ];

    const result = (service as any).aggregateData(data, schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const resultData = result.data.getData();
      // Should have nested structure
      assertEquals(typeof resultData.tools, "object");
      assertEquals(Array.isArray((resultData.tools as any).commands), true);
    }
  });

  await t.step(
    "should handle derivation rules with frontmatter-part",
    () => {
      // Use real aggregator for this test
      service = new DocumentProcessingService(
        new MockFrontmatterProcessor() as any,
        new Aggregator(),
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );

      const derivationRules = [
        {
          sourcePath: "commands[].c1",
          targetField: "availableConfigs",
          unique: true,
        },
      ];
      const schema = new MockSchema(
        "commands",
        derivationRules,
      ) as unknown as Schema;
      const data = [
        createTestFrontmatterData({ c1: "git", c2: "commit" }),
        createTestFrontmatterData({ c1: "spec", c2: "analyze" }),
      ];

      const result = (service as any).aggregateData(data, schema);

      assertEquals(result.ok, true);
      // With derivation rules, the aggregator should be called
      // and should create the availableConfigs field with unique c1 values
      if (result.ok) {
        const resultData = result.data.getData();
        assertEquals(Array.isArray(resultData.availableConfigs), true);
        assertEquals(resultData.availableConfigs.length, 2);
        assertEquals(resultData.availableConfigs.includes("git"), true);
        assertEquals(resultData.availableConfigs.includes("spec"), true);
      }
    },
  );

  await t.step("should handle no frontmatter-part schema", () => {
    setup();
    const schema = new MockSchema(null) as unknown as Schema;
    const data = [
      createTestFrontmatterData({ field1: "value1" }),
      createTestFrontmatterData({ field2: "value2" }),
    ];

    const result = (service as any).aggregateData(data, schema);

    assertEquals(result.ok, true);
    // Should merge data directly when no frontmatter-part
  });

  await t.step("should handle empty data array", () => {
    setup();
    const schema = new MockSchema("commands") as unknown as Schema;
    const data: FrontmatterData[] = [];

    const result = (service as any).aggregateData(data, schema);

    // With our improved implementation, empty data array creates proper empty structure
    assertEquals(result.ok, true);
    if (result.ok) {
      const resultData = result.data.getData();
      // Should have empty commands array in proper structure
      assertEquals(Array.isArray(resultData.commands), true);
      assertEquals(resultData.commands.length, 0);
    }
  });

  await t.step(
    "should preserve data structure for backward compatibility",
    () => {
      setup();
      const schema = new MockSchema(
        "registry.tools.commands",
      ) as unknown as Schema;
      const data = [
        createTestFrontmatterData({ c1: "git", c2: "commit", c3: "message" }),
      ];

      const result = (service as any).aggregateData(data, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const resultData = result.data.getData();
        // Should have the nested structure
        assertEquals(typeof resultData.registry, "object");
        assertEquals(typeof (resultData.registry as any).tools, "object");
        assertEquals(
          Array.isArray(((resultData.registry as any).tools as any).commands),
          true,
        );
      }
    },
  );
});

Deno.test("DocumentProcessingService - DDD Totality compliance", async (t) => {
  let service: DocumentProcessingService;

  const setup = () => {
    service = new DocumentProcessingService(
      new MockFrontmatterProcessor() as any,
      new MockAggregator() as any,
      new MockBasePropertyPopulator() as any,
      new MockFileReader() as any,
      new MockFileLister() as any,
    );
  };

  await t.step(
    "should return Result type from all aggregation methods",
    () => {
      setup();
      const schema = new MockSchema("commands") as unknown as Schema;
      const data = [createTestFrontmatterData({ test: "value" })];

      // Test aggregateData
      const result1 = (service as any).aggregateData(data, schema);
      assertEquals(typeof result1, "object");
      assertEquals(typeof result1.ok, "boolean");

      // Test aggregateWithDerivationRules
      const result2 = (service as any).aggregateWithDerivationRules(
        data,
        schema,
        [],
      );
      assertEquals(typeof result2, "object");
      assertEquals(typeof result2.ok, "boolean");

      // Test aggregateWithoutDerivationRules
      const result3 = (service as any).aggregateWithoutDerivationRules(
        data,
        schema,
      );
      assertEquals(typeof result3, "object");
      assertEquals(typeof result3.ok, "boolean");

      // Test mergeDataDirectly
      const result4 = (service as any).mergeDataDirectly(data);
      assertEquals(typeof result4, "object");
      assertEquals(typeof result4.ok, "boolean");
    },
  );

  await t.step("should handle all error cases with proper Result types", () => {
    setup();

    // Test with schema that will cause errors
    class ErrorSchema extends MockSchema {
      constructor() {
        super(null);
      }

      override findFrontmatterPartPath() {
        return err({ kind: "FrontmatterPartNotFound" as const });
      }

      override findFrontmatterPartSchema() {
        return err({ kind: "FrontmatterPartNotFound" as const });
      }
    }

    const errorSchema = new ErrorSchema() as unknown as Schema;
    const data = [createTestFrontmatterData({ test: "value" })];

    const result = (service as any).aggregateData(data, errorSchema);

    // Should handle error gracefully and still return Result type
    assertEquals(typeof result, "object");
    assertEquals(typeof result.ok, "boolean");
  });
});

// Test to verify the fix for Issue #780 (hardcoding violations)
Deno.test("DocumentProcessingService - Issue #780 hardcoding fix verification", async (t) => {
  let service: DocumentProcessingService;

  const setup = () => {
    service = new DocumentProcessingService(
      new MockFrontmatterProcessor() as any,
      new MockAggregator() as any,
      new MockBasePropertyPopulator() as any,
      new MockFileReader() as any,
      new MockFileLister() as any,
    );
  };

  await t.step(
    "should work with different schema structures (not hardcoded to tools.commands)",
    () => {
      setup();

      // Test with different path structures
      const testCases = [
        "commands",
        "tools.commands",
        "registry.commands",
        "data.items",
        "config.tools.commands",
      ];

      for (const path of testCases) {
        const schema = new MockSchema(path) as unknown as Schema;
        const data = [createTestFrontmatterData({ id: "test" })];

        const result = (service as any).aggregateData(data, schema);

        assertEquals(result.ok, true, `Failed for path: ${path}`);

        if (result.ok) {
          const resultData = result.data.getData();

          // Verify that the data is placed at the correct schema-defined path
          const pathParts = path.split(".");
          let current = resultData;

          // Navigate to the nested location
          for (let i = 0; i < pathParts.length - 1; i++) {
            assertEquals(
              typeof current[pathParts[i]],
              "object",
              `Path ${path} should create nested structure at ${pathParts[i]}`,
            );
            current = current[pathParts[i]];
          }

          // Check final array location
          assertEquals(
            Array.isArray(current[pathParts[pathParts.length - 1]]),
            true,
            `Path ${path} should have array at final location`,
          );
        }
      }
    },
  );

  await t.step(
    "should not contain any hardcoded 'tools.commands' references",
    () => {
      setup();

      // Test with a completely different structure to ensure no hardcoding
      const schema = new MockSchema(
        "application.modules.handlers",
      ) as unknown as Schema;
      const data = [
        createTestFrontmatterData({ type: "handler", name: "test" }),
      ];

      const result = (service as any).aggregateData(data, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const resultData = result.data.getData();

        // Should not have 'tools' at all if not specified in schema
        assertEquals(
          typeof resultData.tools,
          "undefined",
          "Should not create hardcoded 'tools' structure",
        );

        // Should have the schema-defined structure
        assertEquals(typeof resultData.application, "object");
        assertEquals(typeof (resultData.application as any).modules, "object");
        assertEquals(
          Array.isArray(
            ((resultData.application as any).modules as any).handlers,
          ),
          true,
        );
      }
    },
  );
});
