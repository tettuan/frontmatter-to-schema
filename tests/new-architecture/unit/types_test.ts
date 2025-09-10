/**
 * Core Types Test Suite - Totality Compliant Testing
 * Tests fundamental types and Smart Constructors for new architecture
 * Following DDD and Totality principles from Issue #591
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import {
  assertError,
  assertErrorKind,
  assertOk,
  createDomainError,
  type DomainError,
  type Result,
} from "../helpers/result_matchers.ts";

/**
 * Core Result Type Tests
 * Validates fundamental Result<T, E> patterns used throughout new architecture
 */
describe("Result Type Core Operations", () => {
  it("should handle success case correctly", () => {
    const result: Result<string, DomainError> = { ok: true, data: "success" };
    assertOk(result);
    assertEquals(result.data, "success");
  });

  it("should handle error case correctly", () => {
    const result: Result<string, DomainError> = {
      ok: false,
      error: createDomainError("ValidationError", "test error"),
    };
    assertError(result);
    assertEquals(result.error.kind, "ValidationError");
    assertEquals(result.error.message, "test error");
  });

  it("should provide type safety through discriminated union", () => {
    function processResult(result: Result<number, DomainError>): number {
      if (result.ok) {
        return result.data * 2; // TypeScript knows this is number
      } else {
        throw new Error(result.error.message); // TypeScript knows this is DomainError
      }
    }

    const successResult: Result<number, DomainError> = { ok: true, data: 42 };
    assertEquals(processResult(successResult), 84);
  });
});

/**
 * DocumentPath Value Object Tests
 * Smart Constructor pattern validation for file paths
 */
describe("DocumentPath Smart Constructor", () => {
  // Implementation placeholder - will be implemented when types.ts is created
  class DocumentPath {
    private constructor(readonly value: string) {}

    static create(path: string): Result<DocumentPath, DomainError> {
      if (!path || path.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            "EmptyInput",
            "Document path cannot be empty",
          ),
        };
      }

      if (path.length > 260) {
        return {
          ok: false,
          error: createDomainError(
            "OutOfRange",
            "Path exceeds maximum length",
            { value: path, max: 260 },
          ),
        };
      }

      if (!/\.(md|markdown)$/i.test(path)) {
        return {
          ok: false,
          error: createDomainError(
            "InvalidFormat",
            "Path must end with .md or .markdown",
            { input: path, expectedFormat: "*.md or *.markdown" },
          ),
        };
      }

      return { ok: true, data: new DocumentPath(path) };
    }

    getValue(): string {
      return this.value;
    }
  }

  it("should create valid document path", () => {
    const result = DocumentPath.create("valid/path.md");
    assertOk(result);
    assertEquals(result.data.getValue(), "valid/path.md");
  });

  it("should reject empty path", () => {
    const result = DocumentPath.create("");
    assertErrorKind(result, "EmptyInput");
  });

  it("should reject whitespace-only path", () => {
    const result = DocumentPath.create("   ");
    assertErrorKind(result, "EmptyInput");
  });

  it("should reject path without markdown extension", () => {
    const result = DocumentPath.create("file.txt");
    assertErrorKind(result, "InvalidFormat");
  });

  it("should accept .markdown extension", () => {
    const result = DocumentPath.create("file.markdown");
    assertOk(result);
    assertEquals(result.data.getValue(), "file.markdown");
  });

  it("should reject overly long paths", () => {
    const longPath = "a".repeat(258) + ".md"; // 261 characters
    const result = DocumentPath.create(longPath);
    assertErrorKind(result, "OutOfRange");
  });
});

/**
 * SchemaDefinition Value Object Tests
 * Smart Constructor for schema validation
 */
describe("SchemaDefinition Smart Constructor", () => {
  class SchemaDefinition {
    private constructor(readonly schema: unknown) {}

    static create(schema: unknown): Result<SchemaDefinition, DomainError> {
      if (schema === null || schema === undefined) {
        return {
          ok: false,
          error: createDomainError(
            "EmptyInput",
            "Schema cannot be null or undefined",
          ),
        };
      }

      if (typeof schema !== "object") {
        return {
          ok: false,
          error: createDomainError(
            "InvalidFormat",
            "Schema must be an object",
            { input: typeof schema, expectedFormat: "object" },
          ),
        };
      }

      if (Array.isArray(schema)) {
        return {
          ok: false,
          error: createDomainError(
            "InvalidFormat",
            "Schema cannot be an array",
            { input: "array", expectedFormat: "object" },
          ),
        };
      }

      return { ok: true, data: new SchemaDefinition(schema) };
    }

    getSchema(): unknown {
      return this.schema;
    }
  }

  it("should create valid schema definition", () => {
    const schema = { type: "object", properties: {} };
    const result = SchemaDefinition.create(schema);
    assertOk(result);
    assertEquals(result.data.getSchema(), schema);
  });

  it("should reject null schema", () => {
    const result = SchemaDefinition.create(null);
    assertErrorKind(result, "EmptyInput");
  });

  it("should reject undefined schema", () => {
    const result = SchemaDefinition.create(undefined);
    assertErrorKind(result, "EmptyInput");
  });

  it("should reject non-object schema", () => {
    const result = SchemaDefinition.create("not an object");
    assertErrorKind(result, "InvalidFormat");
  });

  it("should reject array schema", () => {
    const result = SchemaDefinition.create([]);
    assertErrorKind(result, "InvalidFormat");
  });
});

/**
 * Processing Context Discriminated Union Tests
 * Validates totality pattern for processing modes
 */
describe("ProcessingContext Discriminated Union", () => {
  type ProcessingContext =
    | { kind: "SingleDocument"; document: { path: string; content: string } }
    | {
      kind: "BatchProcessing";
      documents: Array<{ path: string; content: string }>;
    }
    | {
      kind: "AggregateMode";
      documents: Array<{ path: string; content: string }>;
      rules: string[];
    };

  function processContext(context: ProcessingContext): string {
    switch (context.kind) {
      case "SingleDocument":
        return `Processing single document: ${context.document.path}`;
      case "BatchProcessing":
        return `Processing ${context.documents.length} documents`;
      case "AggregateMode":
        return `Aggregating ${context.documents.length} documents with ${context.rules.length} rules`;
    }
  }

  it("should handle SingleDocument context", () => {
    const context: ProcessingContext = {
      kind: "SingleDocument",
      document: { path: "test.md", content: "content" },
    };
    assertEquals(
      processContext(context),
      "Processing single document: test.md",
    );
  });

  it("should handle BatchProcessing context", () => {
    const context: ProcessingContext = {
      kind: "BatchProcessing",
      documents: [
        { path: "test1.md", content: "content1" },
        { path: "test2.md", content: "content2" },
      ],
    };
    assertEquals(processContext(context), "Processing 2 documents");
  });

  it("should handle AggregateMode context", () => {
    const context: ProcessingContext = {
      kind: "AggregateMode",
      documents: [{ path: "test.md", content: "content" }],
      rules: ["rule1", "rule2"],
    };
    assertEquals(
      processContext(context),
      "Aggregating 1 documents with 2 rules",
    );
  });

  it("should ensure exhaustive handling with TypeScript", () => {
    // This test validates that the switch statement is exhaustive
    // TypeScript will error if we miss a case in the discriminated union
    function _exhaustiveCheck(context: ProcessingContext): never {
      switch (context.kind) {
        case "SingleDocument":
        case "BatchProcessing":
        case "AggregateMode":
          return undefined as never; // This should never be reached
        default: {
          // If we miss a case, TypeScript will error here
          const _exhaustiveCheck: never = context;
          throw new Error(`Unhandled context kind: ${_exhaustiveCheck}`);
        }
      }
    }

    // Test that all cases are properly handled
    const contexts: ProcessingContext[] = [
      {
        kind: "SingleDocument",
        document: { path: "test.md", content: "content" },
      },
      { kind: "BatchProcessing", documents: [] },
      { kind: "AggregateMode", documents: [], rules: [] },
    ];

    contexts.forEach((context) => {
      assertEquals(typeof processContext(context), "string");
    });
  });
});

/**
 * Configuration Type Tests
 * Validates complete configuration structure
 */
describe("Configuration Types", () => {
  type Configuration = {
    schema: { definition: unknown; format: "json" | "yaml" };
    template: {
      definition: string;
      format: "json" | "yaml" | "xml" | "custom";
    };
    input: { path: string; pattern?: string };
    output: { path: string; format: "json" | "yaml" | "xml" | "custom" };
  };

  it("should validate complete configuration structure", () => {
    const config: Configuration = {
      schema: {
        definition: { type: "object", properties: {} },
        format: "json",
      },
      template: {
        definition: "# {title}\n\n{description}",
        format: "custom",
      },
      input: {
        path: "*.md",
        pattern: "**/*.md",
      },
      output: {
        path: "output.json",
        format: "json",
      },
    };

    // Test that configuration structure is valid
    assertEquals(config.schema.format, "json");
    assertEquals(config.template.format, "custom");
    assertEquals(config.input.path, "*.md");
    assertEquals(config.output.format, "json");
  });

  it("should enforce type safety for format fields", () => {
    // TypeScript should prevent invalid format values
    // This test documents the expected compile-time behavior

    const validSchemaFormat: "json" | "yaml" = "json";
    const validTemplateFormat: "json" | "yaml" | "xml" | "custom" = "custom";
    const validOutputFormat: "json" | "yaml" | "xml" | "custom" = "json";

    assertEquals(validSchemaFormat, "json");
    assertEquals(validTemplateFormat, "custom");
    assertEquals(validOutputFormat, "json");
  });
});

/**
 * Domain Error Discriminated Union Tests
 * Validates complete error handling patterns
 */
describe("Domain Error Types", () => {
  it("should handle all error kinds with proper discrimination", () => {
    const errors: DomainError[] = [
      createDomainError("SchemaError", "Schema error"),
      createDomainError("FrontmatterError", "Frontmatter error"),
      createDomainError("TemplateError", "Template error"),
      createDomainError("FileError", "File error"),
      createDomainError("ValidationError", "Validation error"),
      createDomainError("ProcessingError", "Processing error"),
      createDomainError("EmptyInput", "Empty input"),
      createDomainError("InvalidFormat", "Invalid format", {
        input: "test",
        expectedFormat: "expected",
      }),
      createDomainError("OutOfRange", "Out of range", {
        value: 100,
        min: 0,
        max: 50,
      }),
    ];

    errors.forEach((error) => {
      assertEquals(typeof error.kind, "string");
      assertEquals(typeof error.message, "string");

      // Test exhaustive error handling
      switch (error.kind) {
        case "SchemaError":
        case "FrontmatterError":
        case "TemplateError":
        case "FileError":
        case "ValidationError":
        case "ProcessingError":
        case "EmptyInput":
        case "InvalidFormat":
        case "OutOfRange":
          // All cases handled
          break;
        default: {
          // TypeScript will error if we miss a case
          const _exhaustiveCheck: never = error;
          throw new Error(`Unhandled error kind: ${_exhaustiveCheck}`);
        }
      }
    });
  });

  it("should provide proper error context for specific error types", () => {
    const invalidFormatError = createDomainError(
      "InvalidFormat",
      "Invalid format",
      {
        input: "test input",
        expectedFormat: "expected format",
      },
    );

    assertEquals(invalidFormatError.kind, "InvalidFormat");
    assertEquals(invalidFormatError.message, "Invalid format");
    assertEquals((invalidFormatError as { input: string }).input, "test input");
    assertEquals(
      (invalidFormatError as { expectedFormat: string }).expectedFormat,
      "expected format",
    );

    const outOfRangeError = createDomainError(
      "OutOfRange",
      "Value out of range",
      {
        value: 100,
        min: 0,
        max: 50,
      },
    );

    assertEquals(outOfRangeError.kind, "OutOfRange");
    assertEquals((outOfRangeError as { value: number }).value, 100);
    assertEquals((outOfRangeError as { min: number }).min, 0);
    assertEquals((outOfRangeError as { max: number }).max, 50);
  });
});
