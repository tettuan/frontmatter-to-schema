/**
 * Template Variable Resolver (refactored)
 *
 * This file has been refactored following DDD and Totality principles:
 * - Decomposed monolithic service (618 lines → focused re-exports)
 * - Proper domain service separation with single responsibility principle
 * - Extracted value objects, services, and utilities to separate concerns
 *
 * NOTE: Maintained functional compatibility while improving architectural design
 * The refactoring follows DDD bounded context separation and service composition
 */

// Re-export value objects
export type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";
export {
  ConditionalTemplateVariable,
  PathTemplateVariable,
  SimpleTemplateVariable,
} from "../value-objects/template-variable.value-object.ts";

export type {
  TemplateProcessingError,
  TemplateProcessingResult,
  VariableResolutionResult,
} from "../value-objects/variable-resolution-result.value-object.ts";

// Re-export services following DDD separation
export { TemplateVariableExtractor } from "./template-variable-extractor.service.ts";
export { TemplateVariableParser } from "./template-variable-parser.service.ts";
export { TemplateVariableResolverImpl } from "./template-variable-resolver-impl.service.ts";
export { TemplateProcessor } from "./template-processor.service.ts";
export { TemplateVariableOrchestrator } from "./template-variable-orchestrator.service.ts";

// Re-export utilities
export {
  isConditionalEvaluationFailed,
  isConditionalVariable,
  isDefaultUsed,
  isPartialSuccess,
  isPathNotResolved,
  isPathVariable,
  isProcessingFailed,
  isProcessingSuccess,
  isResolutionSuccess,
  isSimpleVariable,
  isVariableNotFound,
} from "../utils/template-variable-guards.ts";

// Re-export constants
export {
  PATH_NAVIGATION_KINDS,
  type PathNavigationKind,
  RESOLUTION_RESULT_KINDS,
  type ResolutionResultKind,
  TEMPLATE_VARIABLE_KINDS,
  type TemplateVariableKind,
} from "./template-resolution-constants.ts";

// Import for internal use
import { TemplateVariableOrchestrator } from "./template-variable-orchestrator.service.ts";
import type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";

// Main class for backward compatibility (facade pattern)
export class TemplateVariableResolver {
  private orchestrator: TemplateVariableOrchestrator;

  constructor() {
    this.orchestrator = new TemplateVariableOrchestrator();
  }

  /**
   * Extract variables from template content
   * @deprecated Use TemplateVariableOrchestrator directly for better separation of concerns
   */
  extractVariables(templateContent: string) {
    return this.orchestrator.extractVariables(templateContent);
  }

  /**
   * Process template by resolving and substituting variables
   * @deprecated Use TemplateVariableOrchestrator directly for better separation of concerns
   */
  processTemplate(
    templateContent: string,
    data: Record<string, unknown>,
    allowPartialResolution = false,
  ) {
    return this.orchestrator.processTemplate(
      templateContent,
      data,
      allowPartialResolution,
    );
  }

  /**
   * Resolve a single variable against provided data
   * @deprecated Use TemplateVariableOrchestrator directly for better separation of concerns
   */
  resolveVariable(
    variable: TemplateVariable,
    data: Record<string, unknown>,
    useDefaults: boolean,
  ) {
    return this.orchestrator.resolveVariable(variable, data, useDefaults);
  }

  /**
   * Parse variable content from template
   * @deprecated Use TemplateVariableOrchestrator directly for better separation of concerns
   */
  parseVariableContent(content: string, placeholder: string) {
    return this.orchestrator.parseVariableContent(content, placeholder);
  }
}
