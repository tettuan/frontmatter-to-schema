import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  PipelineOrchestrator,
  PipelineConfig,
  FileSystem,
} from "../../../../src/application/services/pipeline-orchestrator.ts";
import { FrontmatterTransformationService } from "../../../../src/domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../../../src/domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../../../src/domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../../../src/domain/template/services/template-path-resolver.ts";
import { Schema } from "../../../../src/domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../../../src/domain/schema/value-objects/validation-rules.ts";
import { err, ok, Result } from "../../../../src/domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../../src/domain/shared/types/errors.ts";

describe("PipelineOrchestrator", () => {
  // Mock implementations
  class MockFileSystem implements FileSystem {
    private files = new Map<string, string>();
    private shouldFail = false;
    private errorToReturn?: DomainError & { message: string };

    setFile(path: string, content: string) {
      this.files.set(path, content);
    }

    setShouldFail(fail: boolean, error?: DomainError & { message: string }) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    read(path: string): Result<string, DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      const content = this.files.get(path);
      if (!content) {
        return err(createError({
          kind: "FileNotFound",
          path,
        }));
      }
      return ok(content);
    }

    write(
      path: string,
      content: string,
    ): Result<void, DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      this.files.set(path, content);
      return ok(undefined);
    }

    list(pattern: string): Result<string[], DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      // Simple pattern matching for tests
      const files = Array.from(this.files.keys()).filter((path) =>
        path.includes(pattern.replace("**/*.md", ""))
      );
      return ok(files);
    }
  }

  class MockFrontmatterTransformationService {
    private shouldFail = false;
    private errorToReturn?: DomainError & { message: string };
    private dataToReturn?: FrontmatterData;

    setShouldFail(fail: boolean, error?: DomainError & { message: string }) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    setDataToReturn(data: FrontmatterData) {
      this.dataToReturn = data;
    }

    transformDocuments(
      pattern: string,
      rules: ValidationRules,
      schema: Schema,
      verbose?: boolean,
    ): Result<FrontmatterData, DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      if (this.dataToReturn) {
        return ok(this.dataToReturn);
      }
      return ok(FrontmatterData.empty());
    }
  }

  class MockSchemaProcessingService {
    private shouldFail = false;
    private errorToReturn?: DomainError & { message: string };

    setShouldFail(fail: boolean, error?: DomainError & { message: string }) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    process(
      data: FrontmatterData,
      schema: Schema,
    ): Result<FrontmatterData, DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      return ok(data);
    }
  }

  class MockOutputRenderingService {
    private shouldFail = false;
    private errorToReturn?: DomainError & { message: string };

    setShouldFail(fail: boolean, error?: DomainError & { message: string }) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    renderOutput(
      templatePath: string,
      itemsTemplatePath: string | undefined,
      mainData: FrontmatterData,
      itemsData: FrontmatterData[] | undefined,
      outputPath: string,
      outputFormat: string,
    ): Result<void, DomainError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      return ok(undefined);
    }
  }

  class MockTemplatePathResolver {
    private shouldFail = false;
    private errorToReturn?: DomainError & { message: string };
    private pathsToReturn = {
      templatePath: "/test/template.json",
      itemsTemplatePath: undefined as string | undefined,
      outputFormat: "json",
    };

    setShouldFail(fail: boolean, error?: DomainError & { message: string }) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    setPathsToReturn(paths: {
      templatePath: string;
      itemsTemplatePath?: string;
      outputFormat?: string;
    }) {
      this.pathsToReturn = {
        ...this.pathsToReturn,
        ...paths,
      };
    }

    resolveTemplatePaths(
      schema: Schema,
      config: { schemaPath: string; explicitTemplatePath?: string },
    ): Result<
      {
        templatePath: string;
        itemsTemplatePath?: string;
        outputFormat?: string;
      },
      DomainError & { message: string }
    > {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      return ok(this.pathsToReturn);
    }
  }

  describe("execute", () => {
    it("should execute the complete pipeline successfully", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
            count: { type: "number" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const dataResult = FrontmatterData.create({ title: "Test", count: 5 });
      if (dataResult.ok) {
        frontmatterTransformer.setDataToReturn(dataResult.data);
      }

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });

    it("should handle verbose mode", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setDataToReturn(FrontmatterData.empty());

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
        verbose: true,
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });

    it("should handle schema loading failure", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setShouldFail(true, createError({
        kind: "FileNotFound",
        path: "/test/schema.json",
      }));

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    });

    it("should handle invalid schema JSON", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile("/test/schema.json", "invalid json");

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
      }
    });

    it("should handle template path resolution failure", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();
      templateResolver.setShouldFail(true, createError({
        kind: "TemplateNotFound",
        path: "/test/template.json",
      }));

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TemplateNotFound");
      }
    });

    it("should handle document transformation failure", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setShouldFail(true, createError({
        kind: "ExtractionFailed",
        message: "Failed to transform documents",
      }));

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionFailed");
      }
    });

    it("should handle output rendering failure", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setDataToReturn(FrontmatterData.empty());

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      outputRenderer.setShouldFail(true, createError({
        kind: "RenderFailed",
        message: "Failed to render output",
      }));

      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RenderFailed");
      }
    });

    it("should handle dual template rendering with items", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            items: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                },
              },
            },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const dataResult = FrontmatterData.create({
        items: [
          { title: "Item 1" },
          { title: "Item 2" },
        ],
      });
      if (dataResult.ok) {
        frontmatterTransformer.setDataToReturn(dataResult.data);
      }

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();
      templateResolver.setPathsToReturn({
        templatePath: "/test/template.json",
        itemsTemplatePath: "/test/items-template.json",
        outputFormat: "json",
      });

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });

    it("should handle single template with frontmatter-part", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            items: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                },
              },
            },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      const dataResult = FrontmatterData.create({
        base: "value",
        items: [
          { title: "Item 1" },
          { title: "Item 2" },
        ],
      });
      if (dataResult.ok) {
        frontmatterTransformer.setDataToReturn(dataResult.data);
      }

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();
      // No itemsTemplatePath - single template mode
      templateResolver.setPathsToReturn({
        templatePath: "/test/template.json",
        outputFormat: "json",
      });

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
        verbose: true,
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });

    it("should handle explicit template path", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            title: { type: "string" },
          },
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setDataToReturn(FrontmatterData.empty());

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
        templatePath: "/custom/template.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty frontmatter data", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
          properties: {},
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setDataToReturn(FrontmatterData.empty());

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });

    it("should handle schema without properties", async () => {
      const fileSystem = new MockFileSystem();
      fileSystem.setFile(
        "/test/schema.json",
        JSON.stringify({
          type: "object",
        }),
      );

      const frontmatterTransformer = new MockFrontmatterTransformationService();
      frontmatterTransformer.setDataToReturn(FrontmatterData.empty());

      const schemaProcessor = new MockSchemaProcessingService();
      const outputRenderer = new MockOutputRenderingService();
      const templateResolver = new MockTemplatePathResolver();

      const orchestrator = new PipelineOrchestrator(
        frontmatterTransformer as any,
        schemaProcessor as any,
        outputRenderer as any,
        templateResolver as any,
        fileSystem,
      );

      const config: PipelineConfig = {
        inputPattern: "**/*.md",
        schemaPath: "/test/schema.json",
        outputPath: "/test/output.json",
      };

      const result = await orchestrator.execute(config);

      assertEquals(result.ok, true);
    });
  });
});