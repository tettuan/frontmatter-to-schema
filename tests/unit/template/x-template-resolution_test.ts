import { assertEquals } from "@std/assert";
import { TemplateRenderer } from "../../../src/template-renderer.ts";
import { getTemplatePath } from "../../../src/domain/models/schema-extensions.ts";

Deno.test("x-template Resolution from Schema", async (t) => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  await t.step(
    "should apply x-template from schema for array items",
    async () => {
      // Create item template that extracts just the ID
      const itemTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(itemTemplate, '"{id.full}"');

      // Create main template
      const mainTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        mainTemplate,
        JSON.stringify({
          version: "{version}",
          items: "{items}",
        }),
      );

      // Test data with schema containing x-template
      const data = {
        kind: "schema-aware" as const,
        aggregatedData: {
          version: "1.0.0",
          items: [
            {
              id: { full: "req:api:test-1", level: "api" },
              summary: "First item",
            },
            {
              id: { full: "req:api:test-2", level: "api" },
              summary: "Second item",
            },
          ],
        },
        schema: {
          type: "object",
          properties: {
            version: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                "x-template": itemTemplate, // This should be used for each array item
                properties: {
                  id: {
                    type: "object",
                    properties: {
                      full: { type: "string" },
                      level: { type: "string" },
                    },
                  },
                  summary: { type: "string" },
                },
              },
            },
          },
        },
      };

      const result = await renderer.data.render(
        { path: mainTemplate, format: "json" },
        data,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        // EXPECTED: items should be an array of ID strings (processed by x-template)
        // Currently FAILS: items is stringified full objects
        assertEquals(parsed.version, "1.0.0");
        assertEquals(parsed.items, [
          "req:api:test-1",
          "req:api:test-2",
        ]);
      }

      await Deno.remove(itemTemplate);
      await Deno.remove(mainTemplate);
    },
  );

  await t.step(
    "should use getTemplatePath to extract x-template from schema",
    () => {
      const schema = {
        type: "object",
        "x-template": "custom-template.json",
        properties: {},
      };

      const result = getTemplatePath(schema);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "custom-template.json");
      }
    },
  );

  await t.step(
    "should handle nested x-template in array items",
    async () => {
      // Create nested item template
      const nestedTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        nestedTemplate,
        JSON.stringify({
          type: "{type}",
          value: "{value}",
        }),
      );

      // Main template
      const mainTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        mainTemplate,
        JSON.stringify({
          data: "{data}",
        }),
      );

      const data = {
        kind: "schema-aware" as const,
        aggregatedData: {
          data: [
            { type: "number", value: "42", extra: "ignored" },
            { type: "string", value: "hello", extra: "also ignored" },
          ],
        },
        schema: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: {
                type: "object",
                "x-template": nestedTemplate,
                properties: {
                  type: { type: "string" },
                  value: { type: "string" },
                  extra: { type: "string" },
                },
              },
            },
          },
        },
      };

      const result = await renderer.data.render(
        { path: mainTemplate, format: "json" },
        data,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        // x-template should limit output to only type and value fields
        assertEquals(parsed.data, [
          { type: "number", value: "42" },
          { type: "string", value: "hello" },
        ]);
      }

      await Deno.remove(nestedTemplate);
      await Deno.remove(mainTemplate);
    },
  );
});
