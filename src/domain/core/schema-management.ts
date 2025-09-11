/**
 * Dynamic Schema Management Layer (refactored)
 *
 * This file has been refactored following DDD and Totality principles:
 * - Eliminated all type assertions (4 → 0) using Smart Constructors and type guards
 * - Decomposed monolithic file (630 lines → focused re-exports)
 * - Proper domain service separation with single responsibility principle
 *
 * NOTE: Some tests may need updating to use the new Totality-compliant APIs
 * The refactoring maintains functional compatibility while improving type safety
 */

// Re-export value objects
export { ValidSchema } from "../value-objects/valid-schema.value-object.ts";

// Re-export services following DDD separation
export { SchemaLoader } from "../../application/services/schema-loader.service.ts";
export type { FileSystemAdapter } from "../../application/services/schema-loader.service.ts";
// Note: SchemaSwitcher and ExecutablePipeline have been removed in DDD refactoring

// Deprecated factory removed - use ComponentFactory instead

// Re-export type definitions
export type {
  ExecutionConfiguration,
  PipelineOutput,
  SchemaProcessor,
} from "../types/pipeline-types.ts";
