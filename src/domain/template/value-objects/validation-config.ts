/**
 * ValidationConfig Value Object
 *
 * Encapsulates configurable validation patterns for variable names
 * Eliminates hardcoding violations by providing configurable validation rules
 */

export type ValidationContext = "default" | "mixed" | "strict" | undefined;

/**
 * ValidationConfig - Configurable validation patterns
 * Replaces hardcoded regex patterns and reserved keywords with configurable rules
 */
export class ValidationConfig {
  private constructor(
    private readonly namePattern: RegExp,
    private readonly reservedKeywords: Set<string>,
    private readonly description: string,
  ) {}

  /**
   * Create default validation configuration
   * Supports alphanumeric, underscore, and dot notation for variable names
   */
  static createDefault(): ValidationConfig {
    return new ValidationConfig(
      /^[a-zA-Z_][a-zA-Z0-9_$.]*$/, // Supports dot notation like {object.property}
      new Set([
        "null",
        "undefined",
        "true",
        "false",
        "class",
        "function",
        "var",
        "let",
        "const",
        "if",
        "else",
        "for",
        "while",
        "return",
      ]),
      "valid variable name (alphanumeric, underscore, and dot)",
    );
  }

  /**
   * Create strict validation configuration
   * More restrictive patterns for stricter validation contexts
   */
  static createStrict(): ValidationConfig {
    return new ValidationConfig(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/, // No dot notation in strict mode
      new Set([
        "null",
        "undefined",
        "true",
        "false",
        "class",
        "function",
        "var",
        "let",
        "const",
        "if",
        "else",
        "for",
        "while",
        "return",
        "public",
        "private",
        "protected",
        "static",
      ]),
      "strict variable name (alphanumeric and underscore only)",
    );
  }

  /**
   * Create mixed validation configuration
   * Balanced approach for mixed contexts
   */
  static createMixed(): ValidationConfig {
    return new ValidationConfig(
      /^[a-zA-Z_][a-zA-Z0-9_.-]*$/, // Allows dots and hyphens
      new Set([
        "null",
        "undefined",
        "true",
        "false",
      ]),
      "mixed variable name (alphanumeric, underscore, dot, and hyphen)",
    );
  }

  /**
   * Validate variable name against configured pattern
   */
  validateName(name: string, _context?: ValidationContext): boolean {
    // First check pattern
    if (!this.namePattern.test(name)) {
      return false;
    }

    // Then check reserved keywords
    if (this.reservedKeywords.has(name.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Get validation description for error messages
   */
  getValidationDescription(_context?: ValidationContext): string {
    return this.description;
  }

  /**
   * Get the configured pattern
   */
  getPattern(): RegExp {
    return this.namePattern;
  }

  /**
   * Check if a keyword is reserved
   */
  isReservedKeyword(keyword: string): boolean {
    return this.reservedKeywords.has(keyword.toLowerCase());
  }
}
