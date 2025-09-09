/**
 * Template Processor Service
 * Extracted from template-variable-resolver.ts for better domain separation
 * Handles template processing and variable substitution following DDD principles
 */

import type { DomainError, Result } from "../core/result.ts";
import type {
  TemplateProcessingError,
  TemplateProcessingResult,
} from "../value-objects/variable-resolution-result.value-object.ts";
// deno-lint-ignore verbatim-module-syntax
import { TemplateVariableExtractor } from "./template-variable-extractor.service.ts";
// deno-lint-ignore verbatim-module-syntax
import { TemplateVariableResolverImpl } from "./template-variable-resolver-impl.service.ts";
import { RESOLUTION_RESULT_KINDS } from "./template-resolution-constants.ts";

/**
 * Template Processor Service - Processes templates with variable substitution
 */
export class TemplateProcessor {
  constructor(
    private readonly extractor: TemplateVariableExtractor,
    private readonly resolver: TemplateVariableResolverImpl,
  ) {}

  /**
   * Process template by resolving and substituting variables
   */
  processTemplate(
    templateContent: string,
    data: Record<string, unknown>,
    allowPartialResolution = false,
  ): Result<TemplateProcessingResult, DomainError & { message: string }> {
    // Extract variables first
    const variablesResult = this.extractor.extractVariables(templateContent);
    if (!variablesResult.ok) {
      return variablesResult;
    }

    const variables = variablesResult.data;
    let processedTemplate = templateContent;
    const resolvedVariables: string[] = [];
    const unresolvedVariables: Array<
      { name: string; placeholder: string; reason: string }
    > = [];
    const errors: TemplateProcessingError[] = [];

    // Process each variable
    for (const variable of variables) {
      const resolutionResult = this.resolver.resolveVariable(
        variable,
        data,
        true, // Use defaults
      );

      if (!resolutionResult.ok) {
        errors.push({
          variable: variable.name,
          error: resolutionResult.error.message,
        });
        continue;
      }

      switch (resolutionResult.data.kind) {
        case RESOLUTION_RESULT_KINDS.SUCCESS:
        case RESOLUTION_RESULT_KINDS.DEFAULT_USED: {
          const resolvedValue =
            resolutionResult.data.kind === RESOLUTION_RESULT_KINDS.SUCCESS
              ? resolutionResult.data.resolvedValue
              : resolutionResult.data.defaultValue;

          processedTemplate = processedTemplate.replace(
            variable.placeholder,
            resolvedValue,
          );
          resolvedVariables.push(variable.name);
          break;
        }

        case RESOLUTION_RESULT_KINDS.VARIABLE_NOT_FOUND:
        case RESOLUTION_RESULT_KINDS.PATH_NOT_RESOLVED:
        case RESOLUTION_RESULT_KINDS.CONDITIONAL_EVALUATION_FAILED: {
          unresolvedVariables.push({
            name: variable.name,
            placeholder: variable.placeholder,
            reason: this.resolver.getResolutionErrorMessage(
              resolutionResult.data,
            ),
          });
          if (!allowPartialResolution) {
            errors.push({
              variable: variable.name,
              error: this.resolver.getResolutionErrorMessage(
                resolutionResult.data,
              ),
            });
          }
          break;
        }

        default: {
          // Exhaustive check - TypeScript will error if we miss a case
          const _exhaustiveCheck: never = resolutionResult.data;
          errors.push({
            variable: variable.name,
            error: `Unhandled resolution result: ${String(_exhaustiveCheck)}`,
          });
        }
      }
    }

    // Determine result type
    if (errors.length > 0 && !allowPartialResolution) {
      return {
        ok: true,
        data: {
          kind: "ProcessingFailed",
          errors,
        },
      };
    }

    if (unresolvedVariables.length > 0) {
      return {
        ok: true,
        data: {
          kind: "PartialSuccess",
          processedTemplate,
          resolvedVariables,
          unresolvedVariables,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Success",
        processedTemplate,
        resolvedVariables,
      },
    };
  }
}
