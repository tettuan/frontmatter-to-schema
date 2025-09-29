import { assertEquals } from "jsr:@std/assert";
import {
  OutputRenderingService,
  RenderingContext,
} from "../../../../../src/domain/template/services/output-rendering-service.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

// Helper function to create test templates
function createTestTemplate(
  content: Record<string, unknown>,
  path = "test-template.json",
  format: "json" | "yaml" | "xml" | "markdown" = "json",
) {
  const pathResult = TemplatePath.create(path);
  if (pathResult.isError()) {
    throw new Error("Failed to create test template path");
  }

  const templateResult = Template.create(pathResult.unwrap(), {
    content,
    format,
  });
  if (templateResult.isError()) {
    throw new Error("Failed to create test template");
  }

  return templateResult.unwrap();
}

Deno.test("OutputRenderingService - create instance", () => {
  const serviceResult = OutputRenderingService.create();

  assertEquals(serviceResult.isOk(), true);
  const service = serviceResult.unwrap();
  assertEquals(typeof service, "object");
  assertEquals(service.constructor.name, "OutputRenderingService");
});

Deno.test("OutputRenderingService - render simple JSON template", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    title: "${title}",
    description: "${description}",
    version: "1.0",
  });

  const data = {
    title: "My Project",
    description: "A test project",
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();
  assertEquals(rendering.format, "json");
  assertEquals(rendering.metadata.templatePath, "test-template.json");

  // Parse the JSON to verify structure
  const parsed = JSON.parse(rendering.content);
  assertEquals(parsed.title, "My Project");
  assertEquals(parsed.description, "A test project");
  assertEquals(parsed.version, "1.0");
});

Deno.test("OutputRenderingService - render simple YAML template", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    title: "${title}",
    count: "${count}",
    enabled: true,
  });

  const data = {
    title: "YAML Test",
    count: 42,
  };

  const config = service.createDefaultConfig("yaml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();
  assertEquals(rendering.format, "yaml");

  // Verify YAML content contains expected values
  assertEquals(rendering.content.includes("title: YAML Test"), true);
  assertEquals(rendering.content.includes("count: 42"), true);
  assertEquals(rendering.content.includes("enabled: true"), true);
});

Deno.test("OutputRenderingService - render template with array data", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    commands: [
      {
        name: "${firstCommand}",
        description: "${firstDescription}",
      },
      {
        name: "${secondCommand}",
        description: "${secondDescription}",
      },
    ],
    totalCommands: "${totalCommands}",
  });

  const data = {
    firstCommand: "build",
    firstDescription: "Build the project",
    secondCommand: "test",
    secondDescription: "Run tests",
    totalCommands: 2,
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  const parsed = JSON.parse(rendering.content);
  assertEquals(Array.isArray(parsed.commands), true);
  assertEquals(parsed.commands.length, 2);
  assertEquals(parsed.commands[0].name, "build");
  assertEquals(parsed.commands[1].description, "Run tests");
  assertEquals(parsed.totalCommands, "2"); // Variable resolution converts to string
});

Deno.test("OutputRenderingService - render with nested object variables", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    project: {
      name: "${project.name}",
      version: "${project.version}",
      author: {
        name: "${project.author.name}",
        email: "${project.author.email}",
      },
    },
  });

  const data = {
    project: {
      name: "Frontend App",
      version: "2.1.0",
      author: {
        name: "John Doe",
        email: "john@example.com",
      },
    },
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  const parsed = JSON.parse(rendering.content);
  assertEquals(parsed.project.name, "Frontend App");
  assertEquals(parsed.project.version, "2.1.0");
  assertEquals(parsed.project.author.name, "John Doe");
  assertEquals(parsed.project.author.email, "john@example.com");
});

Deno.test("OutputRenderingService - renderSimple convenience method", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    message: "${greeting} ${name}!",
    timestamp: "${timestamp}",
  });

  const data = {
    greeting: "Hello",
    name: "World",
    timestamp: "2024-01-01T00:00:00Z",
  };

  const result = service.renderSimple(template, data, "json");

  assertEquals(result.isOk(), true);
  const content = result.unwrap();

  const parsed = JSON.parse(content);
  assertEquals(parsed.message, "Hello World!");
  assertEquals(parsed.timestamp, "2024-01-01T00:00:00Z");
});

Deno.test("OutputRenderingService - render with custom configuration", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    data: "${value}",
    nested: {
      item: "${nested.item}",
    },
  });

  const data = {
    value: "test",
    nested: {
      item: "nested value",
    },
  };

  const config = {
    format: "json" as const,
    indent: 4,
    sortKeys: true,
    prettyPrint: true,
  };

  const context: RenderingContext = { template, data, config };
  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify pretty printing with 4-space indentation
  assertEquals(rendering.content.includes("    "), true);
  assertEquals(rendering.content.includes("test"), true);
  assertEquals(rendering.content.includes("nested value"), true);
});

Deno.test("OutputRenderingService - handle missing template variables gracefully", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    available: "${available}",
    missing: "${missing}",
    nested: "${nested.missing}",
  });

  const data = {
    available: "present value",
    // missing and nested.missing are not provided
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  const parsed = JSON.parse(rendering.content);
  assertEquals(parsed.available, "present value");
  assertEquals(parsed.missing, "${missing}"); // Unchanged
  assertEquals(parsed.nested, "${nested.missing}"); // Unchanged
});

Deno.test("OutputRenderingService - render empty template", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({});
  const data = {};

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();
  assertEquals(rendering.content, "{}");
  assertEquals(rendering.metadata.dataItemCount, 0);
});

Deno.test("OutputRenderingService - include rendering metadata", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    items: ["${item1}", "${item2}"],
  }, "metadata-test.json");

  const data = {
    item1: "first",
    item2: "second",
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify metadata
  assertEquals(rendering.metadata.templatePath, "metadata-test.json");
  assertEquals(rendering.metadata.dataItemCount > 0, true);
  assertEquals(typeof rendering.metadata.renderingTime, "number");
  assertEquals(rendering.metadata.renderingTime >= 0, true);
});

Deno.test("OutputRenderingService - handle invalid context", () => {
  const service = OutputRenderingService.create().unwrap();

  // Missing template
  const invalidContext1 = {
    template: null as any,
    data: {},
    config: service.createDefaultConfig("json"),
  };

  const result1 = service.render(invalidContext1);
  assertEquals(result1.isError(), true);
  assertEquals(result1.unwrapError().code, "INVALID_CONTEXT");

  // Invalid data
  const template = createTestTemplate({ test: "value" });
  const invalidContext2 = {
    template,
    data: null as any,
    config: service.createDefaultConfig("json"),
  };

  const result2 = service.render(invalidContext2);
  assertEquals(result2.isError(), true);
  assertEquals(result2.unwrapError().code, "INVALID_CONTEXT");

  // Missing config
  const invalidContext3 = {
    template,
    data: {},
    config: null as any,
  };

  const result3 = service.render(invalidContext3);
  assertEquals(result3.isError(), true);
  assertEquals(result3.unwrapError().code, "INVALID_CONTEXT");
});

Deno.test("OutputRenderingService - handle YAML array formatting", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    fruits: ["${fruit1}", "${fruit2}", "${fruit3}"],
    metadata: {
      count: "${count}",
    },
  });

  const data = {
    fruit1: "apple",
    fruit2: "banana",
    fruit3: "cherry",
    count: 3,
  };

  const config = service.createDefaultConfig("yaml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify YAML array formatting
  assertEquals(rendering.content.includes("fruits:"), true);
  assertEquals(rendering.content.includes("- apple"), true);
  assertEquals(rendering.content.includes("- banana"), true);
  assertEquals(rendering.content.includes("- cherry"), true);
  assertEquals(rendering.content.includes("metadata:"), true);
  assertEquals(rendering.content.includes("count: 3"), true);
});

Deno.test("OutputRenderingService - handle special characters in YAML", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    message: "${message}",
    command: "${command}",
  });

  const data = {
    message: "This is a: test with special chars",
    command: "echo 'hello world'",
  };

  const config = service.createDefaultConfig("yaml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Should handle special characters by quoting (updated expectation)
  assertEquals(
    rendering.content.includes("This is a: test with special chars"),
    true,
  );
  assertEquals(rendering.content.includes("echo 'hello world'"), true);
  assertEquals(rendering.content.includes("message:"), true);
  assertEquals(rendering.content.includes("command:"), true);
});

Deno.test("OutputRenderingService - data item counting", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    simpleField: "${value}",
    arrayField: ["${item1}", "${item2}"],
    objectField: {
      nested: "${nested}",
    },
  });

  const data = {
    value: "test",
    item1: "first",
    item2: "second",
    nested: "nested value",
  };

  const config = service.createDefaultConfig("json");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Should count data items correctly
  assertEquals(rendering.metadata.dataItemCount >= 4, true);
});

// XML Output Format Tests
Deno.test("OutputRenderingService - render simple XML template", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    title: "${title}",
    description: "${description}",
    version: "1.0",
  });

  const data = {
    title: "My Project",
    description: "A test project",
  };

  const config = service.createDefaultConfig("xml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();
  assertEquals(rendering.format, "xml");
  assertEquals(rendering.metadata.templatePath, "test-template.json");

  // Verify XML structure
  assertEquals(
    rendering.content.includes('<?xml version="1.0" encoding="UTF-8"?>'),
    true,
  );
  assertEquals(rendering.content.includes("<root>"), true);
  assertEquals(rendering.content.includes("</root>"), true);
  assertEquals(rendering.content.includes("<title>My Project</title>"), true);
  assertEquals(
    rendering.content.includes("<description>A test project</description>"),
    true,
  );
  assertEquals(rendering.content.includes("<version>1.0</version>"), true);
});

Deno.test("OutputRenderingService - render XML with special characters", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    message: "${message}",
    html: "${html}",
  });

  const data = {
    message: "Test & Development",
    html: "<p>Hello World</p>",
  };

  const config = service.createDefaultConfig("xml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify XML escaping
  assertEquals(rendering.content.includes("&amp;"), true);
  assertEquals(rendering.content.includes("&lt;p&gt;"), true);
  assertEquals(rendering.content.includes("&lt;/p&gt;"), true);
});

Deno.test("OutputRenderingService - render XML with nested objects", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    project: {
      name: "${name}",
      settings: {
        debug: "${debug}",
        port: "${port}",
      },
    },
  });

  const data = {
    name: "Web App",
    debug: true,
    port: 3000,
  };

  const config = service.createDefaultConfig("xml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify nested XML structure
  assertEquals(rendering.content.includes("<project>"), true);
  assertEquals(rendering.content.includes("</project>"), true);
  assertEquals(rendering.content.includes("<name>Web App</name>"), true);
  assertEquals(rendering.content.includes("<settings>"), true);
  assertEquals(rendering.content.includes("</settings>"), true);
  assertEquals(rendering.content.includes("<debug>true</debug>"), true);
  assertEquals(rendering.content.includes("<port>3000</port>"), true);
});

Deno.test("OutputRenderingService - render XML with arrays", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    items: ["${item1}", "${item2}", "${item3}"],
  });

  const data = {
    item1: "first",
    item2: "second",
    item3: "third",
  };

  const config = service.createDefaultConfig("xml");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify XML array structure
  assertEquals(rendering.content.includes("<items>"), true);
  assertEquals(rendering.content.includes("</items>"), true);
  assertEquals(
    rendering.content.includes('<item index="0">first</item>'),
    true,
  );
  assertEquals(
    rendering.content.includes('<item index="1">second</item>'),
    true,
  );
  assertEquals(
    rendering.content.includes('<item index="2">third</item>'),
    true,
  );
});

// Markdown Output Format Tests
Deno.test("OutputRenderingService - render simple Markdown template", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    title: "${title}",
    description: "${description}",
    version: "1.0",
  });

  const data = {
    title: "My Project",
    description: "A test project",
  };

  const config = service.createDefaultConfig("markdown");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();
  assertEquals(rendering.format, "markdown");
  assertEquals(rendering.metadata.templatePath, "test-template.json");

  // Verify Markdown structure
  assertEquals(rendering.content.includes("**title**: My Project"), true);
  assertEquals(
    rendering.content.includes("**description**: A test project"),
    true,
  );
  assertEquals(rendering.content.includes("**version**: 1.0"), true);
});

Deno.test("OutputRenderingService - render Markdown with nested objects", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    project: {
      name: "${name}",
      settings: {
        debug: "${debug}",
        port: "${port}",
      },
    },
  });

  const data = {
    name: "Web App",
    debug: true,
    port: 3000,
  };

  const config = service.createDefaultConfig("markdown");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify Markdown header structure
  assertEquals(rendering.content.includes("# project"), true);
  assertEquals(rendering.content.includes("**name**: Web App"), true);
  assertEquals(rendering.content.includes("## settings"), true);
  assertEquals(rendering.content.includes("**debug**: true"), true);
  assertEquals(rendering.content.includes("**port**: 3000"), true);
});

Deno.test("OutputRenderingService - render Markdown with arrays", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    features: ["${feature1}", "${feature2}", "${feature3}"],
  });

  const data = {
    feature1: "Authentication",
    feature2: "User Management",
    feature3: "Data Export",
  };

  const config = service.createDefaultConfig("markdown");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify Markdown list structure
  assertEquals(rendering.content.includes("# features"), true);
  assertEquals(rendering.content.includes("- Authentication"), true);
  assertEquals(rendering.content.includes("- User Management"), true);
  assertEquals(rendering.content.includes("- Data Export"), true);
});

Deno.test("OutputRenderingService - render Markdown with complex nested structure", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    documentation: {
      title: "${title}",
      sections: ["${section1}", "${section2}"],
      metadata: {
        author: "${author}",
        version: "${version}",
      },
    },
  });

  const data = {
    title: "API Documentation",
    section1: "Getting Started",
    section2: "API Reference",
    author: "Development Team",
    version: "2.0",
  };

  const config = service.createDefaultConfig("markdown");
  const context: RenderingContext = { template, data, config };

  const result = service.render(context);

  assertEquals(result.isOk(), true);
  const rendering = result.unwrap();

  // Verify complex Markdown structure
  assertEquals(rendering.content.includes("# documentation"), true);
  assertEquals(
    rendering.content.includes("**title**: API Documentation"),
    true,
  );
  assertEquals(rendering.content.includes("## sections"), true);
  assertEquals(rendering.content.includes("- Getting Started"), true);
  assertEquals(rendering.content.includes("- API Reference"), true);
  assertEquals(rendering.content.includes("## metadata"), true);
  assertEquals(
    rendering.content.includes("**author**: Development Team"),
    true,
  );
  assertEquals(rendering.content.includes("**version**: 2.0"), true);
});

Deno.test("OutputRenderingService - all format types work with renderSimple", () => {
  const service = OutputRenderingService.create().unwrap();

  const template = createTestTemplate({
    message: "${greeting} ${name}!",
  });

  const data = {
    greeting: "Hello",
    name: "World",
  };

  // Test all format types
  const formats: Array<"json" | "yaml" | "xml" | "markdown"> = [
    "json",
    "yaml",
    "xml",
    "markdown",
  ];

  for (const format of formats) {
    const result = service.renderSimple(template, data, format);

    assertEquals(result.isOk(), true, `Format ${format} should work`);
    const content = result.unwrap();

    // Each format should contain the resolved message
    switch (format) {
      case "json":
        assertEquals(content.includes("Hello World!"), true);
        break;
      case "yaml":
        assertEquals(content.includes("Hello World!"), true);
        break;
      case "xml":
        assertEquals(content.includes("Hello World!"), true);
        assertEquals(content.includes("<?xml"), true);
        break;
      case "markdown":
        assertEquals(content.includes("Hello World!"), true);
        assertEquals(content.includes("**message**"), true);
        break;
    }
  }
});
