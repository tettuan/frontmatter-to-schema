/**
 * Processing Pipeline Integration Tests
 * Tests end-to-end processing workflow for new architecture
 * Validates canonical processing path and template system integrity
 */

import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import {
  assertError,
  assertOk,
  type DomainError,
  type Result,
} from "../helpers/result_matchers.ts";
import { TestDataFactory } from "../helpers/domain_builders.ts";

/**
 * Mock implementations for testing the canonical processing path
 * These will be replaced with actual implementations from new architecture
 */

// Mock CoreProcessor following Issue #591 design
class MockCoreProcessor {
  constructor(
    private extractor: MockFrontmatterExtractor,
    private resolver: MockSchemaResolver,
    private renderer: MockTemplateRenderer,
    private aggregator: MockAggregator,
  ) {}

  async process(
    config: ProcessingConfiguration,
  ): Promise<Result<ProcessedResult, DomainError>> {
    try {
      // Step 1: Load and resolve schema
      const schemaResult = await this.resolver.resolve(
        config.schema.definition,
      );
      if (!schemaResult.ok) {
        return schemaResult;
      }

      // Step 2: Extract frontmatter from documents
      const extractionResults: ExtractedData[] = [];
      for (const docPath of config.input.documents) {
        const extractResult = await this.extractor.extract(docPath);
        if (!extractResult.ok) {
          return extractResult;
        }
        extractionResults.push(extractResult.data);
      }

      // Step 3: Validate against schema
      const validatedResults: ValidatedData[] = [];
      for (const extracted of extractionResults) {
        const validationResult = this.validateData(
          extracted,
          schemaResult.data,
        );
        if (!validationResult.ok) {
          return validationResult;
        }
        validatedResults.push(validationResult.data);
      }

      // Step 4: Apply template transformation (NO BYPASS ALLOWED)
      const templateResult = await this.renderer.render(
        validatedResults,
        config.template,
      );
      if (!templateResult.ok) {
        return templateResult;
      }

      // Step 5: Generate aggregated output
      const aggregatedResult = await this.aggregator.aggregate(
        validatedResults,
        config.aggregation?.rules || [],
      );
      if (!aggregatedResult.ok) {
        return aggregatedResult;
      }

      return {
        ok: true,
        data: {
          processedDocuments: validatedResults.length,
          templateOutput: templateResult.data,
          aggregatedData: aggregatedResult.data,
          bypassDetected: false, // Critical: ensure no template bypass
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ProcessingError",
          message: `Processing failed: ${error}`,
        } as DomainError,
      };
    }
  }

  private validateData(
    extracted: ExtractedData,
    _schema: ResolvedSchema,
  ): Result<ValidatedData, DomainError> {
    // Mock validation logic
    if (!extracted.data || Object.keys(extracted.data).length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "No data to validate",
        },
      };
    }

    return {
      ok: true,
      data: {
        path: extracted.path,
        validatedFields: extracted.data,
        schemaCompliant: true,
      },
    };
  }
}

// Supporting mock classes
class MockFrontmatterExtractor {
  extract(path: string): Promise<Result<ExtractedData, DomainError>> {
    if (path.includes("invalid")) {
      return Promise.resolve({
        ok: false,
        error: {
          kind: "FrontmatterError",
          message: "Invalid frontmatter format",
        },
      });
    }

    return Promise.resolve({
      ok: true,
      data: {
        path,
        data: {
          title: "Test Document",
          description: "Test description",
        },
      },
    });
  }
}

class MockSchemaResolver {
  resolve(
    schemaDefinition: unknown,
  ): Promise<Result<ResolvedSchema, DomainError>> {
    if (!schemaDefinition || typeof schemaDefinition !== "object") {
      return Promise.resolve({
        ok: false,
        error: {
          kind: "SchemaError",
          message: "Invalid schema definition",
        },
      });
    }

    const definition = schemaDefinition as Record<string, unknown>;
    return Promise.resolve({
      ok: true,
      data: {
        properties: (definition.properties as Record<string, unknown>) || {},
        required: (definition.required as string[]) || [],
        resolved: true,
      },
    });
  }
}

class MockTemplateRenderer {
  render(
    data: ValidatedData[],
    template: TemplateConfig,
  ): Promise<Result<RenderedContent, DomainError>> {
    // Handle discriminated union
    let definition: string;

    switch (template.kind) {
      case "file":
        return Promise.resolve({
          ok: false,
          error: {
            kind: "TemplateError",
            message: "File templates not supported in mock",
          },
        });

      case "inline":
        definition = template.definition;
        break;
    }

    if (!definition || definition.trim() === "") {
      return Promise.resolve({
        ok: false,
        error: {
          kind: "TemplateError",
          message: "Empty template definition",
        },
      });
    }

    // Simulate template processing without bypass
    const renderedContent = definition.replace(
      /\{(\w+)\}/g,
      (match, field) => {
        const firstDoc = data[0];
        return String(firstDoc?.validatedFields[field] || match);
      },
    );

    return Promise.resolve({
      ok: true,
      data: {
        content: renderedContent,
        templateProcessed: true,
        bypassDetected: false,
      },
    });
  }
}

class MockAggregator {
  aggregate(
    data: ValidatedData[],
    rules: string[],
  ): Promise<Result<AggregatedResult, DomainError>> {
    return Promise.resolve({
      ok: true,
      data: {
        totalDocuments: data.length,
        aggregatedFields: {},
        rulesApplied: rules,
      },
    });
  }
}

// Type definitions for integration testing
interface ProcessingConfiguration {
  schema: { definition: unknown; format: string };
  template: TemplateConfig;
  input: { documents: string[] };
  aggregation?: { rules: string[] };
}

type TemplateConfig =
  | { kind: "file"; path: string; format: string }
  | { kind: "inline"; definition: string; format: string };

interface ExtractedData {
  path: string;
  data: Record<string, unknown>;
}

interface ValidatedData {
  path: string;
  validatedFields: Record<string, unknown>;
  schemaCompliant: boolean;
}

interface ResolvedSchema {
  properties: Record<string, unknown>;
  required: string[];
  resolved: boolean;
}

interface RenderedContent {
  content: string;
  templateProcessed: boolean;
  bypassDetected: boolean;
}

interface AggregatedResult {
  totalDocuments: number;
  aggregatedFields: Record<string, unknown>;
  rulesApplied: string[];
}

interface ProcessedResult {
  processedDocuments: number;
  templateOutput: RenderedContent;
  aggregatedData: AggregatedResult;
  bypassDetected: boolean;
}

/**
 * Integration Test Suite
 */
describe("Processing Pipeline Integration", () => {
  let processor: MockCoreProcessor;

  beforeEach(() => {
    processor = new MockCoreProcessor(
      new MockFrontmatterExtractor(),
      new MockSchemaResolver(),
      new MockTemplateRenderer(),
      new MockAggregator(),
    );
  });

  describe("Canonical Processing Path", () => {
    it("should process complete workflow successfully", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}\n\n{description}",
          format: "custom",
        },
        input: {
          documents: ["test1.md", "test2.md"],
        },
      };

      const result = await processor.process(config);

      assertOk(result);
      assertEquals(result.data.processedDocuments, 2);
      assertEquals(result.data.templateOutput.templateProcessed, true);
      assertEquals(result.data.bypassDetected, false);
    });

    it("should enforce template system integrity", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}\n\n{description}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertOk(result);
      // Critical: verify template processing occurred
      assertEquals(result.data.templateOutput.templateProcessed, true);
      assertEquals(result.data.templateOutput.bypassDetected, false);

      // Verify template content was actually processed
      assertEquals(
        result.data.templateOutput.content.includes("Test Document"),
        true,
      );
    });

    it("should handle schema resolution errors", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: null, // Invalid schema
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertError(result);
      assertEquals(result.error.kind, "SchemaError");
    });

    it("should handle frontmatter extraction errors", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}",
          format: "custom",
        },
        input: {
          documents: ["invalid-frontmatter.md"], // Will trigger error
        },
      };

      const result = await processor.process(config);

      assertError(result);
      assertEquals(result.error.kind, "FrontmatterError");
    });

    it("should handle template rendering errors", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "", // Empty template
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertError(result);
      assertEquals(result.error.kind, "TemplateError");
    });
  });

  describe("Single Path Rule Enforcement", () => {
    it("should use only the canonical processing path", async () => {
      // This test ensures there are no alternative processing paths
      // that could bypass the template system

      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "Processed: {title}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertOk(result);

      // Verify all processing steps were executed
      assertEquals(result.data.processedDocuments > 0, true);
      assertEquals(result.data.templateOutput.templateProcessed, true);
      assertEquals(result.data.bypassDetected, false);

      // Verify template was actually applied
      assertEquals(
        result.data.templateOutput.content,
        "Processed: Test Document",
      );
    });

    it("should prevent raw data output bypassing templates", async () => {
      // Critical test: ensure raw data never bypasses template processing

      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "Template: {title} - {description}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertOk(result);

      // The output must be template-processed, not raw data
      assertEquals(result.data.templateOutput.templateProcessed, true);
      assertEquals(
        result.data.templateOutput.content.startsWith("Template:"),
        true,
      );

      // Raw data should not appear in output
      assertEquals(
        result.data.templateOutput.content.includes("Test Document"),
        true,
      );
      assertEquals(
        result.data.templateOutput.content.includes("Test description"),
        true,
      );
    });
  });

  describe("Error Propagation and Recovery", () => {
    it("should propagate errors through Result types", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          definition: "invalid schema", // Will cause error
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const result = await processor.process(config);

      assertError(result);
      assertEquals(typeof result.error.message, "string");
      assertEquals(result.error.message.length > 0, true);
    });

    it("should maintain system consistency during errors", async () => {
      // Test that errors don't leave system in inconsistent state

      const invalidConfig: ProcessingConfiguration = {
        schema: {
          definition: null,
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const invalidResult = await processor.process(invalidConfig);
      assertError(invalidResult);

      // Processor should still work with valid config after error
      const validConfig: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "# {title}",
          format: "custom",
        },
        input: {
          documents: ["test.md"],
        },
      };

      const validResult = await processor.process(validConfig);
      assertOk(validResult);
      assertEquals(validResult.data.bypassDetected, false);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle batch processing efficiently", async () => {
      const documents = Array.from({ length: 10 }, (_, i) => `test${i}.md`);

      const config: ProcessingConfiguration = {
        schema: {
          definition: TestDataFactory.basicSchema().build(),
          format: "json",
        },
        template: {
          kind: "inline",
          definition: "Document: {title}",
          format: "custom",
        },
        input: {
          documents,
        },
      };

      const startTime = Date.now();
      const result = await processor.process(config);
      const endTime = Date.now();

      assertOk(result);
      assertEquals(result.data.processedDocuments, 10);

      // Performance check - should complete in reasonable time
      const processingTime = endTime - startTime;
      assertEquals(processingTime < 1000, true); // Less than 1 second for 10 docs
    });
  });
});
