import { assertEquals, assertExists } from "jsr:@std/assert";
import { isError, isOk } from "../../src/domain/shared/types.ts";
import type { DomainError } from "../../src/domain/core/result.ts";
import { ProcessDocumentsUseCase } from "../../src/application/use-cases/process-documents.ts";
import {
  ConfigPath,
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  OutputPath,
  ProcessingOptions,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
  TemplatePath,
} from "../../src/domain/models/value-objects.ts";
import {
  AggregatedResult,
  type AnalysisResult,
  Document,
  ExtractedData,
  FrontMatter,
  MappedData,
  Schema,
  SchemaId,
  Template,
  TemplateId,
} from "../../src/domain/models/entities.ts";
import type {
  DocumentRepository,
  FrontMatterExtractor,
  ProcessingConfiguration,
  ResultAggregator,
  ResultRepository,
  SchemaAnalyzer,
  SchemaRepository,
  TemplateMapper,
  TemplateRepository,
} from "../../src/domain/services/interfaces.ts";

// ============================================================================
// Integration Test: End-to-End Document Processing Pipeline
// ============================================================================

// Test fixtures and mock implementations
class MockDocumentRepository implements DocumentRepository {
  private documents: Document[] = [];

  constructor(docs: Array<{ path: string; content: string }>) {
    for (const doc of docs) {
      const pathResult = DocumentPath.create(doc.path);
      const contentResult = DocumentContent.create(doc.content);
      if (isOk(pathResult) && isOk(contentResult)) {
        // Extract frontmatter if present
        const frontMatterMatch = doc.content.match(/^---\n([\s\S]*?)\n---/);
        let frontMatter: FrontMatter | null = null;

        if (frontMatterMatch) {
          const fmContent = FrontMatterContent.create(frontMatterMatch[1]);
          if (isOk(fmContent)) {
            frontMatter = FrontMatter.create(
              fmContent.data,
              frontMatterMatch[1],
            );
          }
        }

        const document = Document.createWithFrontMatter(
          pathResult.data,
          frontMatter,
          contentResult.data,
        );
        this.documents.push(document);
      }
    }
  }

  async findAll(_path: DocumentPath) {
    await Promise.resolve(); // Required for async interface
    return { ok: true as const, data: this.documents };
  }

  async findByPattern(
    _pattern: string,
    _basePath?: string,
  ) {
    await Promise.resolve(); // Required for async interface
    return { ok: true as const, data: this.documents };
  }

  async read(path: DocumentPath) {
    await Promise.resolve(); // Required for async interface
    const doc = this.documents.find((d) =>
      d.getPath().getValue() === path.getValue()
    );
    return doc ? { ok: true as const, data: doc } : {
      ok: false as const,
      error: {
        kind: "ReadError" as const,
        path: path.getValue(),
        reason: "Document not found",
        message: "Document not found",
      },
    };
  }
}

class MockSchemaRepository implements SchemaRepository {
  private schema: Schema | null = null;

  constructor(schemaDefinition: unknown) {
    const defResult = SchemaDefinition.create(schemaDefinition, "1.0.0");
    if (isOk(defResult)) {
      const idResult = SchemaId.create("test-schema");
      const versionResult = SchemaVersion.create("1.0.0");
      if (isOk(idResult) && isOk(versionResult)) {
        this.schema = Schema.create(
          idResult.data,
          defResult.data,
          versionResult.data,
          "Test schema for integration tests",
        );
      }
    }
  }

  async load(_path: ConfigPath) {
    await Promise.resolve(); // Required for async interface
    if (!this.schema) {
      return {
        ok: false as const,
        error: {
          kind: "ReadError" as const,
          path: _path.getValue(),
          reason: "Schema not found",
          message: "Schema not found",
        },
      };
    }
    return { ok: true as const, data: this.schema };
  }

  validate(_schema: Schema) {
    return { ok: true as const, data: undefined };
  }
}

class MockTemplateRepository implements TemplateRepository {
  private template: Template | null = null;

  constructor(
    format: string,
    templateContent: string,
    mappingRules: Record<string, string>,
  ) {
    const formatResult = TemplateFormat.create(
      format as "json" | "yaml" | "handlebars" | "custom",
      templateContent,
    );
    if (isOk(formatResult)) {
      const idResult = TemplateId.create("test-template");
      if (isOk(idResult)) {
        // Create MappingRule objects from the mapping rules
        const rules: MappingRule[] = [];
        for (const [target, source] of Object.entries(mappingRules)) {
          const ruleResult = MappingRule.create(source, target);
          if (isOk(ruleResult)) {
            rules.push(ruleResult.data);
          }
        }

        this.template = Template.create(
          idResult.data,
          formatResult.data,
          rules,
          "Test template for integration tests",
        );
      }
    }
  }

  async load(_path: TemplatePath) {
    await Promise.resolve(); // Required for async interface
    if (!this.template) {
      return {
        ok: false as const,
        error: {
          kind: "ReadError" as const,
          path: _path.getValue(),
          reason: "Template not found",
          message: "Template not found",
        },
      };
    }
    return { ok: true as const, data: this.template };
  }

  validate(_template: Template) {
    return { ok: true as const, data: undefined };
  }
}

class MockResultRepository implements ResultRepository {
  private savedData: AggregatedResult | null = null;

  async save(result: AggregatedResult, _path: OutputPath) {
    await Promise.resolve(); // Required for async interface
    this.savedData = result;
    return { ok: true as const, data: undefined };
  }

  async append(_result: AnalysisResult, _path: OutputPath) {
    await Promise.resolve(); // Required for async interface
    return { ok: true as const, data: undefined };
  }

  getSavedData() {
    return this.savedData;
  }
}

class MockFrontMatterExtractor implements FrontMatterExtractor {
  extract(document: Document) {
    const frontMatter = document.getFrontMatter();

    if (!frontMatter) {
      return {
        ok: false as const,
        error: {
          kind: "NotFound",
          message: "No frontmatter found",
        } as DomainError & { message: string },
      };
    }

    return {
      ok: true as const,
      data: { kind: "Extracted" as const, frontMatter },
    };
  }
}

class MockSchemaAnalyzer implements SchemaAnalyzer {
  async analyze(frontMatter: FrontMatter, _schema: Schema) {
    await Promise.resolve(); // Required for async interface
    // Simple mock analysis - convert frontmatter to ExtractedData
    const data = frontMatter.toObject() as Record<string, unknown>;
    return {
      ok: true as const,
      data: ExtractedData.create(data),
    };
  }
}

class MockTemplateMapper implements TemplateMapper {
  map(data: ExtractedData, template: Template) {
    // Use template's built-in mapping
    const sourceData = data.getData();
    const mapped = template.applyRules(sourceData);

    return { ok: true as const, data: MappedData.create(mapped) };
  }
}

class MockResultAggregator implements ResultAggregator {
  aggregate(results: AnalysisResult[]) {
    return {
      ok: true as const,
      data: AggregatedResult.create(results, "json"),
    };
  }
}

// Test data helpers
function createTestDocuments() {
  return [
    {
      path: "/test/docs/article1.md",
      content: `---
title: "Introduction to DDD"
author: "John Doe"
tags: ["ddd", "architecture", "design"]
published: true
date: "2024-01-15"
---

# Introduction to Domain-Driven Design

This article introduces DDD concepts.`,
    },
    {
      path: "/test/docs/article2.md",
      content: `---
title: "Advanced TypeScript Patterns"
author: "Jane Smith"
tags: ["typescript", "patterns", "advanced"]
published: false
date: "2024-01-20"
---

# Advanced TypeScript Patterns

Learn advanced TypeScript patterns.`,
    },
    {
      path: "/test/docs/article3.md",
      content: `---
title: "Testing Best Practices"
author: "Bob Johnson"
tags: ["testing", "quality", "tdd"]
published: true
date: "2024-01-25"
---

# Testing Best Practices

Best practices for testing.`,
    },
  ];
}

function createTestSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1 },
      author: { type: "string", minLength: 1 },
      tags: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
      },
      published: { type: "boolean" },
      date: { type: "string", format: "date" },
    },
    required: ["title", "author", "tags"],
  };
}

function createTestTemplate() {
  return {
    format: "json",
    content: JSON.stringify({
      articleTitle: "{{title}}",
      writtenBy: "{{author}}",
      topics: "{{tags}}",
      isPublished: "{{published}}",
      publishDate: "{{date}}",
    }),
    mappingRules: {
      articleTitle: "title",
      writtenBy: "author",
      topics: "tags",
      isPublished: "published",
      publishDate: "date",
    },
  };
}

// Main integration tests
Deno.test("Integration: End-to-End Document Processing Pipeline", async (t) => {
  await t.step("Complete pipeline with multiple documents", async () => {
    // Setup
    const documents = createTestDocuments();
    const schema = createTestSchema();
    const template = createTestTemplate();

    const documentRepo = new MockDocumentRepository(documents);
    const schemaRepo = new MockSchemaRepository(schema);
    const templateRepo = new MockTemplateRepository(
      template.format,
      template.content,
      template.mappingRules,
    );
    const resultRepo = new MockResultRepository();
    const frontMatterExtractor = new MockFrontMatterExtractor();
    const schemaAnalyzer = new MockSchemaAnalyzer();
    const templateMapper = new MockTemplateMapper();
    const resultAggregator = new MockResultAggregator();

    // Create processing configuration
    // Use a dummy markdown file path since DocumentPath requires .md extension
    // The repository will use the directory part
    const configResult = {
      documentsPath: DocumentPath.create("/test/docs/dummy.md"),
      schemaPath: ConfigPath.create("schema.json"),
      templatePath: TemplatePath.create("template.json"),
      outputPath: OutputPath.create("output.json"),
      options: ProcessingOptions.create({
        parallel: false,
        maxConcurrency: 5,
        continueOnError: true,
      }),
    };

    // Verify all config creation succeeded
    if (isError(configResult.documentsPath)) {
      throw new Error(
        `Failed to create documentsPath: ${configResult.documentsPath.error.message}`,
      );
    }
    if (isError(configResult.schemaPath)) {
      throw new Error(
        `Failed to create schemaPath: ${configResult.schemaPath.error.message}`,
      );
    }
    if (isError(configResult.templatePath)) {
      throw new Error(
        `Failed to create templatePath: ${configResult.templatePath.error.message}`,
      );
    }
    if (isError(configResult.outputPath)) {
      throw new Error(
        `Failed to create outputPath: ${configResult.outputPath.error.message}`,
      );
    }
    if (isError(configResult.options)) {
      throw new Error(
        `Failed to create options: ${configResult.options.error.message}`,
      );
    }

    const options = (configResult.options as { data: ProcessingOptions }).data;
    const config: ProcessingConfiguration = {
      documentsPath: (configResult.documentsPath as { data: DocumentPath })
        .data,
      schemaPath: (configResult.schemaPath as { data: ConfigPath }).data,
      templatePath: (configResult.templatePath as { data: TemplatePath }).data,
      outputPath: (configResult.outputPath as { data: OutputPath }).data,
      options: {
        parallel: options.isParallel(),
        maxConcurrency: options.getMaxConcurrency(),
        continueOnError: options.shouldContinueOnError(),
      },
    };

    // Execute use case
    const useCase = new ProcessDocumentsUseCase(
      documentRepo,
      schemaRepo,
      templateRepo,
      resultRepo,
      frontMatterExtractor,
      schemaAnalyzer,
      templateMapper,
      resultAggregator,
    );

    const result = await useCase.execute({ config });

    // Assertions
    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.processedCount, 3);
      assertEquals(result.data.failedCount, 0);
      assertEquals(result.data.outputPath, "output.json");
      assertEquals(result.data.errors.length, 0);
    }

    // Verify saved results
    const savedData = resultRepo.getSavedData();
    assertExists(savedData);
    assertEquals(savedData.getResults().length, 3);
    assertEquals(savedData.getFormat(), "json");
  });

  await t.step("Pipeline with processing errors", async () => {
    // Add document without frontmatter
    const documentsWithError = [
      ...createTestDocuments(),
      {
        path: "/test/docs/no-frontmatter.md",
        content: "# Just Content\n\nNo frontmatter here.",
      },
    ];

    const documentRepo = new MockDocumentRepository(documentsWithError);
    const schemaRepo = new MockSchemaRepository(createTestSchema());
    const template = createTestTemplate();
    const templateRepo = new MockTemplateRepository(
      template.format,
      template.content,
      template.mappingRules,
    );
    const resultRepo = new MockResultRepository();

    const configResult = {
      documentsPath: DocumentPath.create("/test/docs/dummy.md"),
      schemaPath: ConfigPath.create("schema.json"),
      templatePath: TemplatePath.create("template.json"),
      outputPath: OutputPath.create("output.json"),
      options: ProcessingOptions.create({
        parallel: false,
        continueOnError: true, // Continue despite errors
      }),
    };

    const options = (configResult.options as { data: ProcessingOptions }).data;
    const config: ProcessingConfiguration = {
      documentsPath: (configResult.documentsPath as { data: DocumentPath })
        .data,
      schemaPath: (configResult.schemaPath as { data: ConfigPath }).data,
      templatePath: (configResult.templatePath as { data: TemplatePath }).data,
      outputPath: (configResult.outputPath as { data: OutputPath }).data,
      options: {
        parallel: options.isParallel(),
        maxConcurrency: options.getMaxConcurrency(),
        continueOnError: options.shouldContinueOnError(),
      },
    };

    const useCase = new ProcessDocumentsUseCase(
      documentRepo,
      schemaRepo,
      templateRepo,
      resultRepo,
      new MockFrontMatterExtractor(),
      new MockSchemaAnalyzer(),
      new MockTemplateMapper(),
      new MockResultAggregator(),
    );

    const result = await useCase.execute({ config });

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.processedCount, 3); // 3 successful
      assertEquals(result.data.failedCount, 1); // 1 failed
      assertEquals(result.data.errors.length, 1);
      assertEquals(
        result.data.errors[0].document,
        "/test/docs/no-frontmatter.md",
      );
    }
  });

  await t.step("Parallel processing mode", async () => {
    const documents = createTestDocuments();
    const documentRepo = new MockDocumentRepository(documents);
    const schemaRepo = new MockSchemaRepository(createTestSchema());
    const template = createTestTemplate();
    const templateRepo = new MockTemplateRepository(
      template.format,
      template.content,
      template.mappingRules,
    );
    const resultRepo = new MockResultRepository();

    const configResult = {
      documentsPath: DocumentPath.create("/test/docs/dummy.md"),
      schemaPath: ConfigPath.create("schema.json"),
      templatePath: TemplatePath.create("template.json"),
      outputPath: OutputPath.create("output.json"),
      options: ProcessingOptions.create({
        parallel: true, // Enable parallel processing
        maxConcurrency: 2,
        continueOnError: false,
      }),
    };

    const options = (configResult.options as { data: ProcessingOptions }).data;
    const config: ProcessingConfiguration = {
      documentsPath: (configResult.documentsPath as { data: DocumentPath })
        .data,
      schemaPath: (configResult.schemaPath as { data: ConfigPath }).data,
      templatePath: (configResult.templatePath as { data: TemplatePath }).data,
      outputPath: (configResult.outputPath as { data: OutputPath }).data,
      options: {
        parallel: options.isParallel(),
        maxConcurrency: options.getMaxConcurrency(),
        continueOnError: options.shouldContinueOnError(),
      },
    };

    const useCase = new ProcessDocumentsUseCase(
      documentRepo,
      schemaRepo,
      templateRepo,
      resultRepo,
      new MockFrontMatterExtractor(),
      new MockSchemaAnalyzer(),
      new MockTemplateMapper(),
      new MockResultAggregator(),
    );

    const startTime = performance.now();
    const result = await useCase.execute({ config });
    const duration = performance.now() - startTime;

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data.processedCount, 3);
      assertEquals(result.data.failedCount, 0);
      console.log(
        `Parallel processing completed in ${duration.toFixed(2)}ms`,
      );
    }
  });

  await t.step("Stop on first error mode", async () => {
    const documentsWithErrors = [
      {
        path: "/test/docs/good1.md",
        content: `---
title: "Good Article"
author: "Author"
tags: ["test"]
---
Content`,
      },
      {
        path: "/test/docs/bad.md",
        content: "No frontmatter",
      },
      {
        path: "/test/docs/good2.md",
        content: `---
title: "Another Good"
author: "Author"
tags: ["test"]
---
Content`,
      },
    ];

    const documentRepo = new MockDocumentRepository(documentsWithErrors);
    const schemaRepo = new MockSchemaRepository(createTestSchema());
    const template = createTestTemplate();
    const templateRepo = new MockTemplateRepository(
      template.format,
      template.content,
      template.mappingRules,
    );
    const resultRepo = new MockResultRepository();

    const configResult = {
      documentsPath: DocumentPath.create("/test/docs/dummy.md"),
      schemaPath: ConfigPath.create("schema.json"),
      templatePath: TemplatePath.create("template.json"),
      outputPath: OutputPath.create("output.json"),
      options: ProcessingOptions.create({
        parallel: false,
        continueOnError: false, // Stop on first error
      }),
    };

    const options = (configResult.options as { data: ProcessingOptions }).data;
    const config: ProcessingConfiguration = {
      documentsPath: (configResult.documentsPath as { data: DocumentPath })
        .data,
      schemaPath: (configResult.schemaPath as { data: ConfigPath }).data,
      templatePath: (configResult.templatePath as { data: TemplatePath }).data,
      outputPath: (configResult.outputPath as { data: OutputPath }).data,
      options: {
        parallel: options.isParallel(),
        maxConcurrency: options.getMaxConcurrency(),
        continueOnError: options.shouldContinueOnError(),
      },
    };

    const useCase = new ProcessDocumentsUseCase(
      documentRepo,
      schemaRepo,
      templateRepo,
      resultRepo,
      new MockFrontMatterExtractor(),
      new MockSchemaAnalyzer(),
      new MockTemplateMapper(),
      new MockResultAggregator(),
    );

    const result = await useCase.execute({ config });

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      // Should stop after encountering the bad document
      assertEquals(result.data.processedCount, 1); // Only first good doc
      assertEquals(result.data.failedCount, 1); // The bad doc
      assertEquals(result.data.errors.length, 1);
      // Third document should not be processed due to early stop
    }
  });

  await t.step("Configuration validation", async () => {
    // Test with invalid schema repository (returns error)
    const documentRepo = new MockDocumentRepository(createTestDocuments());
    const schemaRepo = new MockSchemaRepository(null); // Will fail to load
    const template = createTestTemplate();
    const templateRepo = new MockTemplateRepository(
      template.format,
      template.content,
      template.mappingRules,
    );
    const resultRepo = new MockResultRepository();

    const configResult = {
      documentsPath: DocumentPath.create("/test/docs/dummy.md"),
      schemaPath: ConfigPath.create("schema.json"),
      templatePath: TemplatePath.create("template.json"),
      outputPath: OutputPath.create("output.json"),
      options: ProcessingOptions.create({}),
    };

    const options = (configResult.options as { data: ProcessingOptions }).data;
    const config: ProcessingConfiguration = {
      documentsPath: (configResult.documentsPath as { data: DocumentPath })
        .data,
      schemaPath: (configResult.schemaPath as { data: ConfigPath }).data,
      templatePath: (configResult.templatePath as { data: TemplatePath }).data,
      outputPath: (configResult.outputPath as { data: OutputPath }).data,
      options: {
        parallel: options.isParallel(),
        maxConcurrency: options.getMaxConcurrency(),
        continueOnError: options.shouldContinueOnError(),
      },
    };

    const useCase = new ProcessDocumentsUseCase(
      documentRepo,
      schemaRepo,
      templateRepo,
      resultRepo,
      new MockFrontMatterExtractor(),
      new MockSchemaAnalyzer(),
      new MockTemplateMapper(),
      new MockResultAggregator(),
    );

    const result = await useCase.execute({ config });

    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error.kind, "ReadError");
    }
  });
});
