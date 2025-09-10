/**
 * Placeholder Pattern - Domain Service
 * Handles placeholder pattern creation and validation
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Smart Constructor pattern
 */

import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Placeholder Pattern Types (Constrained Value Type)
 */
export type PlaceholderPatternType =
  | "mustache"
  | "dollar"
  | "percent"
  | "brace";

/**
 * Smart Constructor for Placeholder Patterns (Totality Pattern)
 * Eliminates runtime errors from invalid regex patterns
 */
export class PlaceholderPattern {
  private constructor(
    readonly pattern: RegExp,
    readonly name: PlaceholderPatternType,
  ) {}

  static create(
    patternType: PlaceholderPatternType,
  ): PlaceholderPattern | DomainError {
    switch (patternType) {
      case "mustache":
        return new PlaceholderPattern(/\{\{([^}]+)\}\}/g, "mustache");
      case "dollar":
        return new PlaceholderPattern(/\$\{([^}]+)\}/g, "dollar");
      case "percent":
        return new PlaceholderPattern(/%([^%]+)%/g, "percent");
      case "brace":
        // Matches {variable} or {path.to.variable} - single braces only, not double braces
        // Uses negative lookbehind and lookahead to avoid matching {{...}}
        return new PlaceholderPattern(/(?<!\{)\{([^{}]+)\}(?!\})/g, "brace");
      default:
        return createDomainError({
          kind: "InvalidFormat",
          input: patternType,
          expectedFormat: "mustache, dollar, percent, or brace",
        }, `Unsupported placeholder pattern: ${patternType}`);
    }
  }
}
