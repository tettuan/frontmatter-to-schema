/**
 * VariableResolver Domain Service
 *
 * Handles template variable resolution and extraction following DDD and Totality principles
 * Consolidates variable resolution business logic into a single domain service
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type { TemplateDefinition } from "../../value-objects/template-definition.ts";
import type { FrontmatterData } from "../../value-objects/frontmatter-data.ts";

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
  readonly name: string;
  readonly path: string;
  readonly type: VariableType;
  readonly defaultValue?: unknown;
  readonly required: boolean;
}

/**
 * Variable types as discriminated union
 */
export type VariableType =
  | "simple"
  | "nested"
  | "conditional"
  | "loop"
  | "computed";

/**
 * Variable resolution result
 */
export interface VariableResolution {
  readonly variable: VariableDefinition;
  readonly resolved: boolean;
  readonly value: unknown;
  readonly source: "data" | "default" | "computed";
  readonly error?: string;
}

/**
 * Variable extraction result
 */
export interface VariableExtractionResult {
  readonly variables: VariableDefinition[];
  readonly patterns: string[];
  readonly totalCount: number;
}

/**
 * Resolution context
 */
export interface ResolutionContext {
  readonly data: Record<string, unknown>;
  readonly allowDefaults: boolean;
  readonly strictMode: boolean;
  readonly computedValues?: Record<string, unknown>;
}

/**
 * VariableResolver domain service for resolving template variables
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class VariableResolver {
  private constructor() {}

  /**
   * Smart Constructor for VariableResolver
   * @returns Result containing VariableResolver
   */
  static create(): Result<
    VariableResolver,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new VariableResolver(),
    };
  }

  /**
   * Extract variables from template definition
   * @param template - TemplateDefinition to extract variables from
   * @returns Result containing variable extraction result
   */
  extractVariables(
    template: TemplateDefinition,
  ): Result<VariableExtractionResult, DomainError & { message: string }> {
    if (template.isEmpty()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot extract variables from empty template",
        ),
      };
    }

    const content = template.getContent();
    const engine = template.getEngine();

    // Extract variables based on template engine
    const extractionResult = this.extractByEngine(content, engine);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    const patterns = extractionResult.data;

    // Parse patterns into variable definitions
    const variables: VariableDefinition[] = [];
    const uniquePatterns: string[] = [];

    for (const pattern of patterns) {
      if (!uniquePatterns.includes(pattern)) {
        uniquePatterns.push(pattern);

        const variableResult = this.parseVariablePattern(pattern);
        if (variableResult.ok) {
          variables.push(variableResult.data);
        }
      }
    }

    return {
      ok: true,
      data: {
        variables,
        patterns: uniquePatterns,
        totalCount: variables.length,
      },
    };
  }

  /**
   * Resolve variables against frontmatter data
   * @param variables - Array of VariableDefinitions to resolve
   * @param data - FrontmatterData to resolve against
   * @param options - Resolution options
   * @returns Result containing resolution results
   */
  resolveWithFrontmatter(
    variables: VariableDefinition[],
    data: FrontmatterData,
    options: {
      allowDefaults?: boolean;
      strictMode?: boolean;
    } = {},
  ): Result<VariableResolution[], DomainError & { message: string }> {
    if (data.isEmpty()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot resolve variables with empty frontmatter data",
        ),
      };
    }

    const context: ResolutionContext = {
      data: data.getData(),
      allowDefaults: options.allowDefaults ?? true,
      strictMode: options.strictMode ?? false,
    };

    return this.resolveWithContext(variables, context);
  }

  /**
   * Resolve variables against data context
   * @param variables - Array of VariableDefinitions to resolve
   * @param context - ResolutionContext for resolution
   * @returns Result containing resolution results
   */
  resolveWithContext(
    variables: VariableDefinition[],
    context: ResolutionContext,
  ): Result<VariableResolution[], DomainError & { message: string }> {
    const resolutions: VariableResolution[] = [];

    for (const variable of variables) {
      const resolution = this.resolveVariable(variable, context);
      resolutions.push(resolution);

      // In strict mode, fail fast on required variable resolution failures
      if (context.strictMode && variable.required && !resolution.resolved) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "MissingRequiredField",
              fields: [variable.name],
            },
            `Required variable '${variable.name}' could not be resolved`,
          ),
        };
      }
    }

    return { ok: true, data: resolutions };
  }

  /**
   * Compute derived variables from existing data
   * @param data - Base data for computation
   * @param computationRules - Rules for computing derived values
   * @returns Result containing computed variables
   */
  computeDerivedVariables(
    data: Record<string, unknown>,
    computationRules: Array<{
      name: string;
      expression: string;
      dependencies: string[];
    }>,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const computed: Record<string, unknown> = {};

    for (const rule of computationRules) {
      // Check if all dependencies are available
      const missingDeps = rule.dependencies.filter((dep) => !(dep in data));
      if (missingDeps.length > 0) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "MissingRequiredField",
              fields: missingDeps,
            },
            `Missing dependencies for computed variable '${rule.name}': ${
              missingDeps.join(", ")
            }`,
          ),
        };
      }

      // Compute value based on expression
      const computeResult = this.evaluateExpression(rule.expression, data);
      if (!computeResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ComputationError",
              expression: rule.expression,
              details: `Available data keys: ${Object.keys(data).join(", ")}`,
            },
            `Failed to compute variable '${rule.name}': ${computeResult.error.message}`,
          ),
        };
      }

      computed[rule.name] = computeResult.data;
    }

    return { ok: true, data: computed };
  }

  /**
   * Validate variable resolution completeness
   * @param resolutions - Array of VariableResolutions to validate
   * @returns Result containing validation summary
   */
  validateResolutions(
    resolutions: VariableResolution[],
  ): Result<{
    complete: boolean;
    resolved: number;
    unresolved: string[];
    errors: string[];
  }, DomainError & { message: string }> {
    const unresolved: string[] = [];
    const errors: string[] = [];
    let resolved = 0;

    for (const resolution of resolutions) {
      if (resolution.resolved) {
        resolved++;
      } else {
        unresolved.push(resolution.variable.name);
        if (resolution.error) {
          errors.push(`${resolution.variable.name}: ${resolution.error}`);
        }
      }
    }

    const complete = unresolved.length === 0;

    return {
      ok: true,
      data: {
        complete,
        resolved,
        unresolved,
        errors,
      },
    };
  }

  /**
   * Extract variable patterns by template engine
   * @param content - Template content
   * @param engine - Template engine type
   * @returns Result containing extracted patterns
   */
  private extractByEngine(
    content: string,
    engine: import("../../value-objects/template-definition.ts").TemplateEngine,
  ): Result<string[], DomainError & { message: string }> {
    const patterns: string[] = [];

    switch (engine) {
      case "handlebars":
      case "mustache": {
        // Extract {{variable}} patterns
        const matches = content.matchAll(/\{\{\s*([^}]+)\s*\}\}/g);
        for (const match of matches) {
          patterns.push(match[1].trim());
        }

        // Extract {{#if variable}} block helper patterns
        const blockMatches = content.matchAll(
          /\{\{\s*#(if|unless|each|with)\s+([^}]+)\s*\}\}/g,
        );
        for (const match of blockMatches) {
          const helper = match[1];
          const variable = match[2].trim();
          // Mark as conditional by adding a special marker
          patterns.push(`${helper}:${variable}`);
        }
        break;
      }

      case "liquid": {
        // Extract {{variable}} and {% variable %} patterns
        const outputMatches = content.matchAll(/\{\{\s*([^}]+)\s*\}\}/g);
        for (const match of outputMatches) {
          patterns.push(match[1].trim());
        }

        const tagMatches = content.matchAll(/\{%\s*([^%]+)\s*%\}/g);
        for (const match of tagMatches) {
          const tagContent = match[1].trim();
          // Extract variable names from liquid tags
          const varMatch = tagContent.match(/(?:assign|for|if)\s+(\w+)/);
          if (varMatch) {
            patterns.push(varMatch[1]);
          }
        }
        break;
      }

      case "ejs": {
        // Extract <%=variable%> patterns
        const matches = content.matchAll(/<%=\s*([^%]+)\s*%>/g);
        for (const match of matches) {
          patterns.push(match[1].trim());
        }
        break;
      }

      case "html":
      case "text": {
        // Extract {variable} patterns
        const matches = content.matchAll(/\{\s*([^}]+)\s*\}/g);
        for (const match of matches) {
          patterns.push(match[1].trim());
        }
        break;
      }

      case "pug":
      case "custom": {
        // For custom engines, extract #{variable} patterns as default
        const matches = content.matchAll(/#\{\s*([^}]+)\s*\}/g);
        for (const match of matches) {
          patterns.push(match[1].trim());
        }
        break;
      }

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = engine;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "supported template engine",
            },
            `Unsupported template engine for variable extraction: ${
              String(_exhaustiveCheck)
            }`,
          ),
        };
      }
    }

    return { ok: true, data: patterns };
  }

  /**
   * Parse variable pattern into definition
   * @param pattern - Variable pattern to parse
   * @returns Result containing variable definition
   */
  private parseVariablePattern(
    pattern: string,
  ): Result<VariableDefinition, DomainError & { message: string }> {
    // Handle special conditional patterns like "if:admin"
    let actualPattern = pattern;
    let isConditionalBlock = false;

    if (pattern.includes(":")) {
      const colonParts = pattern.split(":");
      if (
        colonParts.length === 2 &&
        ["if", "unless", "each", "with"].includes(colonParts[0])
      ) {
        actualPattern = colonParts[1];
        isConditionalBlock = true;
      }
    }

    // Remove any modifiers and extract base variable name
    const cleanPattern = actualPattern.replace(/[|?!]/g, " ").trim();
    const parts = cleanPattern.split(/\s+/);
    const name = parts[0];

    if (!name || !/^[a-zA-Z_][\w.]*$/.test(name)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: pattern,
            expectedFormat: "valid variable name",
          },
          `Invalid variable pattern: ${pattern}`,
        ),
      };
    }

    // Determine variable type
    let type: VariableType = "simple";
    if (name.includes(".")) {
      type = "nested";
    }
    if (isConditionalBlock || actualPattern.includes("?")) {
      type = "conditional";
    }
    if (pattern.includes("for") || pattern.includes("each")) {
      type = "loop";
    }

    // Check for default value
    let defaultValue: unknown;
    let required = true;

    if (actualPattern.includes("|")) {
      const defaultMatch = actualPattern.match(/\|\s*(.+)$/);
      if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
        required = false;
      }
    }

    return {
      ok: true,
      data: {
        name,
        path: name,
        type,
        defaultValue,
        required,
      },
    };
  }

  /**
   * Resolve a single variable
   * @param variable - Variable definition to resolve
   * @param context - Resolution context
   * @returns Variable resolution result
   */
  private resolveVariable(
    variable: VariableDefinition,
    context: ResolutionContext,
  ): VariableResolution {
    // Try to get value from data
    const dataValue = this.getValueByPath(context.data, variable.path);

    if (dataValue !== undefined) {
      return {
        variable,
        resolved: true,
        value: dataValue,
        source: "data",
      };
    }

    // Try computed values if available
    if (context.computedValues && variable.name in context.computedValues) {
      return {
        variable,
        resolved: true,
        value: context.computedValues[variable.name],
        source: "computed",
      };
    }

    // Try default value if allowed
    if (context.allowDefaults && variable.defaultValue !== undefined) {
      return {
        variable,
        resolved: true,
        value: variable.defaultValue,
        source: "default",
      };
    }

    // Resolution failed
    return {
      variable,
      resolved: false,
      value: undefined,
      source: "data",
      error: `Variable '${variable.name}' not found in data`,
    };
  }

  /**
   * Get value from object by dot notation path
   * @param obj - Object to search
   * @param path - Dot notation path
   * @returns Value or undefined
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (
        typeof current === "object" &&
        key in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate simple expression
   * @param expression - Expression to evaluate
   * @param data - Data context
   * @returns Result containing evaluated value
   */
  private evaluateExpression(
    expression: string,
    data: Record<string, unknown>,
  ): Result<unknown, DomainError & { message: string }> {
    try {
      // Simple expression evaluation - for now just handle basic cases
      if (expression.includes("length")) {
        const arrayMatch = expression.match(/(\w+)\.length/);
        if (arrayMatch) {
          const arrayValue = data[arrayMatch[1]];
          if (Array.isArray(arrayValue)) {
            return { ok: true, data: arrayValue.length };
          }
        }
      }

      if (expression.includes("count")) {
        const objectMatch = expression.match(/(\w+)\.count/);
        if (objectMatch) {
          const objectValue = data[objectMatch[1]];
          if (typeof objectValue === "object" && objectValue !== null) {
            return { ok: true, data: Object.keys(objectValue).length };
          }
        }
      }

      // Default: return the expression as a literal
      return { ok: true, data: expression };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ComputationError",
            expression,
            details: error instanceof Error ? error.message : String(error),
          },
          `Failed to evaluate expression: ${expression}`,
        ),
      };
    }
  }
}
