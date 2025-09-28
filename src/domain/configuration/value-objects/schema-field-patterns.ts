import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Raw configuration data structure for schema field patterns
 */
export interface RawSchemaFieldConfig {
  readonly version: string;
  readonly description: string;
  readonly commandFields: {
    readonly sequential: {
      readonly patterns: readonly string[];
      readonly description: string;
    };
    readonly named: {
      readonly patterns: readonly string[];
      readonly description: string;
    };
    readonly custom: {
      readonly patterns: readonly string[];
      readonly description: string;
    };
  };
  readonly structurePatterns: {
    readonly hasCommands: {
      readonly requiredFields: readonly string[];
      readonly optionalFields: readonly string[];
      readonly description: string;
    };
    readonly hasSequentialCommands: {
      readonly anyOfFields: readonly string[];
      readonly description: string;
    };
    readonly hasCustomCommands: {
      readonly configurable: boolean;
      readonly description: string;
    };
  };
  readonly validation: {
    readonly caseSensitive: boolean;
    readonly requireMinimumMatch: number;
    readonly allowPartialMatch: boolean;
  };
  readonly features: {
    readonly enableSequentialDetection: boolean;
    readonly enableNamedDetection: boolean;
    readonly enableCustomPatterns: boolean;
    readonly enableNestedDetection: boolean;
  };
  readonly fallback: {
    readonly commandFields: readonly string[];
    readonly enableStrictMatching: boolean;
  };
}

/**
 * Schema Field Patterns Configuration Value Object
 *
 * Replaces hardcoded field detection patterns with configurable,
 * extensible pattern matching following DDD principles
 */
export class SchemaFieldPatterns {
  private constructor(
    private readonly config: RawSchemaFieldConfig,
  ) {}

  /**
   * Smart constructor following Totality principle
   */
  static create(
    config: RawSchemaFieldConfig,
  ): Result<SchemaFieldPatterns, DomainError & { message: string }> {
    // Validate configuration structure
    if (!config.commandFields || !config.structurePatterns) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Invalid schema field patterns configuration: missing required sections",
        }),
      };
    }

    // Validate sequential patterns
    if (!Array.isArray(config.commandFields.sequential.patterns)) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Sequential command patterns must be an array",
        }),
      };
    }

    // Validate named patterns
    if (!Array.isArray(config.commandFields.named.patterns)) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Named command patterns must be an array",
        }),
      };
    }

    // Validate fallback configuration
    if (!Array.isArray(config.fallback.commandFields)) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Fallback command fields must be an array",
        }),
      };
    }

    return ok(new SchemaFieldPatterns(config));
  }

  /**
   * Create default configuration for fallback scenarios
   */
  static createDefault(): Result<
    SchemaFieldPatterns,
    DomainError & { message: string }
  > {
    const defaultConfig: RawSchemaFieldConfig = {
      version: "1.0.0",
      description: "Default schema field patterns configuration",
      commandFields: {
        sequential: {
          patterns: ["c1", "c2", "c3"],
          description: "Sequential command field patterns",
        },
        named: {
          patterns: ["commands"],
          description: "Named command field patterns",
        },
        custom: {
          patterns: [],
          description: "Custom command field patterns",
        },
      },
      structurePatterns: {
        hasCommands: {
          requiredFields: ["commands"],
          optionalFields: [],
          description: "Detects schemas with command arrays",
        },
        hasSequentialCommands: {
          anyOfFields: ["c1", "c2", "c3"],
          description: "Detects schemas with sequential command patterns",
        },
        hasCustomCommands: {
          configurable: true,
          description: "Detects schemas with custom command patterns",
        },
      },
      validation: {
        caseSensitive: true,
        requireMinimumMatch: 1,
        allowPartialMatch: true,
      },
      features: {
        enableSequentialDetection: true,
        enableNamedDetection: true,
        enableCustomPatterns: false,
        enableNestedDetection: false,
      },
      fallback: {
        commandFields: ["c1", "c2", "c3", "commands"],
        enableStrictMatching: false,
      },
    };

    return SchemaFieldPatterns.create(defaultConfig);
  }

  /**
   * Get sequential command field patterns
   */
  getSequentialPatterns(): readonly string[] {
    return this.config.commandFields.sequential.patterns;
  }

  /**
   * Get named command field patterns
   */
  getNamedPatterns(): readonly string[] {
    return this.config.commandFields.named.patterns;
  }

  /**
   * Get custom command field patterns
   */
  getCustomPatterns(): readonly string[] {
    return this.config.commandFields.custom.patterns;
  }

  /**
   * Get all command field patterns combined
   */
  getAllPatterns(): readonly string[] {
    const patterns = [
      ...this.getSequentialPatterns(),
      ...this.getNamedPatterns(),
      ...this.getCustomPatterns(),
    ];
    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Check if sequential detection is enabled
   */
  isSequentialDetectionEnabled(): boolean {
    return this.config.features.enableSequentialDetection;
  }

  /**
   * Check if named detection is enabled
   */
  isNamedDetectionEnabled(): boolean {
    return this.config.features.enableNamedDetection;
  }

  /**
   * Check if custom patterns are enabled
   */
  isCustomPatternsEnabled(): boolean {
    return this.config.features.enableCustomPatterns;
  }

  /**
   * Check if a field matches any of the configured patterns
   */
  matchesPattern(fieldName: string): boolean {
    const allPatterns = this.getAllPatterns();

    if (this.config.validation.caseSensitive) {
      return allPatterns.includes(fieldName);
    } else {
      const lowerFieldName = fieldName.toLowerCase();
      return allPatterns.some((pattern) =>
        pattern.toLowerCase() === lowerFieldName
      );
    }
  }

  /**
   * Check if any pattern matches in the given field set
   */
  hasAnyMatch(fields: readonly string[]): boolean {
    return fields.some((field) => this.matchesPattern(field));
  }

  /**
   * Get fallback patterns when configuration loading fails
   */
  getFallbackPatterns(): readonly string[] {
    return this.config.fallback.commandFields;
  }

  /**
   * Get the minimum number of matches required
   */
  getMinimumMatchCount(): number {
    return this.config.validation.requireMinimumMatch;
  }

  /**
   * Check if partial matching is allowed
   */
  isPartialMatchAllowed(): boolean {
    return this.config.validation.allowPartialMatch;
  }
}
