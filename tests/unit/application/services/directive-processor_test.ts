/**
 * @fileoverview Test Suite for DirectiveProcessor Application Service - Issue #900
 * @description Tests for directive processing orchestration with proper ordering
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DirectiveProcessor } from "../../../../src/application/services/directive-processor.ts";
import { DirectiveType } from "../../../../src/domain/schema/directive-order.ts";
import { MockDomainLogger } from "../../../helpers/mock-domain-logger.ts";

describe("DirectiveProcessor", () => {
  describe("Smart Constructor", () => {
    it("should create DirectiveProcessor instance successfully", async () => {
      const result = await DirectiveProcessor.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assert(result.data instanceof DirectiveProcessor);
      }
    });

    it("should create DirectiveProcessor with custom logger", async () => {
      const mockLogger = new MockDomainLogger();
      const result = await DirectiveProcessor.create(mockLogger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assert(result.data instanceof DirectiveProcessor);
      }
    });
  });

  describe("Processing Order Interface", () => {
    it("should return correct processing order for given directives", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;
        const directives: DirectiveType[] = [
          "x-template",
          "x-derived-from",
          "x-frontmatter-part",
          "x-extract-from",
        ];

        const orderResult = processor.getProcessingOrder(directives);
        assertEquals(orderResult.ok, true);

        if (orderResult.ok) {
          const order = orderResult.data;

          assertEquals(order.orderedDirectives.length, 4);
          assertEquals(order.orderedDirectives[0], "x-frontmatter-part");
          assertEquals(order.orderedDirectives[1], "x-extract-from");
          assertEquals(order.orderedDirectives[2], "x-derived-from");
          assertEquals(order.orderedDirectives[3], "x-template");

          assertEquals(order.stages.length, 4);
          assertExists(order.dependencyGraph);
        }
      }
    });

    it("should provide list of supported directives", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;
        const supportedDirectives = processor.getSupportedDirectives();

        assertEquals(supportedDirectives.length, 8);
        assert(supportedDirectives.includes("x-frontmatter-part"));
        assert(supportedDirectives.includes("x-extract-from"));
        assert(supportedDirectives.includes("x-jmespath-filter"));
        assert(supportedDirectives.includes("x-merge-arrays"));
        assert(supportedDirectives.includes("x-derived-from"));
        assert(supportedDirectives.includes("x-derived-unique"));
        assert(supportedDirectives.includes("x-template"));
        assert(supportedDirectives.includes("x-template-items"));
      }
    });
  });

  describe("Directive Detection", () => {
    // Note: Full directive processing tests would require mock Schema objects
    // These tests focus on the interface and error handling

    it("should handle processing with mock schema and data", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        // Mock minimal schema and data for interface testing
        const mockSchema = {
          getId: () => "mock-schema-id",
          getPath: () => ({ toString: () => "mock-schema-path" }),
          findFrontmatterPartSchema: () => ({ ok: false }),
          getDefinition: () => ({ getRawSchema: () => ({}) }),
        } as any;

        const mockData = [] as any[];

        const result = await processor.processDirectives(mockSchema, mockData);

        // Should succeed even with empty data and no directives
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.success, true);
          assertEquals(result.data.finalData.length, 0);
          assertEquals(result.data.stageResults.length, 0);
          assertEquals(result.data.directivesProcessed.length, 0);
          assert(result.data.totalProcessingTime >= 0);
        }
      }
    });

    it("should handle processing order determination errors gracefully", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        // Test with invalid directive type (this would be caught by TypeScript in real usage)
        const invalidDirectives: any[] = ["invalid-directive"];

        const orderResult = processor.getProcessingOrder(invalidDirectives);

        // Should handle gracefully - invalid directives would be filtered out
        assertEquals(orderResult.ok, true);
        if (orderResult.ok) {
          assertEquals(orderResult.data.orderedDirectives.length, 0);
          assertEquals(orderResult.data.stages.length, 0);
        }
      }
    });
  });

  describe("Logging Integration", () => {
    it("should log processing steps with custom logger", async () => {
      const mockLogger = new MockDomainLogger();
      const processorResult = await DirectiveProcessor.create(mockLogger);
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        const mockSchema = {
          getId: () => "test-schema",
          getPath: () => ({ toString: () => "test-schema-path" }),
          findFrontmatterPartSchema: () => ({ ok: false }),
          getDefinition: () => ({ getRawSchema: () => ({}) }),
        } as any;

        const mockData = [] as any[];

        const result = await processor.processDirectives(mockSchema, mockData);

        assertEquals(result.ok, true);

        // Verify logging calls were made
        assert(mockLogger.infoLogs.length > 0);
        assert(mockLogger.debugLogs.length > 0);

        // Check for specific log messages
        const hasProcessingStart = mockLogger.infoLogs.some((log) =>
          log.message.includes("Starting directive processing pipeline")
        );
        assert(hasProcessingStart);

        const hasProcessingComplete = mockLogger.infoLogs.some((log) =>
          log.message.includes("Completed directive processing pipeline")
        );
        assert(hasProcessingComplete);
      }
    });

    it("should include directive order debug information in logs", async () => {
      const mockLogger = new MockDomainLogger();
      const processorResult = await DirectiveProcessor.create(mockLogger);
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        // Mock schema with x-frontmatter-part to trigger directive detection
        const mockSchema = {
          getId: () => "test-schema-with-directives",
          getPath: () => ({
            toString: () => "test-schema-with-directives-path",
          }),
          findFrontmatterPartSchema: () => ({ ok: true, data: {} }),
          getDefinition: () => ({
            getRawSchema: () => ({
              properties: {
                testField: {
                  "x-extract-from": "test.path",
                },
              },
            }),
          }),
        } as any;

        const mockData = [] as any[];

        const result = await processor.processDirectives(mockSchema, mockData);

        assertEquals(result.ok, true);

        // Check for directive order debug logs
        const hasDirectiveDetection = mockLogger.debugLogs.some((log) =>
          log.message.includes("DIRECTIVE-ORDER-DEBUG") &&
          log.message.includes("Detected directives")
        );
        assert(hasDirectiveDetection);

        const hasOrderDetermination = mockLogger.infoLogs.some((log) =>
          log.message.includes("DIRECTIVE-ORDER-DEBUG") &&
          log.message.includes("Determined directive processing order")
        );
        assert(hasOrderDetermination);
      }
    });
  });

  describe("Processing Result Structure", () => {
    it("should return well-structured processing result", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        const mockSchema = {
          getId: () => "result-structure-test",
          getPath: () => ({ toString: () => "result-structure-test-path" }),
          findFrontmatterPartSchema: () => ({ ok: false }),
          getDefinition: () => ({ getRawSchema: () => ({}) }),
        } as any;

        const mockData = [] as any[];

        const result = await processor.processDirectives(mockSchema, mockData);

        assertEquals(result.ok, true);
        if (result.ok) {
          const processingResult = result.data;

          // Verify all required fields are present
          assertExists(processingResult.success);
          assertExists(processingResult.finalData);
          assertExists(processingResult.stageResults);
          assertExists(processingResult.totalProcessingTime);
          assertExists(processingResult.directivesProcessed);
          assertExists(processingResult.processingOrder);

          // Verify types
          assertEquals(typeof processingResult.success, "boolean");
          assert(Array.isArray(processingResult.finalData));
          assert(Array.isArray(processingResult.stageResults));
          assertEquals(typeof processingResult.totalProcessingTime, "number");
          assert(Array.isArray(processingResult.directivesProcessed));
          assertExists(processingResult.processingOrder.orderedDirectives);
          assertExists(processingResult.processingOrder.stages);
          assertExists(processingResult.processingOrder.dependencyGraph);
        }
      }
    });

    it("should handle empty processing gracefully", async () => {
      const processorResult = await DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);

      if (processorResult.ok) {
        const processor = processorResult.data;

        const mockSchema = {
          getId: () => "empty-processing-test",
          getPath: () => ({ toString: () => "empty-processing-test-path" }),
          findFrontmatterPartSchema: () => ({ ok: false }),
          getDefinition: () => ({ getRawSchema: () => ({}) }),
        } as any;

        const mockData = [] as any[];

        const result = await processor.processDirectives(mockSchema, mockData);

        assertEquals(result.ok, true);
        if (result.ok) {
          const processingResult = result.data;

          assertEquals(processingResult.success, true);
          assertEquals(processingResult.finalData.length, 0);
          assertEquals(processingResult.stageResults.length, 0);
          assertEquals(processingResult.directivesProcessed.length, 0);
          assert(processingResult.totalProcessingTime >= 0);
        }
      }
    });
  });
});
