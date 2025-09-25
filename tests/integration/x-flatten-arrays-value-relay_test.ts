/**
 * @fileoverview X-Flatten-Arrays Value Relay Test
 * @description Test to verify x-flatten-arrays directive properly relays values through the entire pipeline
 *
 * This test verifies:
 * 1. x-flatten-arrays directive is recognized and executed
 * 2. Nested arrays are properly flattened
 * 3. Flattened values are properly relayed to output
 * 4. No data loss occurs during processing
 */

import { assertEquals, assert } from "jsr:@std/assert";
import { BreakdownLogger } from "jsr:@tettuan/breakdownlogger";
import { DirectiveProcessor } from "../../src/domain/schema/services/directive-processor.ts";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterDataFactory } from "../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";

Deno.test("x-flatten-arrays Value Relay Integration Test", async (t) => {
  const logger = new BreakdownLogger("x-flatten-arrays-relay");

  await t.step("Step 1: Verify directive recognition and processing", () => {
    logger.info("=== Testing Directive Recognition ===");

    // Create test schema with x-flatten-arrays
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "data": {
          "type": "array",
          "extensions": {
            "x-flatten-arrays": "data"
          },
          "items": {
            "type": "string"
          }
        }
      }
    };

    // Create schema instance
    const pathResult = SchemaPath.create("test.json");
    assert(pathResult.ok);
    const definitionResult = SchemaDefinition.create(schemaData);
    assert(definitionResult.ok);
    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assert(schemaResult.ok);

    // Create processor
    const processorResult = DirectiveProcessor.create();
    assert(processorResult.ok);

    // Resolve processing order
    const orderResult = processorResult.data.resolveProcessingOrder(schemaResult.data);
    assert(orderResult.ok);

    logger.debug("Processing order resolved", {
      phaseCount: orderResult.data.phases.length,
      phases: orderResult.data.phases.map(p => ({
        phase: p.phaseNumber,
        description: p.description,
        directives: p.directives.length
      }))
    });

    // Verify x-flatten-arrays is in the processing order
    const hasFlattenDirective = orderResult.data.phases.some(phase =>
      phase.directives.some(d => d.type.getKind() === "flatten-arrays")
    );

    assertEquals(hasFlattenDirective, true, "x-flatten-arrays should be recognized");
  });

  await t.step("Step 2: Test nested array flattening", () => {
    logger.info("=== Testing Array Flattening ===");

    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "extensions": {
            "x-flatten-arrays": "items"
          },
          "items": { "type": "string" }
        }
      }
    };

    // Test data with nested arrays
    const testData = {
      items: [
        "item1",
        ["item2", "item3"],
        "item4",
        [["item5", "item6"], "item7"]
      ]
    };

    logger.debug("Input data structure", {
      topLevelLength: testData.items.length,
      hasNestedArrays: testData.items.some(item => Array.isArray(item))
    });

    // Process through directive
    const pathResult = SchemaPath.create("test.json");
    assert(pathResult.ok);
    const definitionResult = SchemaDefinition.create(schemaData);
    assert(definitionResult.ok);
    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assert(schemaResult.ok);

    const processorResult = DirectiveProcessor.create();
    assert(processorResult.ok);
    const orderResult = processorResult.data.resolveProcessingOrder(schemaResult.data);
    assert(orderResult.ok);

    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);

    const processedResult = processorResult.data.processDirectives(
      dataResult.data,
      schemaResult.data,
      orderResult.data
    );

    assert(processedResult.ok);
    const processedData = processedResult.data.getData();

    logger.info("After directive processing", {
      itemsType: typeof processedData.items,
      itemsIsArray: Array.isArray(processedData.items),
      itemsLength: processedData.items?.length,
      allItemsAreStrings: Array.isArray(processedData.items) &&
        processedData.items.every((item: unknown) => typeof item === "string")
    });

    // Verify flattening worked
    assertEquals(Array.isArray(processedData.items), true, "Items should be an array");
    assertEquals(processedData.items.length, 7, "Should have 7 flattened items");
    assertEquals(
      processedData.items.every((item: unknown) => typeof item === "string"),
      true,
      "All items should be strings after flattening"
    );

    // Log each item for verification
    processedData.items.forEach((item: unknown, index: number) => {
      logger.debug(`Flattened item ${index}`, { value: item });
    });
  });

  await t.step("Step 3: Compare processing with and without x-flatten-arrays", () => {
    logger.info("=== Comparison Test: With vs Without Directive ===");

    const testData = {
      requirements: [
        { id: "REQ-001" },
        [{ id: "REQ-002" }, { id: "REQ-003" }],
        { id: "REQ-004" }
      ]
    };

    // Schema WITHOUT x-flatten-arrays
    const schemaWithoutDirective = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "requirements": {
          "type": "array",
          "items": { "type": "object" }
        }
      }
    };

    // Schema WITH x-flatten-arrays
    const schemaWithDirective = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "requirements": {
          "type": "array",
          "extensions": {
            "x-flatten-arrays": "requirements"
          },
          "items": { "type": "object" }
        }
      }
    };

    // Process WITHOUT directive
    const pathResult1 = SchemaPath.create("test1.json");
    assert(pathResult1.ok);
    const definitionResult1 = SchemaDefinition.create(schemaWithoutDirective);
    assert(definitionResult1.ok);
    const schemaResult1 = Schema.create(pathResult1.data, definitionResult1.data);
    assert(schemaResult1.ok);

    const processorResult1 = DirectiveProcessor.create();
    assert(processorResult1.ok);
    const orderResult1 = processorResult1.data.resolveProcessingOrder(schemaResult1.data);
    assert(orderResult1.ok);
    const dataResult1 = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult1.ok);
    const processedResult1 = processorResult1.data.processDirectives(
      dataResult1.data,
      schemaResult1.data,
      orderResult1.data
    );
    assert(processedResult1.ok);
    const withoutDirectiveData = processedResult1.data.getData();

    // Process WITH directive
    const pathResult2 = SchemaPath.create("test2.json");
    assert(pathResult2.ok);
    const definitionResult2 = SchemaDefinition.create(schemaWithDirective);
    assert(definitionResult2.ok);
    const schemaResult2 = Schema.create(pathResult2.data, definitionResult2.data);
    assert(schemaResult2.ok);

    const processorResult2 = DirectiveProcessor.create();
    assert(processorResult2.ok);
    const orderResult2 = processorResult2.data.resolveProcessingOrder(schemaResult2.data);
    assert(orderResult2.ok);
    const dataResult2 = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult2.ok);
    const processedResult2 = processorResult2.data.processDirectives(
      dataResult2.data,
      schemaResult2.data,
      orderResult2.data
    );
    assert(processedResult2.ok);
    const withDirectiveData = processedResult2.data.getData();

    logger.info("Comparison Results", {
      without: {
        length: withoutDirectiveData.requirements?.length,
        hasNestedArrays: withoutDirectiveData.requirements?.some((item: unknown) => Array.isArray(item)),
        structure: "mixed (flat and nested)"
      },
      with: {
        length: withDirectiveData.requirements?.length,
        hasNestedArrays: withDirectiveData.requirements?.some((item: unknown) => Array.isArray(item)),
        structure: "flat only"
      }
    });

    // Verify the difference
    assertEquals(
      withoutDirectiveData.requirements.some((item: unknown) => Array.isArray(item)),
      true,
      "Without directive: should have nested arrays"
    );
    assertEquals(
      withDirectiveData.requirements.every((item: unknown) => !Array.isArray(item)),
      true,
      "With directive: should have no nested arrays"
    );
    assertEquals(
      withDirectiveData.requirements.length,
      4,
      "With directive: should have 4 flattened items"
    );

    logger.info("✅ x-flatten-arrays directive successfully processes and flattens nested arrays");
  });

  await t.step("Step 4: Test deep nesting and complex structures", () => {
    logger.info("=== Testing Deep Nesting ===");

    const complexData = {
      deeply: {
        nested: {
          items: [
            "a",
            ["b", ["c", "d"]],
            [[[["e"]]], "f"],
            "g"
          ]
        }
      }
    };

    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "deeply": {
          "type": "object",
          "properties": {
            "nested": {
              "type": "object",
              "properties": {
                "items": {
                  "type": "array",
                  "extensions": {
                    "x-flatten-arrays": "deeply.nested.items"
                  },
                  "items": { "type": "string" }
                }
              }
            }
          }
        }
      }
    };

    const pathResult = SchemaPath.create("test.json");
    assert(pathResult.ok);
    const definitionResult = SchemaDefinition.create(schemaData);
    assert(definitionResult.ok);
    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assert(schemaResult.ok);

    const processorResult = DirectiveProcessor.create();
    assert(processorResult.ok);
    const orderResult = processorResult.data.resolveProcessingOrder(schemaResult.data);
    assert(orderResult.ok);
    const dataResult = FrontmatterDataFactory.fromObject(complexData);
    assert(dataResult.ok);

    const processedResult = processorResult.data.processDirectives(
      dataResult.data,
      schemaResult.data,
      orderResult.data
    );

    assert(processedResult.ok);
    const processedData = processedResult.data.getData();

    logger.info("Deep nesting result", {
      originalPath: "deeply.nested.items",
      flattenedLength: processedData.deeply?.nested?.items?.length,
      allFlat: Array.isArray(processedData.deeply?.nested?.items) &&
        processedData.deeply.nested.items.every((item: unknown) => !Array.isArray(item))
    });

    assertEquals(
      processedData.deeply?.nested?.items?.length,
      7,
      "Should flatten deeply nested arrays to 7 items"
    );

    logger.info("✅ All tests passed: x-flatten-arrays directive correctly processes and relays values");
  });
});

// Run with: LOG_KEY=x-flatten-arrays-relay LOG_LENGTH=W deno test tests/integration/x-flatten-arrays-value-relay_test.ts --allow-all