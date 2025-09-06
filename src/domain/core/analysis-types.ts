/**
 * Analysis-related Type Definitions
 *
 * Contains all analysis-related types, interfaces, and classes
 * following DDD principles and Totality patterns for analysis operations.
 */

import type { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";

/**
 * Analysis context type - discriminated union for different analysis types
 */
export type AnalysisContext =
  | {
    kind: "SchemaAnalysis";
    document: string;
    schema: unknown; // Schema definition from various sources
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "TemplateMapping";
    document: string;
    schema?: unknown; // Optional schema definition from various sources
    template: TemplateDefinition;
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "ValidationOnly";
    document: string;
    schema: {
      validate: (data: unknown) => { ok: boolean; data?: unknown };
      schema: unknown;
    };
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "BasicExtraction";
    document: string;
    options?: { includeMetadata?: boolean } & Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  };

/**
 * Template definition type
 */
export interface TemplateDefinition {
  template: string;
  variables?: Record<string, unknown>;
  mappingRules?: Record<string, string>;
  structure?: Record<string, unknown>;
}

/**
 * Type guards
 */
export function isSchemaAnalysis(value: unknown): value is { schema: unknown } {
  return value !== null && typeof value === "object" && "schema" in value;
}

/**
 * Command Structure interface for analysis results
 * Note: Full CommandStructure types are exported from domain-types.ts
 */
interface AnalysisCommandStructure {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string; // c1
  [DEFAULT_COMMAND_FIELDS.ACTION]: string; // c2
  [DEFAULT_COMMAND_FIELDS.TARGET]: string; // c3
  description: string;
  options?: Record<string, unknown>;
}

/**
 * Analysis Result data structure
 */
export interface AnalysisResultData<T = unknown> {
  has_frontmatter: boolean;
  frontmatter: {
    title?: string;
    description?: string;
    usage?: string;
  };
  template_variables: string[];
  command_structure: AnalysisCommandStructure;
  detected_options: {
    has_input_file: boolean;
    has_stdin: boolean;
    has_destination: boolean;
    user_variables: string[];
  };
  data?: T;
}

/**
 * Analysis Result class - combines data and metadata
 */
export class AnalysisResult<T = unknown> {
  private metadata: Record<string, unknown> = {};

  constructor(
    public readonly sourceFile: unknown,
    public readonly data: T,
  ) {}

  // Alias for backward compatibility
  get extractedData(): T {
    return this.data;
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMetadata(): Record<string, unknown>;
  getMetadata(key: string): unknown;
  getMetadata(key?: string): Record<string, unknown> | unknown {
    if (key === undefined) {
      return { ...this.metadata };
    }
    return this.metadata[key];
  }

  hasMetadata(key: string): boolean {
    return key in this.metadata;
  }
}
