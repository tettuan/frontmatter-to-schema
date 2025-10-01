/**
 * JSON Template Processing Module
 *
 * A module for processing JSON templates with variable substitution support.
 * Supports dot notation and array access for complex data structures.
 *
 * Public API:
 * - createTemplateProcessor(): Factory function to create a processor instance
 * - JsonTemplateProcessor: Interface for the processor
 * - Error classes: For error handling
 * - Type definitions: For TypeScript support
 *
 * Internal implementation classes (JsonTemplateProcessorImpl, VariableResolver)
 * are not exported to maintain proper encapsulation.
 */

// Internal imports - not exported
import type { JsonTemplateProcessor } from "./types.ts";
import { JsonTemplateProcessorImpl } from "./template-processor.ts";

// Public API: Error classes
export {
  InvalidJsonError,
  JsonTemplateError,
  TemplateNotFoundError,
  TemplateReadError,
  VariableNotFoundError,
} from "./errors.ts";

// Public API: Type definitions
export type {
  JsonTemplateProcessor,
  ProcessingResult,
  TemplateProcessingError,
  VariableValue,
} from "./types.ts";

// Public API: Factory function (recommended entry point)
export function createTemplateProcessor(): JsonTemplateProcessor {
  return new JsonTemplateProcessorImpl();
}
