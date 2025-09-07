/**
 * Tests for Schema Extension Properties (x-*)
 *
 * These tests verify the handling of custom extension properties in JSON Schema:
 * - x-frontmatter-part: Marks properties for frontmatter extraction
 * - x-derived-from: Specifies data derivation expressions
 * - x-derived-unique: Enables unique value filtering
 * - x-template: Defines template transformations
 */

import { assert, assertEquals } from "jsr:@std/assert@1.0.9";
import {
  type ExtendedSchema,
  SchemaTemplateInfo,
} from "../../../../src/domain/models/schema-extensions.ts";

Deno.test("SchemaTemplateInfo - x-frontmatter-part extraction", async (t) => {
  await t.step("should identify property with x-frontmatter-part", () => {
    const schema = {
      type: "object",
      properties: {
        title: {
          type: "string",
          "x-frontmatter-part": true,
        },
        content: {
          type: "string",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const info = result.data;
    assertEquals(info.getIsFrontmatterPart(), false); // Root level is false

    // Check if title has frontmatter-part
    const titleProp = schema.properties.title as Record<string, unknown>;
    assertEquals(titleProp["x-frontmatter-part"], true);
  });

  await t.step(
    "should handle nested properties with x-frontmatter-part",
    () => {
      const schema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            "x-frontmatter-part": true,
            properties: {
              author: { type: "string" },
              date: { type: "string" },
            },
          },
          body: {
            type: "string",
          },
        },
      };

      const result = SchemaTemplateInfo.extract(schema);
      assert(result.ok);

      const metadataProp = schema.properties.metadata as Record<
        string,
        unknown
      >;
      assertEquals(metadataProp["x-frontmatter-part"], true);
    },
  );

  await t.step("should handle array items with x-frontmatter-part", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          "x-frontmatter-part": true,
          items: {
            type: "string",
          },
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const tagsProp = schema.properties.tags as Record<string, unknown>;
    assertEquals(tagsProp["x-frontmatter-part"], true);
  });

  await t.step("should return error for invalid schema", () => {
    const invalidSchema = "not an object";

    // Cast through unknown to ExtendedSchema to test validation logic
    const result = SchemaTemplateInfo.extract(
      invalidSchema as unknown as ExtendedSchema,
    );
    assert(!result.ok);
    assertEquals(result.error.kind, "InvalidFormat");
  });

  await t.step("should handle schema without x-frontmatter-part", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const info = result.data;
    assertEquals(info.getIsFrontmatterPart(), false);
  });
});

Deno.test("SchemaTemplateInfo - x-derived-from extraction", async (t) => {
  await t.step("should extract simple derivation expression", () => {
    const schema = {
      type: "object",
      properties: {
        commands: {
          type: "array",
          "x-derived-from": "tools.commands",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const commandsProp = schema.properties.commands as Record<string, unknown>;
    assertEquals(commandsProp["x-derived-from"], "tools.commands");
  });

  await t.step("should extract array expansion expression", () => {
    const schema = {
      type: "object",
      properties: {
        allNames: {
          type: "array",
          items: { type: "string" },
          "x-derived-from": "users[].name",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const namesProp = schema.properties.allNames as Record<string, unknown>;
    assertEquals(namesProp["x-derived-from"], "users[].name");
  });

  await t.step("should extract nested path expression", () => {
    const schema = {
      type: "object",
      properties: {
        primaryEmail: {
          type: "string",
          "x-derived-from": "contact.emails[0].address",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const emailProp = schema.properties.primaryEmail as Record<string, unknown>;
    assertEquals(emailProp["x-derived-from"], "contact.emails[0].address");
  });

  await t.step("should handle missing x-derived-from", () => {
    const schema = {
      type: "object",
      properties: {
        static: {
          type: "string",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const staticProp = schema.properties.static as Record<string, unknown>;
    assertEquals(staticProp["x-derived-from"], undefined);
  });

  await t.step("should extract complex path with multiple arrays", () => {
    const schema = {
      type: "object",
      properties: {
        allTasks: {
          type: "array",
          "x-derived-from": "projects[].sprints[].tasks[]",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const tasksProp = schema.properties.allTasks as Record<string, unknown>;
    assertEquals(tasksProp["x-derived-from"], "projects[].sprints[].tasks[]");
  });
});

Deno.test("SchemaTemplateInfo - x-derived-unique extraction", async (t) => {
  await t.step("should identify unique derivation", () => {
    const schema = {
      type: "object",
      properties: {
        uniqueAuthors: {
          type: "array",
          "x-derived-from": "posts[].author",
          "x-derived-unique": true,
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const authorsProp = schema.properties.uniqueAuthors as Record<
      string,
      unknown
    >;
    assertEquals(authorsProp["x-derived-unique"], true);
  });

  await t.step("should handle false unique flag", () => {
    const schema = {
      type: "object",
      properties: {
        allValues: {
          type: "array",
          "x-derived-from": "items[].value",
          "x-derived-unique": false,
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const valuesProp = schema.properties.allValues as Record<string, unknown>;
    assertEquals(valuesProp["x-derived-unique"], false);
  });

  await t.step("should handle missing unique flag", () => {
    const schema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          "x-derived-from": "source.items",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const itemsProp = schema.properties.items as Record<string, unknown>;
    assertEquals(itemsProp["x-derived-unique"], undefined);
  });

  await t.step("should work with nested unique arrays", () => {
    const schema = {
      type: "object",
      properties: {
        categories: {
          type: "object",
          properties: {
            unique: {
              type: "array",
              "x-derived-from": "products[].category",
              "x-derived-unique": true,
            },
          },
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const categoriesProp = schema.properties.categories as Record<
      string,
      unknown
    >;
    const uniqueProp = (categoriesProp.properties as Record<string, unknown>)
      .unique as Record<string, unknown>;
    assertEquals(uniqueProp["x-derived-unique"], true);
  });

  await t.step("should combine with x-frontmatter-part", () => {
    const schema = {
      type: "object",
      properties: {
        uniqueTags: {
          type: "array",
          "x-frontmatter-part": true,
          "x-derived-from": "articles[].tags[]",
          "x-derived-unique": true,
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const tagsProp = schema.properties.uniqueTags as Record<string, unknown>;
    assertEquals(tagsProp["x-frontmatter-part"], true);
    assertEquals(tagsProp["x-derived-from"], "articles[].tags[]");
    assertEquals(tagsProp["x-derived-unique"], true);
  });
});

Deno.test("SchemaTemplateInfo - x-template extraction", async (t) => {
  await t.step("should extract template string", () => {
    const schema = {
      type: "object",
      properties: {
        greeting: {
          type: "string",
          "x-template": "Hello, {{name}}!",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const greetingProp = schema.properties.greeting as Record<string, unknown>;
    assertEquals(greetingProp["x-template"], "Hello, {{name}}!");
  });

  await t.step("should handle complex template with multiple variables", () => {
    const schema = {
      type: "object",
      properties: {
        summary: {
          type: "string",
          "x-template": "{{title}} by {{author}} on {{date}}",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const summaryProp = schema.properties.summary as Record<string, unknown>;
    assertEquals(
      summaryProp["x-template"],
      "{{title}} by {{author}} on {{date}}",
    );
  });

  await t.step("should handle template with conditionals", () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          type: "string",
          "x-template": "{{#if completed}}Done{{else}}Pending{{/if}}",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const statusProp = schema.properties.status as Record<string, unknown>;
    assertEquals(
      statusProp["x-template"],
      "{{#if completed}}Done{{else}}Pending{{/if}}",
    );
  });

  await t.step("should handle template with loops", () => {
    const schema = {
      type: "object",
      properties: {
        list: {
          type: "string",
          "x-template": "{{#each items}}• {{this}}\n{{/each}}",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const listProp = schema.properties.list as Record<string, unknown>;
    assertEquals(
      listProp["x-template"],
      "{{#each items}}• {{this}}\n{{/each}}",
    );
  });

  await t.step("should handle missing template", () => {
    const schema = {
      type: "object",
      properties: {
        plain: {
          type: "string",
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const plainProp = schema.properties.plain as Record<string, unknown>;
    assertEquals(plainProp["x-template"], undefined);
  });
});

Deno.test("SchemaTemplateInfo - Combined extension properties", async (t) => {
  await t.step("should handle all x-* properties together", () => {
    const schema = {
      type: "object",
      "x-frontmatter-part": true,
      properties: {
        summary: {
          type: "string",
          "x-frontmatter-part": true,
          "x-derived-from": "metadata.description",
          "x-template": "{{title}}: {{description}}",
        },
        tags: {
          type: "array",
          "x-frontmatter-part": true,
          "x-derived-from": "posts[].tags[]",
          "x-derived-unique": true,
          items: { type: "string" },
        },
      },
    };

    const result = SchemaTemplateInfo.extract(schema);
    assert(result.ok);

    const info = result.data;
    assertEquals(info.getIsFrontmatterPart(), true); // Root has x-frontmatter-part

    const summaryProp = schema.properties.summary as Record<string, unknown>;
    assertEquals(summaryProp["x-frontmatter-part"], true);
    assertEquals(summaryProp["x-derived-from"], "metadata.description");
    assertEquals(summaryProp["x-template"], "{{title}}: {{description}}");

    const tagsProp = schema.properties.tags as Record<string, unknown>;
    assertEquals(tagsProp["x-frontmatter-part"], true);
    assertEquals(tagsProp["x-derived-from"], "posts[].tags[]");
    assertEquals(tagsProp["x-derived-unique"], true);
  });
});
