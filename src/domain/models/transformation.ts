import type { DomainError, Result } from "../core/result.ts";
import type { Document } from "./entities.ts";
import type { Template } from "./entities.ts";
import type { Schema } from "./entities.ts";

export class ExtractedData {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: Record<string, unknown>,
  ) {}

  static create(
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): ExtractedData {
    return new ExtractedData(data, metadata || {});
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  getField(key: string): unknown {
    return this.data[key];
  }
}

export class TransformationContext {
  private constructor(
    private readonly document: Document,
    private readonly schema: Schema,
    private readonly extractionPrompt?: string,
    private readonly mappingPrompt?: string,
  ) {}

  static create(
    document: Document,
    schema: Schema,
    extractionPrompt?: string,
    mappingPrompt?: string,
  ): TransformationContext {
    return new TransformationContext(
      document,
      schema,
      extractionPrompt,
      mappingPrompt,
    );
  }

  getDocument(): Document {
    return this.document;
  }

  getSchema(): Schema {
    return this.schema;
  }

  getExtractionPrompt(): string | undefined {
    return this.extractionPrompt;
  }

  getMappingPrompt(): string | undefined {
    return this.mappingPrompt;
  }
}

export class TransformationResult {
  private constructor(
    private readonly context: TransformationContext,
    private readonly extractedData: ExtractedData,
    private readonly validatedData: unknown,
  ) {}

  static create(
    context: TransformationContext,
    extractedData: ExtractedData,
    validatedData: unknown,
  ): TransformationResult {
    return new TransformationResult(context, extractedData, validatedData);
  }

  getContext(): TransformationContext {
    return this.context;
  }

  getExtractedData(): ExtractedData {
    return this.extractedData;
  }

  getValidatedData(): unknown {
    return this.validatedData;
  }

  renderWithTemplate(
    template: Template,
  ): Result<string, DomainError> {
    try {
      const result = template.applyRules(
        this.validatedData as Record<string, unknown>,
        { kind: "SimpleMapping" },
      );

      if (!result.ok) {
        return {
          ok: false,
          error: result.error,
        };
      }

      return {
        ok: true,
        data: JSON.stringify(result.data),
      };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateMappingFailed" as const,
          template: "Template rendering",
          source: this.validatedData,
        },
      };
    }
  }
}

export class BatchTransformationResult {
  private constructor(
    private readonly results: TransformationResult[],
    private readonly errors: Array<
      { document: Document; error: DomainError }
    >,
  ) {}

  static create(
    results: TransformationResult[],
    errors: Array<{ document: Document; error: DomainError }>,
  ): BatchTransformationResult {
    return new BatchTransformationResult(results, errors);
  }

  getResults(): TransformationResult[] {
    return [...this.results];
  }

  getErrors(): Array<{ document: Document; error: DomainError }> {
    return [...this.errors];
  }

  getSuccessCount(): number {
    return this.results.length;
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  getTotalCount(): number {
    return this.results.length + this.errors.length;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  aggregateData(): unknown[] {
    return this.results.map((r) => r.getValidatedData());
  }
}
