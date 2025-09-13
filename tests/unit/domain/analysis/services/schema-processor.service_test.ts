/**
 * SchemaAnalysisProcessor Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target - Schema Analysis Processor
 */

import { assertEquals, assertExists } from "@std/assert";
import { SchemaAnalysisProcessor } from "../../../../../src/domain/analysis/services/schema-processor.service.ts";
import type {
  AnalysisContext,
  ProcessingResult as _ProcessingResult,
} from "../../../../../src/domain/core/abstractions.ts";
import type { TotalSchemaBasedAnalyzer } from "../../../../../src/domain/analysis/services/schema-analyzer.service.ts";
import type { TotalTemplateMapper } from "../../../../../src/domain/analysis/services/template-mapper.service.ts";
import type {
  DomainError,
  Result as _Result,
} from "../../../../../src/domain/core/result.ts";

// Test Types
interface TestInput {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface TestSchema {
  version: string;
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

interface TestOutput {
  processedId: string;
  processedContent: string;
  processedMetadata: Record<string, unknown>;
  template: string;
}

Deno.test("SchemaAnalysisProcessor - Robust Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step("should create processor with required dependencies", () => {
      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: () =>
          Promise.resolve({ ok: true, data: { analyzed: "data" } }),
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: () =>
          Promise.resolve({
            ok: true,
            data: {
              processedId: "test",
              processedContent: "mapped",
              processedMetadata: {},
              template: "result",
            },
          }),
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "test",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      assertExists(processor, "Processor instance should be created");
      assertEquals(
        typeof processor.process,
        "function",
        "Should have process method",
      );
      assertEquals(
        typeof processor.processMany,
        "function",
        "Should have processMany method",
      );
    });

    await t.step(
      "should accept analyzer, mapper, schema, and template in constructor",
      () => {
        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: () => Promise.resolve({ ok: true, data: {} }),
        };

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: () =>
            Promise.resolve({
              ok: true,
              data: {
                processedId: "",
                processedContent: "",
                processedMetadata: {},
                template: "",
              },
            }),
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "test",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "test",
          processedContent: "test",
          processedMetadata: {},
          template: "test",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        assertExists(
          processor,
          "Should create processor with all dependencies",
        );
      },
    );
  });

  await t.step("process Method - Successful Flow", async (t) => {
    await t.step(
      "should process input through analyzer and mapper successfully",
      async () => {
        const analysisResult = {
          id: "analyzed-123",
          content: "analyzed content",
          metadata: { analyzed: true },
        };

        const mappingResult: TestOutput = {
          processedId: "mapped-123",
          processedContent: "mapped content",
          processedMetadata: { mapped: true },
          template: "final result",
        };

        let analyzerInput: unknown;
        let analyzerSchema: TestSchema | undefined;
        let analyzerContext: AnalysisContext | undefined;

        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: (
            input: unknown,
            schema: TestSchema,
            context?: AnalysisContext,
          ) => {
            analyzerInput = input;
            analyzerSchema = schema;
            analyzerContext = context;
            return Promise.resolve({ ok: true, data: analysisResult });
          },
        };

        let mapperSource: unknown;
        let mapperTemplate: TestOutput | undefined;
        let mapperSchema: unknown;

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: (source: unknown, template: TestOutput, schema?: unknown) => {
            mapperSource = source;
            mapperTemplate = template;
            mapperSchema = schema;
            return Promise.resolve({ ok: true, data: mappingResult });
          },
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "object",
          properties: { content: { type: "string" } },
          required: ["content"],
        };

        const testTemplate: TestOutput = {
          processedId: "template-id",
          processedContent: "template content",
          processedMetadata: { template: true },
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInput: TestInput = {
          id: "input-123",
          content: "test content",
          metadata: { source: "test" },
        };

        const context: AnalysisContext = {
          sourceFile: "test.md",
          options: { mode: "strict" },
          metadata: new Map([["key", "value"]]),
        };

        const result = await processor.process(testInput, context);

        // Verify analyzer was called correctly
        assertEquals(analyzerInput, testInput, "Should pass input to analyzer");
        assertEquals(
          analyzerSchema,
          testSchema,
          "Should pass schema to analyzer",
        );
        assertEquals(
          analyzerContext,
          context,
          "Should pass context to analyzer",
        );

        // Verify mapper was called with analyzer result
        assertEquals(
          mapperSource,
          analysisResult,
          "Should pass analyzer result to mapper",
        );
        assertEquals(
          mapperTemplate,
          testTemplate,
          "Should pass template to mapper",
        );
        assertEquals(mapperSchema, testSchema, "Should pass schema to mapper");

        // Verify final result
        assertEquals(result.isValid, true, "Should return valid result");
        assertEquals(result.data, mappingResult, "Should return mapped result");
        assertEquals(result.errors.length, 0, "Should have no errors");
        assertExists(result.metadata, "Should include metadata");
      },
    );

    await t.step("should handle context with metadata properly", async () => {
      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: () =>
          Promise.resolve({ ok: true, data: { analyzed: "data" } }),
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: () =>
          Promise.resolve({
            ok: true,
            data: {
              processedId: "test",
              processedContent: "test",
              processedMetadata: {},
              template: "test",
            },
          }),
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "test",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const testInput: TestInput = {
        id: "metadata-test",
        content: "test",
        metadata: {},
      };

      const context: AnalysisContext = {
        metadata: new Map([
          ["process", "analysis"],
          ["timestamp", Date.now().toString()],
          ["version", "1.0.0"],
        ]),
      };

      const result = await processor.process(testInput, context);

      assertEquals(
        result.isValid,
        true,
        "Should process with metadata context",
      );
      assertEquals(
        result.metadata instanceof Map,
        true,
        "Should return Map metadata",
      );
      assertEquals(
        result.metadata.get("process"),
        "analysis",
        "Should preserve metadata",
      );
    });

    await t.step(
      "should use default empty context when none provided",
      async () => {
        let capturedContext: AnalysisContext | undefined;

        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: (
            _input: unknown,
            _schema: TestSchema,
            _context?: AnalysisContext,
          ) => {
            capturedContext = _context;
            return Promise.resolve({ ok: true, data: { analyzed: "data" } });
          },
        };

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: () =>
            Promise.resolve({
              ok: true,
              data: {
                processedId: "test",
                processedContent: "test",
                processedMetadata: {},
                template: "test",
              },
            }),
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "test",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "template",
          processedContent: "",
          processedMetadata: {},
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInput: TestInput = {
          id: "default-context-test",
          content: "test",
          metadata: {},
        };

        await processor.process(testInput); // No context provided

        assertEquals(
          capturedContext,
          {},
          "Should use empty object as default context",
        );
      },
    );
  });

  await t.step("process Method - Error Handling", async (t) => {
    await t.step("should handle analyzer failure gracefully", async () => {
      const analyzerError: DomainError & { message: string } = {
        kind: "AIServiceError",
        service: "analysis",
        message: "Analyzer failed to process input",
      };

      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: () => {
          return Promise.resolve({ ok: false, error: analyzerError });
        },
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: () =>
          Promise.resolve({
            ok: true,
            data: {
              processedId: "test",
              processedContent: "test",
              processedMetadata: {},
              template: "test",
            },
          }),
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "test",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "error fallback",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const testInput: TestInput = {
        id: "analyzer-error-test",
        content: "test",
        metadata: {},
      };

      const context: AnalysisContext = {
        metadata: new Map([["test", "metadata"]]),
      };

      const result = await processor.process(testInput, context);

      assertEquals(
        result.isValid,
        false,
        "Should return invalid result on analyzer failure",
      );
      assertEquals(
        result.data,
        testTemplate,
        "Should return template as fallback data",
      );
      assertEquals(result.errors.length, 1, "Should have one error");
      assertEquals(
        result.errors[0],
        analyzerError.message,
        "Should include analyzer error message",
      );
      assertEquals(
        result.metadata instanceof Map,
        true,
        "Should preserve context metadata",
      );
      assertEquals(
        result.metadata.get("test"),
        "metadata",
        "Should preserve metadata values",
      );
    });

    await t.step("should handle mapper failure gracefully", async () => {
      const mapperError: DomainError & { message: string } = {
        kind: "TemplateMappingFailed",
        template: {},
        source: {},
        message: "Mapper failed to map template",
      };

      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: () => {
          return Promise.resolve({
            ok: true,
            data: { analyzed: "successfully" },
          });
        },
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: () => {
          return Promise.resolve({ ok: false, error: mapperError });
        },
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "test",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "mapper error fallback",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const testInput: TestInput = {
        id: "mapper-error-test",
        content: "test",
        metadata: {},
      };

      const context: AnalysisContext = {
        metadata: new Map([["error", "test"]]),
      };

      const result = await processor.process(testInput, context);

      assertEquals(
        result.isValid,
        false,
        "Should return invalid result on mapper failure",
      );
      assertEquals(
        result.data,
        testTemplate,
        "Should return template as fallback data",
      );
      assertEquals(result.errors.length, 1, "Should have one error");
      assertEquals(
        result.errors[0],
        mapperError.message,
        "Should include mapper error message",
      );
      assertEquals(
        result.metadata instanceof Map,
        true,
        "Should preserve context metadata",
      );
      assertEquals(
        result.metadata.get("error"),
        "test",
        "Should preserve metadata values",
      );
    });

    await t.step(
      "should handle both analyzer and mapper failures in sequence",
      async () => {
        // Test case where analyzer fails first
        const analyzerError: DomainError & { message: string } = {
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          message: "Schema validation failed",
        };

        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: () => {
            return Promise.resolve({ ok: false, error: analyzerError });
          },
        };

        // Mapper should not be called if analyzer fails
        let mapperCalled = false;
        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: () => {
            mapperCalled = true;
            return Promise.resolve({
              ok: true,
              data: {
                processedId: "test",
                processedContent: "test",
                processedMetadata: {},
                template: "test",
              },
            });
          },
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "test",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "template",
          processedContent: "error sequence test",
          processedMetadata: {},
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInput: TestInput = {
          id: "sequence-error-test",
          content: "test",
          metadata: {},
        };

        const result = await processor.process(testInput);

        assertEquals(result.isValid, false, "Should return invalid result");
        assertEquals(
          mapperCalled,
          false,
          "Should not call mapper if analyzer fails",
        );
        assertEquals(
          result.errors[0],
          analyzerError.message,
          "Should include analyzer error",
        );
      },
    );
  });

  await t.step("processMany Method - Batch Processing", async (t) => {
    await t.step("should process multiple inputs successfully", async () => {
      let processCount = 0;
      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: (input: unknown) => {
          processCount++;
          const typedInput = input as TestInput;
          return Promise.resolve({
            ok: true,
            data: {
              id: `analyzed-${typedInput.id}`,
              content: `analyzed-${typedInput.content}`,
            },
          });
        },
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: (_source: unknown) => {
          const typedSource = _source as { id: string; content: string };
          return Promise.resolve({
            ok: true,
            data: {
              processedId: `mapped-${typedSource.id}`,
              processedContent: `mapped-${typedSource.content}`,
              processedMetadata: {},
              template: "batch result",
            },
          });
        },
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "batch",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const testInputs: TestInput[] = [
        { id: "batch-1", content: "content-1", metadata: {} },
        { id: "batch-2", content: "content-2", metadata: {} },
        { id: "batch-3", content: "content-3", metadata: {} },
      ];

      const baseContext: AnalysisContext = {
        sourceFile: "batch.md",
        metadata: new Map([["batch", "test"]]),
      };

      const results = await processor.processMany(testInputs, baseContext);

      assertEquals(results.length, 3, "Should return result for each input");
      assertEquals(processCount, 3, "Should process each input");

      // Verify each result
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        assertEquals(result.isValid, true, `Result ${i} should be valid`);
        assertEquals(
          result.data.processedId,
          `mapped-analyzed-batch-${i + 1}`,
          `Result ${i} should have correct processed ID`,
        );
        assertEquals(
          result.data.processedContent,
          `mapped-analyzed-content-${i + 1}`,
          `Result ${i} should have correct processed content`,
        );
        assertEquals(
          result.errors.length,
          0,
          `Result ${i} should have no errors`,
        );
      }
    });

    await t.step(
      "should add index to context options for each input",
      async () => {
        const capturedContexts: AnalysisContext[] = [];

        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: (
            _input: unknown,
            _schema: TestSchema,
            _context?: AnalysisContext,
          ) => {
            if (_context) {
              capturedContexts.push(_context);
            }
            return Promise.resolve({ ok: true, data: { processed: "data" } });
          },
        };

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: () =>
            Promise.resolve({
              ok: true,
              data: {
                processedId: "test",
                processedContent: "test",
                processedMetadata: {},
                template: "test",
              },
            }),
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "index",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "template",
          processedContent: "",
          processedMetadata: {},
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInputs: TestInput[] = [
          { id: "index-1", content: "content-1", metadata: {} },
          { id: "index-2", content: "content-2", metadata: {} },
        ];

        const baseContext: AnalysisContext = {
          options: { mode: "batch" },
          metadata: new Map([["base", "context"]]),
        };

        await processor.processMany(testInputs, baseContext);

        assertEquals(
          capturedContexts.length,
          2,
          "Should capture context for each input",
        );

        // Verify first context
        assertEquals(
          capturedContexts[0].options?.mode,
          "batch",
          "Should preserve base options",
        );
        assertEquals(
          capturedContexts[0].options?.index,
          0,
          "Should add index 0 for first input",
        );
        assertEquals(
          capturedContexts[0].metadata?.get("base"),
          "context",
          "Should preserve base metadata",
        );

        // Verify second context
        assertEquals(
          capturedContexts[1].options?.mode,
          "batch",
          "Should preserve base options",
        );
        assertEquals(
          capturedContexts[1].options?.index,
          1,
          "Should add index 1 for second input",
        );
        assertEquals(
          capturedContexts[1].metadata?.get("base"),
          "context",
          "Should preserve base metadata",
        );

        // Verify metadata is independent between contexts
        assertEquals(
          capturedContexts[0].metadata !== capturedContexts[1].metadata,
          true,
          "Should create independent metadata maps",
        );
      },
    );

    await t.step(
      "should handle mixed success and failure results",
      async () => {
        let callCount = 0;
        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: (input: unknown) => {
            callCount++;
            const typedInput = input as TestInput;

            // Fail on second input
            if (typedInput.id === "fail-2") {
              return Promise.resolve({
                ok: false,
                error: {
                  kind: "AIServiceError",
                  service: "analysis",
                  message: "Intentional failure for testing",
                },
              });
            }

            return Promise.resolve({
              ok: true,
              data: { processed: typedInput.id },
            });
          },
        };

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: (_source: unknown) => {
            const typedSource = _source as { processed: string };
            return Promise.resolve({
              ok: true,
              data: {
                processedId: `mapped-${typedSource.processed}`,
                processedContent: "mapped",
                processedMetadata: {},
                template: "mixed result",
              },
            });
          },
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "mixed",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "template",
          processedContent: "fallback",
          processedMetadata: {},
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInputs: TestInput[] = [
          { id: "success-1", content: "content-1", metadata: {} },
          { id: "fail-2", content: "content-2", metadata: {} },
          { id: "success-3", content: "content-3", metadata: {} },
        ];

        const results = await processor.processMany(testInputs);

        assertEquals(results.length, 3, "Should return result for each input");
        assertEquals(callCount, 3, "Should attempt to process each input");

        // First result should be successful
        assertEquals(results[0].isValid, true, "First result should be valid");
        assertEquals(
          results[0].data.processedId,
          "mapped-success-1",
          "Should process first input",
        );
        assertEquals(
          results[0].errors.length,
          0,
          "First result should have no errors",
        );

        // Second result should fail
        assertEquals(
          results[1].isValid,
          false,
          "Second result should be invalid",
        );
        assertEquals(
          results[1].data,
          testTemplate,
          "Should return template for failed input",
        );
        assertEquals(
          results[1].errors.length,
          1,
          "Second result should have error",
        );
        assertEquals(
          results[1].errors[0],
          "Intentional failure for testing",
          "Should include failure error message",
        );

        // Third result should be successful
        assertEquals(results[2].isValid, true, "Third result should be valid");
        assertEquals(
          results[2].data.processedId,
          "mapped-success-3",
          "Should process third input",
        );
        assertEquals(
          results[2].errors.length,
          0,
          "Third result should have no errors",
        );
      },
    );

    await t.step("should handle empty input array", async () => {
      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: () => Promise.resolve({ ok: true, data: {} }),
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: () =>
          Promise.resolve({
            ok: true,
            data: {
              processedId: "test",
              processedContent: "test",
              processedMetadata: {},
              template: "test",
            },
          }),
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "empty",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const results = await processor.processMany([]);

      assertEquals(
        results.length,
        0,
        "Should return empty array for empty input",
      );
    });

    await t.step(
      "should use default empty context when none provided",
      async () => {
        let capturedContext: AnalysisContext | undefined;

        const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
          analyze: (
            _input: unknown,
            _schema: TestSchema,
            _context?: AnalysisContext,
          ) => {
            capturedContext = _context;
            return Promise.resolve({ ok: true, data: { processed: "data" } });
          },
        };

        const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
          map: () =>
            Promise.resolve({
              ok: true,
              data: {
                processedId: "test",
                processedContent: "test",
                processedMetadata: {},
                template: "test",
              },
            }),
        };

        const testSchema: TestSchema = {
          version: "1.0.0",
          type: "default",
          properties: {},
        };

        const testTemplate: TestOutput = {
          processedId: "template",
          processedContent: "",
          processedMetadata: {},
          template: "template",
        };

        const processor = new SchemaAnalysisProcessor<
          TestInput,
          TestSchema,
          TestOutput
        >(
          mockAnalyzer,
          mockMapper,
          testSchema,
          testTemplate,
        );

        const testInputs: TestInput[] = [
          { id: "default-context", content: "test", metadata: {} },
        ];

        await processor.processMany(testInputs); // No baseContext provided

        assertExists(capturedContext, "Should provide context to analyzer");
        assertEquals(
          capturedContext.options?.index,
          0,
          "Should add index to default context",
        );
        assertEquals(
          capturedContext.metadata instanceof Map,
          true,
          "Should create Map for metadata",
        );
      },
    );
  });

  await t.step("Integration and Edge Cases", async (t) => {
    await t.step("should handle complex data flow correctly", async () => {
      // Test complex data transformation through analyzer and mapper
      const complexInput: TestInput = {
        id: "complex-data-123",
        content: JSON.stringify({
          title: "Complex Document",
          sections: [
            { heading: "Introduction", content: "Overview content" },
            { heading: "Details", content: "Detailed content" },
          ],
          metadata: { tags: ["complex", "test"], version: 2 },
        }),
        metadata: {
          source: "complex.md",
          author: "Test Author",
          processed: new Date().toISOString(),
        },
      };

      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: (
          _input: unknown,
          _schema: TestSchema,
          _context?: AnalysisContext,
        ) => {
          const typedInput = _input as TestInput;
          const parsedContent = JSON.parse(typedInput.content);

          return Promise.resolve({
            ok: true,
            data: {
              extractedTitle: parsedContent.title,
              sectionCount: parsedContent.sections.length,
              extractedTags: parsedContent.metadata.tags,
              sourceInfo: {
                id: typedInput.id,
                file: context?.sourceFile || "unknown",
                metadata: typedInput.metadata,
              },
            },
          });
        },
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: (_source: unknown, _template: TestOutput, _schema?: unknown) => {
          const typedSource = _source as {
            extractedTitle: string;
            sectionCount: number;
            extractedTags: string[];
            sourceInfo: {
              id: string;
              file: string;
              metadata: Record<string, unknown>;
            };
          };

          return Promise.resolve({
            ok: true,
            data: {
              processedId: typedSource.sourceInfo.id,
              processedContent:
                `Title: ${typedSource.extractedTitle}, Sections: ${typedSource.sectionCount}`,
              processedMetadata: {
                tags: typedSource.extractedTags,
                source: typedSource.sourceInfo.file,
                schema: _schema,
              },
              template: "complex-processing-complete",
            },
          });
        },
      };

      const testSchema: TestSchema = {
        version: "2.0.0",
        type: "object",
        properties: {
          title: { type: "string" },
          sections: { type: "array" },
          metadata: { type: "object" },
        },
        required: ["title"],
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const context: AnalysisContext = {
        sourceFile: "complex-test.md",
        options: { processingMode: "detailed" },
      };

      const result = await processor.process(complexInput, context);

      assertEquals(
        result.isValid,
        true,
        "Should process complex data successfully",
      );
      assertEquals(
        result.data.processedId,
        "complex-data-123",
        "Should preserve input ID through processing",
      );
      assertEquals(
        result.data.processedContent,
        "Title: Complex Document, Sections: 2",
        "Should transform content correctly",
      );
      assertEquals(
        result.data.processedMetadata.tags,
        ["complex", "test"],
        "Should extract and preserve tags",
      );
      assertEquals(
        result.data.processedMetadata.source,
        "complex-test.md",
        "Should include source file from context",
      );
      assertEquals(
        result.data.template,
        "complex-processing-complete",
        "Should complete complex processing",
      );
    });

    await t.step("should handle concurrent processing correctly", async () => {
      // Simulate concurrent processing with timing
      const processingOrder: string[] = [];

      const mockAnalyzer: TotalSchemaBasedAnalyzer<TestSchema, unknown> = {
        analyze: async (input: unknown) => {
          const typedInput = input as TestInput;
          processingOrder.push(`analyze-${typedInput.id}`);

          // Simulate async processing with different delays
          const delay = typedInput.id === "slow" ? 50 : 10;
          await new Promise((resolve) => setTimeout(resolve, delay));

          return Promise.resolve({
            ok: true,
            data: { analyzed: typedInput.id },
          });
        },
      };

      const mockMapper: TotalTemplateMapper<unknown, TestOutput> = {
        map: (_source: unknown) => {
          const typedSource = _source as { analyzed: string };
          processingOrder.push(`map-${typedSource.analyzed}`);

          return Promise.resolve({
            ok: true,
            data: {
              processedId: typedSource.analyzed,
              processedContent: "concurrent",
              processedMetadata: {},
              template: "concurrent result",
            },
          });
        },
      };

      const testSchema: TestSchema = {
        version: "1.0.0",
        type: "concurrent",
        properties: {},
      };

      const testTemplate: TestOutput = {
        processedId: "template",
        processedContent: "",
        processedMetadata: {},
        template: "template",
      };

      const processor = new SchemaAnalysisProcessor<
        TestInput,
        TestSchema,
        TestOutput
      >(
        mockAnalyzer,
        mockMapper,
        testSchema,
        testTemplate,
      );

      const testInputs: TestInput[] = [
        { id: "fast", content: "fast content", metadata: {} },
        { id: "slow", content: "slow content", metadata: {} },
        { id: "medium", content: "medium content", metadata: {} },
      ];

      const results = await processor.processMany(testInputs);

      assertEquals(results.length, 3, "Should process all inputs");
      assertEquals(
        processingOrder.length,
        6,
        "Should have analyze and map steps for each input",
      );

      // Verify processing order is sequential (not concurrent within processMany)
      assertEquals(
        processingOrder[0],
        "analyze-fast",
        "Should analyze first input first",
      );
      assertEquals(
        processingOrder[1],
        "map-fast",
        "Should map first input after analysis",
      );
      assertEquals(
        processingOrder[2],
        "analyze-slow",
        "Should analyze second input next",
      );
      assertEquals(
        processingOrder[3],
        "map-slow",
        "Should map second input after its analysis",
      );

      // All results should be valid
      for (const result of results) {
        assertEquals(
          result.isValid,
          true,
          "All concurrent results should be valid",
        );
      }
    });
  });
});
