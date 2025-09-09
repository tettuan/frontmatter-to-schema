// Re-export all entities from split domain contexts

// Document Management Context
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
} from "../../frontmatter/entities/frontmatter.ts";
export { Document, DocumentId } from "../../document/entities/document.ts";

// FrontMatter Context
export type { PathResolutionResult } from "../../frontmatter/entities/frontmatter.ts";
export { FrontMatter } from "../../frontmatter/entities/frontmatter.ts";

// Schema Management Context
export type { ValidatedData } from "../../schema/entities/schema.ts";
export { Schema, SchemaId } from "../../schema/entities/schema.ts";

// Template Management Context
export type {
  TemplateApplicationMode,
  TemplateParsingResult,
} from "../../template/entities/template-core.ts";
export { Template, TemplateId } from "../../template/entities/template-core.ts";

// Aggregation Context
export {
  AggregatedResult,
  AnalysisId,
  AnalysisResult,
  ExtractedData,
  MappedData,
} from "../../aggregation/entities/aggregation.ts";

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "../value-objects.ts";
