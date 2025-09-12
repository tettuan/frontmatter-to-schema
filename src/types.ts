// Foundation Result type
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Core domain errors following totality
export type DomainError =
  | ValidationError
  | ProcessingError
  | FileSystemError;

export type ValidationError =
  | { kind: "EmptyInput"; field?: string }
  | { kind: "InvalidFormat"; input: string; expectedFormat: string }
  | { kind: "PatternMismatch"; value: string; pattern: string };

export type ProcessingError =
  | { kind: "SchemaValidationFailed"; schema: unknown; data: unknown }
  | { kind: "TemplateRenderFailed"; template: string; data: unknown }
  | { kind: "FrontmatterExtractionFailed"; content: string }
  | { kind: "SchemaNotFound"; path: string }
  | { kind: "ArrayItemsSchemaNotFound"; path: string }
  | { kind: "ArrayTemplateResolutionFailed"; path: string; details: string }
  | { kind: "TemplateLoadFailed"; path: string; details: string };

export type FileSystemError =
  | { kind: "FileNotFound"; path: string }
  | { kind: "ReadError"; path: string; details?: string }
  | { kind: "WriteError"; path: string; details?: string };

// Value objects (leveraging existing Phase 2 work)
export interface DocumentPath {
  readonly value: string;
}
export interface SchemaPath {
  readonly value: string;
}
export interface TemplatePath {
  readonly value: string;
}

// Processing configuration (Totality-compliant discriminated union)
export interface ProcessingConfig {
  readonly schema: { readonly path: string; readonly format: "json" | "yaml" };
  readonly input: { readonly pattern: string; readonly baseDirectory?: string };
  readonly template: {
    readonly path: string;
    readonly format: "json" | "yaml" | "xml" | "custom";
  };
  readonly output: {
    readonly path: string;
    readonly format: "json" | "yaml" | "xml" | "custom";
  };
}
