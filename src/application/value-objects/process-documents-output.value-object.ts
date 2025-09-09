/**
 * Process Documents Output Value Object
 * Extracted from process-documents-usecase.ts for better domain separation
 * Provides Smart Constructor for output validation following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";

/**
 * Process Documents Output Value Object with validation
 */
export class ProcessDocumentsOutput {
  private constructor(
    private readonly processedCount: number,
    private readonly outputPath: string,
    private readonly warnings: string[] = [],
  ) {}

  static create(data: {
    processedCount: number;
    outputPath: string;
    warnings?: string[];
  }): Result<ProcessDocumentsOutput, DomainError & { message: string }> {
    // Validate processed count
    if (typeof data.processedCount !== "number" || data.processedCount < 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "processedCount",
          input: data.processedCount,
        }, "Processed count must be a non-negative number"),
      };
    }

    // Validate output path
    if (!data.outputPath || typeof data.outputPath !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "outputPath",
          input: data.outputPath,
        }, "Output path is required and must be a non-empty string"),
      };
    }

    // Validate warnings array
    const warnings = data.warnings || [];
    if (
      !Array.isArray(warnings) || warnings.some((w) => typeof w !== "string")
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "warnings",
          input: data.warnings,
        }, "Warnings must be an array of strings"),
      };
    }

    return {
      ok: true,
      data: new ProcessDocumentsOutput(
        data.processedCount,
        data.outputPath,
        warnings,
      ),
    };
  }

  getProcessedCount(): number {
    return this.processedCount;
  }

  getOutputPath(): string {
    return this.outputPath;
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  toObject() {
    return {
      processedCount: this.processedCount,
      outputPath: this.outputPath,
      warnings: this.warnings.length > 0 ? this.warnings : undefined,
    };
  }
}
