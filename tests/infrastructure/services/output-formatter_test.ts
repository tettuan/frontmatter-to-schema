import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import {
  JsonOutputFormatter,
  MultiFormatOutputService,
  OutputFormatterFactory,
  YamlOutputFormatter,
} from "../../../src/infrastructure/services/output-formatter.ts";
import type { OutputFormat } from "../../../src/infrastructure/services/output-formatter.ts";

Deno.test("JsonOutputFormatter - Basic Functionality", async (t) => {
  await t.step("creates JsonOutputFormatter with default indent", () => {
    const formatter = new JsonOutputFormatter();
    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "JSON");
  });

  await t.step("creates JsonOutputFormatter with custom indent", () => {
    const formatter = new JsonOutputFormatter(4);
    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "JSON");
  });

  await t.step("formats simple object to JSON", () => {
    const formatter = new JsonOutputFormatter(2);
    const data = { name: "test", value: 42 };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.name, "test");
      assertEquals(parsed.value, 42);
      assertEquals(result.data.includes("  "), true); // 2-space indentation
    }
  });

  await t.step("formats complex nested object", () => {
    const formatter = new JsonOutputFormatter(4);
    const data = {
      metadata: {
        version: "1.0.0",
        tags: ["test", "json"],
      },
      items: [
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ],
    };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("    "), true); // 4-space indentation
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.metadata.version, "1.0.0");
      assertEquals(parsed.items.length, 2);
      assertEquals(parsed.items[0].name, "first");
    }
  });

  await t.step("handles null and undefined values", () => {
    const formatter = new JsonOutputFormatter();
    const data = {
      nullValue: null,
      undefinedValue: undefined,
      zeroValue: 0,
      emptyString: "",
    };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.nullValue, null);
      assertEquals("undefinedValue" in parsed, false); // JSON removes undefined
      assertEquals(parsed.zeroValue, 0);
      assertEquals(parsed.emptyString, "");
    }
  });

  await t.step("handles circular reference error", () => {
    const formatter = new JsonOutputFormatter();
    const data: Record<string, unknown> = { name: "test" };
    data.self = data; // Create circular reference

    const result = formatter.format(data);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ProcessingStageError");
    }
  });
});

Deno.test("YamlOutputFormatter - Basic Functionality", async (t) => {
  await t.step("creates YamlOutputFormatter with default indent", () => {
    const formatter = new YamlOutputFormatter();
    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "YAML");
  });

  await t.step("creates YamlOutputFormatter with custom indent", () => {
    const formatter = new YamlOutputFormatter(4);
    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "YAML");
  });

  await t.step("formats simple object to YAML", () => {
    const formatter = new YamlOutputFormatter(2);
    const data = { name: "test document", count: 5, active: true };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("name: test document"), true);
      assertEquals(result.data.includes("count: 5"), true);
      assertEquals(result.data.includes("active: true"), true);
    }
  });

  await t.step("formats array to YAML", () => {
    const formatter = new YamlOutputFormatter();
    const data = ["first", "second", "third"];

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("results:"), true);
      assertEquals(result.data.includes("first"), true);
      assertEquals(result.data.includes("second"), true);
      assertEquals(result.data.includes("third"), true);
    }
  });

  await t.step("formats nested object with proper indentation", () => {
    const formatter = new YamlOutputFormatter(2);
    const data = {
      project: {
        name: "test-project",
        version: "1.0.0",
        dependencies: ["dep1", "dep2"],
      },
    };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("project:"), true);
      assertEquals(result.data.includes("  name: test-project"), true);
      assertEquals(result.data.includes("  version: 1.0.0"), true);
      assertEquals(result.data.includes("  dependencies:"), true);
    }
  });

  await t.step("handles strings with special characters", () => {
    const formatter = new YamlOutputFormatter();
    const data = {
      description: "Text with: colon and newline\nand quotes'test'",
      path: "/path/with spaces",
      url: "https://example.com",
    };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes('"'), true); // Should quote special strings
      assertEquals(result.data.includes("https://example.com"), true);
    }
  });

  await t.step("formats primitive values", () => {
    const formatter = new YamlOutputFormatter();

    const stringResult = formatter.format("simple string");
    assertEquals(stringResult.ok, true);
    if (stringResult.ok) {
      assertEquals(stringResult.data, "simple string");
    }

    const numberResult = formatter.format(42);
    assertEquals(numberResult.ok, true);
    if (numberResult.ok) {
      assertEquals(numberResult.data, "42");
    }
  });

  await t.step("handles BigInt values by converting to string", () => {
    const formatter = new YamlOutputFormatter();

    // Create an object with BigInt (should be handled gracefully)
    const problematicData = {
      bigint: BigInt(123), // BigInt should be converted to string
    };

    const result = formatter.format(problematicData);

    // YAML formatter should handle this by converting to string
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("123"), true);
    }
  });
});

Deno.test("OutputFormatterFactory - Format Creation", async (t) => {
  await t.step("creates JSON formatter", () => {
    const format: OutputFormat = { kind: "JSON", indent: 2 };
    const formatter = OutputFormatterFactory.createFormatter(format);

    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "JSON");
  });

  await t.step("creates YAML formatter", () => {
    const format: OutputFormat = { kind: "YAML", indentSize: 4 };
    const formatter = OutputFormatterFactory.createFormatter(format);

    assertExists(formatter);
    assertEquals(formatter.getFormatKind(), "YAML");
  });

  await t.step("creates format from string - JSON", () => {
    const result = OutputFormatterFactory.fromString("json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.kind, "JSON");
      if (result.data.kind === "JSON") {
        assertEquals(result.data.indent || 2, 2);
      }
    }
  });

  await t.step("creates format from string - YAML", () => {
    const yamlResult = OutputFormatterFactory.fromString("yaml");
    assertEquals(yamlResult.ok, true);
    if (yamlResult.ok) {
      assertEquals(yamlResult.data.kind, "YAML");
      if (yamlResult.data.kind === "YAML") {
        assertEquals(yamlResult.data.indentSize || 2, 2);
      }
    }

    const ymlResult = OutputFormatterFactory.fromString("yml");
    assertEquals(ymlResult.ok, true);
    if (ymlResult.ok) {
      assertEquals(ymlResult.data.kind, "YAML");
      if (ymlResult.data.kind === "YAML") {
        assertEquals(ymlResult.data.indentSize || 2, 2);
      }
    }
  });

  await t.step("handles case insensitive format strings", () => {
    const upperResult = OutputFormatterFactory.fromString("JSON");
    assertEquals(upperResult.ok, true);

    const mixedResult = OutputFormatterFactory.fromString("Yaml");
    assertEquals(mixedResult.ok, true);
  });

  await t.step("fails with unsupported format string", () => {
    const result = OutputFormatterFactory.fromString("xml");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("fails with empty format string", () => {
    const result = OutputFormatterFactory.fromString("");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });
});

Deno.test("MultiFormatOutputService - High-level Formatting", async (t) => {
  const service = new MultiFormatOutputService();

  await t.step("formats data with OutputFormat object", () => {
    const data = { title: "Test Document", version: "1.0" };
    const format: OutputFormat = { kind: "JSON", indent: 2 };

    const result = service.format(data, format);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.title, "Test Document");
      assertEquals(parsed.version, "1.0");
    }
  });

  await t.step("formats data with format string", () => {
    const data = { registry: "climpt", commands: 42 };

    const result = service.formatWithString(data, "yaml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("registry: climpt"), true);
      assertEquals(result.data.includes("commands: 42"), true);
    }
  });

  await t.step("propagates format string errors", () => {
    const data = { test: true };

    const result = service.formatWithString(data, "unsupported");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("propagates formatting errors", () => {
    const data: Record<string, unknown> = { test: true };
    data.circular = data; // Create circular reference

    const result = service.formatWithString(data, "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ProcessingStageError");
    }
  });
});

Deno.test("Output Formatters - Registry Command Scenarios", async (t) => {
  await t.step("formats climpt registry structure as JSON", () => {
    const formatter = new JsonOutputFormatter(2);
    const registryData = {
      version: "1.0.0",
      description: "Climpt Command Registry",
      tools: {
        availableConfigs: ["git", "spec", "meta", "build"],
        commands: [
          {
            c1: "git",
            c2: "create",
            c3: "refinement-issue",
            description: "Create refinement issue from requirements",
            options: ["default"],
          },
          {
            c1: "spec",
            c2: "analyze",
            c3: "quality-metrics",
            description: "Analyze specification quality metrics",
            options: ["default"],
          },
        ],
      },
    };

    const result = formatter.format(registryData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.version, "1.0.0");
      assertEquals(parsed.tools.availableConfigs.length, 4);
      assertEquals(parsed.tools.commands[0].c1, "git");
      assertEquals(parsed.tools.commands[0].c2, "create");
      assertEquals(parsed.tools.commands[0].c3, "refinement-issue");
      assertEquals(parsed.tools.commands[1].c1, "spec");
    }
  });

  await t.step("formats climpt registry structure as YAML", () => {
    const formatter = new YamlOutputFormatter(2);
    const registryData = {
      version: "1.0.0",
      tools: {
        commands: [
          { c1: "build", c2: "robust", c3: "test" },
          { c1: "meta", c2: "resolve", c3: "registered-commands" },
        ],
      },
    };

    const result = formatter.format(registryData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.includes("version: 1.0.0"), true);
      assertEquals(result.data.includes("tools:"), true);
      assertEquals(result.data.includes("commands:"), true);
      assertEquals(result.data.includes("c1: build"), true);
      assertEquals(result.data.includes("c2: robust"), true);
      assertEquals(result.data.includes("c3: test"), true);
    }
  });

  await t.step("formats C3L command structure", () => {
    const service = new MultiFormatOutputService();
    const c3lCommand = {
      command: "climpt-build robust test default",
      directive: "robust",
      layer: "test",
      adaptation: "default",
      description: "Build robust tests from specification",
      input_text_file: true,
      input_text: true,
      destination: false,
      usage: "climpt-build robust test default -f spec.md",
      examples: [
        "climpt-build robust test default <<<'Create tests for output formatter'",
        "climpt-build robust test strict -f requirements.md",
      ],
    };

    const jsonResult = service.formatWithString(c3lCommand, "json");
    assertEquals(jsonResult.ok, true);
    if (jsonResult.ok) {
      const parsed = JSON.parse(jsonResult.data);
      assertEquals(parsed.directive, "robust");
      assertEquals(parsed.layer, "test");
      assertEquals(parsed.adaptation, "default");
    }

    const yamlResult = service.formatWithString(c3lCommand, "yaml");
    assertEquals(yamlResult.ok, true);
    if (yamlResult.ok) {
      assertEquals(
        yamlResult.data.includes("command: climpt-build robust test default"),
        true,
      );
      assertEquals(yamlResult.data.includes("directive: robust"), true);
    }
  });
});

Deno.test("Output Formatters - Edge Cases and Error Handling", async (t) => {
  await t.step("handles empty objects and arrays", () => {
    const jsonFormatter = new JsonOutputFormatter();
    const yamlFormatter = new YamlOutputFormatter();

    const emptyObject = {};
    const emptyArray: unknown[] = [];

    const jsonObjectResult = jsonFormatter.format(emptyObject);
    assertEquals(jsonObjectResult.ok, true);
    if (jsonObjectResult.ok) {
      assertEquals(jsonObjectResult.data, "{}");
    }

    const jsonArrayResult = jsonFormatter.format(emptyArray);
    assertEquals(jsonArrayResult.ok, true);
    if (jsonArrayResult.ok) {
      assertEquals(jsonArrayResult.data, "[]");
    }

    const yamlObjectResult = yamlFormatter.format(emptyObject);
    assertEquals(yamlObjectResult.ok, true);

    const yamlArrayResult = yamlFormatter.format(emptyArray);
    assertEquals(yamlArrayResult.ok, true);
  });

  await t.step("handles very deep nesting", () => {
    const formatter = new JsonOutputFormatter(2);

    // Create deeply nested object
    let deepObject: Record<string, unknown> = { value: "deep" };
    for (let i = 0; i < 50; i++) {
      deepObject = { level: i, nested: deepObject };
    }

    const result = formatter.format(deepObject);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(result.data.includes('"value": "deep"'), true);
    }
  });

  await t.step("handles large arrays efficiently", () => {
    const formatter = new JsonOutputFormatter();

    const largeArray = Array(1000).fill(0).map((_, i) => ({
      id: i,
      name: `item-${i}`,
      active: i % 2 === 0,
    }));

    const result = formatter.format(largeArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.length, 1000);
      assertEquals(parsed[0].id, 0);
      assertEquals(parsed[999].id, 999);
    }
  });

  await t.step("maintains precision for numbers", () => {
    const formatter = new JsonOutputFormatter();

    const data = {
      integer: 42,
      float: 3.14159,
      scientific: 1.23e10,
      verySmall: 0.000001,
      zero: 0,
      negative: -123.45,
    };

    const result = formatter.format(data);

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      assertEquals(parsed.integer, 42);
      assertEquals(parsed.float, 3.14159);
      assertEquals(parsed.scientific, 1.23e10);
      assertEquals(parsed.verySmall, 0.000001);
      assertEquals(parsed.zero, 0);
      assertEquals(parsed.negative, -123.45);
    }
  });
});
