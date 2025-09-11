/**
 * Validation Pattern Configuration - Value Object
 *
 * Eliminates hardcoded regex patterns (Issue #663)
 * Implements Totality principles with Smart Constructor pattern
 * Provides configurable validation pattern management
 */

import type { Result } from "../../core/result.ts";

/**
 * Validation pattern error types following Totality principles
 */
export type ValidationPatternError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "InvalidPattern"; pattern: string; message: string }
  | { kind: "PatternNotFound"; name: string; message: string }
  | { kind: "DuplicatePattern"; name: string; message: string }
  | {
    kind: "CompilationFailed";
    pattern: string;
    error: string;
    message: string;
  };

/**
 * Validation pattern definition
 */
export interface ValidationPattern {
  readonly name: string; // Pattern identifier (e.g., "jsonPath", "identifier")
  readonly pattern: RegExp; // Compiled regex pattern
  readonly description: string; // Human-readable description
  readonly flags?: string; // Regex flags (i, g, m, etc.)
  readonly examples?: readonly string[]; // Example inputs that should match
}

/**
 * Pattern categories for organization
 */
export type PatternCategory =
  | "identifier" // Variable/field name patterns
  | "path" // File path patterns
  | "expression" // Expression patterns (JSONPath, etc.)
  | "format" // Data format patterns
  | "custom"; // User-defined patterns

/**
 * Default validation patterns
 * Consolidates hardcoded regex from the codebase
 */
const DEFAULT_PATTERNS: readonly ValidationPattern[] = [
  // From domain/aggregation/value-objects.ts:55
  {
    name: "jsonPathExpression",
    pattern: /^[a-zA-Z_][a-zA-Z0-9_]*(\[\])?(\.)?.*$/,
    description:
      "JSONPath expression for data aggregation (e.g., 'commands[].c1')",
    examples: ["commands[].c1", "items.name", "data.values"],
  },

  // Common identifier patterns
  {
    name: "identifier",
    pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    description: "Valid programming identifier (letters, numbers, underscore)",
    examples: ["variableName", "field_name", "_internal"],
  },

  {
    name: "camelCaseIdentifier",
    pattern: /^[a-z][a-zA-Z0-9]*$/,
    description: "Camel case identifier starting with lowercase",
    examples: ["fieldName", "myVariable", "getData"],
  },

  {
    name: "pascalCaseIdentifier",
    pattern: /^[A-Z][a-zA-Z0-9]*$/,
    description: "Pascal case identifier starting with uppercase",
    examples: ["ClassName", "MyComponent", "DataType"],
  },

  // File path patterns
  {
    name: "unixPath",
    pattern: /^(\/|\.\/|\.\.\/)?([^\/\0]+\/)*[^\/\0]*$/,
    description: "Unix-style file path",
    examples: ["/usr/local/bin", "./config.json", "../data/file.txt"],
  },

  {
    name: "windowsPath",
    pattern: /^([A-Za-z]:)?(\\|\/)?([^\\\/\0]+[\\\/])*[^\\\/\0]*$/,
    description: "Windows-style file path",
    examples: ["C:\\Users\\data", "D:/projects/file.txt", "relative\\path"],
  },

  // Data format patterns
  {
    name: "semver",
    pattern: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
    description: "Semantic version (e.g., 1.2.3, 2.0.0-beta.1)",
    examples: ["1.0.0", "2.1.3-alpha", "3.0.0+build.123"],
  },

  {
    name: "uuid",
    pattern:
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    description: "UUID format",
    examples: ["550e8400-e29b-41d4-a716-446655440000"],
  },

  // Email and URL patterns
  {
    name: "email",
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    description: "Basic email format validation",
    examples: ["user@example.com", "test.user@domain.org"],
  },

  {
    name: "url",
    pattern: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
    description: "HTTP/HTTPS URL format",
    examples: ["https://example.com", "http://localhost:3000/api"],
  },
] as const;

/**
 * Validation Pattern Configuration Value Object
 *
 * Follows Smart Constructor pattern with Result type
 * Eliminates hardcoded regex patterns throughout the codebase
 */
export class ValidationPatternConfig {
  private readonly patterns = new Map<string, ValidationPattern>();
  private readonly categorizedPatterns = new Map<
    PatternCategory,
    ValidationPattern[]
  >();

  private constructor(
    private readonly id: string,
    initialPatterns: readonly ValidationPattern[],
  ) {
    this.registerPatterns(initialPatterns);
  }

  /**
   * Smart Constructor with default patterns
   */
  static createDefault(): Result<
    ValidationPatternConfig,
    ValidationPatternError
  > {
    const id = `pattern-config-${Date.now()}-${
      Math.random().toString(36).substr(2, 9)
    }`;

    try {
      return {
        ok: true,
        data: new ValidationPatternConfig(id, DEFAULT_PATTERNS),
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "CompilationFailed",
          pattern: "default_patterns",
          error: error instanceof Error ? error.message : String(error),
          message: "Failed to create default validation pattern config",
        },
      };
    }
  }

  /**
   * Smart Constructor with custom patterns
   */
  static create(
    patterns: readonly ValidationPattern[],
    id?: string,
  ): Result<ValidationPatternConfig, ValidationPatternError> {
    if (patterns.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "At least one validation pattern is required",
        },
      };
    }

    const configId = id || `custom-pattern-config-${Date.now()}`;

    try {
      return {
        ok: true,
        data: new ValidationPatternConfig(configId, patterns),
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "CompilationFailed",
          pattern: "custom_patterns",
          error: error instanceof Error ? error.message : String(error),
          message: "Failed to create custom validation pattern config",
        },
      };
    }
  }

  /**
   * Register patterns with validation
   */
  private registerPatterns(patterns: readonly ValidationPattern[]): void {
    for (const pattern of patterns) {
      this.registerSinglePattern(pattern);
    }
  }

  private registerSinglePattern(pattern: ValidationPattern): void {
    // Validate pattern name
    if (!pattern.name || pattern.name.trim().length === 0) {
      throw new Error(`Pattern name cannot be empty`);
    }

    // Check for duplicates
    if (this.patterns.has(pattern.name)) {
      throw new Error(`Duplicate pattern name: ${pattern.name}`);
    }

    // Validate regex pattern
    try {
      // Test the pattern to ensure it's valid
      pattern.pattern.test("test");
    } catch (error) {
      throw new Error(`Invalid regex pattern for ${pattern.name}: ${error}`);
    }

    this.patterns.set(pattern.name, pattern);
  }

  /**
   * Validate input against a pattern
   * Replaces hardcoded regex checks throughout the codebase
   */
  validate(
    input: string,
    patternName: string,
  ): Result<boolean, ValidationPatternError> {
    if (!input) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Input cannot be empty",
        },
      };
    }

    const pattern = this.patterns.get(patternName);
    if (!pattern) {
      return {
        ok: false,
        error: {
          kind: "PatternNotFound",
          name: patternName,
          message: `Validation pattern not found: ${patternName}`,
        },
      };
    }

    try {
      const isValid = pattern.pattern.test(input);
      return { ok: true, data: isValid };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "CompilationFailed",
          pattern: patternName,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to execute pattern ${patternName}`,
        },
      };
    }
  }

  /**
   * Get pattern by name
   */
  getPattern(name: string): Result<ValidationPattern, ValidationPatternError> {
    const pattern = this.patterns.get(name);

    if (!pattern) {
      return {
        ok: false,
        error: {
          kind: "PatternNotFound",
          name,
          message: `Pattern not found: ${name}`,
        },
      };
    }

    return { ok: true, data: pattern };
  }

  /**
   * Get compiled regex for direct use
   * Provides migration path for existing hardcoded regex
   */
  getRegex(patternName: string): Result<RegExp, ValidationPatternError> {
    const patternResult = this.getPattern(patternName);
    if (!patternResult.ok) {
      return patternResult;
    }

    return { ok: true, data: patternResult.data.pattern };
  }

  /**
   * Check if input matches any of the provided patterns
   */
  matchesAny(
    input: string,
    patternNames: readonly string[],
  ): Result<string | null, ValidationPatternError> {
    if (!input) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Input cannot be empty",
        },
      };
    }

    for (const patternName of patternNames) {
      const result = this.validate(input, patternName);
      if (!result.ok) {
        return result;
      }
      if (result.data) {
        return { ok: true, data: patternName };
      }
    }

    return { ok: true, data: null };
  }

  /**
   * Register additional pattern at runtime
   */
  registerPattern(
    pattern: ValidationPattern,
  ): Result<void, ValidationPatternError> {
    try {
      this.registerSinglePattern(pattern);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "DuplicatePattern",
          name: pattern.name,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get all available pattern names
   */
  getAvailablePatterns(): readonly string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * Get configuration identity
   */
  getId(): string {
    return this.id;
  }

  /**
   * Create pattern from string (helper for migration)
   */
  static createPatternFromString(
    name: string,
    patternString: string,
    description?: string,
    flags?: string,
  ): Result<ValidationPattern, ValidationPatternError> {
    if (!name || name.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Pattern name cannot be empty",
        },
      };
    }

    if (!patternString || patternString.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Pattern string cannot be empty",
        },
      };
    }

    try {
      const regex = new RegExp(patternString, flags);

      const pattern: ValidationPattern = {
        name,
        pattern: regex,
        description: description || `Pattern: ${patternString}`,
        flags,
      };

      return { ok: true, data: pattern };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "CompilationFailed",
          pattern: patternString,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to compile pattern: ${patternString}`,
        },
      };
    }
  }
}

/**
 * Error creation helper following Totality principles
 */
export const createValidationPatternError = (
  error: ValidationPatternError,
  customMessage?: string,
): ValidationPatternError & { message: string } => ({
  ...error,
  message: customMessage || error.message,
});
