/**
 * Test scenario generator for performance benchmarks
 *
 * Creates temporary markdown files with realistic frontmatter data
 * following DDD and Totality principles with Result<T,E> patterns
 */

import { err, ok, Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

export interface TestFile {
  readonly path: string;
  readonly content: string;
  readonly frontmatterSize: number;
}

export interface TestScenario {
  readonly files: TestFile[];
  readonly schemaPath: string;
  readonly templatePath?: string;
  readonly outputPattern: string;
  readonly processingMode: "single" | "dual" | "aggregation";
  readonly tempDir: string;
}

export type ScenarioResult = Result<
  TestScenario,
  DomainError & { message: string }
>;

export class TestScenarioGenerator {
  private readonly tempDir: string;

  constructor(baseDir = "./tmp/performance-test-scenarios") {
    this.tempDir = baseDir;
  }

  /**
   * Generate test scenario with specified number of files and processing mode
   * Total function - always returns Result, never throws
   */
  async generate(
    fileCount: number,
    processingMode: "single" | "dual" | "aggregation",
  ): Promise<ScenarioResult> {
    try {
      // Create temp directory
      const dirResult = await this.ensureTempDirectory();
      if (!dirResult.ok) {
        return dirResult;
      }

      // Generate files based on processing mode
      const filesResult = await this.generateFiles(fileCount, processingMode);
      if (!filesResult.ok) {
        return filesResult;
      }

      // Generate schema file
      const schemaResult = await this.generateSchema(processingMode);
      if (!schemaResult.ok) {
        return schemaResult;
      }

      // Generate template file if needed
      const templateResult = await this.generateTemplate(processingMode);
      if (!templateResult.ok) {
        return templateResult;
      }

      return ok({
        files: filesResult.data,
        schemaPath: schemaResult.data,
        templatePath: templateResult.data,
        outputPattern: `${this.tempDir}/output-{filename}.json`,
        processingMode,
        tempDir: this.tempDir,
      });
    } catch (error) {
      return err({
        kind: "TestScenarioError" as const,
        content: "Failed to generate test scenario",
        message: `Scenario generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Clean up temporary files and directories
   */
  async cleanup(
    scenario: TestScenario,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      // Remove temp directory and all files
      await Deno.remove(scenario.tempDir, { recursive: true });
      return ok(void 0);
    } catch (error) {
      return err({
        kind: "CleanupError" as const,
        content: "Failed to cleanup test scenario",
        message: `Cleanup failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  private async ensureTempDirectory(): Promise<
    Result<void, DomainError & { message: string }>
  > {
    try {
      await Deno.mkdir(this.tempDir, { recursive: true });
      return ok(void 0);
    } catch (error) {
      return err({
        kind: "DirectoryCreationError" as const,
        content: "Failed to create temp directory",
        message: `Directory creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  private async generateFiles(
    count: number,
    mode: "single" | "dual" | "aggregation",
  ): Promise<Result<TestFile[], DomainError & { message: string }>> {
    const files: TestFile[] = [];

    for (let i = 0; i < count; i++) {
      const fileResult = await this.generateSingleFile(i, mode);
      if (!fileResult.ok) {
        return fileResult;
      }
      files.push(fileResult.data);
    }

    return ok(files);
  }

  private async generateSingleFile(
    index: number,
    mode: "single" | "dual" | "aggregation",
  ): Promise<Result<TestFile, DomainError & { message: string }>> {
    const fileName = `test-${index.toString().padStart(4, "0")}.md`;
    const filePath = `${this.tempDir}/${fileName}`;

    const frontmatter = this.generateFrontmatter(index, mode);
    const body = this.generateMarkdownBody(index);
    const content = `---\n${frontmatter}\n---\n\n${body}`;

    try {
      await Deno.writeTextFile(filePath, content);

      return ok({
        path: filePath,
        content,
        frontmatterSize: frontmatter.length,
      });
    } catch (error) {
      return err({
        kind: "FileWriteError" as const,
        content: "Failed to write test file",
        message: `File write failed for ${fileName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  private generateFrontmatter(
    index: number,
    mode: "single" | "dual" | "aggregation",
  ): string {
    const baseData = {
      id: `test-${index}`,
      title: `Test Document ${index}`,
      category: `category-${index % 5}`,
      tags: [`tag-${index % 3}`, `tag-${(index + 1) % 3}`],
      priority: index % 3 + 1,
      created: new Date(2024, 0, 1 + (index % 365)).toISOString().split("T")[0],
    };

    if (mode === "aggregation") {
      // Add command-style data for aggregation testing
      return `${this.yamlStringify(baseData)}
commands:
  - c1: command-${index}-1
    c2: value-${index}-1
    priority: ${index % 3 + 1}
  - c1: command-${index}-2
    c2: value-${index}-2
    priority: ${(index + 1) % 3 + 1}`;
    } else if (mode === "dual") {
      // Add template-specific data for dual template testing
      return `${this.yamlStringify(baseData)}
x-template: template-primary
x-template-items: template-secondary`;
    } else {
      // Single template mode
      return `${this.yamlStringify(baseData)}
x-template: template-single`;
    }
  }

  private generateMarkdownBody(index: number): string {
    const paragraphs = [
      `This is test document number ${index}.`,
      `It contains sample content for performance testing.`,
      `The content is generated to simulate realistic markdown files.`,
    ];

    // Vary content length slightly for realism
    const extraSentences = index % 3;
    for (let i = 0; i < extraSentences; i++) {
      paragraphs.push(`Additional sentence ${i + 1} for document ${index}.`);
    }

    return paragraphs.join("\n\n");
  }

  private async generateSchema(
    mode: "single" | "dual" | "aggregation",
  ): Promise<Result<string, DomainError & { message: string }>> {
    const schemaPath = `${this.tempDir}/test-schema.json`;

    let schemaContent: any;

    if (mode === "aggregation") {
      schemaContent = {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "number" },
          created: { type: "string" },
          commands: {
            type: "array",
            items: {
              type: "object",
              properties: {
                c1: { type: "string" },
                c2: { type: "string" },
                priority: { type: "number" },
              },
              required: ["c1", "c2", "priority"],
              "x-frontmatter-part": true,
            },
          },
          uniqueCommands: {
            "x-derived-from": "commands[].c1",
            "x-unique": true,
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["id", "title", "category"],
      };
    } else {
      schemaContent = {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "number" },
          created: { type: "string" },
        },
        required: ["id", "title", "category"],
      };

      if (mode === "dual") {
        schemaContent["x-template"] = "template-primary";
        schemaContent["x-template-items"] = "template-secondary";
      } else {
        schemaContent["x-template"] = "template-single";
      }
    }

    try {
      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(schemaContent, null, 2),
      );
      return ok(schemaPath);
    } catch (error) {
      return err({
        kind: "SchemaWriteError" as const,
        content: "Failed to write schema file",
        message: `Schema write failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  private async generateTemplate(
    mode: "single" | "dual" | "aggregation",
  ): Promise<Result<string | undefined, DomainError & { message: string }>> {
    if (mode === "single" || mode === "aggregation") {
      const templatePath = `${this.tempDir}/template.json`;
      const templateContent = {
        title: "{{title}}",
        id: "{{id}}",
        category: "{{category}}",
        processedAt: new Date().toISOString(),
        mode: mode,
      };

      try {
        await Deno.writeTextFile(
          templatePath,
          JSON.stringify(templateContent, null, 2),
        );
        return ok(templatePath);
      } catch (error) {
        return err({
          kind: "TemplateWriteError" as const,
          content: "Failed to write template file",
          message: `Template write failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    }

    return ok(undefined); // No template needed for dual mode in this implementation
  }

  private yamlStringify(obj: any): string {
    // Simple YAML stringifier for frontmatter
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.join("\n");
  }
}
