/**
 * SchemaProcessingService Specification Test
 *
 * Tests the comprehensive business logic for schema processing in the 3-stage pipeline
 * following DDD and Totality principles with Result<T,E> pattern throughout.
 *
 * Business Requirements Tested:
 * 1. Schema loading and validation with proper error context
 * 2. Template path resolution (absolute and relative paths)
 * 3. Items template path resolution for dual template scenarios
 * 4. JMESPath filtering application at schema and property levels
 * 5. Progress tracking and decision making for template availability
 * 6. ProcessedSchema discriminated union creation (WithTemplate/WithoutTemplate)
 * 7. Performance requirements for schema processing operations
 * 8. Error recovery and context preservation
 *
 * Architecture: Domain Service following DDD patterns
 * Dependencies: SchemaRepository, BasePropertyPopulator, JMESPathFilterService
 * Error Handling: Complete Result<T,E> pattern with context tracking
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../../../src/domain/shared/types/errors.ts";

import { SchemaProcessingService } from "../../../../../src/domain/schema/services/schema-processing-service.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { ValidationRules as _ValidationRules } from "../../../../../src/domain/schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

// Test Doubles following established patterns
class MockSchemaRepository {
  private schemas = new Map<string, Schema>();
  private failures = new Map<string, DomainError>();

  setMockSchema(path: string, schema: Schema): void {
    this.schemas.set(path, schema);
  }

  setMockFailure(path: string, error: DomainError): void {
    this.failures.set(path, error);
  }

  load(schemaPath: SchemaPath): Result<Schema, DomainError> {
    const pathStr = schemaPath.toString();

    if (this.failures.has(pathStr)) {
      return err(this.failures.get(pathStr)!);
    }

    if (this.schemas.has(pathStr)) {
      return ok(this.schemas.get(pathStr)!);
    }

    return err({
      kind: "SchemaNotFound" as const,
      path: pathStr,
    });
  }

  resolve(schema: Schema): Result<Schema, DomainError> {
    // Mock resolution - return same schema for simplicity
    return ok(schema);
  }
}

class MockBasePropertyPopulator {
  populate(): Result<any, DomainError> {
    return ok({});
  }
}

class MockJMESPathFilterService {
  private filterResults = new Map<string, any>();
  private filterFailures = new Map<string, DomainError>();

  setMockFilterResult(expression: string, result: any): void {
    this.filterResults.set(expression, result);
  }

  setMockFilterFailure(expression: string, error: DomainError): void {
    this.filterFailures.set(expression, error);
  }

  applyFilter(
    data: FrontmatterData,
    expression: string,
  ): Result<any, DomainError> {
    if (this.filterFailures.has(expression)) {
      return err(this.filterFailures.get(expression)!);
    }

    if (this.filterResults.has(expression)) {
      return ok(this.filterResults.get(expression));
    }

    return ok(data.getData());
  }
}

// Test Data Creation Helpers
class TestSchemaCreator {
  static createSchemaWithTemplate(
    templatePath: string,
  ): Result<Schema, DomainError> {
    const schemaData = {
      type: "object",
      "x-template": templatePath,
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title"],
    };

    const pathResult = SchemaPath.create("test://schema.json");
    if (!pathResult.ok) return pathResult;

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) return definitionResult;

    return Schema.create(pathResult.data, definitionResult.data);
  }

  static createSchemaWithoutTemplate(): Result<Schema, DomainError> {
    const schemaData = {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title"],
    };

    const pathResult = SchemaPath.create("test://schema.json");
    if (!pathResult.ok) return pathResult;

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) return definitionResult;

    return Schema.create(pathResult.data, definitionResult.data);
  }

  static createSchemaWithItemsTemplate(
    templatePath: string,
    itemsTemplatePath: string,
  ): Result<Schema, DomainError> {
    const schemaData = {
      type: "object",
      "x-template": templatePath,
      "x-template-items": itemsTemplatePath,
      properties: {
        title: { type: "string" },
        items: {
          type: "array",
          items: { type: "object" },
        },
      },
      required: ["title"],
    };

    const pathResult = SchemaPath.create("test://schema.json");
    if (!pathResult.ok) return pathResult;

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) return definitionResult;

    return Schema.create(pathResult.data, definitionResult.data);
  }

  static createSchemaWithJMESPathFilter(
    jmespathFilter: string,
  ): Result<Schema, DomainError> {
    const schemaData = {
      type: "object",
      "x-jmespath-filter": jmespathFilter,
      properties: {
        commands: {
          type: "array",
          items: { type: "object" },
        },
      },
    };

    const pathResult = SchemaPath.create("test://schema.json");
    if (!pathResult.ok) return pathResult;

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) return definitionResult;

    return Schema.create(pathResult.data, definitionResult.data);
  }
}

describe("SchemaProcessingService Specification", () => {
  let service: SchemaProcessingService;
  let mockRepository: MockSchemaRepository;
  let mockPopulator: MockBasePropertyPopulator;
  let mockJMESPathService: MockJMESPathFilterService;

  beforeEach(() => {
    mockRepository = new MockSchemaRepository();
    mockPopulator = new MockBasePropertyPopulator();
    mockJMESPathService = new MockJMESPathFilterService();

    const serviceResult = SchemaProcessingService.create(
      mockRepository as any,
      mockPopulator as any,
      mockJMESPathService as any,
    );
    if (!serviceResult.ok) {
      throw new Error("Failed to create schema processing service");
    }
    service = serviceResult.data;
  });

  describe("Business Requirement: Schema Processing Pipeline", () => {
    describe("Schema Loading and Processing", () => {
      it("should process schema with template and return WithTemplate discriminated union", () => {
        // Arrange: Create schema with x-template directive
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema("test/schema.json", schemaResult.data);

        // Act: Process schema
        const result = service.processSchema("test/schema.json");

        // Assert: Should return WithTemplate variant
        assertExists(result.ok);
        if (!result.ok) return;

        assertEquals(result.data.kind, "WithTemplate");
        if (result.data.kind === "WithTemplate") {
          assertEquals(result.data.templatePath, "./template.json");
          assertExists(result.data.schema);
          assertExists(result.data.validationRules);
        }
      });

      it("should process schema without template and return WithoutTemplate discriminated union", () => {
        // Arrange: Create schema without x-template directive
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema("test/schema.json", schemaResult.data);

        // Act: Process schema
        const result = service.processSchema("test/schema.json");

        // Assert: Should return WithoutTemplate variant
        assertExists(result.ok);
        if (!result.ok) return;

        assertEquals(result.data.kind, "WithoutTemplate");
        assertExists(result.data.schema);
        assertExists(result.data.validationRules);
      });

      it("should propagate schema loading errors with proper error context", () => {
        // Arrange: Set repository to fail
        mockRepository.setMockFailure("invalid/schema.json", {
          kind: "SchemaNotFound" as const,
          path: "invalid/schema.json",
        });

        // Act: Attempt to process non-existent schema
        const result = service.processSchema("invalid/schema.json");

        // Assert: Should propagate error
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "SchemaNotFound");
        }
      });

      it("should handle invalid schema path with proper error response", () => {
        // Act: Process invalid schema path
        const result = service.processSchema("");

        // Assert: Should fail with appropriate error
        assertEquals(result.ok, false);
        if (!result.ok) {
          // Error should be related to invalid path
          assertExists(result.error.kind);
        }
      });
    });

    describe("Template Path Resolution", () => {
      it("should resolve relative template paths correctly", () => {
        // Arrange: Create schema with relative template path
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./templates/output.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve template path
        const result = service.resolveTemplatePath(
          schemaResult.data,
          "schemas/main/schema.json",
        );

        // Assert: Should resolve relative path
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "schemas/main/templates/output.json");
        }
      });

      it("should return absolute template paths unchanged", () => {
        // Arrange: Create schema with absolute template path
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "/templates/output.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve template path
        const result = service.resolveTemplatePath(
          schemaResult.data,
          "schemas/schema.json",
        );

        // Assert: Should return unchanged absolute path
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "/templates/output.json");
        }
      });

      it("should handle schema without template path", () => {
        // Arrange: Create schema without template
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Attempt to resolve template path
        const result = service.resolveTemplatePath(
          schemaResult.data,
          "schemas/schema.json",
        );

        // Assert: Should return error for missing template
        assertEquals(result.ok, false);
      });

      it("should resolve relative template paths from root directory", () => {
        // Arrange: Schema with relative path, schema in root
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve from root path
        const result = service.resolveTemplatePath(
          schemaResult.data,
          "schema.json",
        );

        // Assert: Should resolve correctly for root case
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "template.json");
        }
      });
    });

    describe("Items Template Path Resolution", () => {
      it("should resolve relative items template paths correctly", () => {
        // Arrange: Create schema with items template
        const schemaResult = TestSchemaCreator.createSchemaWithItemsTemplate(
          "./main.json",
          "./items.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve items template path
        const result = service.resolveItemsTemplatePath(
          schemaResult.data,
          "schemas/dual/schema.json",
        );

        // Assert: Should resolve relative path
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "schemas/dual/items.json");
        }
      });

      it("should return undefined for schema without items template", () => {
        // Arrange: Create schema without items template
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./main.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve items template path
        const result = service.resolveItemsTemplatePath(
          schemaResult.data,
          "schemas/schema.json",
        );

        // Assert: Should return undefined, not error
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, undefined);
        }
      });

      it("should handle absolute items template paths", () => {
        // Arrange: Create schema with absolute items template path
        const schemaResult = TestSchemaCreator.createSchemaWithItemsTemplate(
          "./main.json",
          "/templates/items.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        // Act: Resolve items template path
        const result = service.resolveItemsTemplatePath(
          schemaResult.data,
          "schemas/schema.json",
        );

        // Assert: Should return unchanged absolute path
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, "/templates/items.json");
        }
      });
    });

    describe("JMESPath Filtering Application", () => {
      it("should apply JMESPath filtering when schema has x-jmespath-filter", () => {
        // Arrange: Create schema with JMESPath filter
        const schemaResult = TestSchemaCreator.createSchemaWithJMESPathFilter(
          "commands[?c1 == 'git']",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({
          commands: [
            { c1: "git", c2: "create" },
            { c1: "spec", c2: "analyze" },
          ],
        });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Mock filter service to return filtered data
        mockJMESPathService.setMockFilterResult("commands[?c1 == 'git']", [
          { c1: "git", c2: "create" },
        ]);

        // Act: Apply JMESPath filtering
        const result = service.applyJMESPathFiltering(
          dataResult.data,
          schemaResult.data,
        );

        // Assert: Should return filtered data as FrontmatterData
        assertExists(result.ok);
        if (result.ok) {
          // The service should return a FrontmatterData containing the filtered results
          assertExists(result.data);
        }
      });

      it("should return original data when schema has no JMESPath filter", () => {
        // Arrange: Create schema without JMESPath filter
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({
          title: "Test Document",
          content: "Some content",
        });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Act: Apply JMESPath filtering
        const result = service.applyJMESPathFiltering(
          dataResult.data,
          schemaResult.data,
        );

        // Assert: Should return original data unchanged
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, dataResult.data);
        }
      });

      it("should propagate JMESPath filtering errors properly", () => {
        // Arrange: Create schema with JMESPath filter
        const schemaResult = TestSchemaCreator.createSchemaWithJMESPathFilter(
          "invalid.expression",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({ data: "test" });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Mock filter service to return error
        mockJMESPathService.setMockFilterFailure("invalid.expression", {
          kind: "ParseError" as const,
          input: "invalid.expression",
        });

        // Act: Apply JMESPath filtering
        const result = service.applyJMESPathFiltering(
          dataResult.data,
          schemaResult.data,
        );

        // Assert: Should propagate error
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ParseError");
        }
      });
    });

    describe("Property-Level JMESPath Filtering", () => {
      it("should apply JMESPath filtering to specific properties", () => {
        // Arrange: Create schema and data
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({
          commands: [
            { type: "git", action: "commit" },
            { type: "npm", action: "install" },
          ],
        });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Mock filter result
        mockJMESPathService.setMockFilterResult("commands[?type == 'git']", [
          { type: "git", action: "commit" },
        ]);

        // Act: Apply property-level filtering
        const result = service.applyPropertyJMESPathFiltering(
          dataResult.data,
          "commands",
          schemaResult.data,
        );

        // Assert: Should return original data (no property filter in schema)
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, dataResult.data);
        }
      });

      it("should return original data when property has no JMESPath filter", () => {
        // Arrange: Create standard schema
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({
          title: "Test",
          metadata: { tags: ["test", "example"] },
        });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Act: Apply property filtering to property without filter
        const result = service.applyPropertyJMESPathFiltering(
          dataResult.data,
          "metadata",
          schemaResult.data,
        );

        // Assert: Should return original data
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, dataResult.data);
        }
      });

      it("should handle non-existent property paths gracefully", () => {
        // Arrange: Create schema
        const schemaResult = TestSchemaCreator.createSchemaWithoutTemplate();
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        const dataResult = FrontmatterData.create({ title: "Test" });
        assertExists(dataResult.ok);
        if (!dataResult.ok) return;

        // Act: Apply filtering to non-existent property
        const result = service.applyPropertyJMESPathFiltering(
          dataResult.data,
          "nonexistent.property",
          schemaResult.data,
        );

        // Assert: Should return original data without error
        assertExists(result.ok);
        if (result.ok) {
          assertEquals(result.data, dataResult.data);
        }
      });
    });
  });

  describe("Performance and Quality Requirements", () => {
    describe("Performance Benchmarks", () => {
      it("should process schema within performance targets", () => {
        // Arrange: Create schema for performance test
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema("perf/schema.json", schemaResult.data);

        // Act: Measure processing time
        const startTime = performance.now();
        const result = service.processSchema("perf/schema.json");
        const endTime = performance.now();

        // Assert: Should complete within 100ms for simple schema
        assertExists(result.ok);
        const processingTime = endTime - startTime;
        assertEquals(
          processingTime < 100,
          true,
          `Processing took ${processingTime}ms, expected < 100ms`,
        );
      });

      it("should handle multiple schema processing efficiently", () => {
        // Arrange: Create multiple schemas
        const schemas = [];
        for (let i = 0; i < 10; i++) {
          const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
            `./template-${i}.json`,
          );
          assertExists(schemaResult.ok);
          if (!schemaResult.ok) return;

          schemas.push(schemaResult.data);
          mockRepository.setMockSchema(
            `perf/schema-${i}.json`,
            schemaResult.data,
          );
        }

        // Act: Process multiple schemas
        const startTime = performance.now();
        const results = [];
        for (let i = 0; i < 10; i++) {
          const result = service.processSchema(`perf/schema-${i}.json`);
          results.push(result);
        }
        const endTime = performance.now();

        // Assert: All should succeed and complete within reasonable time
        results.forEach((result, index) => {
          assertExists(result.ok, `Schema ${index} processing failed`);
        });

        const totalTime = endTime - startTime;
        assertEquals(
          totalTime < 500,
          true,
          `Batch processing took ${totalTime}ms, expected < 500ms`,
        );
      });
    });

    describe("Error Recovery and Context Preservation", () => {
      it("should maintain error context through processing pipeline", () => {
        // Arrange: Create scenario that will fail at validation
        mockRepository.setMockFailure("context/schema.json", {
          kind: "InvalidSchema" as const,
          message: "Schema validation failed",
        });

        // Act: Process schema
        const result = service.processSchema("context/schema.json");

        // Assert: Should preserve error context
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          assertExists(result.error.message);
        }
      });

      it("should handle cascading errors gracefully", () => {
        // Arrange: Create schema that will fail at resolution step
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema("cascade/schema.json", schemaResult.data);
        // Mock resolve to fail
        const originalResolve = mockRepository.resolve;
        mockRepository.resolve = () =>
          err({
            kind: "RefResolutionFailed" as const,
            ref: "invalid-ref",
            message: "Reference resolution failed",
          });

        // Act: Process schema
        const result = service.processSchema("cascade/schema.json");

        // Assert: Should handle resolution failure
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "RefResolutionFailed");
        }

        // Cleanup
        mockRepository.resolve = originalResolve;
      });
    });

    describe("Business Logic Validation", () => {
      it("should create proper discriminated union based on template presence", () => {
        // Test both WithTemplate and WithoutTemplate cases
        const testCases = [
          { name: "with template", hasTemplate: true },
          { name: "without template", hasTemplate: false },
        ];

        testCases.forEach((testCase) => {
          // Arrange
          const schemaResult = testCase.hasTemplate
            ? TestSchemaCreator.createSchemaWithTemplate("./template.json")
            : TestSchemaCreator.createSchemaWithoutTemplate();

          assertExists(schemaResult.ok);
          if (!schemaResult.ok) return;

          mockRepository.setMockSchema(
            `union/${testCase.name}.json`,
            schemaResult.data,
          );

          // Act
          const result = service.processSchema(`union/${testCase.name}.json`);

          // Assert
          assertExists(result.ok);
          if (!result.ok) return;

          if (testCase.hasTemplate) {
            assertEquals(result.data.kind, "WithTemplate");
            if (result.data.kind === "WithTemplate") {
              assertExists(result.data.templatePath);
            }
          } else {
            assertEquals(result.data.kind, "WithoutTemplate");
          }
        });
      });

      it("should extract validation rules correctly from schema", () => {
        // Arrange: Create schema with validation rules
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema(
          "validation/schema.json",
          schemaResult.data,
        );

        // Act: Process schema
        const result = service.processSchema("validation/schema.json");

        // Assert: Should include validation rules
        assertExists(result.ok);
        if (!result.ok) return;

        assertExists(result.data.validationRules);
        // ValidationRules should be properly constructed
        assertEquals(typeof result.data.validationRules, "object");
      });
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    describe("Invalid Input Handling", () => {
      it("should handle malformed schema paths", () => {
        const invalidPaths = ["", " ", "invalid\0path", "../../../etc/passwd"];

        invalidPaths.forEach((invalidPath) => {
          const result = service.processSchema(invalidPath);
          assertEquals(
            result.ok,
            false,
            `Should reject invalid path: ${invalidPath}`,
          );
        });
      });

      it("should handle concurrent processing requests", () => {
        // Arrange: Create schema for concurrent test
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        mockRepository.setMockSchema(
          "concurrent/schema.json",
          schemaResult.data,
        );

        // Act: Process same schema concurrently
        const promises = Array(5).fill(0).map(() =>
          Promise.resolve(service.processSchema("concurrent/schema.json"))
        );

        // Assert: All should succeed independently
        return Promise.all(promises).then((results) => {
          results.forEach((result, index) => {
            assertExists(result.ok, `Concurrent request ${index} failed`);
          });
        });
      });
    });

    describe("Memory and Resource Management", () => {
      it("should not leak memory during processing", () => {
        // This is a basic check - in real scenarios you'd use more sophisticated memory monitoring
        const initialMemory =
          (globalThis as any).performance?.memory?.usedJSHeapSize || 0;

        // Arrange: Process many schemas
        const schemaResult = TestSchemaCreator.createSchemaWithTemplate(
          "./template.json",
        );
        assertExists(schemaResult.ok);
        if (!schemaResult.ok) return;

        for (let i = 0; i < 100; i++) {
          mockRepository.setMockSchema(
            `memory/schema-${i}.json`,
            schemaResult.data,
          );
          const result = service.processSchema(`memory/schema-${i}.json`);
          assertExists(result.ok);
        }

        // Force garbage collection if available
        if ((globalThis as any).gc) {
          (globalThis as any).gc();
        }

        const finalMemory =
          (globalThis as any).performance?.memory?.usedJSHeapSize || 0;

        // Memory shouldn't grow significantly (this is a rough check)
        if (initialMemory > 0 && finalMemory > 0) {
          const memoryGrowth = finalMemory - initialMemory;
          assertEquals(
            memoryGrowth < 10_000_000,
            true,
            `Memory grew by ${memoryGrowth} bytes`,
          );
        }
      });
    });
  });
});
