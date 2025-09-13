/**
 * Template Builder Facade - Domain interface for template construction
 * Following DDD and Totality principles from docs/architecture/template-domain-architecture.ja.md
 */

import type { Result } from "../core/result.ts";

/**
 * Template file path value object
 * Represents a path to a template file from Schema
 */
export class TemplateFilePath {
  constructor(private readonly path: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.path || this.path.trim() === "") {
      throw new Error("Template path cannot be empty");
    }
  }

  toString(): string {
    return this.path;
  }

  resolve(): string {
    // Resolve relative paths if needed
    return this.path;
  }
}

/**
 * Template value set for template processing
 */
export interface TemplateValueSet {
  values: Record<string, unknown>;
  metadata?: {
    source: string;
    timestamp: Date;
    schemaVersion?: string;
  };
}

/**
 * Source for template construction
 * Contains template path from Schema and values to apply
 */
export interface TemplateSource {
  templatePath: TemplateFilePath;
  valueSet: TemplateValueSet;
}

/**
 * Compiled template ready for output
 */
export interface CompiledTemplate {
  templatePath: TemplateFilePath;
  appliedValues: TemplateValueSet;
  compiledContent: string;
  compiledAt: Date;
  checksum: string;
  format: "json" | "yaml" | "text";
  validate(): Result<void, ValidationError>;
}

export interface BuildError {
  kind: "BuildError";
  message: string;
  details?: unknown;
}

export interface CompositionError {
  kind: "CompositionError";
  message: string;
  details?: unknown;
}

export interface ValidationError {
  kind: "ValidationError";
  message: string;
  field?: string;
  details?: unknown;
}

/**
 * Template Builder Facade Interface
 * Single entry point for template construction domain
 * All template building operations must go through this facade
 */
export interface TemplateBuilderFacade {
  /**
   * Build a template from source
   * @param source Template source with path from Schema and values
   * @returns Compiled template or error
   */
  buildTemplate(
    source: TemplateSource,
  ): Promise<Result<CompiledTemplate, BuildError>>;

  /**
   * Compose multiple templates into one
   * @param templates Array of compiled templates to compose
   * @returns Single composed template or error
   */
  composeTemplates(
    templates: CompiledTemplate[],
  ): Promise<Result<CompiledTemplate, CompositionError>>;

  /**
   * Validate a compiled template
   * @param template Template to validate
   * @returns Success or validation error
   */
  validateTemplate(
    template: CompiledTemplate,
  ): Result<void, ValidationError>;
}