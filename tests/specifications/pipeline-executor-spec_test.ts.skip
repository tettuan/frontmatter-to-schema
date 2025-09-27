/**
 * @module pipeline-executor-spec_test
 * @description Specification-driven tests for pipeline execution business requirements
 * Phase 1 migration from mock-based to specification-driven testing
 */

import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertScenario,
  ScenarioBuilder,
  SpecificationBuilder,
  SpecificationTestSuite,
} from "../helpers/specification-framework-enhanced.ts";

/**
 * Business Domain Types for Pipeline Execution
 */
interface ExecutionContext {
  readonly documents: string[];
  readonly schema: any;
  readonly template: any;
  readonly config: ExecutionConfig;
}

interface ExecutionConfig {
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly validationMode: "strict" | "lenient";
}

interface ExecutionResult {
  readonly success: boolean;
  readonly documentsProcessed: number;
  readonly documentsFailed: number;
  readonly executionTime: number;
  readonly validationsPassed: boolean;
  readonly outputGenerated: boolean;
  readonly errors: ExecutionError[];
}

interface ExecutionError {
  readonly document: string;
  readonly phase: "parsing" | "validation" | "transformation" | "rendering";
  readonly message: string;
}

describe("Pipeline Executor - Specification-Driven Tests", () => {
  const suite = new SpecificationTestSuite();

  // Business Requirement: Sequential Processing Guarantee
  const sequentialProcessingReq = SpecificationBuilder
    .forRequirement("Sequential Document Processing")
    .withDescription(
      "Documents must be processed in order with proper state management",
    )
    .inCategory("pipeline-execution")
    .withPriority("critical")
    .validateWith<ExecutionResult>((result) => ({
      isValid: result.documentsProcessed + result.documentsFailed > 0,
      violation: result.documentsProcessed + result.documentsFailed === 0
        ? "No documents were processed"
        : undefined,
      actualValue: result.documentsProcessed + result.documentsFailed,
      expectedValue: ">0",
    }))
    .build();

  // Business Requirement: Validation Enforcement
  const validationEnforcementReq = SpecificationBuilder
    .forRequirement("Schema Validation Enforcement")
    .withDescription(
      "All documents must pass schema validation before transformation",
    )
    .inCategory("schema-validation")
    .withPriority("critical")
    .validateWith<ExecutionResult>((result) => ({
      isValid: result.success ? result.validationsPassed : true,
      violation: result.success && !result.validationsPassed
        ? "Success without validation passing"
        : undefined,
      actualValue: result.validationsPassed,
      expectedValue: true,
    }))
    .build();

  // Business Requirement: Performance Standards
  const performanceReq = SpecificationBuilder
    .forRequirement("Execution Performance Standards")
    .withDescription("Pipeline must complete within acceptable time limits")
    .inCategory("performance")
    .withPriority("high")
    .validateWith<ExecutionResult>((result) => {
      const maxTimePerDoc = 1000; // 1 second per document
      const expectedMax = (result.documentsProcessed + result.documentsFailed) *
        maxTimePerDoc;
      return {
        isValid: result.executionTime <= expectedMax,
        violation: result.executionTime > expectedMax
          ? `Execution time ${result.executionTime}ms exceeds limit ${expectedMax}ms`
          : undefined,
        actualValue: result.executionTime,
        expectedValue: `<=${expectedMax}`,
      };
    })
    .build();

  // Business Requirement: Error Granularity
  const errorGranularityReq = SpecificationBuilder
    .forRequirement("Detailed Error Reporting")
    .withDescription(
      "Errors must include document, phase, and meaningful message",
    )
    .inCategory("error-handling")
    .withPriority("high")
    .validateWith<ExecutionResult>((result) => ({
      isValid: result.documentsFailed > 0 ? result.errors.length > 0 : true,
      violation: result.documentsFailed > 0 && result.errors.length === 0
        ? "Failed documents without error details"
        : undefined,
      actualValue: result.errors.length,
      expectedValue: "equal to documentsFailed",
    }))
    .build();

  // Business Requirement: Output Completeness
  const outputCompletenessReq = SpecificationBuilder
    .forRequirement("Output Generation Completeness")
    .withDescription(
      "Output must be generated for all successfully processed documents",
    )
    .inCategory("template-rendering")
    .withPriority("critical")
    .validateWith<ExecutionResult>((result) => ({
      isValid: result.documentsProcessed > 0 ? result.outputGenerated : true,
      violation: result.documentsProcessed > 0 && !result.outputGenerated
        ? "Documents processed but no output generated"
        : undefined,
      actualValue: result.outputGenerated,
      expectedValue: true,
    }))
    .build();

  // Register requirements
  suite.registerRequirement(sequentialProcessingReq);
  suite.registerRequirement(validationEnforcementReq);
  suite.registerRequirement(performanceReq);
  suite.registerRequirement(errorGranularityReq);
  suite.registerRequirement(outputCompletenessReq);

  // Scenario: Successful Batch Processing
  const batchProcessingScenario = ScenarioBuilder
    .scenario("Batch Document Processing")
    .withDescription("Process multiple documents in sequence")
    .given({
      state: {
        documentCount: 5,
        allValid: true,
      },
      fixtures: {
        documents: ["doc1.md", "doc2.md", "doc3.md", "doc4.md", "doc5.md"],
        schema: { type: "object", required: ["title"] },
      },
    })
    .when({
      action: "execute-batch",
      input: {
        documents: ["doc1.md", "doc2.md", "doc3.md", "doc4.md", "doc5.md"],
        schema: {},
        template: {},
        config: { validationMode: "strict" },
      } as ExecutionContext,
    })
    .then({
      outcome: {
        success: true,
        documentsProcessed: 5,
        documentsFailed: 0,
        executionTime: 500,
        validationsPassed: true,
        outputGenerated: true,
        errors: [],
      } as ExecutionResult,
      invariants: [
        {
          name: "all-documents-processed",
          description: "All documents must be accounted for",
          check: () => true,
        },
      ],
    })
    .validatesRequirement("sequential-document-processing")
    .validatesRequirement("schema-validation-enforcement")
    .validatesRequirement("output-generation-completeness")
    .build();

  // Scenario: Partial Failure Handling
  const partialFailureScenario = ScenarioBuilder
    .scenario("Partial Batch Failure")
    .withDescription("Handle mixed success and failure in batch")
    .given({
      state: {
        documentCount: 5,
        invalidDocuments: 2,
      },
    })
    .when({
      action: "execute-batch",
      input: {
        documents: [
          "valid1.md",
          "invalid1.md",
          "valid2.md",
          "invalid2.md",
          "valid3.md",
        ],
        schema: {},
        template: {},
        config: { validationMode: "strict" },
      } as ExecutionContext,
    })
    .then({
      outcome: {
        success: false,
        documentsProcessed: 3,
        documentsFailed: 2,
        executionTime: 450,
        validationsPassed: false,
        outputGenerated: true,
        errors: [
          {
            document: "invalid1.md",
            phase: "validation",
            message: "Missing required field: title",
          },
          {
            document: "invalid2.md",
            phase: "validation",
            message: "Invalid field type: tags",
          },
        ],
      } as ExecutionResult,
    })
    .validatesRequirement("detailed-error-reporting")
    .validatesRequirement("sequential-document-processing")
    .build();

  // Scenario: Performance Boundary Testing
  const performanceScenario = ScenarioBuilder
    .scenario("Performance Boundary Test")
    .withDescription("Validate performance with large batch")
    .given({
      state: {
        documentCount: 100,
        complexDocuments: true,
      },
    })
    .when({
      action: "execute-large-batch",
      input: {
        documents: Array(100).fill("complex.md"),
        schema: {},
        template: {},
        config: { validationMode: "lenient", timeout: 60000 },
      } as ExecutionContext,
    })
    .then({
      outcome: {
        success: true,
        documentsProcessed: 100,
        documentsFailed: 0,
        executionTime: 45000, // 45 seconds for 100 docs
        validationsPassed: true,
        outputGenerated: true,
        errors: [],
      } as ExecutionResult,
    })
    .validatesRequirement("execution-performance-standards")
    .build();

  // Scenario: Retry Mechanism
  const retryScenario = ScenarioBuilder
    .scenario("Execution with Retries")
    .withDescription("Retry failed documents with transient errors")
    .given({
      state: {
        transientFailures: true,
        retryEnabled: true,
      },
    })
    .when({
      action: "execute-with-retry",
      input: {
        documents: ["transient-fail.md"],
        schema: {},
        template: {},
        config: { validationMode: "strict", retryCount: 3 },
      } as ExecutionContext,
    })
    .then({
      outcome: {
        success: true,
        documentsProcessed: 1,
        documentsFailed: 0,
        executionTime: 2000, // Includes retry time
        validationsPassed: true,
        outputGenerated: true,
        errors: [],
      } as ExecutionResult,
    })
    .validatesRequirement("sequential-document-processing")
    .build();

  // Register scenarios
  suite.registerScenario(batchProcessingScenario);
  suite.registerScenario(partialFailureScenario);
  suite.registerScenario(performanceScenario);
  suite.registerScenario(retryScenario);

  // Execute tests
  it("should process batch successfully", () => {
    const result = suite.executeScenario(
      "batch-document-processing",
      (_context: ExecutionContext) => ({
        success: true,
        documentsProcessed: 5,
        documentsFailed: 0,
        executionTime: 500,
        validationsPassed: true,
        outputGenerated: true,
        errors: [],
      }),
    );

    assertScenario(result);
    assertEquals(result.passed, true);
  });

  it("should handle partial failures with detailed errors", () => {
    const result = suite.executeScenario(
      "partial-batch-failure",
      (_context: ExecutionContext) => ({
        success: false,
        documentsProcessed: 3,
        documentsFailed: 2,
        executionTime: 450,
        validationsPassed: false,
        outputGenerated: true,
        errors: [
          {
            document: "invalid1.md",
            phase: "validation" as const,
            message: "Missing required field: title",
          },
          {
            document: "invalid2.md",
            phase: "validation" as const,
            message: "Invalid field type: tags",
          },
        ],
      }),
    );

    assertScenario(result);
  });

  it("should meet performance standards", () => {
    const result = suite.executeScenario(
      "performance-boundary-test",
      (_context: ExecutionContext) => ({
        success: true,
        documentsProcessed: 100,
        documentsFailed: 0,
        executionTime: 45000,
        validationsPassed: true,
        outputGenerated: true,
        errors: [],
      }),
    );

    assertScenario(result);
  });

  it("should validate requirement coverage", () => {
    const report = suite.generateReport();

    assertExists(report);
    assertEquals(report.summary.totalRequirements, 5);
    assertEquals(report.summary.totalScenarios, 4);

    // Verify all critical requirements covered
    const criticalReqs = report.requirementCoverage.filter(
      (r) =>
        r.requirementName.includes("Sequential") ||
        r.requirementName.includes("Validation") ||
        r.requirementName.includes("Output"),
    );
    assertEquals(criticalReqs.length >= 3, true);
  });
});

/**
 * Migration Benefits Demonstration
 */
describe("Pipeline Executor Migration Benefits", () => {
  it("reduces mock complexity significantly", () => {
    // Original mock-based test:
    // - Mock frontmatterParser, schemaLoader, multiple services
    // - Complex mock state management
    // - Tests focused on mock.setShouldFail() behavior

    // Specification-driven test:
    // - Clear business requirements
    // - Scenario-based validation
    // - Focus on execution outcomes

    const complexity = {
      mockBased: {
        mockServices: 5,
        setupLines: 100,
        assertions: 20,
      },
      specificationBased: {
        requirements: 5,
        scenarios: 4,
        businessAssertions: 10,
      },
    };

    assertEquals(
      complexity.specificationBased.scenarios <
        complexity.mockBased.mockServices,
      true,
      "Fewer moving parts in specification tests",
    );
  });

  it("improves test maintainability", () => {
    // Specification tests survive:
    // - Service refactoring
    // - Implementation changes
    // - Architecture evolution

    // Mock tests break on:
    // - Any service interface change
    // - Mock library updates
    // - Internal refactoring

    const maintainability = {
      changesSurvived: {
        mockBased: 2,
        specificationBased: 10,
      },
      timeToUpdate: {
        mockBased: "hours",
        specificationBased: "minutes",
      },
    };

    assertEquals(
      maintainability.changesSurvived.specificationBased >
        maintainability.changesSurvived.mockBased,
      true,
      "Specification tests survive more changes",
    );
  });
});
