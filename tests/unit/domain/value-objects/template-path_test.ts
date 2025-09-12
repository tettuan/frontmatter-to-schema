/**
 * TemplatePath Value Object Tests
 *
 * Tests for TemplatePath Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplatePath } from "../../../../src/domain/value-objects/template-path.ts";

Deno.test("TemplatePath - should create valid path with .hbs extension", () => {
  const result = TemplatePath.create("templates/layout.hbs");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "templates/layout.hbs");
    assertEquals(result.data.getExtension(), ".hbs");
    assertEquals(result.data.getFilename(), "layout.hbs");
    assertEquals(result.data.getBasename(), "layout");
    assertEquals(result.data.isHandlebars(), true);
    assertEquals(result.data.getTemplateEngine(), "handlebars");
  }
});

Deno.test("TemplatePath - should create valid path with .handlebars extension", () => {
  const result = TemplatePath.create("templates/page.handlebars");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".handlebars");
    assertEquals(result.data.isHandlebars(), true);
    assertEquals(result.data.getTemplateEngine(), "handlebars");
  }
});

Deno.test("TemplatePath - should create valid path with .mustache extension", () => {
  const result = TemplatePath.create("templates/component.mustache");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".mustache");
    assertEquals(result.data.isMustache(), true);
    assertEquals(result.data.getTemplateEngine(), "mustache");
  }
});

Deno.test("TemplatePath - should create valid path with .liquid extension", () => {
  const result = TemplatePath.create("templates/blog.liquid");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".liquid");
    assertEquals(result.data.isLiquid(), true);
    assertEquals(result.data.getTemplateEngine(), "liquid");
  }
});

Deno.test("TemplatePath - should create valid path with .ejs extension", () => {
  const result = TemplatePath.create("views/index.ejs");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".ejs");
    assertEquals(result.data.getTemplateEngine(), "ejs");
  }
});

Deno.test("TemplatePath - should create valid path with .pug extension", () => {
  const result = TemplatePath.create("views/main.pug");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".pug");
    assertEquals(result.data.getTemplateEngine(), "pug");
  }
});

Deno.test("TemplatePath - should create valid path with .html extension", () => {
  const result = TemplatePath.create("templates/email.html");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".html");
    assertEquals(result.data.isHtml(), true);
    assertEquals(result.data.getTemplateEngine(), "html");
  }
});

Deno.test("TemplatePath - should create valid path with .htm extension", () => {
  const result = TemplatePath.create("templates/page.htm");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".htm");
    assertEquals(result.data.isHtml(), true);
    assertEquals(result.data.getTemplateEngine(), "html");
  }
});

Deno.test("TemplatePath - should create valid path with .txt extension", () => {
  const result = TemplatePath.create("templates/plain.txt");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".txt");
    assertEquals(result.data.getTemplateEngine(), "text");
  }
});

Deno.test("TemplatePath - should create valid path with .json extension", () => {
  const result = TemplatePath.create("templates/config.json");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".json");
    assertEquals(result.data.isJson(), true);
    assertEquals(result.data.getTemplateEngine(), "json");
  }
});

Deno.test("TemplatePath - should reject empty string", () => {
  const result = TemplatePath.create("");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("TemplatePath - should reject whitespace-only string", () => {
  const result = TemplatePath.create("   ");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("TemplatePath - should reject path with unsupported extension", () => {
  const result = TemplatePath.create("template.docx");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "FileExtensionMismatch");
    assertExists(result.error.message);
  }
});

Deno.test("TemplatePath - should reject path with null byte", () => {
  const result = TemplatePath.create("template\0.hbs");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplatePath - should reject path with directory traversal", () => {
  const result1 = TemplatePath.create("../../../etc/passwd.hbs");
  assertEquals(result1.ok, false);
  if (!result1.ok) {
    assertEquals(result1.error.kind, "InvalidFormat");
  }

  const result2 = TemplatePath.create("..\\..\\windows\\system.hbs");
  assertEquals(result2.ok, false);
  if (!result2.ok) {
    assertEquals(result2.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplatePath - should reject excessively long path", () => {
  const longPath = "a".repeat(1025) + ".hbs";
  const result = TemplatePath.create(longPath);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "TooLong");
  }
});

Deno.test("TemplatePath - should reject filename that is just extension", () => {
  const result = TemplatePath.create(".hbs");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplatePath - should trim whitespace from valid path", () => {
  const result = TemplatePath.create("  templates/layout.hbs  ");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "templates/layout.hbs");
  }
});

Deno.test("TemplatePath - should get directory path", () => {
  const result = TemplatePath.create("path/to/template.hbs");

  if (result.ok) {
    assertEquals(result.data.getDirectory(), "path/to");
  }

  const rootResult = TemplatePath.create("template.hbs");
  if (rootResult.ok) {
    assertEquals(rootResult.data.getDirectory(), "");
  }
});

Deno.test("TemplatePath - should identify absolute paths", () => {
  const absoluteUnix = TemplatePath.create("/absolute/path/template.hbs");
  if (absoluteUnix.ok) {
    assertEquals(absoluteUnix.data.isAbsolute(), true);
  }

  const relative = TemplatePath.create("relative/path/template.hbs");
  if (relative.ok) {
    assertEquals(relative.data.isAbsolute(), false);
  }
});

Deno.test("TemplatePath - should create relative path from base", () => {
  const result = TemplatePath.create("/project/templates/layout.hbs");

  if (result.ok) {
    const relativeResult = result.data.makeRelative("/project/");
    assertEquals(relativeResult.ok, true);
    if (relativeResult.ok) {
      assertEquals(relativeResult.data.getValue(), "templates/layout.hbs");
    }
  }
});

Deno.test("TemplatePath - should fail to create relative path from non-matching base", () => {
  const result = TemplatePath.create("/project/templates/layout.hbs");

  if (result.ok) {
    const relativeResult = result.data.makeRelative("/other/");
    assertEquals(relativeResult.ok, false);
    if (!relativeResult.ok) {
      assertEquals(relativeResult.error.kind, "InvalidFormat");
    }
  }
});

Deno.test("TemplatePath - should join path segments", () => {
  const result = TemplatePath.create("templates/layout.hbs");

  if (result.ok) {
    const joinResult = result.data.join("component.hbs");
    assertEquals(joinResult.ok, true);
    if (joinResult.ok) {
      assertEquals(
        joinResult.data.getValue(),
        "templates/layout.hbs/component.hbs",
      );
    }
  }
});

Deno.test("TemplatePath - should handle empty segment in join", () => {
  const result = TemplatePath.create("templates/layout.hbs");

  if (result.ok) {
    const joinResult = result.data.join("");
    assertEquals(joinResult.ok, true);
    if (joinResult.ok) {
      assertEquals(joinResult.data.getValue(), "templates/layout.hbs");
    }
  }
});

Deno.test("TemplatePath - should change extension", () => {
  const result = TemplatePath.create("template.hbs");

  if (result.ok) {
    const mustacheResult = result.data.withExtension(".mustache");
    assertEquals(mustacheResult.ok, true);
    if (mustacheResult.ok) {
      assertEquals(mustacheResult.data.getValue(), "template.mustache");
      assertEquals(mustacheResult.data.getExtension(), ".mustache");
    }
  }
});

Deno.test("TemplatePath - should check template engine types", () => {
  const handlebarsResult = TemplatePath.create("template.hbs");
  if (handlebarsResult.ok) {
    assertEquals(handlebarsResult.data.isHandlebars(), true);
    assertEquals(handlebarsResult.data.isMustache(), false);
    assertEquals(handlebarsResult.data.isLiquid(), false);
    assertEquals(handlebarsResult.data.isHtml(), false);
  }

  const htmlResult = TemplatePath.create("template.html");
  if (htmlResult.ok) {
    assertEquals(htmlResult.data.isHtml(), true);
    assertEquals(htmlResult.data.isHandlebars(), false);
  }
});

Deno.test("TemplatePath - should check equality", () => {
  const result1 = TemplatePath.create("templates/layout.hbs");
  const result2 = TemplatePath.create("templates/layout.hbs");
  const result3 = TemplatePath.create("templates/other.hbs");

  if (result1.ok && result2.ok && result3.ok) {
    assertEquals(result1.data.equals(result2.data), true);
    assertEquals(result1.data.equals(result3.data), false);
  }
});

Deno.test("TemplatePath - should have string representation", () => {
  const result = TemplatePath.create("templates/layout.hbs");

  if (result.ok) {
    assertEquals(result.data.toString(), "TemplatePath(templates/layout.hbs)");
  }
});
