/**
 * @fileoverview Issue #1005 Verification Tests - Schema processing with remaining directives
 * @description Robust tests to verify that schema processing works correctly with supported directives after deprecated directives removal
 * Following DDD, TDD, and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { BreakdownLogger } from "jsr:@tettuan/breakdownlogger";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

Deno.test("Issue #1005 Verification - Supported Directive Processing", async (t) => {
  const _logger = new BreakdownLogger("issue-966-verification");
  await t.step(
    "should handle schemas with supported directives",
    () => {
      // This test verifies the Issue #1005 fix:
      // Deprecated directives have been removed from codebase and tests
      // Schemas should process successfully with supported directives only

      // Schema without deprecated directives (modern approach)
      const schemaData = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "req": {
            "type": "array",
            "x-frontmatter-part": true,
            "x-jmespath-filter": "[?id.level == 'req']", // JMESPath filter still supported
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "object",
                  "properties": {
                    "full": { "type": "string" },
                    "level": { "type": "string" },
                  },
                },
                "title": { "type": "string" },
              },
            },
          },
        },
        "required": ["req"],
      };

      // Create schema
      const pathResult = SchemaPath.create("test_schema.json");
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

      // Verify schema created successfully without deprecated directives
      const schema = schemaResult.data;
      assertExists(schema, "Schema should be created successfully");

      // Verify frontmatter-part functionality still works
      const frontmatterPartResult = schema.findFrontmatterPartPath();
      assertEquals(
        frontmatterPartResult.ok,
        true,
        "Should be able to find frontmatter-part directive",
      );

      if (frontmatterPartResult.ok) {
        assertEquals(
          frontmatterPartResult.data,
          "req",
          "Frontmatter-part path should be 'req'",
        );
      }

      // Verify JMESPath filter is still supported
      const definition = schema.getDefinition();
      const reqProperty = definition.findProperty("req");
      assertEquals(reqProperty.ok, true, "Should find req property");

      if (reqProperty.ok) {
        // Create SchemaDefinition from the property to check JMESPath filter
        const propertyDefinition = SchemaDefinition.fromSchemaProperty(
          reqProperty.data,
        );
        assertEquals(
          propertyDefinition.hasJMESPathFilter(),
          true,
          "JMESPath filter should still be supported",
        );
      }

      // Create test frontmatter data for verification
      const frontmatterData = FrontmatterData.create({
        id: { full: "TEST-001", level: "test" },
        title: "Test Document",
        req: [
          { id: { full: "REQ-001", level: "req" }, title: "Requirement 1" },
          { id: { full: "REQ-002", level: "req" }, title: "Requirement 2" },
        ],
      });

      assertEquals(frontmatterData.ok, true);
      if (!frontmatterData.ok) return;

      // Verify that basic frontmatter data processing works
      const processedData = frontmatterData.data.getData();

      // Verify the data structure is correct
      assertExists(
        processedData.req,
        "req array should exist in frontmatter data",
      );
      assertEquals(
        Array.isArray(processedData.req),
        true,
        "req should be an array",
      );

      // Note: Deprecated directives have been removed per Issue #1005
      // Modern approach uses direct data structure with supported directives only
      const reqArray = processedData.req as any[];
      assertEquals(
        reqArray.length > 0,
        true,
        "req should contain data items",
      );

      // Verify the items have the expected structure
      const firstItem = reqArray[0];
      assertExists(firstItem.id, "Item should have id");
      assertExists(firstItem.id.full, "Item should have id.full");
    },
  );

  await t.step(
    "should verify frontmatter-part schema detection still works",
    () => {
      // Test that the schema correctly identifies frontmatter-part properties
      // Essential functionality that should remain after deprecation

      const schemaData = {
        type: "object",
        properties: {
          normalArray: {
            type: "array",
            items: { type: "string" },
          },
          frontmatterPartArray: {
            type: "array",
            "x-frontmatter-part": true,
            "x-jmespath-filter": "[?level == 'req']", // Modern approach with JMESPath only
            items: { type: "object" },
          },
        },
      };

      const pathResult = SchemaPath.create("test.json");
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

      // Test frontmatter-part detection
      const frontmatterPartPath = schemaResult.data.findFrontmatterPartPath();
      assertEquals(
        frontmatterPartPath.ok,
        true,
        "Should find frontmatter-part path",
      );
      if (!frontmatterPartPath.ok) return;

      assertEquals(
        frontmatterPartPath.data,
        "frontmatterPartArray",
        "Should identify correct frontmatter-part property",
      );
    },
  );
});
