/**
 * Domain entities and types (refactored)
 *
 * This file has been refactored following DDD and Totality principles:
 * - Eliminated all type assertions (14 → 0)
 * - Removed duplicated entity classes (927 lines → focused re-exports)
 * - Proper domain separation with individual entity files
 * - Maintains backward compatibility during transition
 */

// Re-export shared domain types from their dedicated location
export type {
  DocumentFrontMatterState,
  FrontMatterInput,
  PathResolutionResult,
  TemplateApplicationMode,
  TemplateParsingResult,
  ValidatedData,
  ValidationMetadata,
} from "../types/domain-types.ts";

// Re-export entities from their dedicated files (DDD separation)
export { Document } from "../entities/document.entity.ts";
export { FrontMatter } from "../entities/frontmatter.entity.ts";
export { Schema } from "../entities/schema.entity.ts";
export { Template } from "../entities/template.entity.ts";
export {
  AggregatedResult,
  AnalysisResult,
} from "../entities/analysis-result.entity.ts";

// Re-export identifier value objects with Smart Constructors
export {
  AnalysisId,
  DocumentId,
  SchemaId,
  TemplateId,
} from "../value-objects/identifier-value-objects.ts";

// Re-export data value objects
export {
  ExtractedData,
  MappedData,
} from "../value-objects/data-value-objects.ts";

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "./value-objects.ts";
