import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TemplateOutputFacadeImpl } from "./template-output-facade-impl.ts";
import type {
  OutputSpecification,
  RenderedTemplate,
} from "./template-output-facade.ts";
import type { CompiledTemplate } from "./template-builder-facade.ts";
import { TemplateFilePath } from "./template-builder-facade.ts";

describe("TemplateOutputFacadeImpl", () => {
  describe("outputTemplate", () => {
    const createMockTemplate = (
      content: string,
      format: "json" | "yaml" | "text" = "json",
    ): CompiledTemplate => ({
      templatePath: new TemplateFilePath("test.hbs"),
      appliedValues: {
        values: { test: "value" },
        metadata: { source: "test", timestamp: new Date() },
      },
      compiledContent: content,
      compiledAt: new Date(),
      checksum: "test-checksum",
      format,
      validate: () => ({ ok: true, data: undefined }),
    });

    it("should successfully write valid template to file", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template = createMockTemplate('{"test": "output"}');
      const spec: OutputSpecification = {
        destination: "tmp/test-output-facade.json",
        format: "json",
        prettify: true,
      };

      const result = await facade.outputTemplate(template, spec);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Clean up test file
        try {
          await Deno.remove("tmp/test-output-facade.json");
        } catch {
          // File might not exist, that's ok
        }
      }
    });

    it("should handle template validation failure", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const invalidTemplate: CompiledTemplate = {
        templatePath: new TemplateFilePath("test.hbs"),
        appliedValues: {
          values: {},
          metadata: { source: "test", timestamp: new Date() },
        },
        compiledContent: "",
        compiledAt: new Date(),
        checksum: "",
        format: "json",
        validate: () => ({
          ok: false,
          error: { message: "Invalid template", kind: "ValidationError" },
        }),
      };
      const spec: OutputSpecification = {
        destination: "tmp/test-invalid.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.outputTemplate(invalidTemplate, spec);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RenderError");
        assertEquals(
          result.error.message,
          "Template validation failed: Invalid template",
        );
      }
    });

    it("should write template with prettify option", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template = createMockTemplate('{"a":1,"b":2}');
      const spec: OutputSpecification = {
        destination: "tmp/test-prettify.json",
        format: "json",
        prettify: true,
      };

      const result = await facade.outputTemplate(template, spec);

      assertEquals(result.ok, true);
      if (result.ok) {
        const content = await Deno.readTextFile("tmp/test-prettify.json");
        // Prettified JSON should have newlines and indentation
        assertEquals(content.includes("\n"), true);
        assertEquals(content, '{\n  "a": 1,\n  "b": 2\n}');

        // Clean up
        await Deno.remove("tmp/test-prettify.json");
      }
    });

    it("should write template without prettify option", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template = createMockTemplate('{"a":1,"b":2}');
      const spec: OutputSpecification = {
        destination: "tmp/test-no-prettify.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.outputTemplate(template, spec);

      assertEquals(result.ok, true);
      if (result.ok) {
        const content = await Deno.readTextFile("tmp/test-no-prettify.json");
        // Non-prettified JSON should be compact
        assertEquals(content, '{"a":1,"b":2}');

        // Clean up
        await Deno.remove("tmp/test-no-prettify.json");
      }
    });

    it("should handle file write errors gracefully", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template = createMockTemplate('{"test": "output"}');
      const spec: OutputSpecification = {
        destination: "/invalid/path/test.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.outputTemplate(template, spec);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "OutputError");
        assertEquals(
          result.error.message.includes("Failed to write template"),
          true,
        );
      }
    });

    it("should create parent directories if they don't exist", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template = createMockTemplate('{"test": "nested"}');
      const spec: OutputSpecification = {
        destination: "tmp/nested/deep/test-output.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.outputTemplate(template, spec);

      assertEquals(result.ok, true);
      if (result.ok) {
        const content = await Deno.readTextFile(
          "tmp/nested/deep/test-output.json",
        );
        assertEquals(content, '{"test": "nested"}');

        // Clean up
        await Deno.remove("tmp/nested", { recursive: true });
      }
    });

    it("should handle different output formats", async () => {
      const facade = new TemplateOutputFacadeImpl();

      // Test YAML format
      const yamlTemplate = createMockTemplate(
        "test: value\narray:\n  - item1\n  - item2",
        "yaml",
      );
      const yamlSpec: OutputSpecification = {
        destination: "tmp/test-output.yaml",
        format: "yaml",
        prettify: false,
      };

      const yamlResult = await facade.outputTemplate(yamlTemplate, yamlSpec);
      assertEquals(yamlResult.ok, true);
      if (yamlResult.ok) {
        const content = await Deno.readTextFile("tmp/test-output.yaml");
        assertEquals(content, "test: value\narray:\n  - item1\n  - item2");
        await Deno.remove("tmp/test-output.yaml");
      }

      // Test text format instead of XML (not supported)
      const textTemplate = createMockTemplate("Plain text content", "text");
      const textSpec: OutputSpecification = {
        destination: "tmp/test-output.txt",
        format: "text",
        prettify: false,
      };

      const textResult = await facade.outputTemplate(textTemplate, textSpec);
      assertEquals(textResult.ok, true);
      if (textResult.ok) {
        const content = await Deno.readTextFile("tmp/test-output.txt");
        assertEquals(content, "Plain text content");
        await Deno.remove("tmp/test-output.txt");
      }
    });

    it("should validate empty compiled content", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const emptyTemplate = createMockTemplate("");
      const spec: OutputSpecification = {
        destination: "tmp/test-empty.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.outputTemplate(emptyTemplate, spec);

      // Empty content should still be written (it's valid to have empty files)
      assertEquals(result.ok, true);
      if (result.ok) {
        const content = await Deno.readTextFile("tmp/test-empty.json");
        assertEquals(content, "");
        await Deno.remove("tmp/test-empty.json");
      }
    });

    it("should handle concurrent writes to different files", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template1 = createMockTemplate('{"file": 1}');
      const template2 = createMockTemplate('{"file": 2}');

      const spec1: OutputSpecification = {
        destination: "tmp/concurrent-1.json",
        format: "json",
        prettify: false,
      };

      const spec2: OutputSpecification = {
        destination: "tmp/concurrent-2.json",
        format: "json",
        prettify: false,
      };

      // Execute writes concurrently
      const [result1, result2] = await Promise.all([
        facade.outputTemplate(template1, spec1),
        facade.outputTemplate(template2, spec2),
      ]);

      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);

      if (result1.ok && result2.ok) {
        const content1 = await Deno.readTextFile("tmp/concurrent-1.json");
        const content2 = await Deno.readTextFile("tmp/concurrent-2.json");

        assertEquals(content1, '{"file": 1}');
        assertEquals(content2, '{"file": 2}');

        // Clean up
        await Deno.remove("tmp/concurrent-1.json");
        await Deno.remove("tmp/concurrent-2.json");
      }
    });
  });

  describe("renderTemplate", () => {
    it("should return the rendered template", async () => {
      const facade = new TemplateOutputFacadeImpl();
      const template: CompiledTemplate = {
        templatePath: new TemplateFilePath("test.hbs"),
        appliedValues: {
          values: { test: "value" },
          metadata: { source: "test", timestamp: new Date() },
        },
        compiledContent: '{"rendered": "content"}',
        compiledAt: new Date(),
        checksum: "test-checksum",
        format: "json",
        validate: () => ({ ok: true, data: undefined }),
      };

      const spec: OutputSpecification = {
        destination: "tmp/render-test.json",
        format: "json",
        prettify: false,
      };

      const result = await facade.renderTemplate(template, spec);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rendered = result.data as RenderedTemplate;
        assertEquals(rendered.content, '{"rendered": "content"}');
        assertEquals(
          rendered.specification.destination,
          "tmp/render-test.json",
        );
      }
    });

    it("should handle different content types", async () => {
      const facade = new TemplateOutputFacadeImpl();

      // Test with string content
      const stringTemplate: CompiledTemplate = {
        templatePath: new TemplateFilePath("test.hbs"),
        appliedValues: {
          values: {},
          metadata: { source: "test", timestamp: new Date() },
        },
        compiledContent: "plain text content",
        compiledAt: new Date(),
        checksum: "checksum",
        format: "text",
        validate: () => ({ ok: true, data: undefined }),
      };

      const spec: OutputSpecification = {
        destination: "tmp/text-render.txt",
        format: "text",
        prettify: false,
      };

      const stringResult = await facade.renderTemplate(stringTemplate, spec);
      assertEquals(stringResult.ok, true);
      if (stringResult.ok) {
        const rendered = stringResult.data as RenderedTemplate;
        assertEquals(rendered.content, "plain text content");
      }

      // Test with JSON content
      const jsonTemplate: CompiledTemplate = {
        templatePath: new TemplateFilePath("test.hbs"),
        appliedValues: {
          values: {},
          metadata: { source: "test", timestamp: new Date() },
        },
        compiledContent: '{"key": "value"}',
        compiledAt: new Date(),
        checksum: "checksum",
        format: "json",
        validate: () => ({ ok: true, data: undefined }),
      };

      const jsonSpec: OutputSpecification = {
        destination: "tmp/json-render.json",
        format: "json",
        prettify: true,
      };

      const jsonResult = await facade.renderTemplate(jsonTemplate, jsonSpec);
      assertEquals(jsonResult.ok, true);
      if (jsonResult.ok) {
        const rendered = jsonResult.data as RenderedTemplate;
        // When prettified, JSON should be formatted
        assertEquals(rendered.content, '{\n  "key": "value"\n}');
      }
    });
  });
});
