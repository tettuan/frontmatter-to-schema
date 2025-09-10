/**
 * Template Processing Types - Domain Models
 * Defines all template processing interfaces and discriminated unions
 * Part of Template Context - Domain Layer
 * Follows Totality principles with discriminated unions
 */

import type { PlaceholderPatternType } from "../services/placeholder-pattern.ts";

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
 * Template Processing Options (from TypeScriptTemplateProcessor)
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
  readonly mappings?: Record<string, string>;
  readonly schemaPath?: string;
}
