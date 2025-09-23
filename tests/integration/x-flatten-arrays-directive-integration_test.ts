/**
 * @fileoverview x-flatten-arrays Directive Integration Tests
 * @description End-to-end tests for x-flatten-arrays directive functionality
 * Following DDD, TDD, and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";
import { DirectiveProcessor } from "../../src/domain/schema/services/directive-processor.ts";
import { DirectiveValidator } from "../../src/domain/schema/validators/directive-validator.ts";
import { FrontmatterDataFactory } from "../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";
import { BreakdownLogger } from "@tettuan/breakdownlogger";

Deno.test("x-flatten-arrays Directive Integration", async (t) => {
  await t.step(
    "should validate and process x-flatten-arrays directive end-to-end",
    () => {
      const logger = new BreakdownLogger("x-flatten-arrays-integration");

      logger.info("Starting x-flatten-arrays end-to-end test", {
        testType: "integration",
        objective: "validate and process x-flatten-arrays directive",
      });

      // Schema with x-flatten-arrays directive
      const schemaData = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "traceability": {
            "type": "array",
            "extensions": {
              "x-frontmatter-part": true,
              "x-flatten-arrays": "traceability",
            },
            "items": {
              "type": "string",
            },
          },
          "metadata": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "version": { "type": "string" },
            },
          },
        },
        "required": ["traceability"],
      };

      // Create schema
      const pathResult = SchemaPath.create("flatten_arrays_test_schema.json");
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const definitionResult = SchemaDefinition.create(schemaData);
      assertEquals(definitionResult.ok, true);
      if (!definitionResult.ok) return;

      const schemaResult = Schema.create(
        pathResult.data,
        definitionResult.data,
      );
      assertEquals(schemaResult.ok, true);
      if (!schemaResult.ok) return;

      const schema = schemaResult.data;
      assertExists(schema);

      // Test validation
      const validator = DirectiveValidator.create();
      const traceabilityProperty = schema.getDefinition().findProperty(
        "traceability",
      );
      assertEquals(traceabilityProperty.ok, true);

      if (traceabilityProperty.ok) {
        const validationResult = validator.validateProperty(
          traceabilityProperty.data,
          "traceability",
        );
        assertEquals(validationResult.ok, true);
        if (validationResult.ok) {
          assertEquals(validationResult.data.isValid, true);
          assertEquals(validationResult.data.errors.length, 0);
        }
      }

      // Test processing
      const processorResult = DirectiveProcessor.create();
      assertEquals(processorResult.ok, true);
      if (!processorResult.ok) return;

      const processor = processorResult.data;

      // Create test data with nested arrays
      const inputData = {
        traceability: ["REQ-001", ["REQ-002", "REQ-003"], "REQ-004", [[
          "REQ-005",
        ], "REQ-006"]],
        metadata: {
          title: "Test Document",
          version: "1.0",
        },
      };

      logger.debug("Input data for x-flatten-arrays test", {
        inputStructure: {
          traceability: {
            length: inputData.traceability.length,
            nestingLevels: "2-3 levels deep",
            containsNestedArrays: true,
          },
          metadata: inputData.metadata,
        },
      });

      const dataResult = FrontmatterDataFactory.fromParsedData(inputData);
      assertEquals(dataResult.ok, true);
      if (!dataResult.ok) return;

      // Resolve processing order
      logger.debug("Resolving directive processing order", {
        schemaPath: schema.getPath().getValue(),
      });

      const orderResult = processor.resolveProcessingOrder(schema);
      assertEquals(orderResult.ok, true);
      if (!orderResult.ok) return;

      const order = orderResult.data;

      // Verify flatten-arrays directive is discovered
      const flattenArraysNode = order.dependencyGraph.find(
        (node) => node.id === "flatten-arrays",
      );
      assertExists(flattenArraysNode);
      assertEquals(flattenArraysNode.isPresent, true);

      logger.debug("Processing order analysis", {
        totalDirectives: order.totalDirectives,
        phases: order.phases.map((phase) => ({
          phaseNumber: phase.phaseNumber,
          description: phase.description,
          directiveCount: phase.directives.length,
        })),
        flattenArraysNodeFound: !!flattenArraysNode,
        flattenArraysPresent: flattenArraysNode?.isPresent,
      });

      // Process directives
      logger.debug("Starting directive processing", {
        inputDataKeys: Object.keys(dataResult.data.getData()),
        processingPhases: order.phases.length,
      });

      const processResult = processor.processDirectives(
        dataResult.data,
        schema,
        order,
      );
      assertEquals(processResult.ok, true);
      if (!processResult.ok) return;

      const processedData = processResult.data.getData();

      logger.debug("Processing result analysis", {
        outputDataKeys: Object.keys(processedData),
        traceabilityType: Array.isArray(processedData.traceability)
          ? "array"
          : typeof processedData.traceability,
        traceabilityLength: Array.isArray(processedData.traceability)
          ? processedData.traceability.length
          : "N/A",
        actualStructure: {
          traceability: processedData.traceability,
          metadata: processedData.metadata,
        },
      });

      // Verify flattening worked correctly
      const expectedData = {
        traceability: [
          "REQ-001",
          "REQ-002",
          "REQ-003",
          "REQ-004",
          "REQ-005",
          "REQ-006",
        ],
        metadata: {
          title: "Test Document",
          version: "1.0",
        },
      };

      logger.debug("Expected vs Actual comparison", {
        expected: {
          traceabilityLength: expectedData.traceability.length,
          traceabilityType: "array",
          traceabilityItems: expectedData.traceability,
        },
        actual: {
          traceabilityLength: Array.isArray(processedData.traceability)
            ? processedData.traceability.length
            : "NOT_ARRAY",
          traceabilityType: Array.isArray(processedData.traceability)
            ? "array"
            : typeof processedData.traceability,
          traceabilityItems: processedData.traceability,
        },
        matches: JSON.stringify(processedData) === JSON.stringify(expectedData),
      });

      if (JSON.stringify(processedData) !== JSON.stringify(expectedData)) {
        logger.error("Test failure - Expected vs Actual mismatch", {
          expectedStructure: expectedData,
          actualStructure: processedData,
          differences: {
            traceabilityMatches: JSON.stringify(processedData.traceability) ===
              JSON.stringify(expectedData.traceability),
            metadataMatches: JSON.stringify(processedData.metadata) ===
              JSON.stringify(expectedData.metadata),
          },
        });
      }

      assertEquals(processedData, expectedData);
    },
  );

  await t.step("should handle complex nested structures", () => {
    const schemaData = {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "extensions": {
            "x-frontmatter-part": true,
            "x-flatten-arrays": "nested.deep.traceability",
          },
          "items": { "type": "object" },
        },
      },
    };

    const pathResult = SchemaPath.create("complex_nested_test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    const processorResult = DirectiveProcessor.create();
    assertEquals(processorResult.ok, true);
    if (!processorResult.ok) return;

    // Test data with nested structure
    const inputData = {
      nested: {
        deep: {
          traceability: ["A", ["B", ["C", "D"]], "E"],
          other: "value",
        },
        surface: "data",
      },
      top: "level",
    };

    const dataResult = FrontmatterDataFactory.fromParsedData(inputData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    const processor = processorResult.data;
    const schema = schemaResult.data;

    const orderResult = processor.resolveProcessingOrder(schema);
    assertEquals(orderResult.ok, true);
    if (!orderResult.ok) return;

    const processResult = processor.processDirectives(
      dataResult.data,
      schema,
      orderResult.data,
    );
    assertEquals(processResult.ok, true);
    if (!processResult.ok) return;

    const processedData = processResult.data.getData();

    // Verify nested flattening
    const expectedData = {
      nested: {
        deep: {
          traceability: ["A", "B", "C", "D", "E"],
          other: "value",
        },
        surface: "data",
      },
      top: "level",
    };

    assertEquals(processedData, expectedData);
  });

  await t.step("should handle edge cases gracefully", () => {
    const schemaData = {
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "extensions": {
            "x-frontmatter-part": true,
            "x-flatten-arrays": "nonexistent.property",
          },
          "items": { "type": "object" },
        },
      },
    };

    const pathResult = SchemaPath.create("edge_case_test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    const processorResult = DirectiveProcessor.create();
    assertEquals(processorResult.ok, true);
    if (!processorResult.ok) return;

    // Test data without the target property
    const inputData = {
      existing: "data",
      other: ["values"],
    };

    const dataResult = FrontmatterDataFactory.fromParsedData(inputData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    const processor = processorResult.data;
    const schema = schemaResult.data;

    const orderResult = processor.resolveProcessingOrder(schema);
    assertEquals(orderResult.ok, true);
    if (!orderResult.ok) return;

    const processResult = processor.processDirectives(
      dataResult.data,
      schema,
      orderResult.data,
    );
    assertEquals(processResult.ok, true);
    if (!processResult.ok) return;

    const processedData = processResult.data.getData();

    // Should handle missing property gracefully
    assertEquals(processedData.existing, "data");
    assertEquals(processedData.other, ["values"]);
  });

  await t.step("should work with validation warnings but no errors", () => {
    const schemaData = {
      "type": "object",
      "properties": {
        "stringField": {
          "type": "string", // Not an array type
          "extensions": {
            "x-flatten-arrays": "someProperty", // Should warn but not error
          },
        },
      },
    };

    const pathResult = SchemaPath.create("validation_warning_test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    const validator = DirectiveValidator.create();
    const stringProperty = schemaResult.data.getDefinition().findProperty(
      "stringField",
    );
    assertEquals(stringProperty.ok, true);

    if (stringProperty.ok) {
      const validationResult = validator.validateProperty(
        stringProperty.data,
        "stringField",
      );
      assertEquals(validationResult.ok, true);
      if (validationResult.ok) {
        // Should be valid with warnings
        assertEquals(validationResult.data.isValid, true);
        assertEquals(validationResult.data.errors.length, 0);
        assertEquals(validationResult.data.warnings.length, 2); // Type mismatch + missing frontmatter-part
      }
    }
  });
});
