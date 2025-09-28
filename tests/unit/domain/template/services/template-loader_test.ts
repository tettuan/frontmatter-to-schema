import { assertEquals } from "jsr:@std/assert";
import {
  FileSystemOperations,
  TemplateLoader,
} from "../../../../../src/domain/template/services/template-loader.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

/**
 * Mock file system implementation for testing
 */
class MockFileSystem implements FileSystemOperations {
  private files: Map<string, string> = new Map();

  constructor(files: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(path, content);
    }
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return Promise.resolve(content);
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  // Helper methods for testing
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  removeFile(path: string): void {
    this.files.delete(path);
  }
}

// Test data
const validJsonTemplate = JSON.stringify({
  title: "Test Template",
  metadata: {
    version: "1.0",
    author: "Test Author",
  },
  items: [],
});

const validJsonWithVariables = JSON.stringify({
  title: "${metadata.title}",
  description: "Template for ${entity.name}",
  config: {
    version: "${app.version}",
  },
});

const invalidJsonTemplate = '{ "title": "Invalid JSON" missing comma }';

const emptyJsonObject = JSON.stringify({});

Deno.test("TemplateLoader - create loader instance", () => {
  const fileSystem = new MockFileSystem();
  const loader = TemplateLoader.create(fileSystem);

  // Verify we got a TemplateLoader instance
  assertEquals(typeof loader, "object");
  assertEquals(loader.constructor.name, "TemplateLoader");
});

Deno.test("TemplateLoader - load valid JSON template", async () => {
  const fileSystem = new MockFileSystem({
    "valid_template.json": validJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("valid_template.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isOk(), true);
  const template = result.unwrap();
  assertEquals(template.getPath(), templatePath);
  assertEquals(template.getFormat(), "json");
  assertEquals(template.getNestedProperty("title"), "Test Template");
  assertEquals(template.getNestedProperty("metadata.version"), "1.0");
});

Deno.test("TemplateLoader - load template from non-existent file", async () => {
  const fileSystem = new MockFileSystem();
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("nonexistent.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_NOT_FOUND");
});

Deno.test("TemplateLoader - load empty template file", async () => {
  const fileSystem = new MockFileSystem({
    "empty.json": "",
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("empty.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_TEMPLATE_FILE");
});

Deno.test("TemplateLoader - load template with whitespace only", async () => {
  const fileSystem = new MockFileSystem({
    "whitespace.json": "   \n\t  ",
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("whitespace.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_TEMPLATE_FILE");
});

Deno.test("TemplateLoader - load template with invalid JSON", async () => {
  const fileSystem = new MockFileSystem({
    "invalid.json": invalidJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("invalid.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_PARSE_ERROR");
});

Deno.test("TemplateLoader - load template with non-object JSON", async () => {
  const fileSystem = new MockFileSystem({
    "array.json": JSON.stringify(["not", "an", "object"]),
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("array.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_PARSE_ERROR");
});

Deno.test("TemplateLoader - load template with null JSON", async () => {
  const fileSystem = new MockFileSystem({
    "null.json": "null",
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("null.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_PARSE_ERROR");
});

Deno.test("TemplateLoader - load template with empty object", async () => {
  const fileSystem = new MockFileSystem({
    "empty_object.json": emptyJsonObject,
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("empty_object.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isOk(), true);
  const template = result.unwrap();
  assertEquals(template.getFormat(), "json");
});

Deno.test("TemplateLoader - loadTemplates with multiple paths", async () => {
  const fileSystem = new MockFileSystem({
    "template1.json": validJsonTemplate,
    "template2.json": validJsonWithVariables,
    "invalid.json": invalidJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);
  const paths = [
    TemplatePath.create("template1.json").unwrap(),
    TemplatePath.create("template2.json").unwrap(),
    TemplatePath.create("invalid.json").unwrap(),
    TemplatePath.create("nonexistent.json").unwrap(),
  ];

  const results = await loader.loadTemplates(paths);

  assertEquals(results.length, 4);
  assertEquals(results[0].isOk(), true); // template1.json
  assertEquals(results[1].isOk(), true); // template2.json
  assertEquals(results[2].isError(), true); // invalid.json
  assertEquals(results[3].isError(), true); // nonexistent.json
});

Deno.test("TemplateLoader - loadTemplatesSuccessfully separates results and errors", async () => {
  const fileSystem = new MockFileSystem({
    "template1.json": validJsonTemplate,
    "template2.json": validJsonWithVariables,
    "invalid.json": invalidJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);
  const paths = [
    TemplatePath.create("template1.json").unwrap(),
    TemplatePath.create("template2.json").unwrap(),
    TemplatePath.create("invalid.json").unwrap(),
    TemplatePath.create("nonexistent.json").unwrap(),
  ];

  const result = await loader.loadTemplatesSuccessfully(paths);

  assertEquals(result.templates.length, 2);
  assertEquals(result.errors.length, 2);

  // Check that successful templates are included
  assertEquals(result.templates[0].getNestedProperty("title"), "Test Template");
  assertEquals(
    result.templates[1].getNestedProperty("title"),
    "${metadata.title}",
  );

  // Check that errors are collected
  assertEquals(result.errors[0].code, "TEMPLATE_PARSE_ERROR");
  assertEquals(result.errors[1].code, "TEMPLATE_NOT_FOUND");
});

Deno.test("TemplateLoader - validateTemplate checks template validity", async () => {
  const fileSystem = new MockFileSystem({
    "valid.json": validJsonTemplate,
    "invalid.json": invalidJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);

  const validPath = TemplatePath.create("valid.json").unwrap();
  const invalidPath = TemplatePath.create("invalid.json").unwrap();
  const nonexistentPath = TemplatePath.create("nonexistent.json").unwrap();

  const validResult = await loader.validateTemplate(validPath);
  const invalidResult = await loader.validateTemplate(invalidPath);
  const nonexistentResult = await loader.validateTemplate(nonexistentPath);

  assertEquals(validResult.isOk(), true);
  assertEquals(invalidResult.isError(), true);
  assertEquals(nonexistentResult.isError(), true);
});

Deno.test("TemplateLoader - handles file system read errors", async () => {
  const fileSystem = new MockFileSystem();
  // Override readTextFile to throw an error
  fileSystem.readTextFile = (_path: string) => {
    return Promise.reject(new Error("File system error"));
  };
  fileSystem.addFile("test.json", "dummy"); // Add file so exists() returns true

  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("test.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
});

Deno.test("TemplateLoader - format determination", async () => {
  const fileSystem = new MockFileSystem({
    "template.json": validJsonTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);

  // Test JSON format detection
  const jsonPath = TemplatePath.create("template.json").unwrap();
  const jsonResult = await loader.loadTemplate(jsonPath);

  assertEquals(jsonResult.isOk(), true);
  assertEquals(jsonResult.unwrap().getFormat(), "json");
});

Deno.test("TemplateLoader - complex template with nested structures", async () => {
  const complexTemplate = JSON.stringify({
    header: {
      title: "${document.title}",
      metadata: {
        version: "${app.version}",
        created: "${timestamp}",
      },
    },
    sections: [
      {
        name: "${section.name}",
        content: "${section.content}",
      },
      {
        name: "Static Section",
        content: "Fixed content",
      },
    ],
    footer: {
      text: "${footer.text}",
      links: ["${link1}", "${link2}"],
    },
  });

  const fileSystem = new MockFileSystem({
    "complex.json": complexTemplate,
  });
  const loader = TemplateLoader.create(fileSystem);
  const templatePath = TemplatePath.create("complex.json").unwrap();

  const result = await loader.loadTemplate(templatePath);

  assertEquals(result.isOk(), true);
  const template = result.unwrap();

  assertEquals(template.getNestedProperty("header.title"), "${document.title}");
  assertEquals(
    template.getNestedProperty("header.metadata.version"),
    "${app.version}",
  );
  assertEquals(
    template.getNestedProperty("sections.0.name"),
    "${section.name}",
  );
  assertEquals(template.getNestedProperty("sections.1.name"), "Static Section");
  assertEquals(template.getNestedProperty("footer.links.0"), "${link1}");
});

Deno.test("TemplateLoader - concurrent template loading", async () => {
  const fileSystem = new MockFileSystem({
    "template1.json": validJsonTemplate,
    "template2.json": validJsonWithVariables,
    "template3.json": emptyJsonObject,
  });
  const loader = TemplateLoader.create(fileSystem);

  // Load templates concurrently
  const loadPromises = [
    loader.loadTemplate(TemplatePath.create("template1.json").unwrap()),
    loader.loadTemplate(TemplatePath.create("template2.json").unwrap()),
    loader.loadTemplate(TemplatePath.create("template3.json").unwrap()),
  ];

  const results = await Promise.all(loadPromises);

  assertEquals(results.length, 3);
  assertEquals(results[0].isOk(), true);
  assertEquals(results[1].isOk(), true);
  assertEquals(results[2].isOk(), true);

  // Verify each template loaded correctly
  assertEquals(results[0].unwrap().getNestedProperty("title"), "Test Template");
  assertEquals(
    results[1].unwrap().getNestedProperty("title"),
    "${metadata.title}",
  );
  assertEquals(Object.keys(results[2].unwrap().getContent()).length, 0);
});
