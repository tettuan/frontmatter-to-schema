// Main entities file - imports from split entity files

// Re-export all entities from split files for backward compatibility
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
  PathResolutionResult,
  TemplateApplicationMode,
  TemplateParsingResult,
  ValidatedData,
  ValidationMetadata,
} from "./entities/index.ts";

export {
  AggregatedResult,
  AnalysisId,
  AnalysisResult,
  Document,
  DocumentId,
  ExtractedData,
  FrontMatter,
  MappedData,
  Schema,
  SchemaId,
  SchemaVersion,
  Template,
  TemplateId,
} from "./entities/index.ts";
