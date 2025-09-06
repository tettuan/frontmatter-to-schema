// Re-export all entities from split files

// Document-related exports
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
  DocumentValidationMetadata,
} from "../document-entities.ts";
export {
  DocumentId,
  Document,
  FrontMatter,
} from "../document-entities.ts";

// Schema-related exports
export type { ValidatedData, ValidationMetadata } from "../schema-entities.ts";
export {
  SchemaId,
  Schema,
} from "../schema-entities.ts";

// Template-related exports
export type {
  PathResolutionResult,
  TemplateParsingResult,
  TemplateApplicationMode,
} from "../template-entities.ts";
export {
  TemplateId,
  Template,
} from "../template-entities.ts";

// Analysis-related exports
export {
  AnalysisId,
  ExtractedData,
  MappedData,
  AnalysisResult,
  AggregatedResult,
} from "../analysis-entities.ts";

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "../value-objects.ts";