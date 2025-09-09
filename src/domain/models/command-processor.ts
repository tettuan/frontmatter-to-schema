/**
 * Command Processor - Backward Compatibility Layer
 *
 * This file maintains backward compatibility while delegating to the new DDD structure.
 *
 * @deprecated Use the new structure:
 * - Command domain: src/domain/command/
 * - CommandProcessingContext: src/application/services/command-processing-context.ts
 * - ProcessCommandUseCase: src/application/use-cases/process-command.ts
 */

// Re-export Command domain types and classes
export type {
  CommandCreationData,
  CommandOptions,
  ProcessingMode,
} from "../command/index.ts";
export { Command } from "../command/index.ts";

// Re-export Application services and use cases
export { CommandProcessingContext } from "../../application/services/command-processing-context.ts";
export { ProcessCommandUseCase as CommandProcessor } from "../../application/use-cases/process-command.ts";
