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
