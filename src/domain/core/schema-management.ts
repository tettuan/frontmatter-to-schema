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
export { SchemaLoader } from "../services/schema-loader.service.ts";
export type { FileSystemAdapter } from "../services/schema-loader.service.ts";
export { SchemaSwitcher } from "../services/schema-switcher.service.ts";
export { ExecutablePipeline } from "../services/executable-pipeline.service.ts";

// Re-export deprecated factory (for backward compatibility)
export { DynamicPipelineFactory } from "../services/dynamic-pipeline-factory.service.ts";

// Re-export type definitions
export type {
  ExecutionConfiguration,
  PipelineOutput,
  SchemaProcessor,
} from "../types/pipeline-types.ts";
