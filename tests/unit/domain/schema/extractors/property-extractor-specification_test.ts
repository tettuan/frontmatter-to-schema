/**
 * Specification-driven tests for PropertyExtractor
 *
 * This test file validates business requirements for property extraction
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  PropertyExtractor,
  PropertyPath,
} from "../../../../../src/domain/schema/extractors/property-extractor.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../../helpers/specification-test-framework.ts";

/**
 * Business requirements for property extraction
 */
const propertyExtractionRequirements = {
  pathValidation: {
    name: "property-path-validation",
    description: "Property paths must follow valid dot notation syntax",
    validator: (data: any) => ({
      isValid: data.path !== undefined && data.segments?.length > 0,
      violation: !data.path ? "Property path must be defined" : undefined,
    }),
  },

  valueExtraction: {
    name: "nested-value-extraction",
    description: "Values must be extractable from nested object structures",
    validator: (data: any) => ({
      isValid: data.extracted !== undefined,
      violation: data.extracted === undefined
        ? "Value extraction must succeed for valid paths"
        : undefined,
    }),
  },

  arrayHandling: {
    name: "array-notation-support",
    description: "Array notation [] must enable collection processing",
    validator: (data: any) => ({
      isValid: Array.isArray(data.result) || data.hasArrayNotation === false,
      violation: data.hasArrayNotation && !Array.isArray(data.result)
        ? "Array notation must return array results"
        : undefined,
    }),
  },

  errorBehavior: {
    name: "graceful-error-handling",
    description: "Invalid paths must return appropriate errors or undefined",
    validator: (data: any) => ({
      isValid: data.error !== undefined || data.result === undefined,
      violation: data.error === undefined && data.result !== undefined
        ? "Invalid operations must handle errors gracefully"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Property Path Validation", () => {
  describe("GIVEN: Valid property path syntax", () => {
    it("WHEN: Creating simple dot notation path THEN: Should parse correctly", () => {
      // Arrange - Business scenario setup
      const pathString = "id.full";

      // Act - Execute business operation
      const result = PropertyPath.create(pathString);

      // Assert - Validate business requirements
      assert(result.ok, "Valid path syntax should be accepted");

      if (result.ok) {
        // Business requirement: Path must be parsed into segments
        assertEquals(result.data.getSegments(), ["id", "full"]);
        assertEquals(result.data.hasArrayExpansion(), false);

        // Validate path validation requirement
        SpecificationAssertions.assertBusinessRequirement(
          { path: pathString, segments: result.data.getSegments() },
          propertyExtractionRequirements.pathValidation,
          "Path must be properly validated and parsed",
        );
      }
    });

    it("WHEN: Creating array notation path THEN: Should support array expansion", () => {
      // Arrange - Business scenario with array notation
      const pathString = "traceability[].id.full";

      // Act - Execute array path creation
      const result = PropertyPath.create(pathString);

      // Assert - Validate business requirements
      assert(result.ok, "Array notation should be supported");

      if (result.ok) {
        // Business requirement: Array notation must be recognized
        assert(
          result.data.hasArrayExpansion(),
          "Array expansion must be detected",
        );
        assertEquals(result.data.getPreArraySegments(), ["traceability"]);
        assertEquals(result.data.getPostArraySegments(), ["id", "full"]);

        // Validate array handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasArrayNotation: true, result: result.data.getSegments() },
          propertyExtractionRequirements.arrayHandling,
          "Array notation must be properly handled",
        );
      }
    });

    it("WHEN: Creating single segment path THEN: Should handle simple cases", () => {
      // Arrange - Simple business case
      const pathString = "title";

      // Act - Execute simple path creation
      const result = PropertyPath.create(pathString);

      // Assert - Validate business requirements
      assert(result.ok, "Single segment paths should be valid");

      if (result.ok) {
        assertEquals(result.data.getSegments(), ["title"]);
        assertEquals(result.data.hasArrayExpansion(), false);
      }
    });
  });

  describe("GIVEN: Invalid property path syntax", () => {
    it("WHEN: Creating empty path THEN: Should reject with error", () => {
      // Arrange - Invalid business scenario
      const pathString = "";

      // Act - Attempt invalid path creation
      const result = PropertyPath.create(pathString);

      // Assert - Validate error handling requirement
      assert(!result.ok, "Empty paths must be rejected");

      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        if (result.error.kind === "PropertyNotFound") {
          assert(
            (result.error as { path: string }).path.includes("empty"),
            "Error message must explain rejection reason",
          );
        }

        // Validate error behavior requirement
        SpecificationAssertions.assertBusinessRequirement(
          { error: result.error, result: undefined },
          propertyExtractionRequirements.errorBehavior,
          "Invalid paths must be handled gracefully",
        );
      }
    });

    it("WHEN: Creating path with consecutive dots THEN: Should reject malformed syntax", () => {
      // Arrange - Malformed business input
      const pathString = "id..full";

      // Act - Attempt malformed path creation
      const result = PropertyPath.create(pathString);

      // Assert - Validate syntax validation
      assert(!result.ok, "Malformed syntax must be rejected");

      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");
        if (result.error.kind === "PropertyNotFound") {
          assert(
            (result.error as { path: string }).path.includes(
              "consecutive dots",
            ),
            "Error must specify syntax violation",
          );
        }
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Property Value Extraction", () => {
  describe("GIVEN: Valid data structure", () => {
    it("WHEN: Extracting nested property THEN: Should retrieve correct value", () => {
      // Arrange - Business data structure
      const extractor = PropertyExtractor.create();
      const data = {
        id: {
          full: "req:api:test-123",
          hash: "test123",
        },
      };
      const pathResult = PropertyPath.create("id.full");
      assert(pathResult.ok, "Path creation should succeed");

      // Act - Execute value extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate business requirements
      assert(result.ok, "Valid path extraction should succeed");

      if (result.ok) {
        // Business requirement: Correct value must be extracted
        assertEquals(result.data, "req:api:test-123");

        // Validate value extraction requirement
        SpecificationAssertions.assertBusinessRequirement(
          { extracted: result.data },
          propertyExtractionRequirements.valueExtraction,
          "Nested values must be extractable",
        );
      }
    });

    it("WHEN: Extracting top-level property THEN: Should access direct values", () => {
      // Arrange - Simple business structure
      const extractor = PropertyExtractor.create();
      const data = {
        title: "Test Title",
        description: "Test Description",
      };
      const pathResult = PropertyPath.create("title");
      assert(pathResult.ok);

      // Act - Execute direct extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate business requirements
      assert(result.ok, "Direct property access should work");

      if (result.ok) {
        assertEquals(result.data, "Test Title");
      }
    });

    it("WHEN: Extracting non-existent path THEN: Should return undefined gracefully", () => {
      // Arrange - Missing property scenario
      const extractor = PropertyExtractor.create();
      const data = {
        id: {
          full: "test",
        },
      };
      const pathResult = PropertyPath.create("id.missing");
      assert(pathResult.ok);

      // Act - Execute missing path extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate graceful handling
      assert(result.ok, "Missing paths should not error");

      if (result.ok) {
        // Business requirement: Missing values should return undefined
        assertEquals(result.data, undefined);

        // Validate error behavior requirement
        SpecificationAssertions.assertBusinessRequirement(
          { error: undefined, result: result.data },
          propertyExtractionRequirements.errorBehavior,
          "Missing paths must be handled gracefully",
        );
      }
    });
  });

  describe("GIVEN: Array data structures", () => {
    it("WHEN: Extracting with array notation THEN: Should process collections", () => {
      // Arrange - Business array scenario
      const extractor = PropertyExtractor.create();
      const data = {
        traceability: [
          { id: { full: "req:001" } },
          { id: { full: "req:002" } },
          { id: { full: "req:003" } },
        ],
      };
      const pathResult = PropertyPath.create("traceability[].id.full");
      assert(pathResult.ok);

      // Act - Execute array extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate business requirements
      assert(result.ok, "Array extraction should succeed");

      if (result.ok) {
        // Business requirement: Array processing must extract all values
        assertEquals(result.data, ["req:001", "req:002", "req:003"]);

        // Validate array handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasArrayNotation: true, result: result.data },
          propertyExtractionRequirements.arrayHandling,
          "Array notation must enable collection processing",
        );
      }
    });

    it("WHEN: Extracting array with missing values THEN: Should filter undefined", () => {
      // Arrange - Sparse array business scenario
      const extractor = PropertyExtractor.create();
      const data = {
        traceability: [
          { id: { full: "req:001" } },
          { summary: "No id here" },
          { id: { full: "req:003" } },
        ],
      };
      const pathResult = PropertyPath.create("traceability[].id.full");
      assert(pathResult.ok);

      // Act - Execute sparse array extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate business requirements
      assert(result.ok, "Sparse array extraction should succeed");

      if (result.ok) {
        // Business requirement: Undefined values must be filtered
        assertEquals(result.data, ["req:001", "req:003"]);
        assert(
          Array.isArray(result.data) &&
            !(result.data as unknown[]).includes(undefined),
          "Undefined values must be filtered from results",
        );
      }
    });

    it("WHEN: Extracting array itself THEN: Should return complete collection", () => {
      // Arrange - Array extraction scenario
      const extractor = PropertyExtractor.create();
      const data = {
        items: ["a", "b", "c"],
      };
      const pathResult = PropertyPath.create("items[]");
      assert(pathResult.ok);

      // Act - Execute array self-extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate business requirements
      assert(result.ok, "Array self-extraction should work");

      if (result.ok) {
        assertEquals(result.data, ["a", "b", "c"]);
      }
    });

    it("WHEN: Extracting from null array THEN: Should return empty array", () => {
      // Arrange - Null array business scenario
      const extractor = PropertyExtractor.create();
      const data = {
        traceability: null,
      };
      const pathResult = PropertyPath.create("traceability[].id.full");
      assert(pathResult.ok);

      // Act - Execute null array extraction
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate graceful null handling
      assert(result.ok, "Null arrays should not error");

      if (result.ok) {
        assertEquals(result.data, []);
      }
    });
  });

  describe("GIVEN: Invalid data structures", () => {
    it("WHEN: Accessing property on primitive THEN: Should return error", () => {
      // Arrange - Invalid business operation
      const extractor = PropertyExtractor.create();
      const data = {
        value: "string",
      };
      const pathResult = PropertyPath.create("value.property");
      assert(pathResult.ok);

      // Act - Attempt invalid property access
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate error handling requirement
      assert(!result.ok, "Property access on primitives must error");

      if (!result.ok) {
        assertEquals(result.error.kind, "PropertyNotFound");

        // Validate error behavior requirement
        SpecificationAssertions.assertBusinessRequirement(
          { error: result.error, result: undefined },
          propertyExtractionRequirements.errorBehavior,
          "Invalid operations must handle errors appropriately",
        );
      }
    });

    it("WHEN: Accessing through null intermediate THEN: Should return undefined", () => {
      // Arrange - Null intermediate scenario
      const extractor = PropertyExtractor.create();
      const data = {
        id: null,
      };
      const pathResult = PropertyPath.create("id.full");
      assert(pathResult.ok);

      // Act - Execute null intermediate access
      const result = extractor.extract(data, pathResult.data);

      // Assert - Validate graceful null handling
      assert(result.ok, "Null intermediates should not error");

      if (result.ok) {
        assertEquals(result.data, undefined);
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Property Extraction", () => {
  const propertyExtractionRules: DomainRule<any> = {
    name: "property-extraction-completeness",
    description: "Property extraction must handle all valid business scenarios",
    validator: (data) => ({
      isValid: data.extractor && typeof data.extractor.extract === "function",
      violation: "Property extractor must provide extraction capability",
    }),
  };

  it("Should enforce property extraction domain rules", () => {
    const extractor = PropertyExtractor.create();

    SpecificationAssertions.assertDomainRule(
      { extractor },
      propertyExtractionRules,
      "property-extraction",
      "Property extraction must satisfy domain requirements",
    );
  });
});
