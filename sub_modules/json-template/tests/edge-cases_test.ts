/**
 * Edge case tests for JSON template processing
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createTemplateProcessor, VariableResolver } from '../src/mod.ts';

// Helper to create temporary test files
async function createTempFile(content: string): Promise<string> {
  const tempFile = await Deno.makeTempFile({ suffix: '.json' });
  await Deno.writeTextFile(tempFile, content);
  return tempFile;
}

async function cleanup(filePath: string) {
  try {
    await Deno.remove(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

Deno.test("Edge Case - Special characters in variable values", async () => {
  const template = '{"message": "{message}", "json": "{json}"}';
  const data = {
    message: 'Hello "World" with \\backslashes and \n newlines',
    json: { special: 'chars "quotes" and \\backslashes' }
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      message: 'Hello "World" with \\backslashes and \n newlines',
      json: { special: 'chars "quotes" and \\backslashes' }
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Unicode characters", async () => {
  const template = '{"unicode": "{unicode}", "emoji": "{emoji}"}';
  const data = {
    unicode: "こんにちは世界",
    emoji: "🚀 🎉 ⚡"
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      unicode: "こんにちは世界",
      emoji: "🚀 🎉 ⚡"
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Very long variable paths", async () => {
  const deepData = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: "deep value" } } } } } } } } } };
  const template = '{"deep": "{a.b.c.d.e.f.g.h.i.j}"}';

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(deepData, tempFile);

    assertEquals(result, { deep: "deep value" });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Large arrays", async () => {
  const largeArray = Array(1000).fill(null).map((_, i) => ({ id: i, value: `item${i}` }));
  const data = { items: largeArray };
  const template = '{"first": "{items[0].value}", "middle": "{items[500].value}", "last": "{items[999].value}"}';

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      first: "item0",
      middle: "item500",
      last: "item999"
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Empty and null values", async () => {
  const template = `{
    "empty_string": "{empty_string}",
    "empty_array": "{empty_array}",
    "empty_object": "{empty_object}",
    "null_value": "{null_value}",
    "undefined_becomes_null": "{undefined_value}"
  }`;

  const data = {
    empty_string: "",
    empty_array: [],
    empty_object: {},
    null_value: null,
    undefined_value: undefined
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      empty_string: "",
      empty_array: [],
      empty_object: {},
      null_value: null,
      undefined_becomes_null: null
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Numeric keys and values", async () => {
  const data = {
    "123": "numeric key",
    numbers: [42, 3.14, -17, 0],
    scientific: 1.23e-4,
    large: 9007199254740991 // Number.MAX_SAFE_INTEGER
  };

  const template = `{
    "numericKey": "{123}",
    "integers": "{numbers[0]}",
    "float": "{numbers[1]}",
    "negative": "{numbers[2]}",
    "zero": "{numbers[3]}",
    "scientific": "{scientific}",
    "large": "{large}"
  }`;

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      numericKey: "numeric key",
      integers: 42,
      float: 3.14,
      negative: -17,
      zero: 0,
      scientific: 1.23e-4,
      large: 9007199254740991
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Boolean corner cases", async () => {
  const data = {
    truthy: [true, 1, "true", "yes", {}],
    falsy: [false, 0, "", null],
    explicit: { true: true, false: false }
  };

  const template = `{
    "true_bool": "{explicit.true}",
    "false_bool": "{explicit.false}",
    "truthy_object": "{truthy[4]}",
    "zero": "{falsy[1]}"
  }`;

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      true_bool: true,
      false_bool: false,
      truthy_object: {},
      zero: 0
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Mixed array types", async () => {
  const data = {
    mixed: [
      "string",
      42,
      true,
      null,
      { nested: "object" },
      ["nested", "array"],
      undefined
    ]
  };

  const template = `{
    "string": "{mixed[0]}",
    "number": "{mixed[1]}",
    "boolean": "{mixed[2]}",
    "null": "{mixed[3]}",
    "object": "{mixed[4]}",
    "array": "{mixed[5]}",
    "undefined": "{mixed[6]}"
  }`;

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      string: "string",
      number: 42,
      boolean: true,
      null: null,
      object: { nested: "object" },
      array: ["nested", "array"],
      undefined: null
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Variable names that look like other constructs", () => {
  const data = {
    "if": "conditional",
    "for": "loop",
    "function": "method",
    "123abc": "starts with number",
    "$special": "starts with dollar",
    "_underscore": "starts with underscore"
  };

  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("if"), "conditional");
  assertEquals(resolver.resolve("for"), "loop");
  assertEquals(resolver.resolve("function"), "method");
  assertEquals(resolver.resolve("123abc"), "starts with number");
  assertEquals(resolver.resolve("$special"), "starts with dollar");
  assertEquals(resolver.resolve("_underscore"), "starts with underscore");
});

Deno.test("Edge Case - Malformed variable references", async () => {
  const template = '{"incomplete": "{missing_brace", "valid": "{test}"}';
  const data = { test: "value" };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    // Should process successfully, as only valid variables are replaced
    assertEquals(result, {
      incomplete: "{missing_brace",  // Not a valid variable pattern, so left as-is
      valid: "value"
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Circular reference detection in data", async () => {
  const circular: { name: string; self?: unknown } = { name: "test" };
  circular.self = circular;

  const data = { circular };
  const template = '{"name": "{circular.name}"}';

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, { name: "test" });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Very large template file", async () => {
  // Create a template with many variables
  const templateParts: string[] = ["{"];
  for (let i = 0; i < 1000; i++) {
    templateParts.push(`"field${i}": "{data[${i}].value}"`);
    if (i < 999) templateParts.push(",");
  }
  templateParts.push("}");

  const template = templateParts.join("");
  const data = {
    data: Array(1000).fill(null).map((_, i) => ({ value: `value${i}` }))
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile) as Record<string, unknown>;

    // Verify a few random fields
    assertEquals(result.field0, "value0");
    assertEquals(result.field500, "value500");
    assertEquals(result.field999, "value999");
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Edge Case - Path parsing edge cases", () => {
  const data = {
    "simpleKey": "simple value",
    "array": [{ "bracket_key": "bracket in key" }],
    "": "empty key"
  };

  const resolver = new VariableResolver(data);

  // These should work
  assertEquals(resolver.resolve("simpleKey"), "simple value");
  assertEquals(resolver.resolve("array[0].bracket_key"), "bracket in key");
  assertEquals(resolver.resolve(""), "empty key");
});

Deno.test("Edge Case - Extreme nesting with mixed access patterns", () => {
  const data = {
    level1: [
      {
        level2: {
          level3: [
            {
              level4: {
                items: [{ final: "deeply nested value" }]
              }
            }
          ]
        }
      }
    ]
  };

  const resolver = new VariableResolver(data);
  assertEquals(
    resolver.resolve("level1[0].level2.level3[0].level4.items[0].final"),
    "deeply nested value"
  );
});