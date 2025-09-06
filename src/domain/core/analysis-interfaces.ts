/**
 * Core Analysis Interfaces and Type Definitions
 *
 * These interfaces follow the Totality principle and Domain-Driven Design:
 * - Discriminated unions ensure exhaustive pattern matching
 * - Result types for error handling without exceptions
 * - Type-safe interfaces for analysis components
 */

import type { AnalysisError, Result } from "./result.ts";
import type { AnalysisContext, TemplateDefinition } from "./types.ts";
import type {
  FrontMatterContent,
  SchemaDefinition,
} from "../models/value-objects.ts";
// Note: These imports are kept for potential future use in other split files
// import type {
//   AnalysisContext as AbstractAnalysisContext,
//   SchemaBasedAnalyzer as AbstractSchemaBasedAnalyzer,
//   TemplateMapper as AbstractTemplateMapper,
// } from "./abstractions.ts";

/**
 * Totality-compliant discriminated unions for analysis engine states
 */
export type InputValidationResult<T> = {
  kind: "Valid";
  value: T;
} | {
  kind: "Invalid";
  reason: string;
};

export type TimeoutState = {
  kind: "Active";
  id: number;
} | {
  kind: "Cleared";
} | {
  kind: "NotSet";
};

export type SchemaValidationCapability = {
  kind: "HasValidation";
  validate: (data: unknown) => { ok: boolean; data?: unknown; error?: unknown };
} | {
  kind: "NoValidation";
};

export type TemplateParsingResult = {
  kind: "Parsed";
  structure: Record<string, unknown>;
  mappingRules: MappingRulesResult;
} | {
  kind: "ParseFailed";
  fallbackStructure: Record<string, unknown>;
  mappingRules: MappingRulesResult;
};

export type MappingRulesResult = {
  kind: "Present";
  rules: Record<string, string>;
} | {
  kind: "NotPresent";
};

/**
 * Core Analysis Domain Interfaces - The gravitational center of the system
 * Following DDD backbone center line principle
 */

/**
 * Central Analysis Engine - Longest lifetime, highest frequency component
 */
export interface AnalysisEngine {
  analyze<TInput, TOutput>(
    input: TInput,
    strategy: AnalysisStrategy<TInput, TOutput>,
  ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
}

/**
 * Analysis Strategy - Pluggable analysis behavior
 */
export interface AnalysisStrategy<TInput, TOutput> {
  readonly name: string;
  execute(
    input: TInput,
    context: AnalysisContext,
  ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
}

/**
 * Schema-based Analyzer - Type-safe schema processing
 */
export interface SchemaBasedAnalyzer<TSchema, TResult> {
  process(
    data: FrontMatterContent,
    schema: SchemaDefinition,
  ): Promise<Result<TResult, AnalysisError & { message: string }>>;
}

/**
 * Internal Template Mapper - Handles transformation from source to target
 */
export interface InternalTemplateMapper<TSource, TTarget> {
  mapInternal(
    source: TSource,
    template: TemplateDefinition,
  ): Result<TTarget, AnalysisError & { message: string }>;
}
