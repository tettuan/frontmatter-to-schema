/**
 * Specification-driven tests for DirectiveProcessor
 *
 * This test file validates business requirements for directive processing orchestration
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import { DirectiveProcessor } from "../../../../src/application/services/directive-processor.ts";
import { DirectiveType } from "../../../../src/domain/schema/directive-order.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../helpers/specification-test-framework.ts";

/**
 * In-memory logger for specification testing
 * Implements actual logging behavior following business rules
 */
class InMemoryLogger {
  public readonly infoLogs: Array<{ message: string; context?: unknown }> = [];
  public readonly debugLogs: Array<{ message: string; context?: unknown }> = [];
  public readonly errorLogs: Array<{ message: string; error?: unknown }> = [];
  public readonly warningLogs: Array<{ message: string; context?: unknown }> =
    [];

  logInfo(operation: string, message: string, context?: unknown): void {
    this.infoLogs.push({ message: `[${operation}] ${message}`, context });
  }

  logDebug(operation: string, message: string, context?: unknown): void {
    this.debugLogs.push({ message: `[${operation}] ${message}`, context });
  }

  logError(operation: string, message: string, error?: unknown): void {
    this.errorLogs.push({ message: `[${operation}] ${message}`, error });
  }

  logWarning(operation: string, message: string, context?: unknown): void {
    this.warningLogs.push({ message: `[${operation}] ${message}`, context });
  }
}

/**
 * Test data builder for schema-like objects
 * Creates valid business scenarios without mock complexity
 */
class TestSchemaBuilder {
  private id = "test-schema";
  private path = "test-schema-path";
  private hasFrontmatterPart = false;
  private rawSchema: unknown = {};

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withPath(path: string): this {
    this.path = path;
    return this;
  }

  withFrontmatterPart(): this {
    this.hasFrontmatterPart = true;
    return this;
  }

  withRawSchema(schema: unknown): this {
    this.rawSchema = schema;
    return this;
  }

  build(): any {
    return {
      getId: () => this.id,
      getPath: () => ({ toString: () => this.path }),
      findFrontmatterPartSchema: () => ({
        ok: this.hasFrontmatterPart,
        data: this.hasFrontmatterPart ? {} : undefined,
      }),
      getDefinition: () => ({ getRawSchema: () => this.rawSchema }),
    };
  }
}

/**
 * Business requirements for directive processing
 */
const directiveProcessingRequirements = {
  orderDetermination: {
    name: "directive-order-determination",
    description: "Directives must be processed in correct dependency order",
    validator: (data: any) => ({
      isValid: Array.isArray(data.orderedDirectives) &&
        data.orderedDirectives.length > 0,
      violation: !Array.isArray(data.orderedDirectives)
        ? "Directive order must be determined"
        : undefined,
    }),
  },

  processingCompletion: {
    name: "processing-completion",
    description: "Directive processing must complete successfully",
    validator: (data: any) => ({
      isValid: data.success === true && data.finalData !== undefined,
      violation: data.success !== true
        ? "Processing must complete successfully"
        : undefined,
    }),
  },

  supportedDirectives: {
    name: "supported-directives-availability",
    description: "All supported directives must be available for processing",
    validator: (data: any) => ({
      isValid: Array.isArray(data.directives) && data.directives.length >= 6,
      violation: !Array.isArray(data.directives) || data.directives.length < 6
        ? "Minimum required directives must be supported"
        : undefined,
    }),
  },

  loggingIntegrity: {
    name: "processing-logging-integrity",
    description: "Processing steps must be logged for observability",
    validator: (data: any) => ({
      isValid: data.hasStartLog && data.hasCompleteLog,
      violation: !data.hasStartLog || !data.hasCompleteLog
        ? "Processing lifecycle must be logged"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Directive Processor Initialization", () => {
  describe("GIVEN: DirectiveProcessor creation request", () => {
    it("WHEN: Creating processor THEN: Should initialize successfully", async () => {
      // Arrange - Business scenario setup
      // Act - Execute business operation
      const result = await DirectiveProcessor.create();

      // Assert - Validate business requirements
      assert(result.ok, "DirectiveProcessor creation should succeed");

      if (result.ok) {
        // Business requirement: Processor must be properly initialized
        assert(
          result.data instanceof DirectiveProcessor,
          "Must return valid DirectiveProcessor instance",
        );
      }
    });

    it("WHEN: Creating processor with custom logger THEN: Should accept logger configuration", async () => {
      // Arrange - Business scenario with custom logging
      const logger = new InMemoryLogger();

      // Act - Execute processor creation with logger
      const result = await DirectiveProcessor.create(logger);

      // Assert - Validate business requirements
      assert(result.ok, "Processor with custom logger should be created");

      if (result.ok) {
        assert(
          result.data instanceof DirectiveProcessor,
          "Must return valid DirectiveProcessor instance with logger",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Directive Processing Order", () => {
  describe("GIVEN: Multiple directives requiring processing", () => {
    it("WHEN: Determining processing order THEN: Should establish correct dependency order", async () => {
      // Arrange - Business scenario with common directives
      const processorResult = await DirectiveProcessor.create();
      assert(processorResult.ok, "Processor creation should succeed");

      const directives: DirectiveType[] = [
        "x-template",
        "x-derived-from",
        "x-frontmatter-part",
        "x-jmespath-filter",
      ];

      // Act - Execute order determination
      const orderResult = processorResult.data.getProcessingOrder(directives);

      // Assert - Validate business requirements
      assert(orderResult.ok, "Order determination should succeed");

      if (orderResult.ok) {
        const order = orderResult.data;

        // Business requirement: Correct dependency order must be established
        // Note: Updated after removing deprecated x-extract-from and x-merge-arrays directives
        assertEquals(order.orderedDirectives.length, 4);
        assertEquals(
          order.orderedDirectives[0],
          "x-frontmatter-part",
          "Frontmatter part must be processed first",
        );
        assertEquals(
          order.orderedDirectives[1],
          "x-jmespath-filter",
          "Extraction must follow frontmatter processing",
        );
        assertEquals(
          order.orderedDirectives[2],
          "x-derived-from",
          "Derivation must follow jmespath filtering",
        );
        assertEquals(
          order.orderedDirectives[3],
          "x-template",
          "Template must follow derivation",
        );

        // Validate order determination requirement
        SpecificationAssertions.assertBusinessRequirement(
          { orderedDirectives: order.orderedDirectives },
          directiveProcessingRequirements.orderDetermination,
          "Directive order must be properly determined",
        );

        // Business requirement: Processing stages must be defined
        assertEquals(order.stages.length, 4);
        assert(order.dependencyGraph, "Dependency graph must exist");
      }
    });

    it("WHEN: Requesting supported directives THEN: Should provide complete directive catalog", async () => {
      // Arrange - Business scenario for directive discovery
      const processorResult = await DirectiveProcessor.create();
      assert(processorResult.ok);

      // Act - Execute supported directives query
      const supportedDirectives = processorResult.data.getSupportedDirectives();

      // Assert - Validate business requirements
      // Business requirement: All core directives must be supported
      // Note: Updated after removing deprecated x-extract-from and x-merge-arrays directives
      assertEquals(
        supportedDirectives.length,
        6,
        "Must support all required directives",
      );

      const requiredDirectives: DirectiveType[] = [
        "x-frontmatter-part",
        "x-jmespath-filter",
        "x-derived-from",
        "x-derived-unique",
        "x-template",
        "x-template-items",
      ];

      for (const directive of requiredDirectives) {
        assert(
          supportedDirectives.includes(directive as DirectiveType),
          `Must support ${directive} directive`,
        );
      }

      // Validate supported directives requirement
      SpecificationAssertions.assertBusinessRequirement(
        { directives: supportedDirectives },
        directiveProcessingRequirements.supportedDirectives,
        "All required directives must be supported",
      );
    });

    it("WHEN: Processing invalid directives THEN: Should handle gracefully", async () => {
      // Arrange - Business scenario with invalid input
      const processorResult = await DirectiveProcessor.create();
      assert(processorResult.ok);

      const invalidDirectives: any[] = ["invalid-directive"];

      // Act - Execute order determination with invalid input
      const orderResult = processorResult.data.getProcessingOrder(
        invalidDirectives,
      );

      // Assert - Validate graceful handling
      assert(orderResult.ok, "Invalid directives should be handled gracefully");

      if (orderResult.ok) {
        // Business requirement: Invalid directives should be filtered out
        assertEquals(
          orderResult.data.orderedDirectives.length,
          0,
          "Invalid directives must be filtered",
        );
        assertEquals(
          orderResult.data.stages.length,
          0,
          "No stages for invalid directives",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Directive Processing Execution", () => {
  describe("GIVEN: Schema and data for processing", () => {
    it("WHEN: Processing with empty data THEN: Should complete successfully", async () => {
      // Arrange - Business scenario with minimal data
      const processorResult = await DirectiveProcessor.create();
      assert(processorResult.ok);

      const schema = new TestSchemaBuilder()
        .withId("test-schema")
        .withPath("test-schema-path")
        .build();

      const data: any[] = [];

      // Act - Execute directive processing
      const result = await processorResult.data.processDirectives(
        schema,
        data,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Processing should succeed with empty data");

      if (result.ok) {
        // Business requirement: Processing must complete successfully
        assertEquals(result.data.success, true);
        assertEquals(result.data.finalData.length, 0);
        assertEquals(result.data.stageResults.length, 0);
        assertEquals(result.data.directivesProcessed.length, 0);
        assert(
          result.data.totalProcessingTime >= 0,
          "Processing time must be tracked",
        );

        // Validate processing completion requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            success: result.data.success,
            finalData: result.data.finalData,
          },
          directiveProcessingRequirements.processingCompletion,
          "Processing must complete successfully",
        );
      }
    });

    it("WHEN: Processing with frontmatter-part directive THEN: Should detect and process directive", async () => {
      // Arrange - Business scenario with directive present
      const logger = new InMemoryLogger();
      const processorResult = await DirectiveProcessor.create(logger);
      assert(processorResult.ok);

      const schema = new TestSchemaBuilder()
        .withId("schema-with-directives")
        .withPath("schema-with-directives-path")
        .withFrontmatterPart()
        .build();

      const data: any[] = [];

      // Act - Execute processing with directive detection
      const result = await processorResult.data.processDirectives(
        schema,
        data,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Processing with directives should succeed");

      if (result.ok) {
        assertEquals(result.data.success, true);

        // Business requirement: Processing lifecycle must be logged
        const hasStartLog = logger.infoLogs.some((log) =>
          log.message.includes("Starting directive processing pipeline")
        );
        const hasCompleteLog = logger.infoLogs.some((log) =>
          log.message.includes("Completed directive processing pipeline")
        );

        assert(hasStartLog, "Processing start must be logged");
        assert(hasCompleteLog, "Processing completion must be logged");

        // Validate logging integrity requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasStartLog, hasCompleteLog },
          directiveProcessingRequirements.loggingIntegrity,
          "Processing lifecycle must be logged",
        );

        // Business requirement: Debug information must be available
        assert(
          logger.debugLogs.length > 0,
          "Debug information must be logged",
        );
      }
    });

    it("WHEN: Processing multiple schemas THEN: Should handle each independently", async () => {
      // Arrange - Business scenario with multiple processing operations
      const processorResult = await DirectiveProcessor.create();
      assert(processorResult.ok);

      const schema1 = new TestSchemaBuilder()
        .withId("schema-1")
        .withPath("schema-1-path")
        .build();

      const schema2 = new TestSchemaBuilder()
        .withId("schema-2")
        .withPath("schema-2-path")
        .withFrontmatterPart()
        .build();

      const data: any[] = [];

      // Act - Execute multiple processing operations
      const result1 = await processorResult.data.processDirectives(
        schema1,
        data,
      );
      const result2 = await processorResult.data.processDirectives(
        schema2,
        data,
      );

      // Assert - Validate independent processing
      assert(result1.ok, "First schema processing should succeed");
      assert(result2.ok, "Second schema processing should succeed");

      if (result1.ok && result2.ok) {
        // Business requirement: Each processing operation is independent
        assertEquals(result1.data.success, true);
        assertEquals(result2.data.success, true);

        // Processing results should be independent
        assert(
          result1.data.totalProcessingTime >= 0,
          "First processing time tracked",
        );
        assert(
          result2.data.totalProcessingTime >= 0,
          "Second processing time tracked",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Directive Processing", () => {
  const directiveProcessingRules: DomainRule<any> = {
    name: "directive-processing-completeness",
    description: "Directive processing must handle all business scenarios",
    validator: (data) => ({
      isValid: data.processor &&
        typeof data.processor.processDirectives === "function" &&
        typeof data.processor.getProcessingOrder === "function" &&
        typeof data.processor.getSupportedDirectives === "function",
      violation:
        "Directive processor must provide complete processing interface",
    }),
  };

  it("Should enforce directive processing domain rules", async () => {
    const processorResult = await DirectiveProcessor.create();
    assert(processorResult.ok);

    SpecificationAssertions.assertDomainRule(
      { processor: processorResult.data },
      directiveProcessingRules,
      "directive-processing",
      "Directive processing must satisfy domain requirements",
    );
  });
});
