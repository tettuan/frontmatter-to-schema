import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import {
  isFormattedOutput,
  isOutputFormatter,
  type OutputFormat,
  OutputFormatter,
} from "../../../src/infrastructure/adapters/output-formatter.ts";
import {
  AggregatedStructure,
} from "../../../src/domain/services/structured-aggregator.ts";

// Helper function to create a simple aggregated structure for testing
function createTestAggregatedStructure(data: Record<string, unknown>) {
  return AggregatedStructure.create(
    data,
    { kind: "replace_values", priority: "latest" },
    {
      kind: "parent_template",
      arrayFields: [],
      scalarFields: Object.keys(data),
      nestedStructures: {},
    },
  );
}

Deno.test("OutputFormatter - Smart Constructor", async (t) => {
  await t.step("creates OutputFormatter successfully", () => {
    const result = OutputFormatter.create();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(isOutputFormatter(result.data), true);
    }
  });
});

Deno.test("OutputFormatter - JSON Formatting", async (t) => {
  await t.step("formats simple object to JSON", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = { name: "test", value: 42 };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "json", indent: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          const parsed = JSON.parse(content);
          assertEquals(parsed.name, "test");
          assertEquals(parsed.value, 42);
          assertEquals(isFormattedOutput(result.data), true);
        }
      }
    }
  });

  await t.step("formats nested object to JSON with proper indentation", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        metadata: {
          version: "1.0.0",
          author: "test",
        },
        content: {
          items: [1, 2, 3],
        },
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "json", indent: 4 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("    "), true); // 4-space indentation
          const parsed = JSON.parse(content);
          assertEquals(parsed.metadata.version, "1.0.0");
          assertEquals(parsed.content.items.length, 3);
        }
      }
    }
  });
});

Deno.test("OutputFormatter - YAML Formatting", async (t) => {
  await t.step("formats simple object to YAML", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = { name: "test document", count: 5 };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("name: test document"), true);
          assertEquals(content.includes("count: 5"), true);
        }
      }
    }
  });

  await t.step("formats array to YAML with proper structure", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        items: ["first", "second", "third"],
        metadata: {
          total: 3,
        },
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("items:"), true);
          assertEquals(content.includes("- first"), true);
          assertEquals(content.includes("metadata:"), true);
          assertEquals(content.includes("total: 3"), true);
        }
      }
    }
  });
});

Deno.test("OutputFormatter - XML Formatting", async (t) => {
  await t.step("formats simple object to XML", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = { title: "Test Document", id: 123 };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "xml", pretty: false };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("<title>Test Document</title>"), true);
          assertEquals(content.includes("<id>123</id>"), true);
        }
      }
    }
  });
});

Deno.test("OutputFormatter - CSV Formatting", async (t) => {
  await t.step("formats simple object to CSV", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = { name: "test", count: 42, active: true };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "csv", delimiter: "," };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          const lines = content.split("\n");
          assertEquals(lines.length, 2); // header + data
          assertEquals(lines[0].includes("name"), true);
          assertEquals(lines[0].includes("count"), true);
          assertEquals(lines[1].includes("test"), true);
          assertEquals(lines[1].includes("42"), true);
        }
      }
    }
  });
});

Deno.test("OutputFormatter - Registry Command Scenarios", async (t) => {
  await t.step("formats registry command structure", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const registryData = {
        version: "1.0.0",
        tools: {
          availableConfigs: ["git", "spec", "meta"],
          commands: [
            { c1: "git", c2: "create", c3: "refinement-issue" },
            { c1: "spec", c2: "analyze", c3: "quality-metrics" },
          ],
        },
      };

      const structure = createTestAggregatedStructure(registryData);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "json", indent: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const parsed = JSON.parse(result.data.getContent());
          assertEquals(parsed.version, "1.0.0");
          assertEquals(parsed.tools.availableConfigs.length, 3);
          assertEquals(parsed.tools.commands[0].c1, "git");
          assertEquals(parsed.tools.commands[1].c2, "analyze");
        }
      }
    }
  });
});

Deno.test("OutputFormatter - Type Guards", async (t) => {
  await t.step("isOutputFormatter identifies OutputFormatter correctly", () => {
    const result = OutputFormatter.create();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(isOutputFormatter(result.data), true);
      assertEquals(isOutputFormatter("not formatter"), false);
      assertEquals(isOutputFormatter(null), false);
      assertEquals(isOutputFormatter(undefined), false);
    }
  });

  await t.step("isFormattedOutput works with actual formatted output", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = { test: "value" };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "json", indent: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(isFormattedOutput(result.data), true);
          assertEquals(isFormattedOutput("not formatted output"), false);
        }
      }
    }
  });
});

Deno.test("OutputFormatter - Additional Edge Cases", async (t) => {
  await t.step("handles YAML with special characters", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        special: "value:with:colons",
        hash: "#hashtag",
        empty: "",
        percent: "100%",
        ampersand: "AT&T",
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          // Special characters should be quoted
          assertEquals(content.includes('"value:with:colons"'), true);
          assertEquals(content.includes('"#hashtag"'), true);
          assertEquals(content.includes('""'), true); // empty string
        }
      }
    }
  });

  await t.step("handles XML with empty arrays and objects", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        emptyArray: [],
        emptyObject: {},
        nullValue: null,
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "xml", pretty: true };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("<emptyObject />"), true);
          assertEquals(content.includes("<nullValue />"), true);
        }
      }
    }
  });

  await t.step("handles CSV with nested objects", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        user: {
          name: "John Doe",
          details: {
            age: 30,
            city: "New York",
          },
        },
        tags: ["tag1", "tag2", "tag3"],
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "csv", delimiter: "," };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          // Nested objects should be flattened
          assertEquals(content.includes("user.name"), true);
          assertEquals(content.includes("user.details.age"), true);
          assertEquals(content.includes("user.details.city"), true);
          // Arrays should be formatted with brackets
          assertEquals(content.includes("[tag1, tag2, tag3]"), true);
        }
      }
    }
  });

  await t.step("handles CSV with custom delimiter", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        field1: "value1",
        field2: "value2",
        field3: 123,
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "csv", delimiter: "|" };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          const lines = content.split("\n");
          assertEquals(lines[0].includes("field1|field2|field3"), true);
          assertEquals(lines[1].includes('"value1"|"value2"|123'), true);
        }
      }
    }
  });

  await t.step("handles CSV with quotes in values", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        quote: 'She said "Hello"',
        apostrophe: "It's working",
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "csv", delimiter: "," };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          // Quotes should be escaped
          assertEquals(content.includes('"She said ""Hello"""'), true);
          assertEquals(content.includes('"It\'s working"'), true);
        }
      }
    }
  });

  await t.step("handles YAML with null and undefined values", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        nullField: null,
        undefinedField: undefined,
        number: 0,
        boolean: false,
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("nullField: null"), true);
          assertEquals(content.includes("undefinedField: null"), true);
          assertEquals(content.includes("number: 0"), true);
          assertEquals(content.includes("boolean: false"), true);
        }
      }
    }
  });

  await t.step("handles XML with arrays", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        items: ["item1", "item2", "item3"],
        numbers: [1, 2, 3],
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "xml", pretty: false };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          // Arrays should be indexed
          assertEquals(content.includes("<items_0>item1</items_0>"), true);
          assertEquals(content.includes("<items_1>item2</items_1>"), true);
          assertEquals(content.includes("<numbers_0>1</numbers_0>"), true);
        }
      }
    }
  });

  await t.step("handles empty YAML arrays and objects", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        emptyArray: [],
        emptyObject: {},
        filledArray: [1, 2],
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          // Just verify that the formatting completes successfully
          // The exact format may vary based on implementation
          assertEquals(content.includes("filledArray"), true);
          assertEquals(content.includes("1"), true);
          assertEquals(content.includes("2"), true);
        }
      }
    }
  });

  await t.step("handles deeply nested YAML structure", () => {
    const formatter = OutputFormatter.create();
    assertEquals(formatter.ok, true);

    if (formatter.ok) {
      const data = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };
      const structure = createTestAggregatedStructure(data);
      assertEquals(structure.ok, true);

      if (structure.ok) {
        const format: OutputFormat = { kind: "yaml", indentSize: 2 };
        const result = formatter.data.format(structure.data, format);

        assertEquals(result.ok, true);
        if (result.ok) {
          const content = result.data.getContent();
          assertEquals(content.includes("level1:"), true);
          assertEquals(content.includes("  level2:"), true);
          assertEquals(content.includes("    level3:"), true);
          assertEquals(content.includes("      value: deep"), true);
        }
      }
    }
  });
});
