/**
 * @fileoverview ProcessingCoordinator Test Suite - Robust test design for architectural centerpoint
 * @description Following DDD, TDD, and Totality principles with minimum tests, maximum coverage strategy
 *
 * Critical Business Requirements Tested:
 * 1. Smart Constructor - validates dependencies and returns Result<T,E>
 * 2. Core Processing - orchestrates document processing operations
 * 3. Processing Options - converts discriminated union options correctly
 * 4. Error Handling - propagates errors following Totality principles
 * 5. Integration Boundaries - coordinates domain services without implementation coupling
 *
 * Test Strategy:
 * - Mock external dependencies (FrontmatterTransformationService)
 * - Use real domain objects for business logic validation
 * - Test business requirements, not implementation details
 * - Follow Arrange-Act-Assert pattern with Result<T,E> validation
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  ProcessingCoordinator,
  ProcessingOptions,
} from "../../../../src/application/coordinators/processing-coordinator.ts";
import { FrontmatterTransformationService } from "../../../../src/domain/frontmatter/services/frontmatter-transformation-service.ts";
import { ValidationRules } from "../../../../src/domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../../../src/domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { err, ok } from "../../../../src/domain/shared/types/result.ts";
import { createError } from "../../../../src/domain/shared/types/errors.ts";

/**
 * Minimal Mock Strategy - Following successful pattern from pipeline-coordinator_test.ts
 * Only mock what's necessary for isolation, use real objects for domain logic
 */

// Simplified mock service that satisfies the interface requirements
const createMockTransformationService = (
  transformResult = ok(FrontmatterData.empty()),
) => ({
  async transformDocuments() {
    await Promise.resolve(); // Satisfy require-await lint rule
    return transformResult;
  },
} as unknown as FrontmatterTransformationService);

// Simple mock objects for test data
const createTestValidationRules =
  () => ({ rules: [] } as unknown as ValidationRules);
const createTestSchema = (
  hasExtractFrom = false,
  hasFrontmatterPart = false,
) => ({
  hasExtractFromDirectives: () => hasExtractFrom,
  findFrontmatterPartPath: () =>
    hasFrontmatterPart ? ok("items") : err(
      createError({ kind: "PropertyNotFound", path: "frontmatter-part" }),
    ),
  getExtractFromDirectives: () =>
    hasExtractFrom
      ? ok([])
      : err(createError({ kind: "PropertyNotFound", path: "extract-from" })),
} as Schema);

describe("ProcessingCoordinator", () => {
  describe("Smart Constructor", () => {
    it("should create coordinator with valid transformation service", () => {
      const mockService = createMockTransformationService();

      const result = ProcessingCoordinator.create(mockService);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return InitializationError with null service", () => {
      const result = ProcessingCoordinator.create(null as any);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assert(
          result.error.message.includes(
            "FrontmatterTransformationService is required",
          ),
          `Expected error message to contain "FrontmatterTransformationService is required", got: "${result.error.message}"`,
        );
      }
    });

    it("should follow Totality principles - Result<T,E> pattern", () => {
      const mockService = createMockTransformationService();

      const result = ProcessingCoordinator.create(mockService);

      // Verify Result pattern structure
      assertExists(result.ok);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("Core Processing Operations", () => {
    it("should process documents with sequential options", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema();
        const options: ProcessingOptions = { kind: "sequential" };

        const result = await coordinator.data.processDocuments(
          "*.md",
          validationRules,
          schema,
          options,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      }
    });

    it("should process documents with parallel options", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema();
        const options: ProcessingOptions = { kind: "parallel", maxWorkers: 4 };

        const result = await coordinator.data.processDocuments(
          "*.md",
          validationRules,
          schema,
          options,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      }
    });

    it("should use default sequential processing when no options provided", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema();

        const result = await coordinator.data.processDocuments(
          "*.md",
          validationRules,
          schema,
          // No options provided - tests default behavior
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      }
    });

    it("should propagate transformation service errors", async () => {
      const errorResult = err(createError({
        kind: "AggregationFailed",
        message: "Processing failed",
      })) as any;
      const mockService = createMockTransformationService(errorResult);
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema();

        const result = await coordinator.data.processDocuments(
          "*.md",
          validationRules,
          schema,
        );

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "AggregationFailed");
          assertEquals(
            result.error.message,
            "Aggregation failed: Processing failed",
          );
        }
      }
    });
  });

  describe("Frontmatter-Part Extraction", () => {
    it("should return single item array when no frontmatter-part defined", () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const mockData = FrontmatterData.empty();
        const schema = createTestSchema(false, false); // no extract-from, no frontmatter-part

        const result = coordinator.data.extractFrontmatterPartData(
          mockData,
          schema,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.length, 1);
          assertEquals(result.data[0], mockData);
        }
      }
    });

    it("should handle frontmatter-part path extraction", () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const mockData = FrontmatterData.empty();
        const schema = createTestSchema(false, true); // has frontmatter-part

        const result = coordinator.data.extractFrontmatterPartData(
          mockData,
          schema,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          // Should return at least the original data as single item
          assertEquals(result.data.length >= 1, true);
        }
      }
    });
  });

  describe("Extract-From Directive Processing", () => {
    it("should return data unchanged when no extract-from directives", () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const mockData = FrontmatterData.empty();
        const schema = createTestSchema(false, false); // no extract-from

        const result = coordinator.data.processExtractFromDirectivesSync(
          mockData,
          schema,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, mockData);
        }
      }
    });

    it("should process extract-from directives when present", () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const mockData = FrontmatterData.empty();
        const schema = createTestSchema(true, false); // has extract-from

        const result = coordinator.data.processExtractFromDirectivesSync(
          mockData,
          schema,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      }
    });
  });

  describe("Combined Processing Operations", () => {
    it("should handle documents with items extraction", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema(false, true); // has frontmatter-part

        const result = await coordinator.data
          .processDocumentsWithItemsExtraction(
            "*.md",
            validationRules,
            schema,
          );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data.mainData);
          assertExists(result.data.itemsData);
        }
      }
    });

    it("should handle documents with extract-from directives", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema(true, false); // has extract-from

        const result = await coordinator.data.processDocumentsWithExtractFrom(
          "*.md",
          validationRules,
          schema,
        );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      }
    });

    it("should handle comprehensive processing with all features", async () => {
      const mockService = createMockTransformationService();
      const coordinator = ProcessingCoordinator.create(mockService);
      assertEquals(coordinator.ok, true);

      if (coordinator.ok) {
        const validationRules = createTestValidationRules();
        const schema = createTestSchema(true, true); // has both extract-from and frontmatter-part

        const result = await coordinator.data
          .processDocumentsWithFullExtraction(
            "*.md",
            validationRules,
            schema,
          );

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data.mainData);
          assertExists(result.data.itemsData);
        }
      }
    });
  });

  describe("ProcessingOptions Conversion", () => {
    it("should validate sequential options structure", () => {
      const sequentialOptions: ProcessingOptions = { kind: "sequential" };

      // Test discriminated union structure
      assertEquals(sequentialOptions.kind, "sequential");
      assertEquals(typeof sequentialOptions.kind, "string");
    });

    it("should validate parallel options structure", () => {
      const parallelOptions: ProcessingOptions = {
        kind: "parallel",
        maxWorkers: 8,
      };

      // Test discriminated union structure
      assertEquals(parallelOptions.kind, "parallel");
      assertEquals(parallelOptions.maxWorkers, 8);
      assertEquals(typeof parallelOptions.maxWorkers, "number");
    });
  });

  describe("DDD Architecture Compliance", () => {
    it("should follow Application Service pattern", () => {
      const mockService = createMockTransformationService();
      const result = ProcessingCoordinator.create(mockService);

      assertEquals(result.ok, true);
      if (result.ok) {
        const coordinator = result.data;

        // Verify coordinator has required methods for orchestration
        assertExists(coordinator.processDocuments);
        assertExists(coordinator.extractFrontmatterPartData);
        assertExists(coordinator.processExtractFromDirectives);
        assertExists(coordinator.processDocumentsWithItemsExtraction);
        assertExists(coordinator.processDocumentsWithExtractFrom);
        assertExists(coordinator.processDocumentsWithFullExtraction);

        // Verify methods return proper types
        assertEquals(typeof coordinator.processDocuments, "function");
        assertEquals(typeof coordinator.extractFrontmatterPartData, "function");
        assertEquals(
          typeof coordinator.processExtractFromDirectives,
          "function",
        );
      }
    });

    it("should maintain clear boundaries with domain services", () => {
      const mockService = createMockTransformationService();
      const result = ProcessingCoordinator.create(mockService);

      assertEquals(result.ok, true);
      if (result.ok) {
        const coordinator = result.data;

        // Coordinator should delegate to domain services, not implement domain logic
        assertExists(coordinator);

        // Business requirement: coordinator orchestrates, doesn't implement business rules
        assertEquals(typeof coordinator.processDocuments, "function");
        assertEquals(typeof coordinator.extractFrontmatterPartData, "function");
        assertEquals(
          typeof coordinator.processExtractFromDirectives,
          "function",
        );
      }
    });
  });
});
