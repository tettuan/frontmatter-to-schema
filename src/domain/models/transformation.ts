import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import type { Document } from "./document.ts";
import type { Schema } from "./schema.ts";
import type { Template } from "./template.ts";

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
  ): Result<string, ValidationError> {
    return template.render(this.validatedData);
  }
}

export class BatchTransformationResult {
  private constructor(
    private readonly results: TransformationResult[],
    private readonly errors: Array<
      { document: Document; error: ValidationError }
    >,
  ) {}

  static create(
    results: TransformationResult[],
    errors: Array<{ document: Document; error: ValidationError }>,
  ): BatchTransformationResult {
    return new BatchTransformationResult(results, errors);
  }

  getResults(): TransformationResult[] {
    return [...this.results];
  }

  getErrors(): Array<{ document: Document; error: ValidationError }> {
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
