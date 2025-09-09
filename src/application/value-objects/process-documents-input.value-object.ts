/**
 * Process Documents Input Value Object
 * Extracted from process-documents-usecase.ts for better domain separation
 * Provides Smart Constructor for input validation following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";

/**
 * Process Documents Input Value Object with validation
 */
export class ProcessDocumentsInput {
  private constructor(
    private readonly schemaPath: string,
    private readonly outputPath: string,
    private readonly inputPattern: string,
    private readonly outputFormat: "json" | "yaml" | "toml",
  ) {}

  static create(input: {
    schemaPath: string;
    outputPath: string;
    inputPattern: string;
    outputFormat: "json" | "yaml" | "toml";
  }): Result<ProcessDocumentsInput, DomainError & { message: string }> {
    // Validate schema path
    if (!input.schemaPath || typeof input.schemaPath !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "schemaPath",
          input: input.schemaPath,
        }, "Schema path is required and must be a non-empty string"),
      };
    }

    // Validate output path
    if (!input.outputPath || typeof input.outputPath !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "outputPath",
          input: input.outputPath,
        }, "Output path is required and must be a non-empty string"),
      };
    }

    // Validate input pattern
    if (!input.inputPattern || typeof input.inputPattern !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "inputPattern",
          input: input.inputPattern,
        }, "Input pattern is required and must be a non-empty string"),
      };
    }

    // Validate output format
    if (!["json", "yaml", "toml"].includes(input.outputFormat)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "outputFormat",
          input: input.outputFormat,
        }, "Output format must be 'json', 'yaml', or 'toml'"),
      };
    }

    return {
      ok: true,
      data: new ProcessDocumentsInput(
        input.schemaPath,
        input.outputPath,
        input.inputPattern,
        input.outputFormat,
      ),
    };
  }

  getSchemaPath(): string {
    return this.schemaPath;
  }

  getOutputPath(): string {
    return this.outputPath;
  }

  getInputPattern(): string {
    return this.inputPattern;
  }

  getOutputFormat(): "json" | "yaml" | "toml" {
    return this.outputFormat;
  }

  toObject() {
    return {
      schemaPath: this.schemaPath,
      outputPath: this.outputPath,
      inputPattern: this.inputPattern,
      outputFormat: this.outputFormat,
    };
  }
}
