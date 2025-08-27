import { assertEquals } from "jsr:@std/assert";
import {
  CustomTemplateHandler,
  HandlebarsTemplateHandler,
  JSONTemplateHandler,
  TemplateFormat,
  TemplateFormatHandlerFactory,
  YAMLTemplateHandler,
} from "../../../../src/domain/template/format-handlers.ts";

Deno.test("TemplateFormat - Smart Constructor", async (t) => {
  await t.step("should create valid JSON format", () => {
    const result = TemplateFormat.create("json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "json");
    }
  });

  await t.step("should create valid YAML format", () => {
    const result = TemplateFormat.create("yaml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "yaml");
    }
  });

  await t.step("should create valid YML format", () => {
    const result = TemplateFormat.create("yml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "yml");
    }
  });

  await t.step("should create valid Handlebars format", () => {
    const result = TemplateFormat.create("handlebars");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "handlebars");
    }
  });

  await t.step("should create valid custom format", () => {
    const result = TemplateFormat.create("custom");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "custom");
    }
  });

  await t.step("should normalize format to lowercase", () => {
    const result = TemplateFormat.create("JSON");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "json");
    }
  });

  await t.step("should reject invalid format", () => {
    const result = TemplateFormat.create("invalid");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
      // ValidationError will contain the format information in message field
    }
  });

  await t.step("should handle equals comparison", () => {
    const format1Result = TemplateFormat.create("json");
    const format2Result = TemplateFormat.create("JSON");
    const format3Result = TemplateFormat.create("yaml");

    if (format1Result.ok && format2Result.ok && format3Result.ok) {
      const format1 = format1Result.data;
      const format2 = format2Result.data;
      const format3 = format3Result.data;

      assertEquals(format1.equals(format2), true);
      assertEquals(format1.equals(format3), false);
      assertEquals(format2.equals(format3), false);
    }
  });
});

Deno.test("JSONTemplateHandler - Format Detection", async (t) => {
  const handler = new JSONTemplateHandler();

  await t.step("should handle JSON format", () => {
    assertEquals(handler.canHandle("json"), true);
    assertEquals(handler.canHandle("JSON"), true);
    assertEquals(handler.canHandle("Json"), true);
  });

  await t.step("should not handle other formats", () => {
    assertEquals(handler.canHandle("yaml"), false);
    assertEquals(handler.canHandle("yml"), false);
    assertEquals(handler.canHandle("handlebars"), false);
    assertEquals(handler.canHandle("custom"), false);
    assertEquals(handler.canHandle("xml"), false);
  });

  await t.step("should return correct format name", () => {
    assertEquals(handler.getFormatName(), "JSON");
  });
});

Deno.test("JSONTemplateHandler - Parsing", async (t) => {
  const handler = new JSONTemplateHandler();

  await t.step("should parse valid JSON", () => {
    const jsonContent = `{
  "title": "Test Document",
  "author": "John Doe",
  "tags": ["javascript", "deno"],
  "published": true,
  "version": 1.0
}`;

    const result = handler.parse(jsonContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.title, "Test Document");
      assertEquals(data.author, "John Doe");
      assertEquals(Array.isArray(data.tags), true);
      assertEquals(data.published, true);
      assertEquals(data.version, 1.0);
    }
  });

  await t.step("should parse nested JSON objects", () => {
    const jsonContent = `{
  "metadata": {
    "created": "2023-01-01",
    "author": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "content": {
    "sections": [
      {"title": "Introduction", "wordCount": 150},
      {"title": "Conclusion", "wordCount": 100}
    ]
  }
}`;

    const result = handler.parse(jsonContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      const metadata = data.metadata as Record<string, unknown>;
      const author = metadata.author as Record<string, unknown>;
      const content = data.content as Record<string, unknown>;
      const sections = content.sections as Array<Record<string, unknown>>;

      assertEquals(author.name, "John Doe");
      assertEquals(author.email, "john@example.com");
      assertEquals(sections.length, 2);
      assertEquals(sections[0].title, "Introduction");
      assertEquals(sections[1].wordCount, 100);
    }
  });

  await t.step("should reject empty content", () => {
    const result = handler.parse("");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });

  await t.step("should reject whitespace-only content", () => {
    const result = handler.parse("   \n\t  ");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });

  await t.step("should reject invalid JSON", () => {
    const invalidJson = `{
  "title": "Invalid JSON",
  "missing": "closing brace"`;

    const result = handler.parse(invalidJson);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });

  await t.step("should handle malformed JSON with trailing commas", () => {
    const malformedJson = `{
  "title": "Test",
  "author": "John",
}`;

    const result = handler.parse(malformedJson);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });
});

Deno.test("JSONTemplateHandler - Serialization", async (t) => {
  const handler = new JSONTemplateHandler();

  await t.step("should serialize simple object", () => {
    const data = {
      title: "Test Document",
      author: "John Doe",
      published: true,
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.title, "Test Document");
      assertEquals(parsed.author, "John Doe");
      assertEquals(parsed.published, true);
    }
  });

  await t.step("should serialize complex nested structure", () => {
    const data = {
      metadata: {
        created: new Date("2023-01-01"),
        tags: ["javascript", "deno"],
        stats: { words: 1500, readTime: 7 },
      },
      content: "Document content",
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(typeof parsed.metadata, "object");
      assertEquals(Array.isArray(parsed.metadata.tags), true);
      assertEquals(parsed.metadata.tags.length, 2);
      assertEquals(parsed.content, "Document content");
    }
  });

  await t.step("should serialize arrays", () => {
    const data = ["item1", "item2", { nested: "object" }];

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(Array.isArray(parsed), true);
      assertEquals(parsed.length, 3);
      assertEquals(parsed[0], "item1");
      assertEquals(parsed[2].nested, "object");
    }
  });

  await t.step("should handle circular references gracefully", () => {
    const data: Record<string, unknown> = { name: "test" };
    data.self = data; // Create circular reference

    const result = handler.serialize(data);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });

  await t.step("should serialize null and undefined", () => {
    const nullResult = handler.serialize(null);
    const undefinedResult = handler.serialize(undefined);

    assertEquals(nullResult.ok, true);
    assertEquals(undefinedResult.ok, true);

    if (nullResult.ok) {
      assertEquals(nullResult.data, "null");
    }
    if (undefinedResult.ok) {
      // undefined becomes null in JSON
      assertEquals(undefinedResult.data, undefined);
    }
  });
});

Deno.test("YAMLTemplateHandler - Format Detection", async (t) => {
  const handler = new YAMLTemplateHandler();

  await t.step("should handle YAML formats", () => {
    assertEquals(handler.canHandle("yaml"), true);
    assertEquals(handler.canHandle("YAML"), true);
    assertEquals(handler.canHandle("yml"), true);
    assertEquals(handler.canHandle("YML"), true);
    assertEquals(handler.canHandle("Yaml"), true);
  });

  await t.step("should not handle other formats", () => {
    assertEquals(handler.canHandle("json"), false);
    assertEquals(handler.canHandle("handlebars"), false);
    assertEquals(handler.canHandle("custom"), false);
    assertEquals(handler.canHandle("xml"), false);
  });

  await t.step("should return correct format name", () => {
    assertEquals(handler.getFormatName(), "YAML");
  });
});

Deno.test("YAMLTemplateHandler - Parsing", async (t) => {
  const handler = new YAMLTemplateHandler();

  await t.step("should parse simple YAML", () => {
    const yamlContent = `title: Test Document
author: John Doe
published: true
version: 1.0`;

    const result = handler.parse(yamlContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.title, "Test Document");
      assertEquals(data.author, "John Doe");
      assertEquals(data.published, true);
      assertEquals(data.version, 1.0);
    }
  });

  await t.step("should parse YAML with arrays", () => {
    const yamlContent = `title: Array Test
tags:
  - javascript
  - deno
  - typescript
numbers:
  - 1
  - 2
  - 3`;

    const result = handler.parse(yamlContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.title, "Array Test");

      const tags = data.tags as unknown[];
      assertEquals(Array.isArray(tags), true);
      assertEquals(tags.length, 3);
      assertEquals(tags[0], "javascript");
      assertEquals(tags[1], "deno");
      assertEquals(tags[2], "typescript");

      const numbers = data.numbers as unknown[];
      assertEquals(Array.isArray(numbers), true);
      assertEquals(numbers.length, 3);
      assertEquals(numbers[0], 1);
      assertEquals(numbers[1], 2);
      assertEquals(numbers[2], 3);
    }
  });

  await t.step("should parse quoted strings correctly", () => {
    const yamlContent = `quoted_string: "This is quoted"
single_quoted: 'Single quotes'
unquoted_string: This is unquoted
special_chars: "String with: colons and # hashes"`;

    const result = handler.parse(yamlContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.quoted_string, "This is quoted");
      assertEquals(data.single_quoted, "Single quotes");
      assertEquals(data.unquoted_string, "This is unquoted");
      assertEquals(data.special_chars, "String with: colons and # hashes");
    }
  });

  await t.step("should parse boolean and null values", () => {
    const yamlContent = `bool_true: true
bool_false: false
null_value: null
number_value: 42`;

    const result = handler.parse(yamlContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.bool_true, true);
      assertEquals(data.bool_false, false);
      assertEquals(data.null_value, null);
      assertEquals(data.number_value, 42);
    }
  });

  await t.step("should handle comments and empty lines", () => {
    const yamlContent = `# This is a comment
title: Test Document

# Another comment
author: John Doe

# Empty line above`;

    const result = handler.parse(yamlContent);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      assertEquals(data.title, "Test Document");
      assertEquals(data.author, "John Doe");
    }
  });

  await t.step("should reject empty content", () => {
    const result = handler.parse("");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });

  await t.step("should reject whitespace-only content", () => {
    const result = handler.parse("   \n\t  ");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
    }
  });
});

Deno.test("YAMLTemplateHandler - Serialization", async (t) => {
  const handler = new YAMLTemplateHandler();

  await t.step("should serialize simple object", () => {
    const data = {
      title: "Test Document",
      author: "John Doe",
      published: true,
      version: 1.0,
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("title: Test Document"), true);
      assertEquals(result.data.includes("author: John Doe"), true);
      assertEquals(result.data.includes("published: true"), true);
      assertEquals(result.data.includes("version: 1"), true);
    }
  });

  await t.step("should serialize arrays correctly", () => {
    const data = {
      tags: ["javascript", "deno", "typescript"],
      numbers: [1, 2, 3],
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("tags:"), true);
      assertEquals(result.data.includes("- javascript"), true);
      assertEquals(result.data.includes("- deno"), true);
      assertEquals(result.data.includes("- typescript"), true);
      assertEquals(result.data.includes("numbers:"), true);
      assertEquals(result.data.includes("- 1"), true);
      assertEquals(result.data.includes("- 2"), true);
      assertEquals(result.data.includes("- 3"), true);
    }
  });

  await t.step("should serialize nested objects", () => {
    const data = {
      metadata: {
        created: "2023-01-01",
        author: {
          name: "John Doe",
          email: "john@example.com",
        },
      },
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("metadata:"), true);
      assertEquals(result.data.includes("created: 2023-01-01"), true);
      assertEquals(result.data.includes("author:"), true);
      assertEquals(result.data.includes("name: John Doe"), true);
      assertEquals(result.data.includes("email: john@example.com"), true);
    }
  });

  await t.step("should handle null and undefined values", () => {
    const data = {
      null_value: null,
      undefined_value: undefined,
      empty_string: "",
      zero: 0,
      false_value: false,
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("null_value: null"), true);
      assertEquals(result.data.includes("undefined_value: null"), true);
      assertEquals(result.data.includes("empty_string: "), true);
      assertEquals(result.data.includes("zero: 0"), true);
      assertEquals(result.data.includes("false_value: false"), true);
    }
  });

  await t.step("should quote strings with special characters", () => {
    const data = {
      colon_string: "value: with colons",
      hash_string: "value # with hash",
      quote_string: 'value with "quotes"',
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      // Strings with special characters should be quoted
      assertEquals(result.data.includes('"value: with colons"'), true);
      assertEquals(result.data.includes('"value # with hash"'), true);
      assertEquals(result.data.includes('"value with \\"quotes\\""'), true);
    }
  });

  await t.step("should serialize empty arrays and objects", () => {
    const data = {
      empty_array: [],
      empty_object: {},
    };

    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      // The YAML handler produces indented output for nested structures
      // Check that the serialized YAML contains the expected empty structures
      assertEquals(result.data.includes("empty_array:"), true);
      assertEquals(result.data.includes("[]"), true);
      assertEquals(result.data.includes("empty_object:"), true);
      assertEquals(result.data.includes("{}"), true);
    }
  });
});

Deno.test("HandlebarsTemplateHandler - Format Detection", async (t) => {
  const handler = new HandlebarsTemplateHandler();

  await t.step("should handle Handlebars formats", () => {
    assertEquals(handler.canHandle("handlebars"), true);
    assertEquals(handler.canHandle("HANDLEBARS"), true);
    assertEquals(handler.canHandle("hbs"), true);
    assertEquals(handler.canHandle("HBS"), true);
  });

  await t.step("should not handle other formats", () => {
    assertEquals(handler.canHandle("json"), false);
    assertEquals(handler.canHandle("yaml"), false);
    assertEquals(handler.canHandle("custom"), false);
  });

  await t.step("should return correct format name", () => {
    assertEquals(handler.getFormatName(), "Handlebars");
  });
});

Deno.test("HandlebarsTemplateHandler - Parsing and Serialization", async (t) => {
  const handler = new HandlebarsTemplateHandler();

  await t.step("should parse content as plain text", () => {
    const content = "{{title}} - {{author}}";
    const result = handler.parse(content);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, content);
    }
  });

  await t.step("should serialize string data as-is", () => {
    const data = "{{title}} - {{author}}";
    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, data);
    }
  });

  await t.step("should serialize object data as JSON", () => {
    const data = { title: "Test", author: "John" };
    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.title, "Test");
      assertEquals(parsed.author, "John");
    }
  });
});

Deno.test("CustomTemplateHandler - Format Detection", async (t) => {
  const handler = new CustomTemplateHandler();

  await t.step("should handle custom format", () => {
    assertEquals(handler.canHandle("custom"), true);
    assertEquals(handler.canHandle("CUSTOM"), true);
    assertEquals(handler.canHandle("Custom"), true);
  });

  await t.step("should not handle other formats", () => {
    assertEquals(handler.canHandle("json"), false);
    assertEquals(handler.canHandle("yaml"), false);
    assertEquals(handler.canHandle("handlebars"), false);
  });

  await t.step("should return correct format name", () => {
    assertEquals(handler.getFormatName(), "Custom");
  });
});

Deno.test("CustomTemplateHandler - Parsing and Serialization", async (t) => {
  const handler = new CustomTemplateHandler();

  await t.step("should parse content as plain text", () => {
    const content = "Custom template with ${placeholder}";
    const result = handler.parse(content);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, content);
    }
  });

  await t.step("should serialize string data as-is", () => {
    const data = "Custom template output";
    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, data);
    }
  });

  await t.step("should serialize non-string data as string", () => {
    const data = { processed: true };
    const result = handler.serialize(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "[object Object]");
    }
  });
});

Deno.test("TemplateFormatHandlerFactory - Handler Discovery", async (t) => {
  await t.step("should get JSON handler", () => {
    const result = TemplateFormatHandlerFactory.getHandler("json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data instanceof JSONTemplateHandler, true);
      assertEquals(result.data.canHandle("json"), true);
    }
  });

  await t.step("should get YAML handler for yaml format", () => {
    const result = TemplateFormatHandlerFactory.getHandler("yaml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data instanceof YAMLTemplateHandler, true);
      assertEquals(result.data.canHandle("yaml"), true);
    }
  });

  await t.step("should get YAML handler for yml format", () => {
    const result = TemplateFormatHandlerFactory.getHandler("yml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data instanceof YAMLTemplateHandler, true);
      assertEquals(result.data.canHandle("yml"), true);
    }
  });

  await t.step("should get Handlebars handler", () => {
    const result = TemplateFormatHandlerFactory.getHandler("handlebars");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data instanceof HandlebarsTemplateHandler, true);
      assertEquals(result.data.canHandle("handlebars"), true);
    }
  });

  await t.step("should get Custom handler", () => {
    const result = TemplateFormatHandlerFactory.getHandler("custom");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data instanceof CustomTemplateHandler, true);
      assertEquals(result.data.canHandle("custom"), true);
    }
  });

  await t.step("should reject unknown format", () => {
    const result = TemplateFormatHandlerFactory.getHandler("unknown");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.kind,
        "ValidationError",
      );
      // ValidationError will contain the handler information
    }
  });

  await t.step("should get all handlers", () => {
    const handlers = TemplateFormatHandlerFactory.getAllHandlers();

    assertEquals(handlers.length, 4);
    assertEquals(handlers.some((h) => h instanceof JSONTemplateHandler), true);
    assertEquals(handlers.some((h) => h instanceof YAMLTemplateHandler), true);
    assertEquals(
      handlers.some((h) => h instanceof HandlebarsTemplateHandler),
      true,
    );
    assertEquals(
      handlers.some((h) => h instanceof CustomTemplateHandler),
      true,
    );
  });

  await t.step("should get supported formats", () => {
    const formats = TemplateFormatHandlerFactory.getSupportedFormats();

    assertEquals(formats.length, 4);
    assertEquals(formats.includes("json"), true);
    assertEquals(formats.includes("yaml"), true);
    assertEquals(formats.includes("handlebars"), true);
    assertEquals(formats.includes("custom"), true);
  });
});

Deno.test("TemplateFormatHandler - Integration Tests", async (t) => {
  await t.step("should handle round-trip JSON processing", () => {
    const handler = new JSONTemplateHandler();
    const originalData = {
      title: "Round Trip Test",
      metadata: { version: 1.0 },
      tags: ["test", "json"],
    };

    const serializeResult = handler.serialize(originalData);
    assertEquals(serializeResult.ok, true);

    if (serializeResult.ok) {
      const parseResult = handler.parse(serializeResult.data);
      assertEquals(parseResult.ok, true);

      if (parseResult.ok) {
        const data = parseResult.data as Record<string, unknown>;
        assertEquals(data.title, originalData.title);

        const metadata = data.metadata as Record<string, unknown>;
        assertEquals(metadata.version, originalData.metadata.version);

        const tags = data.tags as string[];
        assertEquals(tags.length, originalData.tags.length);
        assertEquals(tags[0], originalData.tags[0]);
        assertEquals(tags[1], originalData.tags[1]);
      }
    }
  });

  await t.step("should handle round-trip YAML processing", () => {
    const handler = new YAMLTemplateHandler();
    const originalData = {
      title: "YAML Round Trip",
      published: true,
      tags: ["yaml", "test"],
    };

    const serializeResult = handler.serialize(originalData);
    assertEquals(serializeResult.ok, true);

    if (serializeResult.ok) {
      const parseResult = handler.parse(serializeResult.data);
      assertEquals(parseResult.ok, true);

      if (parseResult.ok) {
        const data = parseResult.data as Record<string, unknown>;
        assertEquals(data.title, originalData.title);
        assertEquals(data.published, originalData.published);

        const tags = data.tags as unknown[];
        assertEquals(tags.length, originalData.tags.length);
        assertEquals(tags[0], originalData.tags[0]);
        assertEquals(tags[1], originalData.tags[1]);
      }
    }
  });

  await t.step("should maintain consistency across different handlers", () => {
    const testData = {
      title: "Consistency Test",
      author: "Test Author",
      published: true,
      version: 1.0,
    };

    const jsonHandler = new JSONTemplateHandler();
    const yamlHandler = new YAMLTemplateHandler();

    const jsonResult = jsonHandler.serialize(testData);
    const yamlResult = yamlHandler.serialize(testData);

    assertEquals(jsonResult.ok, true);
    assertEquals(yamlResult.ok, true);

    if (jsonResult.ok && yamlResult.ok) {
      const jsonParsed = JSON.parse(jsonResult.data);
      const yamlParsedResult = yamlHandler.parse(yamlResult.data);

      assertEquals(yamlParsedResult.ok, true);
      if (yamlParsedResult.ok) {
        const yamlParsed = yamlParsedResult.data as Record<string, unknown>;

        // Both should contain the same semantic data
        assertEquals(jsonParsed.title, yamlParsed.title);
        assertEquals(jsonParsed.author, yamlParsed.author);
        assertEquals(jsonParsed.published, yamlParsed.published);
        assertEquals(jsonParsed.version, yamlParsed.version);
      }
    }
  });
});
