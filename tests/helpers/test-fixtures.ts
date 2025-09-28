/**
 * Test fixtures and helpers for reproducible testing
 * Following DDD and Totality principles for robust test infrastructure
 */

import { err, ok } from "../../src/domain/shared/types/result.ts";
import { createError } from "../../src/domain/shared/types/errors.ts";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";

// Mock Infrastructure Adapters
export class MockFileReader {
  constructor(private mockFiles: Map<string, string> = new Map()) {}

  read(path: string) {
    const content = this.mockFiles.get(path);
    if (content === undefined) {
      return err(createError({
        kind: "FileNotFound" as const,
        path,
      }));
    }
    return ok(content);
  }

  setMockFile(path: string, content: string) {
    this.mockFiles.set(path, content);
  }

  setMockFiles(files: Record<string, string>) {
    Object.entries(files).forEach(([path, content]) => {
      this.mockFiles.set(path, content);
    });
  }

  clearMockFiles() {
    this.mockFiles.clear();
  }

  hasMockFile(path: string): boolean {
    return this.mockFiles.has(path);
  }
}

export class MockFileLister {
  constructor(private mockFileList: string[] = []) {}

  list(_pattern: string) {
    return ok([...this.mockFileList]); // Return copy to prevent mutation
  }

  setMockFiles(files: string[]) {
    this.mockFileList = [...files]; // Copy to prevent external mutation
  }

  addMockFile(file: string) {
    if (!this.mockFileList.includes(file)) {
      this.mockFileList.push(file);
    }
  }

  clearMockFiles() {
    this.mockFileList = [];
  }

  getMockFiles(): string[] {
    return [...this.mockFileList]; // Return copy
  }
}

export class MockFileWriter {
  constructor(private writtenFiles: Map<string, string> = new Map()) {}

  write(path: string, content: string) {
    this.writtenFiles.set(path, content);
    return ok(undefined);
  }

  getWrittenContent(path: string): string | undefined {
    return this.writtenFiles.get(path);
  }

  getWrittenFiles(): Record<string, string> {
    return Object.fromEntries(this.writtenFiles);
  }

  clearWrittenFiles() {
    this.writtenFiles.clear();
  }

  hasWrittenFile(path: string): boolean {
    return this.writtenFiles.has(path);
  }
}

// Schema Test Fixtures
export const createBasicSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      // Add x-frontmatter-part directive as boolean marker to the title property
      title: { type: "string", "x-frontmatter-part": true },
      date: { type: "string" },
      author: { type: "string" },
      "x-template": {
        type: "string",
        default:
          "# {{title}}\n\nAuthor: {{author}}\nDate: {{date}}\n\n{{content}}",
      },
    },
  });
  const path = SchemaPath.create("test-schema.json");

  if (!definition.ok) {
    throw new Error("Failed to create basic schema definition");
  }
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

export const createSchemaWithTemplate = (templateContent?: string) => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      // Add x-frontmatter-part directive as boolean marker to the title property
      title: { type: "string", "x-frontmatter-part": true },
      content: { type: "string" },
      "x-template": {
        type: "string",
        default: templateContent || "# {{title}}\n\n{{content}}",
      },
    },
  });
  const path = SchemaPath.create("test-template-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema with template");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

export const createSchemaWithDirectives = (
  directives: Record<string, string>,
) => {
  const properties: Record<string, any> = {
    // Add x-frontmatter-part directive as boolean marker to the title property
    title: { type: "string", "x-frontmatter-part": true },
    content: { type: "string" },
    author: { type: "string" },
    date: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  };

  // Create schema definition with directives as extensions on the schema itself
  const schemaObj: any = {
    type: "object",
    properties,
  };

  // Add x-directives to the schema object (not as properties)
  Object.entries(directives).forEach(([key, value]) => {
    schemaObj[key] = value;
  });

  const definition = SchemaDefinition.create(schemaObj);
  const path = SchemaPath.create("test-directives-schema.json");

  if (!definition.ok) {
    throw new Error("Failed to create schema with directives");
  }
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

// Content Test Fixtures
export const createSampleMarkdownWithFrontmatter = (
  frontmatter: Record<string, any>,
  content?: string,
) => {
  const yamlContent = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
      }
      return `${key}: ${typeof value === "string" ? `"${value}"` : value}`;
    })
    .join("\n");

  return `---
${yamlContent}
---

${content || "# Default Content\n\nThis is default markdown content."}
`;
};

export const createSampleMarkdownWithoutFrontmatter = (content?: string) => {
  return content || "# Simple Article\n\nThis article has no frontmatter.";
};

export const createMultipleMarkdownFiles = () => ({
  "article1.md": createSampleMarkdownWithFrontmatter({
    title: "First Article",
    author: "John Doe",
    date: "2023-01-01",
    tags: ["tech", "programming"],
  }, "# First Article\n\nThis is the first article content."),

  "article2.md": createSampleMarkdownWithFrontmatter({
    title: "Second Article",
    author: "Jane Smith",
    date: "2023-01-02",
    tags: ["design", "ui"],
  }, "# Second Article\n\nThis is the second article content."),

  "article3.md": createSampleMarkdownWithFrontmatter({
    title: "Third Article",
    author: "Bob Wilson",
    date: "2023-01-03",
    tags: ["tech", "api"],
  }, "# Third Article\n\nThis is the third article content."),
});

// Template Test Fixtures
export const createSimpleTemplate = () =>
  `# {{title}}

**Author**: {{author}}
**Date**: {{date}}

{{content}}
`;

export const createListTemplate = () =>
  `# Articles

{% for article in articles %}
## {{article.title}}

By: {{article.author}} on {{article.date}}

{{article.content}}

---
{% endfor %}
`;

export const createConditionalTemplate = () =>
  `# {{title}}

{% if author %}
**Author**: {{author}}
{% endif %}

{% if date %}
**Date**: {{date}}
{% endif %}

{{content}}

{% if tags %}
**Tags**: {% for tag in tags %}{{tag}}{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}
`;

// Data Test Fixtures
export const createSampleFrontmatterData = () => [
  {
    title: "TypeScript Basics",
    author: "Alice Developer",
    date: "2023-01-01",
    tags: ["typescript", "programming"],
    content: "Introduction to TypeScript fundamentals.",
  },
  {
    title: "Deno Runtime",
    author: "Bob Engineer",
    date: "2023-01-02",
    tags: ["deno", "runtime"],
    content: "Exploring the Deno runtime environment.",
  },
  {
    title: "DDD Principles",
    author: "Carol Architect",
    date: "2023-01-03",
    tags: ["architecture", "ddd"],
    content: "Understanding Domain-Driven Design principles.",
  },
];

export const createFilteredFrontmatterData = (
  filter: (item: any) => boolean,
) => {
  return createSampleFrontmatterData().filter(filter);
};

// Test Environment Setup Helpers
export class TestEnvironment {
  fileReader: MockFileReader;
  fileLister: MockFileLister;
  fileWriter: MockFileWriter;

  constructor() {
    this.fileReader = new MockFileReader();
    this.fileLister = new MockFileLister();
    this.fileWriter = new MockFileWriter();
  }

  setupBasicMarkdownFiles() {
    const files = createMultipleMarkdownFiles();
    this.fileReader.setMockFiles(files);
    this.fileLister.setMockFiles(Object.keys(files));
    return files;
  }

  setupCustomMarkdownFiles(files: Record<string, string>) {
    this.fileReader.setMockFiles(files);
    this.fileLister.setMockFiles(Object.keys(files));
    return files;
  }

  setupTemplateFile(path: string, content: string) {
    this.fileReader.setMockFile(path, content);
    return content;
  }

  reset() {
    this.fileReader.clearMockFiles();
    this.fileLister.clearMockFiles();
    this.fileWriter.clearWrittenFiles();
  }

  verifyNoSideEffects() {
    // Verify that test operations didn't leave side effects
    // This helps maintain test isolation and reproducibility
    return {
      hasUnexpectedFiles: this.fileWriter.getWrittenFiles(),
      remainingMockFiles: [], // FileReader doesn't expose mock files list
    };
  }
}

// Test Assertion Helpers
export function assertSchemaResult<T>(
  result: any,
): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    throw new Error(`Schema operation failed: ${JSON.stringify(result.error)}`);
  }
}

export function assertServiceResult<T>(
  result: any,
): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    throw new Error(
      `Service operation failed: ${JSON.stringify(result.error)}`,
    );
  }
}

export function assertErrorResult<E>(
  result: any,
): asserts result is { ok: false; error: E } {
  if (result.ok) {
    throw new Error(
      `Expected error result but got success: ${JSON.stringify(result.data)}`,
    );
  }
}

// Performance Test Helpers
export class PerformanceTimer {
  private startTime: number = 0;

  start() {
    this.startTime = performance.now();
  }

  end(): number {
    return performance.now() - this.startTime;
  }

  assertDurationLessThan(maxDuration: number, operation: string) {
    const duration = this.end();
    if (duration >= maxDuration) {
      throw new Error(
        `${operation} took ${duration}ms, expected < ${maxDuration}ms`,
      );
    }
    return duration;
  }
}

// Test Data Builders (Builder Pattern for Test Data)
export class FrontmatterDataBuilder {
  private data: Record<string, any> = {};

  title(title: string) {
    this.data.title = title;
    return this;
  }

  author(author: string) {
    this.data.author = author;
    return this;
  }

  date(date: string) {
    this.data.date = date;
    return this;
  }

  tags(tags: string[]) {
    this.data.tags = tags;
    return this;
  }

  content(content: string) {
    this.data.content = content;
    return this;
  }

  custom(key: string, value: any) {
    this.data[key] = value;
    return this;
  }

  build() {
    return { ...this.data }; // Return copy to prevent mutation
  }

  buildMarkdown(bodyContent?: string) {
    return createSampleMarkdownWithFrontmatter(this.data, bodyContent);
  }
}

export const frontmatterData = () => new FrontmatterDataBuilder();

// Export commonly used test combinations
export const testSuites = {
  basicDomainTest: () => ({
    environment: new TestEnvironment(),
    schema: createBasicSchema(),
    data: createSampleFrontmatterData(),
  }),

  templateIntegrationTest: () => ({
    environment: new TestEnvironment(),
    schema: createSchemaWithTemplate(),
    template: createSimpleTemplate(),
    data: createSampleFrontmatterData(),
  }),

  performanceTest: () => ({
    environment: new TestEnvironment(),
    timer: new PerformanceTimer(),
    schema: createBasicSchema(),
    data: createSampleFrontmatterData(),
  }),
};
