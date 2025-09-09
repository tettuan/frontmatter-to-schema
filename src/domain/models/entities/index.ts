// Re-export all entities from split domain contexts

// Document Management Context
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
} from "../../document/entities.ts";
export { Document, DocumentId } from "../../document/entities.ts";

// FrontMatter Context
export type { PathResolutionResult } from "../../frontmatter/entities.ts";
export { FrontMatter } from "../../frontmatter/entities.ts";

// Schema Management Context
export type { ValidatedData } from "../../entities/schema.ts";
export { Schema } from "../../entities/schema.ts";
export { SchemaId } from "../../value-objects/ids.ts";

// Template Management Context
export type {
  TemplateApplicationMode,
  TemplateParsingResult,
} from "../../template/entities.ts";
export { Template, TemplateId } from "../../template/entities.ts";

// Analysis Context
export {
  AggregatedResult,
  AnalysisId,
  AnalysisResult,
  ExtractedData,
  MappedData,
} from "../../analysis/entities.ts";

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "../value-objects.ts";
