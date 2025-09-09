/**
 * Template Variable Extractor Service
 * Extracted from template-variable-resolver.ts for better domain separation
 * Handles extraction of variables from template content following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { TemplateVariable } from "../value-objects/template-variable.value-object.ts";
// deno-lint-ignore verbatim-module-syntax
import { TemplateVariableParser } from "./template-variable-parser.service.ts";

/**
 * Template Variable Extractor Service - Extracts variables from template strings
 */
export class TemplateVariableExtractor {
  constructor(
    private readonly parser: TemplateVariableParser,
  ) {}

  /**
   * Extract variables from template content
   * Supports patterns: {{variableName}}, {{path.to.value}}, {{condition ? trueValue : falseValue}}
   */
  extractVariables(
    templateContent: string,
  ): Result<TemplateVariable[], DomainError & { message: string }> {
    if (!templateContent || templateContent.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "templateContent",
        }, "Template content cannot be empty"),
      };
    }

    const variables: TemplateVariable[] = [];
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(templateContent)) !== null) {
      const placeholder = match[0]; // Full {{...}} string
      const content = match[1].trim();

      const variableResult = this.parser.parseVariableContent(
        content,
        placeholder,
      );
      if (!variableResult.ok) {
        return variableResult;
      }

      // Check for duplicate variables
      const existingVariable = variables.find((v) =>
        v.placeholder === placeholder
      );
      if (!existingVariable) {
        variables.push(variableResult.data);
      }
    }

    return { ok: true, data: variables };
  }
}
