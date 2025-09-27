export { CLI } from "./src/presentation/cli/index.ts";

// New 3-domain architecture exports
export { ThreeDomainOrchestrator } from "./src/application/coordinators/three-domain-orchestrator.ts";
export type {
  ProcessingConfiguration,
  ThreeDomainProcessingResult,
} from "./src/application/coordinators/three-domain-orchestrator.ts";

export { FrontmatterAnalysisDomainService } from "./src/domain/frontmatter/services/frontmatter-analysis-domain-service.ts";
export { TemplateManagementDomainService } from "./src/domain/template/services/template-management-domain-service.ts";
export { DataProcessingInstructionDomainService } from "./src/domain/data-processing/services/data-processing-instruction-domain-service.ts";

export * from "./src/domain/shared/types/index.ts";
export * from "./src/domain/schema/index.ts";
export * from "./src/domain/frontmatter/index.ts";
export * from "./src/domain/template/index.ts";
