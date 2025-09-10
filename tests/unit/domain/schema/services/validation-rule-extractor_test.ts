/**
 * ValidationRuleExtractor Domain Service Tests
 *
 * Tests for ValidationRuleExtractor following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ValidationRuleExtractor } from "../../../../../src/domain/schema/services/validation-rule-extractor.ts";
import { SchemaDefinition } from "../../../../../src/domain/value-objects/schema-definition.ts";

Deno.test("ValidationRuleExtractor - should create valid extractor", () => {
  const result = ValidationRuleExtractor.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("ValidationRuleExtractor - should extract basic validation rules", () => {
  const schemaContent = {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 50,
      },
      age: {
        type: "number",
        minimum: 0,
        maximum: 150,
      },
      email: {
        type: "string",
        format: "email",
      },
    },
    required: ["name", "email"],
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const extractorResult = ValidationRuleExtractor.create();
  if (!extractorResult.ok) {
    throw new Error("Failed to create extractor");
  }

  const rulesResult = extractorResult.data.extractRules(schemaResult.data);
  if (!rulesResult.ok) {
    console.log("Rules extraction failed:", rulesResult.error);
  }
  assertEquals(rulesResult.ok, true);
});

Deno.test("ValidationRuleExtractor - should get validated paths", () => {
  const schemaContent = {
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          profile: {
            type: "object",
            properties: {
              bio: { type: "string" },
            },
          },
        },
      },
      settings: { type: "boolean" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const extractorResult = ValidationRuleExtractor.create();
  if (!extractorResult.ok) {
    throw new Error("Failed to create extractor");
  }

  const pathsResult = extractorResult.data.getValidatedPaths(schemaResult.data);
  assertEquals(pathsResult.ok, true);
  if (pathsResult.ok) {
    assertEquals(pathsResult.data.length > 0, true);
  }
});

Deno.test("ValidationRuleExtractor - should extract rules for specific property", () => {
  const schemaContent = {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 50,
      },
      age: {
        type: "number",
        minimum: 0,
      },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const extractorResult = ValidationRuleExtractor.create();
  if (!extractorResult.ok) {
    throw new Error("Failed to create extractor");
  }

  const nameRulesResult = extractorResult.data.extractRulesForProperty(
    schemaResult.data,
    "name",
  );
  assertEquals(nameRulesResult.ok, true);
  if (nameRulesResult.ok) {
    assertEquals(nameRulesResult.data.length > 0, true);
  }
});

Deno.test("ValidationRuleExtractor - should check if property has validation rules", () => {
  const schemaContent = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const extractorResult = ValidationRuleExtractor.create();
  if (!extractorResult.ok) {
    throw new Error("Failed to create extractor");
  }

  const hasRulesResult = extractorResult.data.hasValidationRules(
    schemaResult.data,
    "name",
  );
  assertEquals(hasRulesResult.ok, true);

  const noRulesResult = extractorResult.data.hasValidationRules(
    schemaResult.data,
    "nonexistent",
  );
  assertEquals(noRulesResult.ok, true);
  if (noRulesResult.ok) {
    assertEquals(noRulesResult.data, false);
  }
});

Deno.test("ValidationRuleExtractor - should handle invalid property path", () => {
  const schemaContent = {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const extractorResult = ValidationRuleExtractor.create();
  if (!extractorResult.ok) {
    throw new Error("Failed to create extractor");
  }

  const emptyPathResult = extractorResult.data.extractRulesForProperty(
    schemaResult.data,
    "",
  );
  assertEquals(emptyPathResult.ok, false);
  if (!emptyPathResult.ok) {
    assertEquals(emptyPathResult.error.kind, "EmptyInput");
  }
});
