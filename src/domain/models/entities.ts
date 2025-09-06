// Main entities file - imports from split entity files

// Re-export all entities from split files for backward compatibility
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
  ValidationMetadata,
  ValidatedData,
  PathResolutionResult,
  TemplateParsingResult,
  TemplateApplicationMode,
} from "./entities/index.ts";

export {
  DocumentId,
  Document,
  FrontMatter,
  SchemaId,
  Schema,
  TemplateId,
  Template,
  AnalysisId,
  ExtractedData,
  MappedData,
  AnalysisResult,
  AggregatedResult,
  SchemaVersion,
} from "./entities/index.ts";