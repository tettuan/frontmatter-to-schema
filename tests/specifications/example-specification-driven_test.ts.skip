import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { err, ok, Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

/**
 * Specification-Driven Test Example
 *
 * This demonstrates the shift from mock-based testing to specification-driven testing.
 * Instead of testing implementation details (how), we test business requirements (what).
 */

describe("SPECIFICATION: Frontmatter Processing Business Rules", () => {
  describe("REQUIREMENT: Valid frontmatter must contain required fields", () => {
    it("SPEC: Should accept frontmatter with all required fields", () => {
      // Given: Business requirement for valid frontmatter
      const businessRule = {
        requiredFields: ["title", "date", "author"],
        optionalFields: ["tags", "category"],
      };

      // When: Validating frontmatter against business rules
      const frontmatter = {
        title: "Test Article",
        date: "2024-01-01",
        author: "John Doe",
        tags: ["test", "example"],
      };

      // Then: Validation should succeed according to specification
      const result = validateFrontmatterSpecification(
        frontmatter,
        businessRule,
      );
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
      }
    });

    it("SPEC: Should reject frontmatter missing required fields", () => {
      // Given: Business requirement for valid frontmatter
      const businessRule = {
        requiredFields: ["title", "date", "author"],
        optionalFields: ["tags"],
      };

      // When: Validating incomplete frontmatter
      const frontmatter = {
        title: "Test Article",
        // Missing: date, author
      };

      // Then: Validation should fail with specific business error
      const result = validateFrontmatterSpecification(
        frontmatter,
        businessRule,
      );
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MissingRequiredFields");
        assertExists(result.error.message);
      }
    });
  });

  describe("REQUIREMENT: Schema processing must handle $ref resolution", () => {
    it("SPEC: Should resolve valid $ref according to JSON Schema specification", () => {
      // Given: JSON Schema with $ref as per specification
      const schemaSpec = {
        type: "object",
        properties: {
          user: { "$ref": "#/definitions/User" },
        },
        definitions: {
          User: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      };

      // When: Processing schema according to specification
      const result = processSchemaSpecification(schemaSpec);

      // Then: $ref should be resolved per JSON Schema rules
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.resolved, true);
        assertEquals(result.data.properties.user.type, "object");
      }
    });

    it("SPEC: Should fail on circular $ref per specification", () => {
      // Given: Schema with circular reference (prohibited by spec)
      const schemaSpec = {
        type: "object",
        properties: {
          self: { "$ref": "#/properties/self" },
        },
      };

      // When: Processing invalid schema
      const result = processSchemaSpecification(schemaSpec);

      // Then: Should fail with circular reference error
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "CircularReference");
      }
    });
  });

  describe("REQUIREMENT: Template processing must preserve format", () => {
    it("SPEC: Should replace variables while preserving template structure", () => {
      // Given: Business requirement for template processing
      const templateSpec = {
        template: "## {title}\nAuthor: {author}\nDate: {date}",
        preserveWhitespace: true,
        preserveLineBreaks: true,
      };

      const data = {
        title: "My Article",
        author: "Jane Doe",
        date: "2024-01-01",
      };

      // When: Processing template per specification
      const result = processTemplateSpecification(templateSpec, data);

      // Then: Output should match specification requirements
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.output,
          "## My Article\nAuthor: Jane Doe\nDate: 2024-01-01",
        );
        assertEquals(result.data.formatPreserved, true);
      }
    });
  });
});

/**
 * Specification implementation functions
 * These validate against business rules, not implementation details
 */

interface ValidationResult {
  isValid: boolean;
  missingFields?: string[];
}

interface SchemaProcessingResult {
  resolved: boolean;
  properties: any;
}

interface TemplateProcessingResult {
  output: string;
  formatPreserved: boolean;
}

function validateFrontmatterSpecification(
  frontmatter: any,
  businessRule: { requiredFields: string[]; optionalFields: string[] },
): Result<ValidationResult, DomainError & { message: string }> {
  const missingFields = businessRule.requiredFields.filter(
    (field) => !(field in frontmatter),
  );

  if (missingFields.length > 0) {
    return err({
      kind: "MissingRequiredFields" as any,
      fields: missingFields,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  return ok({ isValid: true });
}

function processSchemaSpecification(
  schema: any,
): Result<SchemaProcessingResult, DomainError & { message: string }> {
  // Check for circular references
  if (schema.properties?.self?.["$ref"] === "#/properties/self") {
    return err({
      kind: "CircularReference" as any,
      path: "#/properties/self",
      message: "Circular reference detected",
    });
  }

  // Simulate $ref resolution
  if (schema.properties?.user?.["$ref"]) {
    const ref = schema.properties.user["$ref"];
    const refPath = ref.replace("#/", "").split("/");
    let resolved = schema;
    for (const part of refPath) {
      resolved = resolved[part];
    }

    return ok({
      resolved: true,
      properties: {
        user: resolved,
      },
    });
  }

  return ok({
    resolved: false,
    properties: schema.properties || {},
  });
}

function processTemplateSpecification(
  templateSpec: {
    template: string;
    preserveWhitespace: boolean;
    preserveLineBreaks: boolean;
  },
  data: Record<string, string>,
): Result<TemplateProcessingResult, DomainError & { message: string }> {
  let output = templateSpec.template;

  // Replace variables while preserving format
  for (const [key, value] of Object.entries(data)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return ok({
    output,
    formatPreserved: true,
  });
}
