import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  AssertionHelpers,
  RequirementBuilder,
  SpecificationTestRunner,
} from "../../src/testing/specification-driven/framework.ts";
import { DomainSpecifications } from "../../src/testing/specification-driven/domain-specifications.ts";

/**
 * Business requirement validation tests
 * Following specification-driven testing approach
 */
describe("Business Requirements Validation", () => {
  describe("Domain Requirements from docs/requirements.ja.md", () => {
    it("should validate all core business requirements", async () => {
      const runner = new SpecificationTestRunner();

      // Add all domain requirements
      const requirementsResult = DomainSpecifications.getAllRequirements();
      assert(requirementsResult.ok);
      if (requirementsResult.ok) {
        for (const req of requirementsResult.data) {
          runner.addRequirement(req);
        }
      }

      // Run all specifications
      const result = await runner.runAll();

      assert(result.ok, "All specifications should run successfully");

      if (result.ok) {
        const report = result.data;

        // Log detailed report
        console.log("\n=== Business Requirements Test Report ===");
        console.log(`Total Requirements: ${report.totalRequirements}`);
        console.log(`Passed: ${report.passed}`);
        console.log(`Failed: ${report.failed}`);

        for (const reqResult of report.results) {
          console.log(`\n${reqResult.requirementId}: ${reqResult.description}`);
          console.log(
            `  Status: ${reqResult.passed ? "✅ PASSED" : "❌ FAILED"}`,
          );

          if (reqResult.assertions) {
            for (const assertion of reqResult.assertions) {
              const status = assertion.passed ? "✓" : "✗";
              console.log(`    ${status} ${assertion.description}`);
              if (assertion.error) {
                console.log(`      Expected: ${assertion.error.expected}`);
                console.log(`      Actual: ${assertion.error.actual}`);
              }
            }
          }

          if (reqResult.error) {
            console.log(`  Error: ${reqResult.error}`);
          }
        }

        // For now, we expect all requirements to be testable
        // In production, we would expect all to pass
        assertEquals(
          report.totalRequirements,
          5,
          "Should have 5 core requirements",
        );
      }
    });
  });

  describe("Individual Requirement Tests", () => {
    it("REQ-001: Schema processing with $ref resolution", async () => {
      const runner = new SpecificationTestRunner();
      const reqResult = DomainSpecifications.schemaRefResolution();
      assert(reqResult.ok);
      if (reqResult.ok) {
        runner.addRequirement(reqResult.data);
      }

      const result = await runner.runAll();
      assert(result.ok);

      if (result.ok) {
        const report = result.data;
        assertEquals(report.totalRequirements, 1);
        assert(report.results[0].passed, "Schema $ref resolution should work");
      }
    });

    it("REQ-002: Frontmatter extraction with validation", async () => {
      const runner = new SpecificationTestRunner();
      const reqResult = DomainSpecifications.frontmatterExtraction();
      assert(reqResult.ok);
      if (reqResult.ok) {
        runner.addRequirement(reqResult.data);
      }

      const result = await runner.runAll();
      assert(result.ok);

      if (result.ok) {
        const report = result.data;
        assertEquals(report.totalRequirements, 1);
        assert(report.results[0].passed, "Frontmatter extraction should work");
      }
    });

    it("REQ-003: Template rendering with variable substitution", async () => {
      const runner = new SpecificationTestRunner();
      const reqResult = DomainSpecifications.templateRendering();
      assert(reqResult.ok);
      if (reqResult.ok) {
        runner.addRequirement(reqResult.data);
      }

      const result = await runner.runAll();
      assert(result.ok);

      if (result.ok) {
        const report = result.data;
        assertEquals(report.totalRequirements, 1);
        assert(report.results[0].passed, "Template rendering should work");
      }
    });

    it("REQ-004: Aggregation with derived field generation", async () => {
      const runner = new SpecificationTestRunner();
      const reqResult = DomainSpecifications.aggregationWithDerivedFields();
      assert(reqResult.ok);
      if (reqResult.ok) {
        runner.addRequirement(reqResult.data);
      }

      const result = await runner.runAll();
      assert(result.ok);

      if (result.ok) {
        const report = result.data;
        assertEquals(report.totalRequirements, 1);
        assert(
          report.results[0].passed,
          "Aggregation should generate derived fields",
        );
      }
    });

    it("REQ-005: Pipeline orchestration with error recovery", async () => {
      const runner = new SpecificationTestRunner();
      const reqResult = DomainSpecifications.pipelineErrorRecovery();
      assert(reqResult.ok);
      if (reqResult.ok) {
        runner.addRequirement(reqResult.data);
      }

      const result = await runner.runAll();
      assert(result.ok);

      if (result.ok) {
        const report = result.data;
        assertEquals(report.totalRequirements, 1);
        assert(
          report.results[0].passed,
          "Pipeline should handle errors gracefully",
        );
      }
    });
  });

  describe("Specification Framework Tests", () => {
    it("should build valid business requirements", () => {
      const builder = new RequirementBuilder();

      const result = builder
        .withId("TEST-001")
        .withDescription("Test requirement")
        // deno-lint-ignore require-await
        .withGiven("test context", async () => ({
          schemas: new Map(),
          frontmatters: new Map(),
          templates: new Map(),
          configurations: {
            inputPattern: "**/*.md",
            outputPath: "output.json",
            schemaPath: "schema.json",
          },
        }))
        // deno-lint-ignore require-await
        .withWhen("action is performed", async () => ({
          output: {
            content: "test",
            format: "text" as const,
          },
        }))
        .withThen("result should be valid", (result) => {
          return AssertionHelpers.noErrors()(result);
        })
        .build();

      assert(result.ok, "Should build valid requirement");
      if (result.ok) {
        assertEquals(result.data.id, "TEST-001");
        assertEquals(result.data.description, "Test requirement");
      }
    });

    it("should fail to build incomplete requirements", () => {
      const builder = new RequirementBuilder();

      // Missing required fields
      const result = builder
        .withId("TEST-002")
        .withDescription("Incomplete requirement")
        // Missing given, when, then
        .build();

      assert(!result.ok, "Should fail to build incomplete requirement");
    });
  });

  describe("Assertion Helpers Tests", () => {
    it("should validate output contains expected content", () => {
      const assertion = AssertionHelpers.outputContains("expected");

      // Test with matching content
      const resultWithContent = assertion({
        output: {
          content: "This contains expected text",
          format: "text",
        },
      });
      assert(resultWithContent.ok, "Should pass when content is found");

      // Test with missing content
      const resultWithoutContent = assertion({
        output: {
          content: "This does not contain the text",
          format: "text",
        },
      });
      assert(!resultWithoutContent.ok, "Should fail when content is missing");
    });

    it("should validate no errors occurred", () => {
      const assertion = AssertionHelpers.noErrors();

      // Test with no errors
      const resultNoErrors = assertion({});
      assert(resultNoErrors.ok, "Should pass when no errors");

      // Test with errors
      const resultWithErrors = assertion({
        errors: [{ kind: "MissingRequired", field: "test" } as any],
      });
      assert(!resultWithErrors.ok, "Should fail when errors exist");
    });

    it("should validate metrics match expected", () => {
      const assertion = AssertionHelpers.metricsMatch({
        filesProcessed: 5,
        errors: 0,
      });

      // Test with matching metrics
      const resultMatching = assertion({
        metrics: {
          filesProcessed: 5,
          processingTime: 100,
          memoryUsage: 1000,
          errors: 0,
        },
      });
      assert(resultMatching.ok, "Should pass when metrics match");

      // Test with non-matching metrics
      const resultNotMatching = assertion({
        metrics: {
          filesProcessed: 3,
          processingTime: 100,
          memoryUsage: 1000,
          errors: 1,
        },
      });
      assert(!resultNotMatching.ok, "Should fail when metrics don't match");
    });

    it("should validate output format", () => {
      const assertion = AssertionHelpers.outputFormat("json");

      // Test with matching format
      const resultMatching = assertion({
        output: {
          content: "{}",
          format: "json",
        },
      });
      assert(resultMatching.ok, "Should pass when format matches");

      // Test with non-matching format
      const resultNotMatching = assertion({
        output: {
          content: "text",
          format: "text",
        },
      });
      assert(!resultNotMatching.ok, "Should fail when format doesn't match");
    });
  });
});
