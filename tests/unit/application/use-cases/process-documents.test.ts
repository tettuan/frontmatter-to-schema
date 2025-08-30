/**
 * Comprehensive tests for ProcessDocumentsUseCase
 * Addressing critical test coverage gap (5.4% -> 100%)
 * Issue #401: Critical test coverage improvements
 */

import { assert, assertEquals } from "jsr:@std/assert";
import {
  ProcessDocumentsUseCase,
} from "../../../../src/application/use-cases/process-documents.ts";
import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../../../src/domain/core/result.ts";
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
} from "../../../../src/domain/models/entities.ts";
import {
  ConfigPath,
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  type MappingRule,
  OutputPath,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
  TemplatePath,
} from "../../../../src/domain/models/value-objects.ts";
import type {
  DocumentRepository,
  FrontMatterExtractionResult,
  FrontMatterExtractor,
  ProcessingConfiguration,
  ResultAggregator,
  ResultRepository,
  SchemaAnalyzer,
  SchemaRepository,
  SchemaValidationMode,
  TemplateMapper,
  TemplateRepository,
} from "../../../../src/domain/services/interfaces.ts";

// Mock implementations
class MockDocumentRepository implements DocumentRepository {
  public documents = new Map<string, Document>();
  private shouldFail = false;

  setDocuments(documents: Document[]): void {
    this.documents.clear();
    for (const doc of documents) {
      this.documents.set(doc.getPath().getValue(), doc);
    }
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.documents.clear();
    this.shouldFail = false;
  }

  findAll(
    path: DocumentPath,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      data: Array.from(this.documents.values()),
    });
  }

  findByPattern(
    _pattern: string,
    basePath?: string,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    const pathResult = DocumentPath.create(basePath || ".");
    if (!pathResult.ok) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "InvalidPath",
          path: basePath || ".",
        }),
      });
    }
    return this.findAll(pathResult.data);
  }

  read(
    path: DocumentPath,
  ): Promise<Result<Document, DomainError & { message: string }>> {
    const doc = this.documents.get(path.getValue());
    if (!doc) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    return Promise.resolve({ ok: true, data: doc });
  }
}

class MockSchemaRepository implements SchemaRepository {
  private shouldFail = false;
  private mockSchema?: Schema;

  setSchema(schema: Schema): void {
    this.mockSchema = schema;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.mockSchema = undefined;
    this.shouldFail = false;
  }

  load(
    path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    if (!this.mockSchema) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    return Promise.resolve({ ok: true, data: this.mockSchema });
  }

  validate(_schema: Schema): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }
}

class MockTemplateRepository implements TemplateRepository {
  private shouldFail = false;
  private mockTemplate?: Template;

  setTemplate(template: Template): void {
    this.mockTemplate = template;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.mockTemplate = undefined;
    this.shouldFail = false;
  }

  load(
    templateId: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: templateId,
        }),
      });
    }
    if (!this.mockTemplate) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: templateId,
        }),
      });
    }
    return Promise.resolve({ ok: true, data: this.mockTemplate });
  }

  loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    if (!this.mockTemplate) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "FileNotFound",
          path: path.getValue(),
        }),
      });
    }
    return Promise.resolve({ ok: true, data: this.mockTemplate });
  }

  save(
    _template: Template,
  ): Promise<Result<void, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: "template",
          details: "Mock save failure",
        }),
      });
    }
    return Promise.resolve({ ok: true, data: undefined });
  }

  exists(_templateId: string): Promise<boolean> {
    return Promise.resolve(this.mockTemplate !== undefined);
  }

  list(): Promise<Result<string[], DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: "templates",
          details: "Mock list failure",
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      data: this.mockTemplate ? ["test-template"] : [],
    });
  }

  validate(
    _template: Template,
  ): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }
}

class MockResultRepository implements ResultRepository {
  private shouldFail = false;
  private savedResults: AggregatedResult[] = [];

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  getSavedResults(): AggregatedResult[] {
    return [...this.savedResults];
  }

  clear(): void {
    this.savedResults = [];
    this.shouldFail = false;
  }

  save(
    _result: AggregatedResult,
    _path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: _path.getValue(),
          details: "Failed to save results",
        }),
      });
    }
    this.savedResults.push(_result);
    return Promise.resolve({ ok: true, data: undefined });
  }

  append(
    _result: AnalysisResult,
    _path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    return Promise.resolve({ ok: true, data: undefined });
  }
}

class MockFrontMatterExtractor implements FrontMatterExtractor {
  private shouldFail = false;
  private extractionResult: FrontMatterExtractionResult = {
    kind: "NotPresent",
  };

  setExtractionResult(result: FrontMatterExtractionResult): void {
    this.extractionResult = result;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.extractionResult = { kind: "NotPresent" };
    this.shouldFail = false;
  }

  extract(
    document: Document,
  ): Result<FrontMatterExtractionResult, DomainError & { message: string }> {
    if (this.shouldFail) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "frontmatter",
          input: document.getPath().getValue(),
        }),
      };
    }
    return { ok: true, data: this.extractionResult };
  }
}

class MockSchemaAnalyzer implements SchemaAnalyzer {
  private shouldFail = false;
  private mockData = ExtractedData.create({ name: "test", value: 42 });

  setMockData(data: ExtractedData): void {
    this.mockData = data;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.mockData = ExtractedData.create({ name: "test", value: 42 });
    this.shouldFail = false;
  }

  analyze(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>> {
    if (this.shouldFail) {
      return Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: _schema.getDefinition().getValue(),
          data: frontMatter.toObject(),
        }),
      });
    }
    return Promise.resolve({ ok: true, data: this.mockData });
  }
}

class MockTemplateMapper implements TemplateMapper {
  private shouldFail = false;
  private mockData = MappedData.create({ output: "test result" });

  setMockData(data: MappedData): void {
    this.mockData = data;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.mockData = MappedData.create({ output: "test result" });
    this.shouldFail = false;
  }

  map(
    data: ExtractedData,
    template: Template,
    _schemaMode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    if (this.shouldFail) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template.getFormat(),
          source: data.getData(),
        }),
      };
    }
    return { ok: true, data: this.mockData };
  }

  async mapWithOrchestrator(
    _frontMatter: FrontMatterContent,
    _schema: Schema,
    _template: Template,
  ): Promise<Result<MappedData, DomainError & { message: string }>> {
    // Mock implementation - fallback to legacy behavior for tests
    if (this.shouldFail) {
      return await Promise.resolve({
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: "orchestrator",
          details: "TypeScriptAnalysisOrchestrator not configured",
        }),
      });
    }
    return await Promise.resolve({ ok: true, data: this.mockData });
  }
}

class MockResultAggregator implements ResultAggregator {
  private shouldFail = false;
  private mockResult?: AggregatedResult;

  setMockResult(result: AggregatedResult): void {
    this.mockResult = result;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  clear(): void {
    this.mockResult = undefined;
    this.shouldFail = false;
  }

  aggregate(
    results: AnalysisResult[],
  ): Result<AggregatedResult, DomainError & { message: string }> {
    if (this.shouldFail) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config: "aggregation failed",
        }),
      };
    }
    return {
      ok: true,
      data: this.mockResult || AggregatedResult.create(results),
    };
  }
}

// Helper functions
function createMockDocument(path: string, hasFrontMatter = true): Document {
  const docPathResult = DocumentPath.create(path);
  if (!docPathResult.ok) throw new Error(`Failed to create path: ${path}`);
  const docPath = docPathResult.data;

  const contentResult = DocumentContent.create("# Test content");
  if (!contentResult.ok) throw new Error("Failed to create content");
  const content = contentResult.data;

  let frontMatter: FrontMatter | null = null;
  if (hasFrontMatter) {
    const fmContentResult = FrontMatterContent.create(
      "title: Test\ntags: [test]",
    );
    if (!fmContentResult.ok) {
      throw new Error("Failed to create front matter content");
    }
    const fmContent = fmContentResult.data;
    frontMatter = FrontMatter.create(fmContent, "title: Test\ntags: [test]");
  }

  return Document.createWithFrontMatter(docPath, frontMatter, content);
}

function createMockSchema(): Schema {
  const schemaIdResult = SchemaId.create("test-schema");
  if (!schemaIdResult.ok) throw new Error("Failed to create schema ID");
  const schemaId = schemaIdResult.data;

  const definitionResult = SchemaDefinition.create({
    type: "object",
    properties: {},
  });
  if (!definitionResult.ok) {
    throw new Error("Failed to create schema definition");
  }
  const definition = definitionResult.data;

  const versionResult = SchemaVersion.create("1.0.0");
  if (!versionResult.ok) throw new Error("Failed to create schema version");
  const version = versionResult.data;

  return Schema.create(schemaId, definition, version, "Test schema");
}

function createMockTemplate(): Template {
  const templateIdResult = TemplateId.create("test-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template ID");
  const templateId = templateIdResult.data;

  const formatResult = TemplateFormat.create("handlebars", "{{ name }}");
  if (!formatResult.ok) throw new Error("Failed to create template format");
  const format = formatResult.data;

  const rules: MappingRule[] = [];
  return Template.createLegacy(templateId, format, rules, "Test template");
}

function createMockConfig(
  options: Partial<ProcessingConfiguration["options"]> = {},
): ProcessingConfiguration {
  const documentsPathResult = DocumentPath.create("./docs");
  if (!documentsPathResult.ok) {
    throw new Error("Failed to create documents path");
  }

  const schemaPathResult = ConfigPath.create("./schema.json");
  if (!schemaPathResult.ok) throw new Error("Failed to create schema path");

  const templatePathResult = TemplatePath.create("./template.json");
  if (!templatePathResult.ok) throw new Error("Failed to create template path");

  const outputPathResult = OutputPath.create("./output.json");
  if (!outputPathResult.ok) throw new Error("Failed to create output path");

  return {
    documentsPath: documentsPathResult.data,
    schemaPath: schemaPathResult.data,
    templatePath: templatePathResult.data,
    outputPath: outputPathResult.data,
    options: {
      parallel: options.parallel ?? false,
      maxConcurrency: options.maxConcurrency ?? 1,
      continueOnError: options.continueOnError ?? false,
    },
  };
}

function createValidFrontMatter(): FrontMatter {
  const fmContentResult = FrontMatterContent.create("title: Test");
  if (!fmContentResult.ok) {
    throw new Error("Failed to create front matter content");
  }
  return FrontMatter.create(fmContentResult.data, "title: Test");
}

Deno.test("ProcessDocumentsUseCase", async (t) => {
  let mockDocumentRepo: MockDocumentRepository;
  let mockSchemaRepo: MockSchemaRepository;
  let mockTemplateRepo: MockTemplateRepository;
  let mockResultRepo: MockResultRepository;
  let mockFrontMatterExtractor: MockFrontMatterExtractor;
  let mockSchemaAnalyzer: MockSchemaAnalyzer;
  let mockTemplateMapper: MockTemplateMapper;
  let mockResultAggregator: MockResultAggregator;
  let useCase: ProcessDocumentsUseCase;

  const setupMocks = () => {
    mockDocumentRepo = new MockDocumentRepository();
    mockSchemaRepo = new MockSchemaRepository();
    mockTemplateRepo = new MockTemplateRepository();
    mockResultRepo = new MockResultRepository();
    mockFrontMatterExtractor = new MockFrontMatterExtractor();
    mockSchemaAnalyzer = new MockSchemaAnalyzer();
    mockTemplateMapper = new MockTemplateMapper();
    mockResultAggregator = new MockResultAggregator();

    useCase = new ProcessDocumentsUseCase(
      mockDocumentRepo,
      mockSchemaRepo,
      mockTemplateRepo,
      mockResultRepo,
      mockFrontMatterExtractor,
      mockSchemaAnalyzer,
      mockTemplateMapper,
      mockResultAggregator,
    );
  };

  await t.step(
    "should successfully process documents with valid inputs",
    async () => {
      setupMocks();

      const config = createMockConfig();
      const schema = createMockSchema();
      const template = createMockTemplate();
      const document = createMockDocument("test.md");
      const frontMatter = createValidFrontMatter();

      mockSchemaRepo.setSchema(schema);
      mockTemplateRepo.setTemplate(template);
      mockDocumentRepo.setDocuments([document]);
      mockFrontMatterExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: frontMatter,
      });

      const result = await useCase.execute({ config });

      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedCount, 1);
        assertEquals(result.data.failedCount, 0);
        assertEquals(result.data.outputPath, config.outputPath.getValue());
        assertEquals(result.data.errors.length, 0);
      }
    },
  );

  await t.step("should handle schema loading failure", async () => {
    setupMocks();

    const config = createMockConfig();
    mockSchemaRepo.setFailure(true);

    const result = await useCase.execute({ config });

    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "ReadError");
      if (result.error.kind === "ReadError") {
        assertEquals(result.error.path, config.schemaPath.getValue());
      }
    }
  });

  await t.step("should handle template loading failure", async () => {
    setupMocks();

    const config = createMockConfig();
    const schema = createMockSchema();
    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setFailure(true);

    const result = await useCase.execute({ config });

    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "ReadError");
      if (result.error.kind === "ReadError") {
        assertEquals(result.error.path, config.templatePath.getValue());
      }
    }
  });

  await t.step("should handle document discovery failure", async () => {
    setupMocks();

    const config = createMockConfig();
    const schema = createMockSchema();
    const template = createMockTemplate();

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setFailure(true);

    const result = await useCase.execute({ config });

    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "ReadError");
      if (result.error.kind === "ReadError") {
        assertEquals(result.error.path, config.documentsPath.getValue());
      }
    }
  });

  await t.step("should handle no documents found gracefully", async () => {
    setupMocks();

    const config = createMockConfig();
    const schema = createMockSchema();
    const template = createMockTemplate();

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([]);

    const result = await useCase.execute({ config });

    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.processedCount, 0);
      assertEquals(result.data.failedCount, 0);
      assertEquals(result.data.outputPath, config.outputPath.getValue());
      assertEquals(result.data.errors.length, 0);
    }
  });

  await t.step(
    "should process documents sequentially when parallel=false",
    async () => {
      setupMocks();

      const config = createMockConfig({ parallel: false });
      const schema = createMockSchema();
      const template = createMockTemplate();
      const documents = [
        createMockDocument("doc1.md"),
        createMockDocument("doc2.md"),
      ];
      const frontMatter = createValidFrontMatter();

      mockSchemaRepo.setSchema(schema);
      mockTemplateRepo.setTemplate(template);
      mockDocumentRepo.setDocuments(documents);
      mockFrontMatterExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: frontMatter,
      });

      const result = await useCase.execute({ config });

      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedCount, 2);
        assertEquals(result.data.failedCount, 0);
      }
    },
  );

  await t.step(
    "should process documents in parallel when parallel=true",
    async () => {
      setupMocks();

      const config = createMockConfig({ parallel: true, maxConcurrency: 2 });
      const schema = createMockSchema();
      const template = createMockTemplate();
      const documents = [
        createMockDocument("doc1.md"),
        createMockDocument("doc2.md"),
      ];
      const frontMatter = createValidFrontMatter();

      mockSchemaRepo.setSchema(schema);
      mockTemplateRepo.setTemplate(template);
      mockDocumentRepo.setDocuments(documents);
      mockFrontMatterExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: frontMatter,
      });

      const result = await useCase.execute({ config });

      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedCount, 2);
        assertEquals(result.data.failedCount, 0);
      }
    },
  );

  await t.step("should handle frontmatter extraction failure", async () => {
    setupMocks();

    const config = createMockConfig({ continueOnError: true });
    const schema = createMockSchema();
    const template = createMockTemplate();
    const document = createMockDocument("test.md");

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([document]);
    mockFrontMatterExtractor.setFailure(true);

    const result = await useCase.execute({ config });

    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.processedCount, 0);
      assertEquals(result.data.failedCount, 1);
      assertEquals(result.data.errors.length, 1);
      assert(result.data.errors[0].document.includes("test.md"));
    }
  });

  await t.step("should handle documents with no frontmatter", async () => {
    setupMocks();

    const config = createMockConfig({ continueOnError: true });
    const schema = createMockSchema();
    const template = createMockTemplate();
    const document = createMockDocument("test.md");

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([document]);
    mockFrontMatterExtractor.setExtractionResult({ kind: "NotPresent" });

    const result = await useCase.execute({ config });

    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.processedCount, 0);
      assertEquals(result.data.failedCount, 1);
      assertEquals(result.data.errors.length, 1);
      assert(result.data.errors[0].error.includes("Extraction strategy"));
    }
  });

  await t.step("should handle result aggregation failure", async () => {
    setupMocks();

    const config = createMockConfig();
    const schema = createMockSchema();
    const template = createMockTemplate();
    const document = createMockDocument("test.md");
    const frontMatter = createValidFrontMatter();

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([document]);
    mockFrontMatterExtractor.setExtractionResult({
      kind: "Extracted",
      frontMatter: frontMatter,
    });
    mockResultAggregator.setFailure(true);

    const result = await useCase.execute({ config });

    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "ConfigurationError");
    }
  });

  await t.step("should handle result saving failure", async () => {
    setupMocks();

    const config = createMockConfig();
    const schema = createMockSchema();
    const template = createMockTemplate();
    const document = createMockDocument("test.md");
    const frontMatter = createValidFrontMatter();

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([document]);
    mockFrontMatterExtractor.setExtractionResult({
      kind: "Extracted",
      frontMatter: frontMatter,
    });
    mockResultRepo.setFailure(true);

    const result = await useCase.execute({ config });

    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.error.kind, "WriteError");
      if (result.error.kind === "WriteError") {
        assertEquals(result.error.path, config.outputPath.getValue());
      }
    }
  });

  await t.step(
    "should stop processing on first error when continueOnError=false",
    async () => {
      setupMocks();

      const config = createMockConfig({
        continueOnError: false,
        parallel: false,
      });
      const schema = createMockSchema();
      const template = createMockTemplate();
      const documents = [
        createMockDocument("doc1.md"),
        createMockDocument("doc2.md"),
        createMockDocument("doc3.md"),
      ];

      mockSchemaRepo.setSchema(schema);
      mockTemplateRepo.setTemplate(template);
      mockDocumentRepo.setDocuments(documents);
      mockFrontMatterExtractor.setFailure(true);

      const result = await useCase.execute({ config });

      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedCount, 0);
        assertEquals(result.data.failedCount, 1); // Should stop after first failure
        assertEquals(result.data.errors.length, 1);
      }
    },
  );

  await t.step("should work with verbose mode enabled", async () => {
    setupMocks();

    // Set environment variable for verbose mode
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");

    const config = createMockConfig();
    const schema = createMockSchema();
    const template = createMockTemplate();
    const document = createMockDocument("test.md");
    const frontMatter = createValidFrontMatter();

    mockSchemaRepo.setSchema(schema);
    mockTemplateRepo.setTemplate(template);
    mockDocumentRepo.setDocuments([document]);
    mockFrontMatterExtractor.setExtractionResult({
      kind: "Extracted",
      frontMatter: frontMatter,
    });

    const result = await useCase.execute({ config });

    // Clean up environment
    Deno.env.delete("FRONTMATTER_VERBOSE_MODE");

    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.processedCount, 1);
      assertEquals(result.data.failedCount, 0);
    }
  });
});
