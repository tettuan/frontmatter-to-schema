// Re-export all entities from split files

// Document-related exports
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
} from "../document-entities.ts";
export { Document, DocumentId, FrontMatter } from "../document-entities.ts";

// Schema-related exports
export type { ValidatedData, ValidationMetadata } from "../schema-entities.ts";
export { Schema, SchemaId } from "../schema-entities.ts";

// Template-related exports
export type {
  PathResolutionResult,
  TemplateApplicationMode,
  TemplateParsingResult,
} from "../template-entities.ts";
export { Template, TemplateId } from "../template-entities.ts";

// Analysis-related exports
export {
  AggregatedResult,
  AnalysisId,
  AnalysisResult,
  ExtractedData,
  MappedData,
} from "../analysis-entities.ts";

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "../value-objects.ts";
