import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DerivedFromDirectiveHandler } from "../../../../../src/domain/schema/handlers/derived-from-directive-handler.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";

describe("DerivedFromDirectiveHandler", () => {
  it("should extract configuration correctly", () => {
    const handler = new DerivedFromDirectiveHandler();
    const schema = {
      "x-derived-from": "tags",
    };

    const result = handler.extractConfig(schema);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.directiveName, "x-derived-from");
      assertEquals(result.data.configuration.sourceProperty, "tags");
      assertEquals(result.data.isPresent, true);
    }
  });

  it("should handle missing directive", () => {
    const handler = new DerivedFromDirectiveHandler();
    const schema = {};

    const result = handler.extractConfig(schema);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isPresent, false);
    }
  });

  it("should process data and aggregate values", () => {
    const handler = new DerivedFromDirectiveHandler();
    const data = FrontmatterData.create({
      title: "Test",
      tags: ["tag1", "tag2"],
    });

    if (!data.ok) throw new Error("Failed to create test data");

    const config = {
      kind: "DirectiveConfig" as const,
      directiveName: "x-derived-from",
      configuration: { sourceProperty: "tags" },
      isPresent: true,
    };

    const pathResult = SchemaPath.create("test.json");
    if (!pathResult.ok) throw new Error("Failed to create path");

    const definitionResult = SchemaDefinition.create({
      type: "object",
      properties: {},
    });
    if (!definitionResult.ok) throw new Error("Failed to create definition");

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) throw new Error("Failed to create schema");

    const result = handler.processData(data.data, config, schemaResult.data);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.directiveName, "x-derived-from");
      const processedData = result.data.processedData.getData();
      assertEquals(processedData.tags, ["tag1", "tag2"]);
    }
  });
});