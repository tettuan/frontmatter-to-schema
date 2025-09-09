/**
 * Test Helpers for Template Processing Pipeline
 *
 * Robust test utilities following DDD/Totality principles
 * Provides reusable mocks and fixtures for template processing tests
 */

import { createMockFrontMatter, createMockTemplate } from "./mock-factories.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../src/domain/services/interfaces.ts";
import type { ExtractedData } from "../../src/domain/models/entities.ts";
import { MappedData } from "../../src/domain/analysis/entities.ts";
import type { DomainError, Result } from "../../src/domain/core/result.ts";
import { createDomainError } from "../../src/domain/core/result.ts";

/**
 * Create mock MappedData implementation for testing
 */
export function createMockMappedData(
  data: Record<string, unknown>,
  _metadata?: {
    templateApplied?: string;
    transformationRules?: string[];
    transformedAt?: Date;
  },
): MappedData {
  return MappedData.create(data);
}

/**
 * Mock TemplateMapper that always succeeds with configured data
 */
export class SuccessfulTemplateMapper implements TemplateMapper {
  private readonly mockData: Record<string, unknown>;
  private readonly metadata?: {
    templateApplied?: string;
    transformationRules?: string[];
  };

  constructor(
    mockData: Record<string, unknown> = { transformed: "success" },
    metadata?: { templateApplied?: string; transformationRules?: string[] },
  ) {
    this.mockData = mockData;
    this.metadata = metadata;
  }

  map(
    _extractedData: ExtractedData,
    _template: unknown,
    _mode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    return {
      ok: true,
      data: createMockMappedData(this.mockData, this.metadata),
    };
  }
}

/**
 * Mock TemplateMapper that always fails with configured error
 */
export class FailingTemplateMapper implements TemplateMapper {
  private readonly errorMessage: string;

  constructor(
    errorMessage: string = "Mock template mapping failure",
  ) {
    this.errorMessage = errorMessage;
  }

  map(
    _extractedData: ExtractedData,
    _template: unknown,
    _mode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "TemplateMappingFailed",
          template: {},
          source: {},
        },
        this.errorMessage,
      ),
    };
  }
}

/**
 * Mock TemplateMapper that throws exceptions for testing error handling
 */
export class ExceptionThrowingTemplateMapper implements TemplateMapper {
  private readonly exceptionMessage: string;

  constructor(
    exceptionMessage: string = "Unexpected template mapper exception",
  ) {
    this.exceptionMessage = exceptionMessage;
  }

  map(): Result<MappedData, DomainError & { message: string }> {
    throw new Error(this.exceptionMessage);
  }
}

/**
 * Mock TemplateMapper with configurable behavior per call
 */
export class ConfigurableTemplateMapper implements TemplateMapper {
  private callCount = 0;
  private readonly behaviors: Array<
    Result<MappedData, DomainError & { message: string }> | "throw"
  >;

  constructor(
    behaviors: Array<
      Result<MappedData, DomainError & { message: string }> | "throw"
    >,
  ) {
    this.behaviors = behaviors;
  }

  map(
    _extractedData: ExtractedData,
    _template: unknown,
    _mode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    const behavior = this.behaviors[this.callCount] ||
      this.behaviors[this.behaviors.length - 1];
    this.callCount++;

    if (behavior === "throw") {
      throw new Error("Configurable mapper exception");
    }

    return behavior;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }
}

/**
 * Template processing test scenarios for robust testing
 */
export const TemplateProcessingScenarios = {
  /**
   * Valid frontmatter data with all required fields
   */
  validFrontmatter: () =>
    createMockFrontMatter({
      c1: "build",
      c2: "robust",
      c3: "system",
      additionalFields: {
        title: "Valid Test Document",
        description: "Test document with valid frontmatter",
      },
    }),

  /**
   * Complex frontmatter with nested objects and arrays
   */
  complexFrontmatter: () => ({
    c1: "complex",
    c2: "nested",
    c3: "data",
    metadata: {
      author: "Test Author",
      tags: ["test", "complex", "nested"],
      config: {
        enabled: true,
        priority: 1,
      },
    },
  }),

  /**
   * Minimal valid frontmatter with only required fields
   */
  minimalFrontmatter: () =>
    createMockFrontMatter({
      c1: "minimal",
      c2: "valid",
      c3: "data",
    }),

  /**
   * Edge case frontmatter with empty strings
   */
  edgeCaseFrontmatter: () =>
    createMockFrontMatter({
      c1: "",
      c2: "edge",
      c3: "case",
      additionalFields: {
        emptyField: "",
        nullField: null,
        undefinedField: undefined,
      },
    }),

  /**
   * Frontmatter with special characters and unicode
   */
  unicodeFrontmatter: () =>
    createMockFrontMatter({
      c1: "特殊文字",
      c2: "unicode-🌟",
      c3: "テスト",
      additionalFields: {
        description: "Unicode and special characters test",
      },
    }),

  /**
   * Template that transforms c1-c2-c3 into composite string
   */
  simpleTemplate: () => createMockTemplate("simple-composite"),

  /**
   * Template with complex transformation rules
   */
  complexTemplate: () => {
    const template = createMockTemplate("complex-transformation");
    // Add custom getDescription for testing
    Object.defineProperty(template, "getDescription", {
      value: () => "Complex transformation template with advanced rules",
      configurable: true,
    });
    return template;
  },

  /**
   * Template without proper description or ID methods
   */
  bareTemplate: () => {
    return {
      getFormat: () => ({ getValue: () => "json" }),
      getMappingRules: () => [],
    } as unknown;
  },

  /**
   * Mock schema validation modes for different test scenarios
   */
  schemaValidationModes: {
    withSchema: () => ({
      kind: "WithSchema" as const,
      schema: { type: "object", properties: {} },
    }),
    withoutSchema: () => ({
      kind: "WithoutSchema" as const,
    }),
    strictMode: () => ({
      kind: "WithSchema" as const,
      schema: {
        type: "object",
        properties: {
          c1: { type: "string" },
          c2: { type: "string" },
          c3: { type: "string" },
        },
        required: ["c1", "c2", "c3"],
        additionalProperties: false,
      },
    }),
  },

  /**
   * Expected transformation results for validation
   */
  expectedResults: {
    simpleComposite: (c1: string, c2: string, c3: string) =>
      createMockMappedData({
        composite: `${c1}-${c2}-${c3}`,
        processed: true,
      }),

    complexTransformation: (input: Record<string, unknown>) =>
      createMockMappedData({
        ...input,
        transformed: true,
        processedAt: new Date().toISOString(),
      }),

    identityTransformation: (input: Record<string, unknown>) =>
      createMockMappedData(input),
  },
};

/**
 * Error scenarios for robust error handling testing
 */
export const ErrorScenarios = {
  /**
   * Invalid input data scenarios
   */
  invalidInputs: {
    nullData: null,
    undefinedData: undefined,
    stringData: "invalid-string-data",
    numberData: 42,
    arrayData: ["invalid", "array", "data"],
    functionData: () => "invalid-function-data",
  },

  /**
   * Template mapper error scenarios
   */
  templateMapperErrors: {
    mappingFailed: () =>
      new FailingTemplateMapper(
        "Template transformation failed",
      ),

    validationError: () =>
      new FailingTemplateMapper(
        "Template validation failed",
      ),

    configurationError: () =>
      new FailingTemplateMapper(
        "Template configuration invalid",
      ),

    unexpectedException: () =>
      new ExceptionThrowingTemplateMapper(
        "Unexpected template processing exception",
      ),
  },

  /**
   * Expected error responses for validation
   */
  expectedErrors: {
    invalidFormat: (input: unknown) => ({
      kind: "InvalidFormat",
      input: typeof input,
      expectedFormat: "object",
    }),

    emptyInput: () => ({
      kind: "EmptyInput",
    }),

    templateMappingFailed: (template: unknown, source: unknown) => ({
      kind: "TemplateMappingFailed",
      template,
      source,
    }),

    processingStageError: (stage: string) => ({
      kind: "ProcessingStageError",
      stage,
      error: {
        kind: "InvalidResponse",
        service: "template-processor",
      },
    }),
  },
};

/**
 * Performance testing helpers
 */
export const PerformanceHelpers = {
  /**
   * Measure execution time of template processing
   */
  measureExecutionTime: async <T>(operation: () => Promise<T>): Promise<{
    result: T;
    executionTime: number;
  }> => {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  },

  /**
   * Create large dataset for performance testing
   */
  createLargeDataset: (size: number): Record<string, unknown> => {
    const dataset: Record<string, unknown> = {
      c1: "performance",
      c2: "testing",
      c3: "dataset",
    };

    for (let i = 0; i < size; i++) {
      dataset[`field_${i}`] = `value_${i}`;
    }

    return dataset;
  },

  /**
   * Validate performance requirements
   */
  validatePerformance: (
    executionTime: number,
    maxTime: number = 1000,
  ): boolean => {
    return executionTime <= maxTime;
  },
};

/**
 * Integration test helpers for orchestrator testing
 */
export const IntegrationHelpers = {
  /**
   * Create markdown content with frontmatter
   */
  createMarkdownWithFrontmatter: (
    frontmatter: Record<string, unknown>,
    content: string = "# Test Content",
  ): string => {
    const frontmatterYaml = Object.entries(frontmatter)
      .map(([key, value]) =>
        `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`
      )
      .join("\n");

    return `---\n${frontmatterYaml}\n---\n${content}`;
  },

  /**
   * Create complete test file structure
   */
  createTestFileStructure: (): Record<string, string> => {
    return {
      "valid-document.md": IntegrationHelpers.createMarkdownWithFrontmatter(
        TemplateProcessingScenarios.validFrontmatter(),
      ),
      "complex-document.md": IntegrationHelpers.createMarkdownWithFrontmatter(
        TemplateProcessingScenarios.complexFrontmatter(),
      ),
      "minimal-document.md": IntegrationHelpers.createMarkdownWithFrontmatter(
        TemplateProcessingScenarios.minimalFrontmatter(),
      ),
      "empty-document.md": "# Document without frontmatter",
      "invalid-frontmatter.md": "---\ninvalid yaml content\n---\n# Invalid",
    };
  },

  /**
   * Validate processing results structure
   */
  validateProcessingResult: (result: unknown): boolean => {
    const res = result as { filesProcessed?: number; result?: unknown };
    return !!(
      result &&
      typeof res.filesProcessed === "number" &&
      res.filesProcessed >= 0 &&
      res.result !== undefined
    );
  },
};
