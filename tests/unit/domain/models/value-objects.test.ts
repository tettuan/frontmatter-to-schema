import { assertEquals } from "jsr:@std/assert";
import {
  ConfigPath,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  OutputPath,
  ProcessingOptions,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "../../../../src/domain/models/value-objects.ts";
import { isError, isOk } from "../../../../src/domain/shared/types.ts";

Deno.test("DocumentPath - Smart Constructor", async (t) => {
  await t.step("should create valid path", () => {
    const result = DocumentPath.create("/path/to/file.md");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/path/to/file.md");
      assertEquals(result.data.getFilename(), "file.md");
      assertEquals(result.data.getDirectory(), "/path/to");
    }
  });

  await t.step("should reject empty path", () => {
    const result = DocumentPath.create("");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should handle special characters", () => {
    const result = DocumentPath.create("/path/to/file-name_123.md");
    assertEquals(isOk(result), true);
  });

  await t.step("should normalize paths", () => {
    const result = DocumentPath.create("  /path/to/file.md  ");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "/path/to/file.md");
    }
  });
});

Deno.test("FrontMatterContent - Smart Constructor", async (t) => {
  await t.step("should create valid content", () => {
    const result = FrontMatterContent.create("title: Test\nauthor: John");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "title: Test\nauthor: John");
    }
  });

  await t.step("should allow empty content", () => {
    const result = FrontMatterContent.create("");
    assertEquals(isOk(result), true);
  });

  await t.step("should handle YAML format", () => {
    const yaml = `
title: Test Article
tags:
  - typescript
  - deno
published: true
`;
    const result = FrontMatterContent.create(yaml);
    assertEquals(isOk(result), true);
  });
});

Deno.test("SchemaDefinition - Smart Constructor", async (t) => {
  await t.step("should create valid JSON schema", () => {
    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
      required: ["title"],
    };
    const result = SchemaDefinition.create(schema, "json");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const value = result.data.getValue();
      assertEquals(typeof value, "object");
      assertEquals(result.data.getVersion(), "json");
    }
  });

  await t.step("should reject invalid definition", () => {
    const result = SchemaDefinition.create(null, "json");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should handle complex schemas", () => {
    const schema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            version: { type: "string" },
            created: { type: "string", format: "date-time" },
          },
        },
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
    };
    const result = SchemaDefinition.create(schema, "json");
    assertEquals(isOk(result), true);
  });
});

Deno.test("ProcessingOptions - Smart Constructor", async (t) => {
  await t.step("should create with defaults", () => {
    const result = ProcessingOptions.create({});
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.isParallel(), true);
      assertEquals(result.data.getMaxConcurrency(), 5);
      assertEquals(result.data.shouldContinueOnError(), false);
    }
  });

  await t.step("should override defaults", () => {
    const result = ProcessingOptions.create({
      parallel: false,
      maxConcurrency: 10,
      continueOnError: true,
    });
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.isParallel(), false);
      assertEquals(result.data.getMaxConcurrency(), 10);
      assertEquals(result.data.shouldContinueOnError(), true);
    }
  });

  await t.step("should reject invalid concurrency", () => {
    const result = ProcessingOptions.create({
      maxConcurrency: 0,
    });
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject negative concurrency", () => {
    const result = ProcessingOptions.create({
      maxConcurrency: -1,
    });
    assertEquals(isError(result), true);
  });
});

Deno.test("MappingRule - Smart Constructor", async (t) => {
  await t.step("should create simple mapping", () => {
    const result = MappingRule.create("source.field", "target.field");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getSource(), "source.field");
      assertEquals(result.data.getTarget(), "target.field");
    }
  });

  await t.step("should create mapping with transform", () => {
    const transform = (value: unknown) => String(value).toUpperCase();
    const result = MappingRule.create("name", "displayName", transform);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const applied = result.data.apply({ name: "john" });
      assertEquals(applied, "JOHN");
    }
  });

  await t.step("should reject empty source", () => {
    const result = MappingRule.create("", "target");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject empty target", () => {
    const result = MappingRule.create("source", "");
    assertEquals(isError(result), true);
  });

  await t.step("should handle nested path extraction", () => {
    const result = MappingRule.create("user.profile.name", "displayName");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const data = {
        user: {
          profile: {
            name: "Alice",
          },
        },
      };
      const applied = result.data.apply(data);
      assertEquals(applied, "Alice");
    }
  });
});

Deno.test("ConfigPath - Smart Constructor", async (t) => {
  await t.step("should create valid config path", () => {
    const result = ConfigPath.create("config/settings.json");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "config/settings.json");
    }
  });

  await t.step("should reject non-json/yaml paths", () => {
    const result = ConfigPath.create("config/settings.txt");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should accept yaml extensions", () => {
    const yamlResult = ConfigPath.create("config.yaml");
    const ymlResult = ConfigPath.create("config.yml");
    assertEquals(isOk(yamlResult), true);
    assertEquals(isOk(ymlResult), true);
  });
});

Deno.test("OutputPath - Smart Constructor", async (t) => {
  await t.step("should create valid output path", () => {
    const result = OutputPath.create("output/results.json");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getValue(), "output/results.json");
    }
  });

  await t.step("should handle markdown output", () => {
    const result = OutputPath.create("output/report.md");
    assertEquals(isOk(result), true);
  });

  await t.step("should reject empty path", () => {
    const result = OutputPath.create("");
    assertEquals(isError(result), true);
  });
});

Deno.test("SchemaVersion - Smart Constructor", async (t) => {
  await t.step("should create valid semver", () => {
    const result = SchemaVersion.create("1.0.0");
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.toString(), "1.0.0");
    }
  });

  await t.step("should accept major.minor.patch format", () => {
    const result = SchemaVersion.create("2.3.45");
    assertEquals(isOk(result), true);
  });

  await t.step("should reject major.minor format (requires X.Y.Z)", () => {
    const result = SchemaVersion.create("1.0");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject version with v prefix", () => {
    const result = SchemaVersion.create("v1.0.0");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject single number version", () => {
    const result = SchemaVersion.create("2");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject invalid format", () => {
    const result = SchemaVersion.create("invalid-version");
    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });
});

Deno.test("TemplateFormat - Smart Constructor", async (t) => {
  await t.step("should create JSON format", () => {
    const template = '{"name": "{{name}}"}';
    const result = TemplateFormat.create("json", template);
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.getFormat(), "json");
      assertEquals(result.data.getTemplate(), template);
    }
  });

  await t.step("should create YAML format", () => {
    const template = "name: {{name}}\nage: {{age}}";
    const result = TemplateFormat.create("yaml", template);
    assertEquals(isOk(result), true);
  });

  await t.step("should create handlebars format", () => {
    const template = "{{#each items}}{{name}}{{/each}}";
    const result = TemplateFormat.create("handlebars", template);
    assertEquals(isOk(result), true);
  });

  await t.step("should reject empty definition", () => {
    const result = TemplateFormat.create("json", "");
    assertEquals(isError(result), true);
  });
});
