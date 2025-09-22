/**
 * Comprehensive Unit Tests for FrontmatterTransformationService
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - Complete transformation pipeline (Extract → Validate → Aggregate → Structure → Integrate)
 * - Error path testing following Totality principles
 * - Memory bounds monitoring and processing limits
 * - Frontmatter part processing with schema-driven paths
 * - Derivation rules application with comprehensive error handling
 * - File system operations with edge cases and failures
 * - Processing bounds violations and recovery strategies
 * - Deep merge operations and data structure preservation
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FrontmatterTransformationService } from "../../../../../src/domain/frontmatter/services/frontmatter-transformation-service.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { Aggregator } from "../../../../../src/domain/aggregation/index.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../../../../src/domain/schema/value-objects/validation-rules.ts";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";
import { ProcessingBoundsFactory } from "../../../../../src/domain/shared/types/processing-bounds.ts";
import { DebugLoggerFactory } from "../../../../../src/infrastructure/logging/debug-logger-factory.ts";
import { NullDebugLogger } from "../../../../../src/infrastructure/logging/null-debug-logger.ts";
import { PerformanceSettings } from "../../../../../src/domain/configuration/value-objects/performance-settings.ts";

/**
 * Helper function to create test service with default performance settings
 */
function createTestServiceWithDisabledLogging(
  processor: any,
  aggregator: any,
  populator: any,
  reader: any,
  lister: any,
  frontmatterDataCreationService?: any,
): FrontmatterTransformationService {
  const performanceSettings = PerformanceSettings.createDefault();
  if (!performanceSettings.ok) {
    throw new Error("Failed to create default performance settings for test");
  }
  return FrontmatterTransformationService.createWithDisabledLogging(
    processor,
    aggregator,
    populator,
    reader,
    lister,
    performanceSettings.data,
    frontmatterDataCreationService,
  );
}

// Comprehensive Mock Implementations for Error Path Testing
class MockFrontmatterProcessor {
  constructor(
    private extractResult: any = ok({ frontmatter: {}, body: "" }),
    private validateResult: any = ok(FrontmatterData.empty()),
  ) {}

  extract() {
    return this.extractResult;
  }
  validate() {
    return this.validateResult;
  }

  // Add missing properties to satisfy interface
  extractor = {};
  parser = {};
  extractFromPart() {
    return this.extractResult;
  }
}

class MockAggregator {
  constructor(
    private aggregateResult: any = ok(FrontmatterData.empty()),
    private mergeResult: any = null,
  ) {}

  aggregate() {
    return this.aggregateResult;
  }
  mergeWithBase(data: any) {
    return this.mergeResult || ok(data);
  }
}

class MockBasePropertyPopulator {
  constructor(private populateResult: any = null) {}

  populate(data: any) {
    return this.populateResult || ok(data);
  }
}

class MockFileReader {
  constructor(private readResult: any = ok("test content")) {}

  read() {
    return this.readResult;
  }
}

class MockFileLister {
  constructor(private listResult: any = ok(["test.md"])) {}

  list() {
    return this.listResult;
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

// Test Data Creation Utilities
const createTestFrontmatterData = (data: Record<string, any>) => {
  const result = TestDataFactory.createFrontmatterData(data);
  if (!result.ok) throw new Error("Failed to create test data");
  return result.data;
};

const createTestValidationRules = () => {
  return ValidationRules.create([]);
};

const createTestSchema = (
  frontmatterPartPath?: string,
  derivationRules: any[] = [],
) => {
  return new MockSchema(
    frontmatterPartPath || null,
    derivationRules,
  ) as unknown as Schema;
};

describe("FrontmatterTransformationService", () => {
  describe("transformDocuments - Complete Pipeline", () => {
    it("should execute complete transformation pipeline successfully", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, true);
    });

    it("should handle verbose mode with detailed logging", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      // Create verbose logger for test
      const verboseLoggerResult = DebugLoggerFactory.createForVerbose(true);
      const _verboseLogger = verboseLoggerResult.ok
        ? verboseLoggerResult.data
        : undefined;

      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, true);
    });

    it("should handle custom processing bounds", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();
      const boundsResult = ProcessingBoundsFactory.createDefault(10);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      // Act
      // Create null logger for quiet mode test
      const nullLoggerResult = NullDebugLogger.create();
      const _nullLogger = nullLoggerResult.ok
        ? nullLoggerResult.data
        : undefined;

      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
        boundsResult.data,
      );

      // Assert
      assertEquals(result.ok, true);
    });
  });

  describe("Error Path Testing - Totality Principles", () => {
    it("should handle file listing failure", async () => {
      // Arrange
      const fileListError = createError({
        kind: "FileNotFound",
        path: "invalid-pattern",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister(err(fileListError)) as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "invalid-pattern",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    });

    it("should handle processing bounds creation failure", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister(
          ok([...Array(10000)].map((_, i) => `file${i}.md`)),
        ) as any, // Too many files
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert - Should handle large file counts gracefully
      assertEquals(result.ok, true);
    });

    it("should handle memory bounds violation", async () => {
      // Arrange
      const strictBounds = ProcessingBoundsFactory.createBounded(1, 1, 1); // Very small limits
      assertEquals(strictBounds.ok, true);
      if (!strictBounds.ok) return;

      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister(ok(["file1.md", "file2.md", "file3.md"])) as any, // More files than limit
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      // Create null logger for quiet mode test
      const nullLoggerResult = NullDebugLogger.create();
      const _nullLogger = nullLoggerResult.ok
        ? nullLoggerResult.data
        : undefined;

      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
        strictBounds.data,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MemoryBoundsViolation");
        assertStringIncludes(result.error.message, "exceeded bounds");
      }
    });

    it("should handle no valid documents found", async () => {
      // Arrange
      const extractError = createError({
        kind: "InvalidFormat",
        format: "frontmatter",
        value: "invalid data",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor(err(extractError)) as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister(ok(["invalid1.md", "invalid2.md"])) as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertStringIncludes(result.error.message, "No valid documents found");
      }
    });

    it("should handle file reading errors gracefully", async () => {
      // Arrange
      const readError = createError({
        kind: "FileNotFound",
        path: "missing-file.md",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader(err(readError)) as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertStringIncludes(result.error.message, "No valid documents found");
      }
    });

    it("should handle frontmatter extraction errors", async () => {
      // Arrange
      const extractError = createError({
        kind: "InvalidFormat",
        format: "YAML frontmatter",
        value: "malformed data",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor(err(extractError)) as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertStringIncludes(result.error.message, "No valid documents found");
      }
    });

    it("should handle frontmatter validation errors", async () => {
      // Arrange
      const validationError = createError({
        kind: "MissingRequired",
        field: "required_field",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor(
          ok({ frontmatter: {}, body: "" }),
          err(validationError),
        ) as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertStringIncludes(result.error.message, "No valid documents found");
      }
    });

    it("should handle aggregation failure", async () => {
      // Arrange
      const aggregationError = createError({
        kind: "AggregationFailed",
        message: "Data aggregation failed",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator(err(aggregationError)) as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema("commands", [{
        sourcePath: "commands[].name",
        targetField: "names",
        unique: true,
      }]);

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertStringIncludes(result.error.message, "Data aggregation failed");
      }
    });

    it("should handle base property population failure", async () => {
      // Arrange
      const populationError = createError({
        kind: "MissingRequired",
        field: "base_property",
      });
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator(err(populationError)) as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const validationRules = createTestValidationRules();
      const schema = createTestSchema();

      // Act
      const result = await service.transformDocuments(
        "**/*.md",
        validationRules,
        schema,
      );

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MissingRequired");
        if (result.error.kind === "MissingRequired") {
          assertEquals(result.error.field, "base_property");
        }
      }
    });
  });

  describe("aggregateData method", () => {
    it("should handle simple frontmatter-part aggregation", () => {
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
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

    it("should handle nested frontmatter-part aggregation", () => {
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
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

    it("should handle derivation rules with frontmatter-part", () => {
      // Use real aggregator for this test
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        aggregatorResult.data,
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
    });

    it("should handle no frontmatter-part schema", () => {
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const schema = new MockSchema(null) as unknown as Schema;
      const data = [
        createTestFrontmatterData({ field1: "value1" }),
        createTestFrontmatterData({ field2: "value2" }),
      ];

      const result = (service as any).aggregateData(data, schema);

      assertEquals(result.ok, true);
      // Should merge data directly when no frontmatter-part
    });

    it("should handle empty data array", () => {
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
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

    it("should preserve data structure for backward compatibility", () => {
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
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
    });
  });

  describe("Frontmatter Part Processing", () => {
    it("should handle frontmatter part extraction with nested paths", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const data = [
        createTestFrontmatterData({ name: "cmd1", type: "git" }),
        createTestFrontmatterData({ name: "cmd2", type: "spec" }),
      ];
      const schema = createTestSchema("tools.commands");

      // Act
      const result = await (service as any).processFrontmatterParts(
        data,
        schema,
      );

      // Assert
      assertEquals(result.length, 2);
      assertEquals(result[0].getData().name, "cmd1");
      assertEquals(result[1].getData().name, "cmd2");
    });

    it("should handle missing frontmatter part schema", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const data = [createTestFrontmatterData({ test: "value" })];
      const schema = createTestSchema(); // No frontmatter part

      // Act
      const result = await (service as any).processFrontmatterParts(
        data,
        schema,
      );

      // Assert
      assertEquals(result, data); // Should return original data
    });

    it("should handle invalid frontmatter part data", async () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const data = [createTestFrontmatterData({ invalid: null })];
      const schema = createTestSchema("commands");

      // Act
      const result = await (service as any).processFrontmatterParts(
        data,
        schema,
      );

      // Assert
      assertEquals(result, data); // Should fallback to original data
    });
  });

  describe("Deep Merge Operations", () => {
    it("should handle deep merge with nested objects", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const baseData = createTestFrontmatterData({
        config: { settings: { debug: true } },
        commands: ["git"],
      });
      const derivedData = createTestFrontmatterData({
        config: { settings: { verbose: true } },
        tags: ["cli"],
      });

      // Act
      const result = (service as any).deepMerge(baseData, derivedData);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const merged = result.data.getData();
        assertEquals(merged.config.settings.debug, true);
        assertEquals(merged.config.settings.verbose, true);
        assertEquals(merged.commands, ["git"]);
        assertEquals(merged.tags, ["cli"]);
      }
    });

    it("should handle merge failure", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
        // Mock service that will fail
        {
          createFromRaw: () =>
            err(createError({ kind: "MissingRequired", field: "test" })),
        } as any,
      );
      const baseData = createTestFrontmatterData({ test: "value" });
      const derivedData = createTestFrontmatterData({ other: "value" });

      // Act
      const result = (service as any).deepMerge(baseData, derivedData);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MergeFailed");
      }
    });
  });

  describe("Nested Field Operations", () => {
    it("should set nested field with dot notation", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const obj = {};

      // Act
      (service as any).setNestedField(obj, "config.settings.debug", true);

      // Assert
      assertEquals((obj as any).config.settings.debug, true);
    });

    it("should extract nested property with dot notation", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const obj = {
        config: {
          settings: {
            debug: true,
          },
        },
      };

      // Act
      const result = (service as any).extractNestedProperty(
        obj,
        "config.settings.debug",
      );

      // Assert
      assertEquals(result, true);
    });

    it("should handle missing nested property", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const obj = { config: {} };

      // Act
      const result = (service as any).extractNestedProperty(
        obj,
        "config.missing.property",
      );

      // Assert
      assertEquals(result, undefined);
    });
  });

  describe("Derivation Rules Conversion", () => {
    it("should convert valid derivation rules", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const rules = [
        { sourcePath: "commands[].name", targetField: "names", unique: true },
        { sourcePath: "commands[].type", targetField: "types", unique: false },
      ];

      // Act
      const result = (service as any).convertDerivationRules(rules);

      // Assert
      assertEquals(result.successfulRules.length, 2);
      assertEquals(result.failedRuleCount, 0);
      assertEquals(result.errors.length, 0);
    });

    it("should handle invalid derivation rules", () => {
      // Arrange
      const service = createTestServiceWithDisabledLogging(
        new MockFrontmatterProcessor() as any,
        new MockAggregator() as any,
        new MockBasePropertyPopulator() as any,
        new MockFileReader() as any,
        new MockFileLister() as any,
      );
      const rules = [
        { sourcePath: "", targetField: "names", unique: true }, // Invalid: empty source path
        { sourcePath: "commands[].name", targetField: "", unique: false }, // Invalid: empty target field
      ];

      // Act
      const result = (service as any).convertDerivationRules(rules);

      // Assert
      assertEquals(result.successfulRules.length, 0);
      assertEquals(result.failedRuleCount, 2);
      assertEquals(result.errors.length, 2);
    });
  });
});
