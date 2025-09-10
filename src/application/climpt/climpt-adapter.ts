/**
 * Climpt-specific adapter for the generic frontmatter analysis system
 *
 * This module re-exports components from individual service modules
 * for backward compatibility while maintaining better code organization.
 */

// Re-export schema and type definitions
export type {
  ClimptCommand,
  ClimptRegistrySchema,
} from "./models/climpt-schema.models.ts";

// Re-export external services
export { ClaudeCLIService } from "./services/claude-cli.service.ts";

// Re-export file system adapter
export { DenoFileSystemProvider } from "./services/deno-filesystem.service.ts";

// Re-export configuration provider
export { ClimptConfigurationProvider } from "./services/climpt-configuration.service.ts";

// Re-export pipeline service
export { ClimptAnalysisPipeline } from "./services/climpt-pipeline.service.ts";

// Re-export factory service
export { ClimptPipelineFactory } from "./services/climpt-factory.service.ts";
