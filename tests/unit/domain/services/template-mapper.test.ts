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
});
