/**
 * JSON Template Processing Module
 *
 * A module for processing JSON templates with variable substitution support.
 * Supports dot notation and array access for complex data structures.
 */

export { JsonTemplateProcessorImpl } from "./template-processor.ts";
export { VariableResolver } from "./variable-resolver.ts";
export {
  InvalidJsonError,
  JsonTemplateError,
  TemplateNotFoundError,
  TemplateReadError,
  VariableNotFoundError,
} from "./errors.ts";
export type {
  JsonTemplateProcessor,
  ProcessingResult,
  TemplateProcessingError,
  VariableValue,
} from "./types.ts";

// Import for internal use
import type { JsonTemplateProcessor } from "./types.ts";
import { JsonTemplateProcessorImpl } from "./template-processor.ts";

// Convenience factory function
export function createTemplateProcessor(): JsonTemplateProcessor {
  return new JsonTemplateProcessorImpl();
}
