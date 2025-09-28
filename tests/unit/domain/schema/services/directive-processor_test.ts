import { assertEquals } from "jsr:@std/assert";
import {
  DirectiveHandler,
  DirectiveProcessor,
} from "../../../../../src/domain/schema/services/directive-processor.ts";
import { SchemaData } from "../../../../../src/domain/schema/entities/schema.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";

// Test schemas
const schemaWithoutDirectives: SchemaData = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
  },
};

const schemaWithFrontmatterPartDirective: SchemaData = {
  type: "object",
  properties: {
    title: {
      type: "string",
      "x-frontmatter-part": true,
    },
    description: { type: "string" },
  },
};

const schemaWithMultipleDirectives: SchemaData = {
  type: "object",
  properties: {
    title: {
      type: "string",
      "x-frontmatter-part": true,
    },
    tags: {
      type: "array",
      items: { type: "string" },
      "x-flatten-arrays": true,
    },
  },
  "x-template-format": "json",
};

const schemaWithNestedDirectives: SchemaData = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        author: {
          type: "string",
          "x-frontmatter-part": true,
        },
        tags: {
          type: "array",
          items: { type: "string" },
          "x-derived-from": ["categories", "topics"],
        },
      },
    },
    content: { type: "string" },
  },
};

const schemaWithConflictingDirectives: SchemaData = {
  type: "object",
  properties: {
    data: {
      type: "string",
      "x-frontmatter-part": true,
      "x-derived-from": "other_field",
    },
  },
};

const schemaWithInvalidDirective: SchemaData = {
  type: "object",
  properties: {
    title: {
      type: "string",
      "x-frontmatter-part": "invalid_value", // Should be boolean
    },
  },
};

const schemaWithTemplateDirectives: SchemaData = {
  type: "object",
  properties: {
    output: {
      type: "object",
      properties: {
        format: { type: "string" },
      },
    },
  },
  "x-template": "output_template.json",
  "x-template-format": "json",
  "x-template-items": "items_template.json",
};

Deno.test("DirectiveProcessor - create instance", () => {
  const processor = DirectiveProcessor.create();

  assertEquals(typeof processor, "object");
  assertEquals(processor.constructor.name, "DirectiveProcessor");
});

Deno.test("DirectiveProcessor - process schema without directives", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(schemaWithoutDirectives);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, false);
  assertEquals(processingResult.extractedDirectives.length, 0);
  assertEquals(processingResult.processedSchema.type, "object");
});

Deno.test("DirectiveProcessor - process schema with frontmatter-part directive", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(
    schemaWithFrontmatterPartDirective,
  );

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);
  assertEquals(processingResult.extractedDirectives.length, 1);

  const directive = processingResult.extractedDirectives[0];
  assertEquals(directive.type, "x-frontmatter-part");
  assertEquals(directive.value, true);
  assertEquals(directive.path, ["title"]);

  // Check that directive is removed from processed schema
  const titleProperty =
    (processingResult.processedSchema.properties as any).title;
  assertEquals(titleProperty["x-frontmatter-part"], undefined);
  assertEquals(titleProperty.type, "string");
});

Deno.test("DirectiveProcessor - process schema with multiple directives", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(schemaWithMultipleDirectives);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);
  assertEquals(processingResult.extractedDirectives.length, 3);

  const directiveTypes = processingResult.extractedDirectives.map((d) =>
    d.type
  );
  assertEquals(directiveTypes.includes("x-frontmatter-part"), true);
  assertEquals(directiveTypes.includes("x-flatten-arrays"), true);
  assertEquals(directiveTypes.includes("x-template-format"), true);

  // Check root-level directive
  const templateFormatDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-template-format",
  );
  assertEquals(templateFormatDirective?.path, []);
  assertEquals(templateFormatDirective?.value, "json");
});

Deno.test("DirectiveProcessor - process schema with nested directives", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(schemaWithNestedDirectives);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);
  assertEquals(processingResult.extractedDirectives.length, 2);

  const frontmatterDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-frontmatter-part",
  );
  assertEquals(frontmatterDirective?.path, ["metadata", "author"]);

  const derivedFromDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-derived-from",
  );
  assertEquals(derivedFromDirective?.path, ["metadata", "tags"]);
  assertEquals(Array.isArray(derivedFromDirective?.value), true);
});

Deno.test("DirectiveProcessor - detect conflicting directives", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.validateDirectives(schemaWithConflictingDirectives);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "CONFLICTING_DIRECTIVES");
});

Deno.test("DirectiveProcessor - handle invalid directive value", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(schemaWithInvalidDirective);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("DirectiveProcessor - extract directives without processing", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.extractDirectives(schemaWithMultipleDirectives);

  assertEquals(result.isOk(), true);
  const directives = result.unwrap();
  assertEquals(directives.length, 3);

  const directiveTypes = directives.map((d) => d.type);
  assertEquals(directiveTypes.includes("x-frontmatter-part"), true);
  assertEquals(directiveTypes.includes("x-flatten-arrays"), true);
  assertEquals(directiveTypes.includes("x-template-format"), true);
});

Deno.test("DirectiveProcessor - validate directives", () => {
  const processor = DirectiveProcessor.create();

  const validResult = processor.validateDirectives(
    schemaWithMultipleDirectives,
  );
  assertEquals(validResult.isOk(), true);

  const invalidResult = processor.validateDirectives(
    schemaWithInvalidDirective,
  );
  assertEquals(invalidResult.isError(), true);
});

Deno.test("DirectiveProcessor - register custom handler", () => {
  const processor = DirectiveProcessor.create();

  const customHandler: DirectiveHandler = {
    directiveType: "x-frontmatter-part",
    validate: (value: unknown) => {
      if (typeof value !== "boolean") {
        return Result.error({
          kind: "InvalidDirectiveValue",
          directive: "x-frontmatter-part",
          value,
          expected: "boolean",
        });
      }
      return Result.ok(undefined);
    },
    process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
  };

  // This should fail since handler already exists
  const result = processor.registerHandler(customHandler);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "HANDLER_ALREADY_REGISTERED");
});

Deno.test("DirectiveProcessor - process template directives", () => {
  const processor = DirectiveProcessor.create();

  const result = processor.processDirectives(schemaWithTemplateDirectives);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);
  assertEquals(processingResult.extractedDirectives.length, 3);

  const directiveTypes = processingResult.extractedDirectives.map((d) =>
    d.type
  );
  assertEquals(directiveTypes.includes("x-template"), true);
  assertEquals(directiveTypes.includes("x-template-format"), true);
  assertEquals(directiveTypes.includes("x-template-items"), true);

  // All should be at root level
  processingResult.extractedDirectives.forEach((directive) => {
    assertEquals(directive.path, []);
  });
});

Deno.test("DirectiveProcessor - handle x-derived-from with string value", () => {
  const schemaWithDerivedFrom: SchemaData = {
    type: "object",
    properties: {
      title: {
        type: "string",
        "x-derived-from": "original_title",
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schemaWithDerivedFrom);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.extractedDirectives.length, 1);

  const directive = processingResult.extractedDirectives[0];
  assertEquals(directive.type, "x-derived-from");
  assertEquals(directive.value, "original_title");
});

Deno.test("DirectiveProcessor - handle x-derived-from with array value", () => {
  const schemaWithDerivedFromArray: SchemaData = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        "x-derived-from": ["categories", "keywords", "topics"],
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schemaWithDerivedFromArray);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.extractedDirectives.length, 1);

  const directive = processingResult.extractedDirectives[0];
  assertEquals(directive.type, "x-derived-from");
  assertEquals(Array.isArray(directive.value), true);
  assertEquals((directive.value as string[]).length, 3);
});

Deno.test("DirectiveProcessor - validate x-template-format values", () => {
  const validSchema: SchemaData = {
    type: "object",
    "x-template-format": "yaml",
  };

  const invalidSchema: SchemaData = {
    type: "object",
    "x-template-format": "xml", // Invalid format
  };

  const processor = DirectiveProcessor.create();

  const validResult = processor.validateDirectives(validSchema);
  assertEquals(validResult.isOk(), true);

  const invalidResult = processor.validateDirectives(invalidSchema);
  assertEquals(invalidResult.isError(), true);
  assertEquals(invalidResult.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("DirectiveProcessor - handle empty schema", () => {
  const emptySchema: SchemaData = {
    type: "object",
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(emptySchema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, false);
  assertEquals(processingResult.extractedDirectives.length, 0);
});

Deno.test("DirectiveProcessor - handle complex nested structure", () => {
  const complexSchema: SchemaData = {
    type: "object",
    properties: {
      level1: {
        type: "object",
        properties: {
          level2: {
            type: "object",
            properties: {
              data: {
                type: "string",
                "x-frontmatter-part": true,
              },
            },
            "x-flatten-arrays": true,
          },
        },
        "x-template-format": "json",
      },
    },
    "x-template": "complex_template.json",
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(complexSchema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);
  assertEquals(processingResult.extractedDirectives.length, 4);

  // Check directive paths
  const paths = processingResult.extractedDirectives.map((d) =>
    d.path.join(".")
  );
  assertEquals(paths.includes(""), true); // Root level
  assertEquals(paths.includes("level1"), true);
  assertEquals(paths.includes("level1.level2"), true);
  assertEquals(paths.includes("level1.level2.data"), true);
});

Deno.test("DirectiveProcessor - handle unsupported directive in extraction", () => {
  const schemaWithUnsupported: SchemaData = {
    type: "object",
    properties: {
      data: {
        type: "string",
        "x-custom-directive": "value", // Not in supported list
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.extractDirectives(schemaWithUnsupported);

  // Should succeed but not extract the unsupported directive
  assertEquals(result.isOk(), true);
  const directives = result.unwrap();
  assertEquals(directives.length, 0);
});

Deno.test("DirectiveProcessor - preserve schema structure", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schemaWithMultipleDirectives);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  // Check that the processed schema maintains structure
  assertEquals(processingResult.processedSchema.type, "object");
  assertEquals(typeof processingResult.processedSchema.properties, "object");

  const properties = processingResult.processedSchema.properties as Record<
    string,
    any
  >;
  assertEquals(properties.title.type, "string");
  assertEquals(properties.tags.type, "array");
  assertEquals(properties.tags.items.type, "string");

  // Check that directives are removed
  assertEquals(properties.title["x-frontmatter-part"], undefined);
  assertEquals(properties.tags["x-flatten-arrays"], undefined);
  assertEquals(
    processingResult.processedSchema["x-template-format"],
    undefined,
  );
});

Deno.test("DirectiveProcessor - handle directive context", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.extractDirectives(schemaWithNestedDirectives);

  assertEquals(result.isOk(), true);
  const directives = result.unwrap();

  // Check that each directive has correct context
  const frontmatterDirective = directives.find((d) =>
    d.type === "x-frontmatter-part"
  );
  assertEquals(frontmatterDirective?.context.currentPath, [
    "metadata",
    "author",
  ]);
  assertEquals(frontmatterDirective?.context.parentSchema.type, "object");
  assertEquals(
    frontmatterDirective?.context.rootSchema,
    schemaWithNestedDirectives,
  );

  const derivedFromDirective = directives.find((d) =>
    d.type === "x-derived-from"
  );
  assertEquals(derivedFromDirective?.context.currentPath, ["metadata", "tags"]);
});
