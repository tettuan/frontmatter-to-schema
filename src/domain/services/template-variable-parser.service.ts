/**
 * Template Variable Parser Service
 * Extracted from template-variable-resolver.ts for better domain separation
 * Handles parsing of variable content into typed objects following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import {
  ConditionalTemplateVariable,
  PathTemplateVariable,
  SimpleTemplateVariable,
  type TemplateVariable,
} from "../value-objects/template-variable.value-object.ts";
import { PropertyPath } from "../models/property-path.ts";

/**
 * Template Variable Parser Service - Parses variable content into typed objects
 */
export class TemplateVariableParser {
  /**
   * Parse variable content from template
   */
  parseVariableContent(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    // Check for conditional variable (contains ? and :)
    if (content.includes("?") && content.includes(":")) {
      return this.parseConditionalVariable(content, placeholder);
    }

    // Check for path variable (contains dots)
    if (content.includes(".")) {
      return this.parsePathVariable(content, placeholder);
    }

    // Default to simple variable
    return this.parseSimpleVariable(content, placeholder);
  }

  /**
   * Parse simple variable: variableName or variableName|defaultValue
   */
  private parseSimpleVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const parts = content.split("|").map((p) => p.trim());
    const name = parts[0];
    const defaultValue = parts[1]?.trim();

    return SimpleTemplateVariable.create(name, placeholder, defaultValue);
  }

  /**
   * Parse path variable: path.to.value or path.to.value|defaultValue
   */
  private parsePathVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const parts = content.split("|").map((p) => p.trim());
    const pathStr = parts[0];
    const defaultValue = parts[1]?.trim();

    if (!pathStr || pathStr.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "path",
        }, "Path cannot be empty"),
      };
    }

    // Create PropertyPath from string
    const pathResult = PropertyPath.create(pathStr);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Use the path string as the name for path variables
    const name = pathStr.replace(/\./g, "_"); // Convert path to valid identifier

    return PathTemplateVariable.create(
      name,
      pathResult.data,
      placeholder,
      defaultValue,
    );
  }

  /**
   * Parse conditional variable: condition ? trueValue : falseValue
   */
  private parseConditionalVariable(
    content: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    const questionIndex = content.indexOf("?");
    const colonIndex = content.indexOf(":");

    if (
      questionIndex === -1 || colonIndex === -1 || questionIndex >= colonIndex
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: content,
          expectedFormat: "condition ? trueValue : falseValue",
        }),
      };
    }

    const condition = content.substring(0, questionIndex).trim();
    const trueValue = content.substring(questionIndex + 1, colonIndex).trim();
    const falseValue = content.substring(colonIndex + 1).trim();

    // Use condition as name for conditional variables
    const name = condition.replace(/[^a-zA-Z0-9_]/g, "_");

    return ConditionalTemplateVariable.create(
      name,
      condition,
      trueValue,
      falseValue,
      placeholder,
    );
  }
}
