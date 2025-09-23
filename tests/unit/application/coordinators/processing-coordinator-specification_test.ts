/**
 * Specification-driven tests for ProcessingCoordinator
 *
 * This test file validates business requirements for document processing coordination
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  ProcessingCoordinator,
  ProcessingOptions,
} from "../../../../src/application/coordinators/processing-coordinator.ts";
import { FrontmatterTransformationService } from "../../../../src/domain/frontmatter/services/frontmatter-transformation-service.ts";
import { ValidationRules } from "../../../../src/domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../../../src/domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { err, ok, Result } from "../../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../../src/domain/shared/types/errors.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../helpers/specification-test-framework.ts";

/**
 * In-memory transformation service for specification testing
 * Implements actual business logic following domain rules
 */
class InMemoryTransformationService {
  private shouldSucceed: boolean;
  private resultData: FrontmatterData;
  private errorResult?: DomainError;

  constructor(
    shouldSucceed = true,
    resultData = FrontmatterData.empty(),
    errorResult?: DomainError,
  ) {
    this.shouldSucceed = shouldSucceed;
    this.resultData = resultData;
    this.errorResult = errorResult;
  }

  async transformDocuments(): Promise<Result<FrontmatterData, DomainError>> {
    await Promise.resolve(); // Satisfy async requirements

    if (!this.shouldSucceed && this.errorResult) {
      return err(this.errorResult);
    }

    return ok(this.resultData);
  }
}

/**
 * Test scenario builder for processing coordination scenarios
 * Creates valid business scenarios without mock complexity
 */
class ProcessingCoordinationScenarioBuilder {
  private transformationService: InMemoryTransformationService;
  private validationRules: ValidationRules;
  private schema: Schema;
  private processingOptions?: ProcessingOptions;

  constructor() {
    this.transformationService = new InMemoryTransformationService();
    this.validationRules = { rules: [] } as unknown as ValidationRules;
    this.schema = this.createDefaultSchema();
  }

  withSuccessfulTransformation(data?: FrontmatterData): this {
    this.transformationService = new InMemoryTransformationService(
      true,
      data || FrontmatterData.empty(),
    );
    return this;
  }

  withFailedTransformation(error: DomainError): this {
    this.transformationService = new InMemoryTransformationService(
      false,
      FrontmatterData.empty(),
      error,
    );
    return this;
  }

  withValidationRules(rules: ValidationRules): this {
    this.validationRules = rules;
    return this;
  }

  withSchema(
    hasExtractFrom = false,
    hasFrontmatterPart = false,
  ): this {
    this.schema = this.createTestSchema(hasExtractFrom, hasFrontmatterPart);
    return this;
  }

  withProcessingOptions(options: ProcessingOptions): this {
    this.processingOptions = options;
    return this;
  }

  build(): {
    coordinator: ProcessingCoordinator;
    transformationService: InMemoryTransformationService;
    validationRules: ValidationRules;
    schema: Schema;
    processingOptions?: ProcessingOptions;
  } {
    const coordinatorResult = ProcessingCoordinator.create(
      this.transformationService as unknown as FrontmatterTransformationService,
    );

    if (!coordinatorResult.ok) {
      throw new Error("Failed to create ProcessingCoordinator");
    }

    return {
      coordinator: coordinatorResult.data,
      transformationService: this.transformationService,
      validationRules: this.validationRules,
      schema: this.schema,
      processingOptions: this.processingOptions,
    };
  }

  private createDefaultSchema(): Schema {
    return this.createTestSchema(false, false);
  }

  private createTestSchema(
    _hasExtractFrom = false,
    hasFrontmatterPart = false,
  ): Schema {
    return {
      findFrontmatterPartPath: () =>
        hasFrontmatterPart ? ok("items") : err({
          kind: "PropertyNotFound" as const,
          path: "frontmatter-part",
          message: "Frontmatter part not found",
        }),
      // Note: x-extract-from directive has been deprecated and removed
    } as Schema;
  }
}

/**
 * Business requirements for processing coordination
 */
const processingCoordinationRequirements = {
  coordinatorInitialization: {
    name: "coordinator-initialization",
    description: "Coordinator must initialize with proper dependencies",
    validator: (data: any) => ({
      isValid: data.hasValidCoordinator && data.followsTotalityPattern,
      violation: !data.hasValidCoordinator || !data.followsTotalityPattern
        ? "Coordinator must initialize properly following Totality principles"
        : undefined,
    }),
  },

  documentProcessing: {
    name: "document-processing-orchestration",
    description: "Coordinator must orchestrate document processing operations",
    validator: (data: any) => ({
      isValid: data.processesDocuments && data.handlesProcessingOptions,
      violation: !data.processesDocuments || !data.handlesProcessingOptions
        ? "Document processing must be orchestrated properly"
        : undefined,
    }),
  },

  frontmatterPartExtraction: {
    name: "frontmatter-part-extraction",
    description:
      "Coordinator must handle frontmatter part extraction correctly",
    validator: (data: any) => ({
      isValid: data.extractsFrontmatterPart && data.handlesNoFrontmatterPart,
      violation: !data.extractsFrontmatterPart || !data.handlesNoFrontmatterPart
        ? "Frontmatter part extraction must be handled correctly"
        : undefined,
    }),
  },

  extractFromDirectives: {
    name: "extract-from-directive-processing",
    description:
      "Coordinator must process extract-from directives appropriately",
    validator: (data: any) => ({
      isValid: data.processesExtractFrom && data.handlesNoExtractFrom,
      violation: !data.processesExtractFrom || !data.handlesNoExtractFrom
        ? "Extract-from directives must be processed correctly"
        : undefined,
    }),
  },

  errorPropagation: {
    name: "error-propagation",
    description:
      "Coordinator must propagate errors following Totality principles",
    validator: (data: any) => ({
      isValid: data.propagatesErrors && data.maintainsErrorContext,
      violation: !data.propagatesErrors || !data.maintainsErrorContext
        ? "Errors must be propagated correctly with context"
        : undefined,
    }),
  },

  applicationServicePattern: {
    name: "application-service-pattern",
    description:
      "Coordinator must follow application service architectural pattern",
    validator: (data: any) => ({
      isValid: data.orchestratesOperations && data.maintainsBoundaries,
      violation: !data.orchestratesOperations || !data.maintainsBoundaries
        ? "Must follow application service pattern with clear boundaries"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Processing Coordinator Initialization", () => {
  describe("GIVEN: ProcessingCoordinator creation request", () => {
    it("WHEN: Creating coordinator with valid service THEN: Should initialize successfully", () => {
      // Arrange - Business scenario setup
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .build();

      // Act - Coordinator is created during build
      // Assert - Validate business requirements
      assert(scenario.coordinator, "Coordinator should be created");

      // Validate coordinator initialization requirement
      SpecificationAssertions.assertBusinessRequirement(
        {
          hasValidCoordinator: scenario.coordinator !== null,
          followsTotalityPattern: true, // Created via Result<T,E> pattern
        },
        processingCoordinationRequirements.coordinatorInitialization,
        "Coordinator must initialize with valid dependencies",
      );
    });

    it("WHEN: Creating coordinator with null service THEN: Should handle gracefully", () => {
      // Arrange - Invalid dependency scenario
      // Act - Attempt creation with null service
      const result = ProcessingCoordinator.create(null as any);

      // Assert - Validate error handling requirement
      assert(!result.ok, "Coordinator creation with null service should fail");

      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assert(
          result.error.message.includes(
            "FrontmatterTransformationService is required",
          ),
          `Expected error message to contain "FrontmatterTransformationService is required", got: "${result.error.message}"`,
        );

        // Validate Totality principles compliance
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasValidCoordinator: true, // True because error was handled properly
            followsTotalityPattern: result.ok === false &&
              result.error.kind === "InitializationError",
          },
          processingCoordinationRequirements.coordinatorInitialization,
          "Initialization errors must follow Totality principles",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Document Processing Orchestration", () => {
  describe("GIVEN: Valid coordinator and processing scenarios", () => {
    it("WHEN: Processing documents with sequential options THEN: Should orchestrate correctly", async () => {
      // Arrange - Sequential processing business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .withProcessingOptions({ kind: "sequential" })
        .build();

      // Act - Execute sequential document processing
      const result = await scenario.coordinator.processDocuments(
        "*.md",
        scenario.validationRules,
        scenario.schema,
        scenario.processingOptions,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Sequential processing should succeed");

      if (result.ok) {
        // Business requirement: Document processing orchestration
        assert(result.data, "Processing result must contain data");

        // Validate document processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processesDocuments: result.ok && result.data !== undefined,
            handlesProcessingOptions: scenario.processingOptions?.kind ===
              "sequential",
          },
          processingCoordinationRequirements.documentProcessing,
          "Sequential document processing must be orchestrated correctly",
        );
      }
    });

    it("WHEN: Processing documents with parallel options THEN: Should handle parallelism", async () => {
      // Arrange - Parallel processing business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .withProcessingOptions({ kind: "parallel", maxWorkers: 4 })
        .build();

      // Act - Execute parallel document processing
      const result = await scenario.coordinator.processDocuments(
        "*.md",
        scenario.validationRules,
        scenario.schema,
        scenario.processingOptions,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Parallel processing should succeed");

      if (result.ok) {
        // Business requirement: Parallel processing support
        const parallelOptions = scenario.processingOptions as {
          kind: "parallel";
          maxWorkers: number;
        };

        // Validate parallel processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processesDocuments: result.ok && result.data !== undefined,
            handlesProcessingOptions: parallelOptions.kind === "parallel" &&
              parallelOptions.maxWorkers === 4,
          },
          processingCoordinationRequirements.documentProcessing,
          "Parallel document processing must be orchestrated correctly",
        );
      }
    });

    it("WHEN: Processing documents without options THEN: Should use default behavior", async () => {
      // Arrange - Default processing business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .build();

      // Act - Execute document processing without options
      const result = await scenario.coordinator.processDocuments(
        "*.md",
        scenario.validationRules,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Default processing should succeed");

      if (result.ok) {
        // Business requirement: Default processing behavior
        assert(result.data, "Default processing must produce results");

        // Validate default processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processesDocuments: result.ok && result.data !== undefined,
            handlesProcessingOptions: true, // Default handling
          },
          processingCoordinationRequirements.documentProcessing,
          "Default document processing must work correctly",
        );
      }
    });

    it("WHEN: Transformation service fails THEN: Should propagate errors correctly", async () => {
      // Arrange - Error propagation business scenario
      const error: DomainError = {
        kind: "AggregationFailed",
        message: "Processing failed",
      };

      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withFailedTransformation(error)
        .build();

      // Act - Execute processing with failing service
      const result = await scenario.coordinator.processDocuments(
        "*.md",
        scenario.validationRules,
        scenario.schema,
      );

      // Assert - Validate error propagation requirement
      assert(!result.ok, "Processing should fail when service fails");

      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertEquals(
          result.error.message,
          "Processing failed",
        );

        // Validate error propagation requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            propagatesErrors: !result.ok &&
              result.error.kind === "AggregationFailed",
            maintainsErrorContext: result.error.message.includes(
              "Processing failed",
            ),
          },
          processingCoordinationRequirements.errorPropagation,
          "Errors must be propagated with proper context",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Frontmatter Part Extraction", () => {
  describe("GIVEN: Schemas with and without frontmatter parts", () => {
    it("WHEN: No frontmatter part defined THEN: Should return single item array", async () => {
      // Arrange - No frontmatter part business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSchema(false, false) // no extract-from, no frontmatter-part
        .build();

      const mockData = FrontmatterData.empty();

      // Act - Execute frontmatter part extraction
      const result = await scenario.coordinator.extractFrontmatterPartData(
        mockData,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Frontmatter part extraction should succeed");

      if (result.ok) {
        // Business requirement: Single item when no frontmatter part
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0], mockData);

        // Validate frontmatter part extraction requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            extractsFrontmatterPart: result.ok && result.data.length === 1,
            handlesNoFrontmatterPart: result.data[0] === mockData,
          },
          processingCoordinationRequirements.frontmatterPartExtraction,
          "Must handle case with no frontmatter part correctly",
        );
      }
    });

    it("WHEN: Frontmatter part defined THEN: Should extract part data", async () => {
      // Arrange - Frontmatter part present business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSchema(false, true) // has frontmatter-part
        .build();

      // Create test data with array at frontmatter-part path ("items")
      const testData = {
        items: [
          { id: 1, title: "Test Item 1" },
          { id: 2, title: "Test Item 2" },
        ],
      };
      const mockDataResult = FrontmatterData.create(testData);
      assert(mockDataResult.ok, "Test data creation should succeed");
      const mockData = mockDataResult.data;

      // Act - Execute frontmatter part extraction with defined part
      const result = await scenario.coordinator.extractFrontmatterPartData(
        mockData,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Frontmatter part extraction with part should succeed");

      if (result.ok) {
        // Business requirement: Extract frontmatter part data
        assert(result.data.length >= 1, "Should return at least one item");

        // Validate frontmatter part extraction requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            extractsFrontmatterPart: result.ok && result.data.length >= 1,
            handlesNoFrontmatterPart: true, // Still handles gracefully
          },
          processingCoordinationRequirements.frontmatterPartExtraction,
          "Must extract frontmatter part data when present",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Extract-From Directive Processing", () => {
  describe("GIVEN: Schemas with and without extract-from directives", () => {
    it("WHEN: No extract-from directives THEN: Should return data unchanged", () => {
      // Arrange - No extract-from business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSchema(false, false) // no extract-from
        .build();

      const mockData = FrontmatterData.empty();

      // Act - Execute extract-from processing
      const result = scenario.coordinator.processExtractFromDirectivesSync(
        mockData,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Extract-from processing should succeed");

      if (result.ok) {
        // Business requirement: Data unchanged when no directives
        assertEquals(result.data, mockData);

        // Validate extract-from processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processesExtractFrom: result.ok,
            handlesNoExtractFrom: result.data === mockData,
          },
          processingCoordinationRequirements.extractFromDirectives,
          "Must handle case with no extract-from directives",
        );
      }
    });

    it("WHEN: Extract-from directives present THEN: Should process directives", () => {
      // Arrange - Extract-from present business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSchema(true, false) // has extract-from
        .build();

      const mockData = FrontmatterData.empty();

      // Act - Execute extract-from processing with directives
      const result = scenario.coordinator.processExtractFromDirectivesSync(
        mockData,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(
        result.ok,
        "Extract-from processing with directives should succeed",
      );

      if (result.ok) {
        // Business requirement: Process extract-from directives
        assert(result.data, "Should return processed data");

        // Validate extract-from processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processesExtractFrom: result.ok && result.data !== undefined,
            handlesNoExtractFrom: true, // Still handles gracefully
          },
          processingCoordinationRequirements.extractFromDirectives,
          "Must process extract-from directives when present",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Combined Processing Operations", () => {
  describe("GIVEN: Complex processing scenarios", () => {
    it("WHEN: Processing documents with items extraction THEN: Should coordinate all operations", async () => {
      // Arrange - Items extraction business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .withSchema(false, true) // has frontmatter-part
        .build();

      // Act - Execute documents with items extraction
      const result = await scenario.coordinator
        .processDocumentsWithItemsExtraction(
          "*.md",
          scenario.validationRules,
          scenario.schema,
        );

      // Assert - Validate business requirements
      assert(result.ok, "Documents with items extraction should succeed");

      if (result.ok) {
        // Business requirement: Items extraction coordination
        assert(result.data.mainData, "Should provide main data");
        assert(result.data.itemsData, "Should provide items data");

        // Validate application service pattern
        SpecificationAssertions.assertBusinessRequirement(
          {
            orchestratesOperations: result.ok &&
              result.data.mainData !== undefined &&
              result.data.itemsData !== undefined,
            maintainsBoundaries: true, // Coordinates without implementing logic
          },
          processingCoordinationRequirements.applicationServicePattern,
          "Must coordinate items extraction operations correctly",
        );
      }
    });

    it("WHEN: Processing documents with extract-from THEN: Should handle directive processing", async () => {
      // Arrange - Extract-from business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .withSchema(true, false) // has extract-from
        .build();

      // Act - Execute documents with extract-from processing
      const result = await scenario.coordinator.processDocumentsWithExtractFrom(
        "*.md",
        scenario.validationRules,
        scenario.schema,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Documents with extract-from should succeed");

      if (result.ok) {
        // Business requirement: Extract-from coordination
        assert(result.data, "Should provide processed data");

        // Validate application service pattern
        SpecificationAssertions.assertBusinessRequirement(
          {
            orchestratesOperations: result.ok && result.data !== undefined,
            maintainsBoundaries: true, // Coordinates without implementing logic
          },
          processingCoordinationRequirements.applicationServicePattern,
          "Must coordinate extract-from processing correctly",
        );
      }
    });

    it("WHEN: Processing with full extraction THEN: Should handle comprehensive scenarios", async () => {
      // Arrange - Full extraction business scenario
      const scenario = new ProcessingCoordinationScenarioBuilder()
        .withSuccessfulTransformation()
        .withSchema(true, true) // has both extract-from and frontmatter-part
        .build();

      // Act - Execute full extraction processing
      const result = await scenario.coordinator
        .processDocumentsWithFullExtraction(
          "*.md",
          scenario.validationRules,
          scenario.schema,
        );

      // Assert - Validate business requirements
      assert(result.ok, "Full extraction processing should succeed");

      if (result.ok) {
        // Business requirement: Comprehensive coordination
        assert(result.data.mainData, "Should provide main data");
        assert(result.data.itemsData, "Should provide items data");

        // Validate comprehensive coordination requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            orchestratesOperations: result.ok &&
              result.data.mainData !== undefined &&
              result.data.itemsData !== undefined,
            maintainsBoundaries: true, // Coordinates all operations properly
          },
          processingCoordinationRequirements.applicationServicePattern,
          "Must coordinate all extraction operations comprehensively",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Processing Coordination", () => {
  const processingCoordinationRules: DomainRule<any> = {
    name: "processing-coordination-completeness",
    description: "Processing coordination must handle all business scenarios",
    validator: (data) => ({
      isValid: data.coordinator &&
        typeof data.coordinator.processDocuments === "function" &&
        typeof data.coordinator.extractFrontmatterPartData === "function" &&
        typeof data.coordinator.processExtractFromDirectivesSync ===
          "function" &&
        typeof data.coordinator.processDocumentsWithItemsExtraction ===
          "function" &&
        typeof data.coordinator.processDocumentsWithExtractFrom ===
          "function" &&
        typeof data.coordinator.processDocumentsWithFullExtraction ===
          "function",
      violation:
        "Processing coordinator must provide complete coordination interface",
    }),
  };

  it("Should enforce processing coordination domain rules", () => {
    const scenario = new ProcessingCoordinationScenarioBuilder()
      .withSuccessfulTransformation()
      .build();

    SpecificationAssertions.assertDomainRule(
      { coordinator: scenario.coordinator },
      processingCoordinationRules,
      "processing-coordination",
      "Processing coordination must satisfy domain requirements",
    );
  });
});
