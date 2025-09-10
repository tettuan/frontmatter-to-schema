/**
 * Template Context Service - Manages Template Processing Contexts
 * Following DDD and Totality principles with <200 lines (AI complexity control)
 */

import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Template Processing Context - Discriminated Union (Totality Pattern)
 */
export type TemplateProcessingContext =
  | {
    kind: "SimpleReplacement";
    data: Record<string, unknown>;
    placeholderPattern: PlaceholderPatternType;
  }
  | {
    kind: "SchemaGuided";
    data: Record<string, unknown>;
    schema: SchemaDefinition;
    strictMode: boolean;
  }
  | {
    kind: "TypeScriptProcessing";
    mappedData: MappedSchemaData;
    options: TemplateProcessingOptions;
  };

/**
 * Placeholder Pattern Types (Constrained Value Type)
 */
export type PlaceholderPatternType =
  | "mustache"
  | "dollar"
  | "percent"
  | "brace";

/**
 * Processing Result - Discriminated Union (Totality Pattern)
 */
export type TemplateProcessingResult =
  | {
    kind: "Success";
    content: string;
    statistics: ProcessingStatistics;
  }
  | {
    kind: "PartialSuccess";
    content: string;
    statistics: ProcessingStatistics;
    missingVariables: string[];
  };

/**
 * Processing Statistics
 */
export interface ProcessingStatistics {
  readonly replacedVariables: string[];
  readonly totalReplacements: number;
  readonly processingTimeMs: number;
}

/**
 * Template Processing Options
 */
export interface TemplateProcessingOptions {
  readonly handleMissingRequired: "error" | "warning" | "ignore";
  readonly handleMissingOptional: "empty" | "remove" | "keep";
  readonly arrayFormat: "json" | "csv" | "list";
}

/**
 * Schema Definition and MappedSchemaData (domain types)
 */
export interface SchemaDefinition {
  readonly properties: Record<string, unknown>;
  readonly required?: string[];
}

export interface MappedSchemaData {
  readonly data: Record<string, unknown>;
  readonly schemaPath: string;
}

/**
 * Smart Constructor for Placeholder Pattern (Totality Pattern)
 */
export class PlaceholderPattern {
  private constructor(
    readonly pattern: RegExp,
    readonly name: PlaceholderPatternType,
  ) {}

  static create(
    patternType: PlaceholderPatternType,
  ): Result<PlaceholderPattern, DomainError & { message: string }> {
    switch (patternType) {
      case "mustache":
        return {
          ok: true,
          data: new PlaceholderPattern(/\{\{([^}]+)\}\}/g, "mustache"),
        };
      case "dollar":
        return {
          ok: true,
          data: new PlaceholderPattern(/\$\{([^}]+)\}/g, "dollar"),
        };
      case "percent":
        return {
          ok: true,
          data: new PlaceholderPattern(/%([^%]+)%/g, "percent"),
        };
      case "brace":
        // Matches {variable} or {path.to.variable} - single braces only, not double braces
        // Uses negative lookbehind and lookahead to avoid matching {{...}}
        return {
          ok: true,
          data: new PlaceholderPattern(/(?<!\{)\{([^{}]+)\}(?!\})/g, "brace"),
        };
      default: {
        const _exhaustive: never = patternType;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: _exhaustive,
            expectedFormat: "mustache, dollar, percent, or brace",
          }, `Unsupported placeholder pattern: ${_exhaustive}`),
        };
      }
    }
  }
}

/**
 * Smart Constructor for Template Content (Totality Pattern)
 */
export class ValidatedTemplateContent {
  private constructor(readonly content: string) {}

  static create(
    content: unknown,
  ): Result<ValidatedTemplateContent, DomainError & { message: string }> {
    if (typeof content !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof content,
          expectedFormat: "string",
        }, `Template content must be string, got ${typeof content}`),
      };
    }

    if (content.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Template content cannot be empty"),
      };
    }

    return { ok: true, data: new ValidatedTemplateContent(content) };
  }
}

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
export function isValidRecordData(
  data: unknown,
): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

/**
 * Default Template Processing Options
 */
export const DEFAULT_PROCESSING_OPTIONS: TemplateProcessingOptions = {
  handleMissingRequired: "warning",
  handleMissingOptional: "empty",
  arrayFormat: "json",
};
