import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplateOutputRenderer } from "../../../../../src/domain/template/services/template-output-renderer.ts";
import { OutputFormat } from "../../../../../src/domain/template/services/output-rendering-service.ts";
import { ProcessingError } from "../../../../../src/domain/shared/types/errors.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

// Mock OutputRenderingService for testing
class MockOutputRenderingService {
  private shouldError = false;
  private errorMessage = "Rendering failed";
  private outputContent = "rendered content";

  setShouldError(
    shouldError: boolean,
    errorMessage = "Rendering failed",
  ): void {
    this.shouldError = shouldError;
    this.errorMessage = errorMessage;
  }

  setOutputContent(content: string): void {
    this.outputContent = content;
  }

  renderSimple(
    _template: any,
    _data: Record<string, unknown>,
    _format: OutputFormat,
  ) {
    if (this.shouldError) {
      return {
        isError: () => true,
        unwrapError: () =>
          new ProcessingError(this.errorMessage, "RENDERING_ERROR", {}),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
      };
    }

    return {
      isError: () => false,
      unwrapError: () => {
        throw new Error("Cannot unwrap ok result");
      },
      isOk: () => true,
      unwrap: () => this.outputContent,
    };
  }
}

// Mock FileSystemPort for testing
class MockFileSystemPort {
  private shouldError = false;
  private errorType = "FILE_WRITE_ERROR";

  setShouldError(shouldError: boolean, errorType = "FILE_WRITE_ERROR"): void {
    this.shouldError = shouldError;
    this.errorType = errorType;
  }

  async writeTextFile(_path: string, _content: string) {
    await Promise.resolve(); // Satisfy async requirement

    if (this.shouldError) {
      return {
        isError: () => true,
        unwrapError: () => ({
          code: this.errorType,
          message: `Error writing ${_path}`,
        }),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
      };
    }

    return {
      isError: () => false,
      unwrapError: () => {
        throw new Error("Cannot unwrap ok result");
      },
      isOk: () => true,
      unwrap: () => undefined,
    };
  }
}

Deno.test("TemplateOutputRenderer - create with valid dependencies", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();

  const result = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  );

  assertEquals(result.isOk(), true);
  assertExists(result.unwrap());
});

Deno.test("TemplateOutputRenderer - create fails with null OutputRenderingService", () => {
  const mockFileSystem = new MockFileSystemPort();

  const result = TemplateOutputRenderer.create(
    null as any,
    mockFileSystem as any,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DEPENDENCY");
  assertEquals(
    error.message,
    "OutputRenderingService is required for template output rendering",
  );
});

Deno.test("TemplateOutputRenderer - create fails with null FileSystemPort", () => {
  const mockOutputRenderer = new MockOutputRenderingService();

  const result = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    null as any,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DEPENDENCY");
  assertEquals(
    error.message,
    "FileSystemPort is required for template output rendering",
  );
});

Deno.test("TemplateOutputRenderer - renderOutput with valid template object", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}", content: "{{content}}" };
  const data = { title: "Test Title", content: "Test Content" };
  const outputPath = "/test/output.json";

  mockOutputRenderer.setOutputContent(
    '{"title": "Test Title", "content": "Test Content"}',
  );

  const result = await renderer.renderOutput(
    template,
    data,
    "json",
    outputPath,
  );

  assertEquals(result.isOk(), true);
});

Deno.test("TemplateOutputRenderer - renderOutput with Template entity", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  // Create a proper Template entity
  const templatePath = TemplatePath.create("/test/template.json").unwrap();
  const templateData = {
    content: { title: "{{title}}" },
    format: "json" as const,
  };
  const template = Template.create(templatePath, templateData).unwrap();

  const data = { title: "Test Title" };
  const outputPath = "/test/output.json";

  mockOutputRenderer.setOutputContent('{"title": "Test Title"}');

  const result = await renderer.renderOutput(
    template,
    data,
    "json",
    outputPath,
  );

  assertEquals(result.isOk(), true);
});

Deno.test("TemplateOutputRenderer - renderOutput fails with invalid data type", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const outputPath = "/test/output.json";

  const result = await renderer.renderOutput(
    template,
    "invalid data" as any,
    "json",
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DATA_TYPE");
});

Deno.test("TemplateOutputRenderer - renderOutput fails with invalid output path", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const data = { title: "Test" };

  const result = await renderer.renderOutput(template, data, "json", "");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_OUTPUT_PATH");
});

Deno.test("TemplateOutputRenderer - renderOutput fails with invalid template type", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const data = { title: "Test" };
  const outputPath = "/test/output.json";

  const result = await renderer.renderOutput(
    "invalid template",
    data,
    "json",
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_TEMPLATE_TYPE");
});

Deno.test("TemplateOutputRenderer - renderOutput fails with rendering error", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  mockOutputRenderer.setShouldError(true, "Template compilation failed");

  const template = { title: "{{title}}" };
  const data = { title: "Test" };
  const outputPath = "/test/output.json";

  const result = await renderer.renderOutput(
    template,
    data,
    "json",
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "RENDERING_ERROR");
  assertEquals(error.message.includes("Output rendering failed"), true);
});

Deno.test("TemplateOutputRenderer - renderOutput fails with file write error", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  mockFileSystem.setShouldError(true, "PERMISSION_DENIED");

  const template = { title: "{{title}}" };
  const data = { title: "Test" };
  const outputPath = "/test/output.json";

  const result = await renderer.renderOutput(
    template,
    data,
    "json",
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "OUTPUT_WRITE_ERROR");
});

Deno.test("TemplateOutputRenderer - renderOutput with different formats", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const data = { title: "Test" };

  const formats: OutputFormat[] = ["json", "yaml", "xml", "markdown"];

  for (const format of formats) {
    mockOutputRenderer.setOutputContent(`Content in ${format} format`);

    const result = await renderer.renderOutput(
      template,
      data,
      format,
      `/test/output.${format}`,
    );

    assertEquals(result.isOk(), true, `Should work with ${format} format`);
  }
});

Deno.test("TemplateOutputRenderer - validateRenderingConfig with valid inputs", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const data = { title: "Test" };
  const format: OutputFormat = "json";
  const outputPath = "/test/output.json";

  const result = renderer.validateRenderingConfig(
    template,
    data,
    format,
    outputPath,
  );

  assertEquals(result.isOk(), true);
});

Deno.test("TemplateOutputRenderer - validateRenderingConfig fails with missing template", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const data = { title: "Test" };
  const format: OutputFormat = "json";
  const outputPath = "/test/output.json";

  const result = renderer.validateRenderingConfig(
    null,
    data,
    format,
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "MISSING_TEMPLATE");
});

Deno.test("TemplateOutputRenderer - validateRenderingConfig fails with invalid data", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const format: OutputFormat = "json";
  const outputPath = "/test/output.json";

  const result = renderer.validateRenderingConfig(
    template,
    "invalid" as any,
    format,
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_DATA");
});

Deno.test("TemplateOutputRenderer - validateRenderingConfig fails with invalid format", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const data = { title: "Test" };
  const outputPath = "/test/output.json";

  const result = renderer.validateRenderingConfig(
    template,
    data,
    "invalid" as any,
    outputPath,
  );

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_FORMAT");
  assertEquals(
    error.message.includes("Must be one of: json, yaml, xml, markdown"),
    true,
  );
});

Deno.test("TemplateOutputRenderer - validateRenderingConfig fails with invalid output path", () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = { title: "{{title}}" };
  const data = { title: "Test" };
  const format: OutputFormat = "json";

  const tests = ["", "   ", null, undefined];

  for (const invalidPath of tests) {
    const result = renderer.validateRenderingConfig(
      template,
      data,
      format,
      invalidPath as any,
    );

    assertEquals(
      result.isError(),
      true,
      `Should fail for path: ${invalidPath}`,
    );
    const error = result.unwrapError();
    assertEquals(error.code, "INVALID_OUTPUT_PATH");
  }
});

Deno.test("TemplateOutputRenderer - comprehensive error handling", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();

  // Test renderer creation with undefined dependencies
  const undefinedOutputResult = TemplateOutputRenderer.create(
    undefined as any,
    mockFileSystem as any,
  );
  assertEquals(undefinedOutputResult.isError(), true);

  const undefinedFileSystemResult = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    undefined as any,
  );
  assertEquals(undefinedFileSystemResult.isError(), true);

  // Test with valid renderer
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  // Test renderOutput with various invalid inputs
  const tests = [
    {
      template: {},
      data: null,
      format: "json",
      path: "/test",
      desc: "null data",
    },
    {
      template: {},
      data: undefined,
      format: "json",
      path: "/test",
      desc: "undefined data",
    },
    {
      template: {},
      data: { test: "value" },
      format: "json",
      path: null,
      desc: "null path",
    },
    {
      template: {},
      data: { test: "value" },
      format: "json",
      path: undefined,
      desc: "undefined path",
    },
    {
      template: null,
      data: { test: "value" },
      format: "json",
      path: "/test",
      desc: "null template",
    },
  ];

  for (const test of tests) {
    const result = await renderer.renderOutput(
      test.template,
      test.data as any,
      test.format as OutputFormat,
      test.path as any,
    );
    assertEquals(result.isError(), true, `Should fail for ${test.desc}`);
  }
});

Deno.test("TemplateOutputRenderer - totality principle compliance", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  // All methods should return Result types, never throw exceptions
  const tests = [
    () =>
      renderer.renderOutput(
        { test: "template" },
        { data: "value" },
        "json",
        "/test",
      ),
    () => renderer.renderOutput(null, { data: "value" }, "json", "/test"),
    () =>
      renderer.renderOutput(
        { test: "template" },
        "invalid" as any,
        "json",
        "/test",
      ),
    () =>
      renderer.validateRenderingConfig(
        { test: "template" },
        { data: "value" },
        "json",
        "/test",
      ),
    () =>
      renderer.validateRenderingConfig(
        null,
        { data: "value" },
        "json",
        "/test",
      ),
    () =>
      renderer.validateRenderingConfig(
        { test: "template" },
        "invalid" as any,
        "json",
        "/test",
      ),
  ];

  for (const test of tests) {
    try {
      const result = await test();
      // Should always return a Result, never throw
      assertEquals(typeof result.isOk, "function");
      assertEquals(typeof result.isError, "function");
    } catch (error) {
      // Should never reach here in totality-compliant code
      throw new Error(`Method threw exception: ${error}`);
    }
  }
});

Deno.test("TemplateOutputRenderer - complex rendering scenario", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  const template = {
    title: "{{title}}",
    sections: [
      { name: "{{sectionName}}", content: "{{sectionContent}}" },
    ],
    metadata: {
      author: "{{author}}",
      version: "{{version}}",
    },
  };

  const data = {
    title: "Complex Document",
    sectionName: "Introduction",
    sectionContent: "This is the introduction section",
    author: "John Doe",
    version: "1.0.0",
  };

  const expectedOutput = JSON.stringify(
    {
      title: "Complex Document",
      sections: [
        { name: "Introduction", content: "This is the introduction section" },
      ],
      metadata: {
        author: "John Doe",
        version: "1.0.0",
      },
    },
    null,
    2,
  );

  mockOutputRenderer.setOutputContent(expectedOutput);

  // Test rendering to different formats
  const formats: OutputFormat[] = ["json", "yaml", "xml", "markdown"];

  for (const format of formats) {
    const outputPath = `/output/complex-document.${format}`;
    const result = await renderer.renderOutput(
      template,
      data,
      format,
      outputPath,
    );

    assertEquals(
      result.isOk(),
      true,
      `Should render successfully to ${format}`,
    );
  }

  // Test validation
  const validationResult = renderer.validateRenderingConfig(
    template,
    data,
    "json",
    "/output/document.json",
  );
  assertEquals(validationResult.isOk(), true);
});

Deno.test("TemplateOutputRenderer - edge cases and error recovery", async () => {
  const mockOutputRenderer = new MockOutputRenderingService();
  const mockFileSystem = new MockFileSystemPort();
  const renderer = TemplateOutputRenderer.create(
    mockOutputRenderer as any,
    mockFileSystem as any,
  ).unwrap();

  // Empty template object
  const emptyTemplateResult = await renderer.renderOutput(
    {},
    { data: "test" },
    "json",
    "/test/empty.json",
  );
  assertEquals(emptyTemplateResult.isOk(), true);

  // Empty data object
  const emptyDataResult = await renderer.renderOutput(
    { template: "test" },
    {},
    "json",
    "/test/empty-data.json",
  );
  assertEquals(emptyDataResult.isOk(), true);

  // Very long output path
  const longPath = "/test/" + "a".repeat(200) + ".json";
  const longPathResult = await renderer.renderOutput(
    { test: "template" },
    { data: "value" },
    "json",
    longPath,
  );
  assertEquals(longPathResult.isOk(), true);

  // Complex nested template structure
  const nestedTemplate = {
    level1: {
      level2: {
        level3: {
          value: "{{deepValue}}",
        },
      },
    },
  };
  const nestedData = { deepValue: "found it!" };
  const nestedResult = await renderer.renderOutput(
    nestedTemplate,
    nestedData,
    "json",
    "/test/nested.json",
  );
  assertEquals(nestedResult.isOk(), true);
});
