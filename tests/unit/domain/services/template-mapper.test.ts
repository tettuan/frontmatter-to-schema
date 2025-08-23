import { assertEquals } from "jsr:@std/assert";
import { TemplateMapper } from "../../../../src/domain/services/template-mapper.ts";
import {
  Template,
  TemplateDefinition,
} from "../../../../src/domain/models/template.ts";
import { isOk } from "../../../../src/domain/shared/result.ts";

Deno.test("TemplateMapper", async (t) => {
  const mapper = new TemplateMapper();

  await t.step("should map data to JSON template", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        name: "{{name}}",
        age: "{{age}}",
        active: true,
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          name: "John",
          age: 30,
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.name, "John");
          assertEquals(parsed.age, 30);
          assertEquals(parsed.active, true);
        }
      }
    }
  });

  await t.step("should map data to YAML format", () => {
    const templateDefResult = TemplateDefinition.create(
      "dummy template",
      "yaml",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          title: "Test",
          items: ["one", "two", "three"],
          metadata: {
            author: "John",
            published: true,
          },
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          assertEquals(result.data.includes("title: Test"), true);
          assertEquals(result.data.includes("- one"), true);
          assertEquals(result.data.includes("author: John"), true);
        }
      }
    }
  });

  await t.step("should handle nested template placeholders", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        user: {
          name: "{{user.name}}",
          email: "{{user.email}}",
        },
        settings: {
          theme: "{{settings.theme}}",
        },
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          user: {
            name: "Alice",
            email: "alice@example.com",
          },
          settings: {
            theme: "dark",
          },
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.user.name, "Alice");
          assertEquals(parsed.user.email, "alice@example.com");
          assertEquals(parsed.settings.theme, "dark");
        }
      }
    }
  });

  await t.step("should handle missing placeholders gracefully", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        name: "{{name}}",
        missing: "{{nonexistent}}",
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          name: "John",
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.name, "John");
          assertEquals(parsed.missing, undefined);
        }
      }
    }
  });

  await t.step("should handle YAML conversion with special characters", () => {
    const templateDefResult = TemplateDefinition.create(
      "dummy template",
      "yaml",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          text: "value:with:colons",
          hash: "value#with#hash",
          quote: 'value"with"quotes',
          nested: {
            array: [1, 2, 3],
            object: { key: "value" },
          },
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          // Check for proper escaping
          assertEquals(result.data.includes('"value:with:colons"'), true);
          assertEquals(result.data.includes('"value#with#hash"'), true);
          assertEquals(result.data.includes('"value\\"with\\"quotes"'), true);
        }
      }
    }
  });

  await t.step("should handle custom format", () => {
    const templateDefResult = TemplateDefinition.create(
      "custom template",
      "custom",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = { test: "data" };
        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.test, "data");
        }
      }
    }
  });

  await t.step("should handle handlebars format (not implemented)", () => {
    const templateDefResult = TemplateDefinition.create(
      "{{#each items}}{{name}}{{/each}}",
      "handlebars",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = { items: [{ name: "item1" }] };
        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), false);
        if (!isOk(result)) {
          assertEquals(result.error.message, "Handlebars support not yet implemented");
        }
      }
    }
  });

  await t.step("should handle invalid JSON template", () => {
    const templateDefResult = TemplateDefinition.create(
      "{ invalid json }",
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = { test: "data" };
        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), false);
        if (!isOk(result)) {
          assertEquals(result.error.kind, "ValidationError");
        }
      }
    }
  });

  await t.step("should handle arrays in templates", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify([
        "{{item1}}",
        "static",
        "{{item2}}",
      ]),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          item1: "first",
          item2: "second",
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(Array.isArray(parsed), true);
          assertEquals(parsed[0], "first");
          assertEquals(parsed[1], "static");
          assertEquals(parsed[2], "second");
        }
      }
    }
  });

  await t.step("should handle complex nested paths", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        deep: "{{a.b.c.d.e}}",
        partial: "{{a.b}}",
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          a: {
            b: {
              c: {
                d: {
                  e: "deep value",
                },
              },
              other: "partial value",
            },
          },
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.deep, "deep value");
          assertEquals(typeof parsed.partial, "object");
        }
      }
    }
  });

  await t.step("should handle null and undefined in YAML", () => {
    const templateDefResult = TemplateDefinition.create(
      "dummy",
      "yaml",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          nullValue: null,
          undefinedValue: undefined,
          emptyArray: [],
          emptyObject: {},
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          assertEquals(result.data.includes("nullValue: null"), true);
          assertEquals(result.data.includes("undefinedValue: null"), true);
          assertEquals(result.data.includes("emptyArray"), true);
          assertEquals(result.data.includes("[]"), true);
          assertEquals(result.data.includes("emptyObject"), true);
          assertEquals(result.data.includes("{}"), true);
        }
      }
    }
  });

  await t.step("should handle primitive types in templates", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        string: "static string",
        number: 42,
        boolean: true,
        nullValue: null,
        placeholder: "{{value}}",
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = { value: "dynamic" };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.string, "static string");
          assertEquals(parsed.number, 42);
          assertEquals(parsed.boolean, true);
          assertEquals(parsed.nullValue, data);  // null in template means use the data
          assertEquals(parsed.placeholder, "dynamic");
        }
      }
    }
  });

  await t.step("should handle unsupported format", () => {
    const templateDefResult = TemplateDefinition.create(
      "template",
      "unknown" as any,
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = { test: "data" };
        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), false);
        if (!isOk(result)) {
          assertEquals(result.error.kind, "ValidationError");
        }
      }
    }
  });

  await t.step("should handle non-object current value in path traversal", () => {
    const templateDefResult = TemplateDefinition.create(
      JSON.stringify({
        value: "{{simple.nested.path}}",
      }),
      "json",
    );

    if (isOk(templateDefResult)) {
      const templateResult = Template.create("test", templateDefResult.data);
      if (isOk(templateResult)) {
        const data = {
          simple: "not an object",
        };

        const result = mapper.map(data, templateResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.value, undefined);
        }
      }
    }
  });
});
