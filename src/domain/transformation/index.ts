// Transformation Orchestration Domain Exports
// This module provides transformation pipeline coordination following DDD principles

// Interfaces
export type {
  TransformationConfig,
  TransformationError,
  TransformationMetadata,
  TransformationOrchestrator,
  TransformationOutput,
} from "./interfaces/transformation-orchestrator.ts";

// Services
export { PipelineTransformationOrchestrator } from "./services/pipeline-transformation-orchestrator.ts";

// Factories
export { PipelineTransformationOrchestratorFactory } from "./factories/pipeline-transformation-orchestrator-factory.ts";
export type { PipelineTransformationOrchestratorConfig } from "./factories/pipeline-transformation-orchestrator-factory.ts";

// Adapters
export { FrontmatterTransformationServiceAdapter } from "./adapters/frontmatter-transformation-service-adapter.ts";
