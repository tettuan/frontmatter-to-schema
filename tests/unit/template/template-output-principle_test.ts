import { assertEquals } from "@std/assert";
import { TemplateRenderer } from "../../../src/template-renderer.ts";

Deno.test("Template Output Principle", async (t) => {
  const renderer = TemplateRenderer.create();
  if (!renderer.ok) throw new Error("Failed to create renderer");

  await t.step(
    "should output EXACTLY what is in the template - string only",
    async () => {
      // Create a temporary template file with just a variable
      const tempFile = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(tempFile, '"{id.full}"');

      const result = await renderer.data.render(
        { path: tempFile, format: "json" },
        {
          kind: "aggregated",
          aggregatedData: {
            id: {
              full: "req:api:test",
              level: "api",
              scope: "requirement",
            },
            summary: "Test requirement",
          },
        },
      );

      // Should output ONLY the string value, not an object
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, "req:api:test"); // Just the string value from id.full
      }

      await Deno.remove(tempFile);
    },
  );

  await t.step(
    "should output full structure when template defines it",
    async () => {
      // Create a template with full structure
      const tempFile = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        tempFile,
        JSON.stringify({
          id: {
            full: "{id.full}",
            level: "{id.level}",
          },
          summary: "{summary}",
        }),
      );

      const result = await renderer.data.render(
        { path: tempFile, format: "json" },
        {
          kind: "aggregated",
          aggregatedData: {
            id: {
              full: "req:api:test",
              level: "api",
              scope: "requirement",
            },
            summary: "Test requirement",
          },
        },
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, {
          id: {
            full: "req:api:test",
            level: "api",
          },
          summary: "Test requirement",
        });
        // Note: scope is NOT in output because template didn't include it
        assertEquals(parsed.id.scope, undefined);
      }

      await Deno.remove(tempFile);
    },
  );

  await t.step("should NOT infer structure from schema", async () => {
    // Template with minimal structure
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile, '{"name": "{name}"}');

    // Even with schema-aware data that has more fields
    const result = await renderer.data.render(
      { path: tempFile, format: "json" },
      {
        kind: "schema-aware",
        aggregatedData: {
          name: "Test Item",
          description: "Full description",
          status: "active",
          metadata: {
            created: "2024-01-01",
            updated: "2024-01-15",
          },
        },
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            metadata: {
              type: "object",
              properties: {
                created: { type: "string" },
                updated: { type: "string" },
              },
            },
          },
        },
      },
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.data);
      // Should ONLY have what template defined
      assertEquals(parsed, { name: "Test Item" });
      // Other fields should NOT appear
      assertEquals(parsed.description, undefined);
      assertEquals(parsed.status, undefined);
      assertEquals(parsed.metadata, undefined);
    }

    await Deno.remove(tempFile);
  });

  await t.step(
    "array templates should apply to each item independently",
    async () => {
      // Template that will be applied to each array item
      const itemTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(itemTemplate, '"{id}"'); // Just the id string

      // Main template referencing array
      const mainTemplate = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        mainTemplate,
        JSON.stringify({
          items: "{items}", // Will be replaced with processed array
        }),
      );

      const result = await renderer.data.render(
        { path: mainTemplate, format: "json" },
        {
          kind: "aggregated",
          aggregatedData: {
            items: [
              { id: "item1", name: "First" },
              { id: "item2", name: "Second" },
            ],
          },
        },
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        // Arrays are stringified when replaced as template variable
        assertEquals(parsed, {
          items:
            '[{"id":"item1","name":"First"},{"id":"item2","name":"Second"}]',
        });
      }

      await Deno.remove(itemTemplate);
      await Deno.remove(mainTemplate);
    },
  );

  await t.step(
    "template should not add fields not explicitly defined",
    async () => {
      // Template with specific fields only
      const tempFile = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(
        tempFile,
        JSON.stringify({
          selectedFields: {
            a: "{data.a}",
            c: "{data.c}",
          },
        }),
      );

      const result = await renderer.data.render(
        { path: tempFile, format: "json" },
        {
          kind: "aggregated",
          aggregatedData: {
            data: {
              a: "value_a",
              b: "value_b", // This won't appear in output
              c: "value_c",
              d: "value_d", // This won't appear in output
            },
          },
        },
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, {
          selectedFields: {
            a: "value_a",
            c: "value_c",
            // b and d are NOT included
          },
        });
        assertEquals(parsed.selectedFields.b, undefined);
        assertEquals(parsed.selectedFields.d, undefined);
      }

      await Deno.remove(tempFile);
    },
  );
});
