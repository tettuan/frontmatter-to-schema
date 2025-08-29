import { assertEquals } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import {
  TypeScriptTemplateProcessor,
} from "../../../../src/domain/template/typescript-template-processor.ts";
import type {
  MappedSchemaData,
  SchemaMatchResult,
} from "../../../../src/domain/models/typescript-schema-matcher.ts";

describe("TypeScriptTemplateProcessor", () => {
  let processor: TypeScriptTemplateProcessor;
  let mockMappedData: MappedSchemaData;

  beforeEach(() => {
    processor = new TypeScriptTemplateProcessor();

    // Create mock mapped data
    mockMappedData = {
      matches: [
        {
          path: "title",
          value: "Test Title",
          matchedProperty: { required: true, type: "string" },
          confidence: 1.0,
        },
        {
          path: "description",
          value: "Test Description",
          matchedProperty: { required: false, type: "string" },
          confidence: 1.0,
        },
        {
          path: "tags",
          value: ["tag1", "tag2", "tag3"],
          matchedProperty: { required: false, type: "array" },
          confidence: 1.0,
        },
        {
          path: "metadata",
          value: { author: "John Doe", version: "1.0" },
          matchedProperty: { required: false, type: "object" },
          confidence: 1.0,
        },
        {
          path: "count",
          value: 42,
          matchedProperty: { required: false, type: "number" },
          confidence: 1.0,
        },
        {
          path: "enabled",
          value: true,
          matchedProperty: { required: false, type: "boolean" },
          confidence: 1.0,
        },
        {
          path: "tools.commands[0].name",
          value: "command1",
          matchedProperty: { required: false, type: "string" },
          confidence: 1.0,
        },
        {
          path: "tools.commands[1].name",
          value: "command2",
          matchedProperty: { required: false, type: "string" },
          confidence: 1.0,
        },
        {
          path: "nullValue",
          value: null,
          matchedProperty: { required: false, type: "null" },
          confidence: 1.0,
        },
        {
          path: "undefinedValue",
          value: undefined,
          matchedProperty: { required: false, type: "undefined" },
          confidence: 1.0,
        },
      ] as SchemaMatchResult[],
      missingRequiredKeys: ["requiredField"],
      unmatchedKeys: [],
      schemaCompliantData: {},
    };
  });

  describe("processTemplate", () => {
    it("should replace simple template variables", () => {
      const template = "Title: {title}, Description: {description}";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.content,
          "Title: Test Title, Description: Test Description",
        );
        assertEquals(result.data.replacedVariables, ["title", "description"]);
        assertEquals(result.data.unresolvedVariables.length, 0);
      }
    });

    it("should handle array variables with different formats", () => {
      const template = "Tags: {tags}";

      // Test JSON format (default)
      const jsonResult = processor.processTemplate(template, mockMappedData);
      assertEquals(jsonResult.ok, true);
      if (jsonResult.ok) {
        assertEquals(jsonResult.data.content, 'Tags: ["tag1","tag2","tag3"]');
      }

      // Test CSV format
      const csvResult = processor.processTemplate(template, mockMappedData, {
        arrayFormat: "csv",
      });
      assertEquals(csvResult.ok, true);
      if (csvResult.ok) {
        assertEquals(csvResult.data.content, "Tags: tag1, tag2, tag3");
      }

      // Test list format
      const listResult = processor.processTemplate(template, mockMappedData, {
        arrayFormat: "list",
      });
      assertEquals(listResult.ok, true);
      if (listResult.ok) {
        assertEquals(listResult.data.content, "Tags: - tag1\n- tag2\n- tag3");
      }
    });

    it("should handle object variables with different formats", () => {
      const template = "Metadata: {metadata}";

      // Test JSON format (default)
      const jsonResult = processor.processTemplate(template, mockMappedData);
      assertEquals(jsonResult.ok, true);
      if (jsonResult.ok) {
        assertEquals(
          jsonResult.data.content.includes('"author": "John Doe"'),
          true,
        );
      }

      // Test CSV format
      const csvResult = processor.processTemplate(template, mockMappedData, {
        arrayFormat: "csv",
      });
      assertEquals(csvResult.ok, true);
      if (csvResult.ok) {
        assertEquals(
          csvResult.data.content,
          "Metadata: author: John Doe, version: 1.0",
        );
      }

      // Test list format
      const listResult = processor.processTemplate(template, mockMappedData, {
        arrayFormat: "list",
      });
      assertEquals(listResult.ok, true);
      if (listResult.ok) {
        assertEquals(
          listResult.data.content,
          "Metadata: - author: John Doe\n- version: 1.0",
        );
      }
    });

    it("should handle different data types correctly", () => {
      const template =
        "Count: {count}, Enabled: {enabled}, Null: {nullValue}, Undefined: {undefinedValue}";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.content,
          "Count: 42, Enabled: true, Null: , Undefined: ",
        );
      }
    });

    it("should handle missing variables with different strategies", () => {
      const template = "Title: {title}, Missing: {missingField}";

      // Test default (empty) strategy
      const emptyResult = processor.processTemplate(template, mockMappedData);
      assertEquals(emptyResult.ok, true);
      if (emptyResult.ok) {
        assertEquals(emptyResult.data.content, "Title: Test Title, Missing: ");
        assertEquals(emptyResult.data.unresolvedVariables, ["missingField"]);
      }

      // Test remove strategy
      const removeResult = processor.processTemplate(template, mockMappedData, {
        handleMissingOptional: "remove",
      });
      assertEquals(removeResult.ok, true);
      if (removeResult.ok) {
        assertEquals(removeResult.data.content, "Title: Test Title, Missing: ");
      }

      // Test keep strategy
      const keepResult = processor.processTemplate(template, mockMappedData, {
        handleMissingOptional: "keep",
      });
      assertEquals(keepResult.ok, true);
      if (keepResult.ok) {
        assertEquals(
          keepResult.data.content,
          "Title: Test Title, Missing: {missingField}",
        );
      }
    });

    it("should handle missing required variables", () => {
      const template = "Required: {requiredField}, Optional: {missingField}";

      // Test warning (default) strategy
      const warningResult = processor.processTemplate(template, mockMappedData);
      assertEquals(warningResult.ok, true);
      if (warningResult.ok) {
        assertEquals(warningResult.data.missingRequiredVariables, [
          "requiredField",
        ]);
      }

      // Test error strategy
      const errorResult = processor.processTemplate(template, mockMappedData, {
        handleMissingRequired: "error",
      });
      assertEquals(errorResult.ok, false);
      if (!errorResult.ok) {
        assertEquals(
          errorResult.error.message.includes(
            "Required template variable not found",
          ),
          true,
        );
      }

      // Test ignore strategy
      const ignoreResult = processor.processTemplate(template, mockMappedData, {
        handleMissingRequired: "ignore",
      });
      assertEquals(ignoreResult.ok, true);
      if (ignoreResult.ok) {
        assertEquals(ignoreResult.data.missingRequiredVariables, [
          "requiredField",
        ]);
      }
    });

    it("should handle templates with no variables", () => {
      const template = "This template has no variables";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content, template);
        assertEquals(result.data.replacedVariables.length, 0);
        assertEquals(result.data.unresolvedVariables.length, 0);
      }
    });

    it("should handle templates with special regex characters in variables", () => {
      const mockDataWithSpecialChars: MappedSchemaData = {
        ...mockMappedData,
        matches: [
          {
            path: "field.with.dots",
            value: "dotted value",
            matchedProperty: { required: false, type: "string" },
            confidence: 1.0,
          },
          {
            path: "field[0]",
            value: "indexed value",
            matchedProperty: { required: false, type: "string" },
            confidence: 1.0,
          },
        ] as SchemaMatchResult[],
      };

      const template = "Dotted: {field.with.dots}, Indexed: {field[0]}";

      const result = processor.processTemplate(
        template,
        mockDataWithSpecialChars,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.content,
          "Dotted: dotted value, Indexed: indexed value",
        );
      }
    });

    it("should handle duplicate variables in template", () => {
      const template = "Title: {title}, Title again: {title}";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.content,
          "Title: Test Title, Title again: Test Title",
        );
        assertEquals(result.data.replacedVariables, ["title"]);
      }
    });

    it("should handle empty template", () => {
      const template = "";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content, "");
        assertEquals(result.data.replacedVariables.length, 0);
      }
    });

    it("should handle template with only whitespace variables", () => {
      const template = "Value: {  }, Another: {   }";

      const result = processor.processTemplate(template, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Whitespace variables should be ignored
        assertEquals(result.data.content, template);
        assertEquals(result.data.replacedVariables.length, 0);
      }
    });

    it("should handle processing errors gracefully", () => {
      // Create a mock that will cause an error during processing
      const corruptedMappedData = {
        ...mockMappedData,
        matches: null as unknown as SchemaMatchResult[],
      };

      const template = "Title: {title}";

      const result = processor.processTemplate(template, corruptedMappedData);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(
          result.error.message.includes("Failed to process template"),
          true,
        );
      }
    });
  });

  describe("resolveComplexSchemaPath", () => {
    it("should resolve simple schema paths", () => {
      const result = processor.resolveComplexSchemaPath(
        "title",
        mockMappedData,
      );

      assertEquals(result.found, true);
      assertEquals(result.value, "Test Title");
    });

    it("should handle array notation in schema paths", () => {
      const result = processor.resolveComplexSchemaPath(
        "tools.commands[]",
        mockMappedData,
      );

      assertEquals(result.found, true);
      assertEquals(Array.isArray(result.value), true);
    });

    it("should handle indexed array access", () => {
      const result = processor.resolveComplexSchemaPath(
        "tools.commands[0].name",
        mockMappedData,
      );

      assertEquals(result.found, true);
      assertEquals(result.value, "command1");
    });

    it("should return not found for missing paths", () => {
      const result = processor.resolveComplexSchemaPath(
        "nonexistent.path",
        mockMappedData,
      );

      assertEquals(result.found, false);
      assertEquals(result.value, undefined);
    });

    it("should handle empty array notation", () => {
      const emptyArrayData: MappedSchemaData = {
        ...mockMappedData,
        matches: [],
      };

      const result = processor.resolveComplexSchemaPath(
        "tools.commands[]",
        emptyArrayData,
      );

      assertEquals(result.found, false);
      assertEquals(result.value, undefined);
    });

    it("should handle complex nested array paths", () => {
      const complexMappedData: MappedSchemaData = {
        ...mockMappedData,
        matches: [
          {
            path: "tools.commands[0].options.input",
            value: "input1",
            matchedProperty: { required: false, type: "string" },
            confidence: 1.0,
          },
          {
            path: "tools.commands[1].options.input",
            value: "input2",
            matchedProperty: { required: false, type: "string" },
            confidence: 1.0,
          },
        ] as SchemaMatchResult[],
      };

      const result = processor.resolveComplexSchemaPath(
        "tools.commands[].options",
        complexMappedData,
      );

      assertEquals(result.found, false);
    });
  });

  describe("formatArray", () => {
    it("should format arrays as JSON", () => {
      // Access private method through reflection
      // deno-lint-ignore no-explicit-any
      const formatArray = (processor as any).formatArray.bind(processor);

      const result = formatArray(["a", "b", "c"], "json");
      assertEquals(result, '["a","b","c"]');
    });

    it("should format arrays as CSV", () => {
      // deno-lint-ignore no-explicit-any
      const formatArray = (processor as any).formatArray.bind(processor);

      const result = formatArray(["a", "b", "c"], "csv");
      assertEquals(result, "a, b, c");
    });

    it("should format arrays as list", () => {
      // deno-lint-ignore no-explicit-any
      const formatArray = (processor as any).formatArray.bind(processor);

      const result = formatArray(["a", "b", "c"], "list");
      assertEquals(result, "- a\n- b\n- c");
    });

    it("should handle empty arrays", () => {
      // deno-lint-ignore no-explicit-any
      const formatArray = (processor as any).formatArray.bind(processor);

      const jsonResult = formatArray([], "json");
      assertEquals(jsonResult, "[]");

      const csvResult = formatArray([], "csv");
      assertEquals(csvResult, "");

      const listResult = formatArray([], "list");
      assertEquals(listResult, "");
    });

    it("should handle mixed type arrays", () => {
      // deno-lint-ignore no-explicit-any
      const formatArray = (processor as any).formatArray.bind(processor);

      const result = formatArray([1, "string", true, null], "csv");
      assertEquals(result, "1, string, true, null");
    });
  });

  describe("formatObject", () => {
    it("should format objects as JSON", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const obj = { name: "test", value: 123 };
      const result = formatObject(obj, "json");
      assertEquals(result.includes('"name": "test"'), true);
      assertEquals(result.includes('"value": 123'), true);
    });

    it("should format objects as CSV", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const obj = { name: "test", value: 123 };
      const result = formatObject(obj, "csv");
      assertEquals(result, "name: test, value: 123");
    });

    it("should format objects as list", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const obj = { name: "test", value: 123 };
      const result = formatObject(obj, "list");
      assertEquals(result, "- name: test\n- value: 123");
    });

    it("should handle empty objects", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const result = formatObject({}, "json");
      assertEquals(result, "{}");
    });

    it("should handle non-object values", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const stringResult = formatObject("not an object", "json");
      assertEquals(stringResult, '"not an object"');

      const numberResult = formatObject(42, "csv");
      assertEquals(numberResult, "42");
    });

    it("should handle null and undefined", () => {
      // deno-lint-ignore no-explicit-any
      const formatObject = (processor as any).formatObject.bind(processor);

      const nullResult = formatObject(null, "json");
      assertEquals(nullResult, "null");

      const undefinedResult = formatObject(undefined, "csv");
      assertEquals(undefinedResult, "undefined");
    });
  });

  describe("extractTemplateVariables", () => {
    it("should extract simple variables", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables(
        "Hello {name}, welcome to {place}!",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["name", "place"]);
      }
    });

    it("should extract variables with complex names", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("Path: {tools.commands[0].name}");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["tools.commands[0].name"]);
      }
    });

    it("should handle duplicate variables", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("{name} and {name} again");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["name"]);
      }
    });

    it("should handle variables with whitespace", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("{ name } and {  title  }");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["name", "title"]);
      }
    });

    it("should ignore empty variables", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("Empty {} and whitespace {  }");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, []);
      }
    });

    it("should handle malformed braces", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("Unclosed { and unopened }");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["and unopened"]);
      }
    });

    it("should handle nested braces", () => {
      // deno-lint-ignore no-explicit-any
      const extractTemplateVariables = (processor as any)
        .extractTemplateVariables.bind(processor);

      const result = extractTemplateVariables("Nested {outer{inner}}");

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should extract the outer variable only
        assertEquals(result.data, ["outer{inner"]);
      }
    });
  });

  describe("escapeRegExp", () => {
    it("should escape special regex characters", () => {
      // deno-lint-ignore no-explicit-any
      const escapeRegExp = (processor as any).escapeRegExp.bind(processor);

      const specialChars = ".*+?^${}()|[]\\";
      const escaped = escapeRegExp(specialChars);

      assertEquals(escaped, "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
    });

    it("should not modify normal characters", () => {
      // deno-lint-ignore no-explicit-any
      const escapeRegExp = (processor as any).escapeRegExp.bind(processor);

      const normal = "abc123_-";
      const escaped = escapeRegExp(normal);

      assertEquals(escaped, normal);
    });

    it("should handle empty strings", () => {
      // deno-lint-ignore no-explicit-any
      const escapeRegExp = (processor as any).escapeRegExp.bind(processor);

      const escaped = escapeRegExp("");

      assertEquals(escaped, "");
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete template processing workflow", () => {
      const template = `
# {title}

{description}

## Tags
{tags}

## Metadata
{metadata}

## Stats
- Count: {count}
- Enabled: {enabled}

## Commands
{tools.commands[0].name}
      `.trim();

      const result = processor.processTemplate(template, mockMappedData, {
        arrayFormat: "list",
        handleMissingOptional: "empty",
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content.includes("# Test Title"), true);
        assertEquals(result.data.content.includes("Test Description"), true);
        assertEquals(result.data.content.includes("- tag1"), true);
        assertEquals(result.data.content.includes("Count: 42"), true);
        assertEquals(result.data.content.includes("command1"), true);
        assertEquals(result.data.replacedVariables.length > 0, true);
      }
    });

    it("should maintain consistency across multiple processing calls", () => {
      const template = "Value: {title}";

      const result1 = processor.processTemplate(template, mockMappedData);
      const result2 = processor.processTemplate(template, mockMappedData);

      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (result1.ok && result2.ok) {
        assertEquals(result1.data.content, result2.data.content);
      }
    });

    it("should handle large templates efficiently", () => {
      const largeTemplate = Array(1000).fill("{title}").join(" ");

      const result = processor.processTemplate(largeTemplate, mockMappedData);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.content.split("Test Title").length - 1, 1000);
      }
    });
  });
});
