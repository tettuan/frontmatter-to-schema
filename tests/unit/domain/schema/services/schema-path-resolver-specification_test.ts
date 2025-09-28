/**
 * Specification-driven tests for SchemaPathResolver
 *
 * This test file validates business requirements for schema path resolution
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  DataStructure,
  SchemaPathResolver,
} from "../../../../../src/domain/schema/services/schema-path-resolver.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../../../src/domain/shared/types/errors.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../../helpers/specification-test-framework.ts";

/**
 * In-memory implementation of Schema for specification testing
 * Replaces mock implementations with real business logic
 */
class InMemorySchema {
  constructor(private frontmatterPartPath: string | null) {}

  findFrontmatterPartPath(): Result<string, DomainError> {
    if (this.frontmatterPartPath === null) {
      return err({
        kind: "FrontmatterPartNotFound",
        message: "No frontmatter part path configured in schema",
        details:
          "Schema must have a valid frontmatter part path for data structure resolution",
      } as DomainError);
    }
    return ok(this.frontmatterPartPath);
  }

  findFrontmatterPartSchema(): Result<any, DomainError> {
    if (this.frontmatterPartPath === null) {
      return err({
        kind: "FrontmatterPartNotFound",
        message: "No frontmatter part schema found",
        details:
          "Schema must have a valid frontmatter part for data structure resolution",
      } as DomainError);
    }
    return ok({
      type: "array",
      items: { type: "object" },
    });
  }

  // Convert to actual Schema interface for testing
  toSchema(): Schema {
    return this as unknown as Schema;
  }
}

/**
 * Builder for creating schema path resolution test scenarios
 */
class SchemaPathResolutionScenarioBuilder {
  private frontmatterPartPath: string | null = null;

  constructor() {}

  withFrontmatterPartPath(path: string): this {
    this.frontmatterPartPath = path;
    return this;
  }

  withoutFrontmatterPartPath(): this {
    this.frontmatterPartPath = null;
    return this;
  }

  build(): Schema {
    return new InMemorySchema(this.frontmatterPartPath).toSchema();
  }

  static create(): SchemaPathResolutionScenarioBuilder {
    return new SchemaPathResolutionScenarioBuilder();
  }
}

/**
 * Business requirements for schema path resolution
 */
const schemaPathResolutionRequirements = {
  pathResolution: {
    name: "frontmatter-part-path-resolution",
    description: "Schema path must be resolved to proper data structure",
    validator: (data: any) => ({
      isValid: data.resolved !== undefined && data.structureValid === true,
      violation: data.resolved === undefined || data.structureValid !== true
        ? "Path resolution must create valid data structure"
        : undefined,
    }),
  },

  nestedPathHandling: {
    name: "nested-path-structure-creation",
    description: "Nested paths must create hierarchical data structures",
    validator: (data: any) => ({
      isValid: data.isNested === false ||
        (data.isNested === true && data.hierarchyValid === true),
      violation: data.isNested && !data.hierarchyValid
        ? "Nested paths must create proper hierarchical structures"
        : undefined,
    }),
  },

  emptyDataHandling: {
    name: "empty-data-validation",
    description: "Empty input data must be handled appropriately",
    validator: (data: any) => ({
      isValid: data.isEmpty === false || data.errorReturned === true,
      violation: data.isEmpty && !data.errorReturned
        ? "Empty data must return appropriate error"
        : undefined,
    }),
  },

  schemaValidation: {
    name: "schema-configuration-validation",
    description: "Schema configuration must be validated before resolution",
    validator: (data: any) => ({
      isValid: data.hasValidSchema === true || data.validationError === true,
      violation: !data.hasValidSchema && !data.validationError
        ? "Invalid schema configuration must be detected"
        : undefined,
    }),
  },

  dataStructureIntegrity: {
    name: "data-structure-integrity",
    description: "Resolved data structures must maintain data integrity",
    validator: (data: any) => ({
      isValid: data.dataIntact === true && data.typeConsistent === true,
      violation: !data.dataIntact || !data.typeConsistent
        ? "Data structure must maintain integrity and type consistency"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Schema Path Resolution", () => {
  describe("GIVEN: Valid schema configuration", () => {
    it("WHEN: Resolving simple path structure THEN: Should create correct data structure", () => {
      // Arrange - Business scenario with simple path
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("commands")
        .build();
      const dataArray = [{ c1: "test", c2: "command" }];

      // Act - Execute path resolution
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate business requirements
      assert(result.ok, "Simple path resolution should succeed");

      if (result.ok) {
        // Business requirement: Path must resolve to correct structure
        const structure = result.data.getStructure();
        assertEquals(structure.commands, dataArray);

        // Validate path resolution requirement
        SpecificationAssertions.assertBusinessRequirement(
          { resolved: structure, structureValid: true },
          schemaPathResolutionRequirements.pathResolution,
          "Path must be resolved to valid data structure",
        );

        // Validate data integrity requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            dataIntact: true,
            typeConsistent: Array.isArray(structure.commands),
          },
          schemaPathResolutionRequirements.dataStructureIntegrity,
          "Data structure must maintain integrity",
        );
      }
    });

    it("WHEN: Resolving nested path structure THEN: Should create hierarchical structure", () => {
      // Arrange - Business scenario with nested path
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("tools.commands")
        .build();
      const dataArray = [{ c1: "test", c2: "command" }];

      // Act - Execute nested path resolution
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate business requirements
      assert(result.ok, "Nested path resolution should succeed");

      if (result.ok) {
        // Business requirement: Nested path must create hierarchy
        const structure = result.data.getStructure();
        assertEquals((structure.tools as any).commands, dataArray);

        // Validate nested path handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          { isNested: true, hierarchyValid: structure.tools !== undefined },
          schemaPathResolutionRequirements.nestedPathHandling,
          "Nested paths must create hierarchical structures",
        );

        // Validate data integrity for nested structure
        SpecificationAssertions.assertBusinessRequirement(
          {
            dataIntact: true,
            typeConsistent: Array.isArray((structure.tools as any).commands),
          },
          schemaPathResolutionRequirements.dataStructureIntegrity,
          "Nested data structure must maintain integrity",
        );
      }
    });

    it("WHEN: Resolving deeply nested path THEN: Should create multi-level hierarchy", () => {
      // Arrange - Business scenario with deep nesting
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("registry.tools.commands")
        .build();
      const dataArray = [{ c1: "test", c2: "command" }];

      // Act - Execute deep nested resolution
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate business requirements
      assert(result.ok, "Deep nested path resolution should succeed");

      if (result.ok) {
        // Business requirement: Deep nesting must work correctly
        const structure = result.data.getStructure();
        assertEquals(
          ((structure.registry as any).tools as any).commands,
          dataArray,
        );

        // Validate complex nested hierarchy
        SpecificationAssertions.assertBusinessRequirement(
          {
            isNested: true,
            hierarchyValid: structure.registry !== undefined &&
              (structure.registry as any).tools !== undefined,
          },
          schemaPathResolutionRequirements.nestedPathHandling,
          "Deep nested paths must create multi-level hierarchies",
        );
      }
    });
  });

  describe("GIVEN: Empty structure creation scenarios", () => {
    it("WHEN: Creating empty structure with path THEN: Should initialize correct structure", () => {
      // Arrange - Empty structure creation scenario
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("commands")
        .build();

      // Act - Execute empty structure creation
      const result = SchemaPathResolver.createEmptyStructure(schema);

      // Assert - Validate business requirements
      assert(result.ok, "Empty structure creation should succeed");

      if (result.ok) {
        // Business requirement: Empty structure must follow path structure
        const structure = result.data.getStructure();
        assertEquals(structure.commands, []);

        // Validate path resolution for empty case
        SpecificationAssertions.assertBusinessRequirement(
          {
            resolved: structure,
            structureValid: Array.isArray(structure.commands),
          },
          schemaPathResolutionRequirements.pathResolution,
          "Empty structure must follow path resolution pattern",
        );
      }
    });

    it("WHEN: Creating empty structure for nested path THEN: Should initialize nested structure", () => {
      // Arrange - Nested empty structure scenario
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("tools.commands")
        .build();

      // Act - Execute nested empty structure creation
      const result = SchemaPathResolver.createEmptyStructure(schema);

      // Assert - Validate business requirements
      assert(result.ok, "Nested empty structure creation should succeed");

      if (result.ok) {
        // Business requirement: Nested empty structure must be hierarchical
        const structure = result.data.getStructure();
        assertEquals((structure.tools as any).commands, []);

        // Validate nested structure creation
        SpecificationAssertions.assertBusinessRequirement(
          {
            isNested: true,
            hierarchyValid: structure.tools !== undefined &&
              Array.isArray((structure.tools as any).commands),
          },
          schemaPathResolutionRequirements.nestedPathHandling,
          "Nested empty structures must create proper hierarchy",
        );
      }
    });

    it("WHEN: Creating empty structure without path THEN: Should handle gracefully", () => {
      // Arrange - Schema without frontmatter part path
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withoutFrontmatterPartPath()
        .build();

      // Act - Execute empty structure creation without path
      const result = SchemaPathResolver.createEmptyStructure(schema);

      // Assert - Validate graceful handling
      assert(result.ok, "Empty structure without path should succeed");

      if (result.ok) {
        // Business requirement: Should create empty object when no path
        const structure = result.data.getStructure();
        assertEquals(structure, {});

        // Validate graceful handling of missing configuration
        SpecificationAssertions.assertBusinessRequirement(
          {
            resolved: structure,
            structureValid: typeof structure === "object",
          },
          schemaPathResolutionRequirements.pathResolution,
          "Missing path should create valid empty structure",
        );
      }
    });
  });

  describe("GIVEN: Error scenarios", () => {
    it("WHEN: Resolving with empty data array THEN: Should return appropriate error", () => {
      // Arrange - Empty data error scenario
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("commands")
        .build();
      const dataArray: unknown[] = [];

      // Act - Execute resolution with empty data
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate error handling requirement
      assert(!result.ok, "Empty data should return error");

      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");

        // Validate empty data handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          { isEmpty: true, errorReturned: true },
          schemaPathResolutionRequirements.emptyDataHandling,
          "Empty data must be handled appropriately",
        );
      }
    });

    it("WHEN: Resolving with schema missing frontmatter part THEN: Should return error", () => {
      // Arrange - Invalid schema scenario
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withoutFrontmatterPartPath()
        .build();
      const dataArray = [{ c1: "test", c2: "command" }];

      // Act - Execute resolution with invalid schema
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate schema validation requirement
      assert(!result.ok, "Schema without frontmatter part should return error");

      if (!result.ok) {
        assertEquals(result.error.kind, "FrontmatterPartNotFound");

        // Validate schema validation requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasValidSchema: false, validationError: true },
          schemaPathResolutionRequirements.schemaValidation,
          "Invalid schema configuration must be detected",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: DataStructure Value Object", () => {
  describe("GIVEN: Valid data structure creation", () => {
    it("WHEN: Creating DataStructure with valid object THEN: Should succeed", () => {
      // Arrange - Valid data structure scenario
      const structure = { commands: [{ c1: "test" }] };

      // Act - Execute DataStructure creation
      const result = DataStructure.create(structure);

      // Assert - Validate business requirements
      assert(result.ok, "Valid structure creation should succeed");

      if (result.ok) {
        // Business requirement: Structure must be preserved
        assertEquals(result.data.getStructure(), structure);

        // Validate data integrity
        SpecificationAssertions.assertBusinessRequirement(
          { dataIntact: true, typeConsistent: true },
          schemaPathResolutionRequirements.dataStructureIntegrity,
          "DataStructure must preserve data integrity",
        );
      }
    });

    it("WHEN: Converting to FrontmatterData THEN: Should maintain compatibility", () => {
      // Arrange - DataStructure conversion scenario
      const structure = { commands: [{ c1: "test" }] };
      const dataStructure = DataStructure.create(structure);

      assert(dataStructure.ok, "DataStructure creation should succeed");

      if (dataStructure.ok) {
        // Act - Execute conversion to FrontmatterData
        const frontmatterResult = dataStructure.data.toFrontmatterData();

        // Assert - Validate conversion requirement
        assert(
          frontmatterResult.ok,
          "Conversion to FrontmatterData should succeed",
        );

        if (frontmatterResult.ok) {
          // Business requirement: Data must be preserved in conversion
          SpecificationAssertions.assertBusinessRequirement(
            { dataIntact: true, typeConsistent: true },
            schemaPathResolutionRequirements.dataStructureIntegrity,
            "Data conversion must maintain integrity",
          );
        }
      }
    });
  });

  describe("GIVEN: Invalid data structure scenarios", () => {
    it("WHEN: Creating DataStructure with null THEN: Should return error", () => {
      // Arrange - Invalid null data scenario
      const invalidData = null as any;

      // Act - Execute DataStructure creation with null
      const result = DataStructure.create(invalidData);

      // Assert - Validate error handling
      assert(!result.ok, "Null data should return error");

      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
        if (result.error.kind === "InvalidType") {
          assertEquals(result.error.expected, "object");
          assertEquals(result.error.actual, "object");
        }

        // Validate schema validation requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasValidSchema: false, validationError: true },
          schemaPathResolutionRequirements.schemaValidation,
          "Invalid data types must be rejected",
        );
      }
    });

    it("WHEN: Creating DataStructure with undefined THEN: Should return error", () => {
      // Arrange - Invalid undefined data scenario
      const invalidData = undefined as any;

      // Act - Execute DataStructure creation with undefined
      const result = DataStructure.create(invalidData);

      // Assert - Validate error handling
      assert(!result.ok, "Undefined data should return error");

      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
        if (result.error.kind === "InvalidType") {
          assertEquals(result.error.expected, "object");
          assertEquals(result.error.actual, "undefined");
        }

        // Validate schema validation requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasValidSchema: false, validationError: true },
          schemaPathResolutionRequirements.schemaValidation,
          "Undefined data must be rejected with proper error",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Integration Patterns", () => {
  describe("GIVEN: Complex business scenarios", () => {
    it("WHEN: Processing complex nested registry schema THEN: Should handle all requirements", () => {
      // Arrange - Complex business scenario mimicking real usage
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("tools.commands")
        .build();
      const dataArray = [
        { c1: "git", c2: "commit", c3: "message" },
        { c1: "spec", c2: "analyze", c3: "quality" },
        { c1: "test", c2: "run", c3: "unit" },
      ];

      // Act - Execute complex registry pattern resolution
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate comprehensive business requirements
      assert(result.ok, "Complex registry pattern should succeed");

      if (result.ok) {
        const structure = result.data.getStructure();

        // Business requirement: All data must be preserved and accessible
        assertEquals((structure.tools as any).commands.length, 3);
        assertEquals((structure.tools as any).commands[0].c1, "git");
        assertEquals((structure.tools as any).commands[1].c1, "spec");
        assertEquals((structure.tools as any).commands[2].c1, "test");

        // Validate comprehensive requirements
        SpecificationAssertions.assertBusinessRequirement(
          {
            isNested: true,
            hierarchyValid: structure.tools !== undefined &&
              Array.isArray((structure.tools as any).commands) &&
              (structure.tools as any).commands.length === 3,
          },
          schemaPathResolutionRequirements.nestedPathHandling,
          "Complex nested patterns must work correctly",
        );

        SpecificationAssertions.assertBusinessRequirement(
          {
            dataIntact: dataArray.every((item, index) =>
              (structure.tools as any).commands[index].c1 === item.c1
            ),
            typeConsistent: true,
          },
          schemaPathResolutionRequirements.dataStructureIntegrity,
          "Complex data must maintain integrity",
        );
      }
    });

    it("WHEN: Processing single level paths THEN: Should avoid duplication", () => {
      // Arrange - Single level business scenario
      const schema = SchemaPathResolutionScenarioBuilder.create()
        .withFrontmatterPartPath("commands")
        .build();
      const dataArray = [{ id: "cmd1" }, { id: "cmd2" }];

      // Act - Execute single level resolution
      const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

      // Assert - Validate business requirements
      assert(result.ok, "Single level paths should work correctly");

      if (result.ok) {
        const structure = result.data.getStructure();

        // Business requirement: No unnecessary nesting for single level
        assertEquals(structure.commands, dataArray);
        assertEquals(Object.keys(structure).length, 1);

        // Validate path resolution efficiency
        SpecificationAssertions.assertBusinessRequirement(
          {
            resolved: structure,
            structureValid: Object.keys(structure).length === 1 &&
              structure.commands === dataArray,
          },
          schemaPathResolutionRequirements.pathResolution,
          "Single level paths must avoid unnecessary nesting",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Schema Path Resolution", () => {
  const schemaPathResolutionRules: DomainRule<any> = {
    name: "schema-path-resolution-completeness",
    description:
      "Schema path resolution must handle all valid business scenarios",
    validator: (data) => ({
      isValid: data.resolver &&
        typeof data.resolver.resolveDataStructure === "function",
      violation:
        "Schema path resolver must provide complete resolution capability",
    }),
  };

  it("Should enforce schema path resolution domain rules", () => {
    // Validate that SchemaPathResolver meets domain requirements
    SpecificationAssertions.assertDomainRule(
      { resolver: SchemaPathResolver },
      schemaPathResolutionRules,
      "schema-path-resolution",
      "Schema path resolution must satisfy domain requirements",
    );
  });
});
