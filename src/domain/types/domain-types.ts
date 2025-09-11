/**
 * Domain type definitions and discriminated unions
 * Extracted from entities-original.ts for better organization
 * Follows Totality principles with exhaustive union types
 */

// Forward declarations for entities (will be defined in their respective files)
export type FrontMatter = import("../entities/frontmatter.ts").FrontMatter;

// Discriminated union for document frontmatter state following totality principle
export type DocumentFrontMatterState =
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter }
  | { kind: "NoFrontMatter" };

// Discriminated union for frontmatter input during creation
export type FrontMatterInput = {
  kind: "Present";
  frontMatter: FrontMatter;
} | {
  kind: "NotPresent";
};

// Discriminated union for path resolution results
export type PathResolutionResult = {
  kind: "Found";
  value: unknown;
} | {
  kind: "NotFound";
  path: string;
};

// Discriminated union for template parsing results
export type TemplateParsingResult = {
  kind: "JsonParsed";
  template: Record<string, unknown>;
} | {
  kind: "ParseFailed";
  reason: string;
} | {
  kind: "NoPlaceholders";
};

// Discriminated union for template application modes following totality principle
export type TemplateApplicationMode =
  | {
    kind: "WithStructuralValidation";
    schemaData: unknown;
    templateStructure: unknown;
  }
  | { kind: "SimpleMapping" };

// Discriminated union for validated data following totality principle
export type ValidatedData<T = unknown> =
  | {
    kind: "Valid";
    data: T;
    metadata: ValidationMetadata;
  }
  | {
    kind: "PartiallyValid";
    validData: Partial<T>;
    invalidFields: Array<{ field: string; error: string }>;
    metadata: ValidationMetadata;
  };

// Validation metadata interface
export interface ValidationMetadata {
  schemaId: string;
  schemaVersion: string;
  validatedAt: Date;
}
