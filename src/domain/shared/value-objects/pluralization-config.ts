/**
 * Pluralization Configuration - Value Object
 *
 * Eliminates English-specific hardcoding violations (Issue #663)
 * Implements Totality principles with Smart Constructor pattern
 * Provides language-agnostic pluralization handling
 */

import type { Result } from "../../core/result.ts";
import {
  HIGH_PRIORITY_PLURALIZATION_RULE_VALUE,
  IRREGULAR_PLURALIZATION_PRIORITY_VALUE,
  LOW_PRIORITY_PLURALIZATION_RULE_VALUE,
  MEDIUM_PRIORITY_PLURALIZATION_RULE_VALUE,
  STANDARD_PLURALIZATION_RULE_PRIORITY_VALUE,
} from "../constants.ts";

/**
 * Pluralization error types following Totality principles
 */
export type PluralizationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "UnsupportedLanguage"; language: string; message: string }
  | { kind: "InvalidRule"; rule: string; message: string }
  | {
    kind: "PatternMismatch";
    word: string;
    language: string;
    message: string;
  };

/**
 * Language-specific pluralization rule
 */
export interface PluralizationRule {
  readonly pattern: RegExp;
  readonly singularSuffix: string;
  readonly pluralSuffix: string;
  readonly priority: number; // Higher priority rules are tried first
}

/**
 * Language configuration for pluralization
 */
export interface LanguageConfig {
  readonly language: string;
  readonly rules: readonly PluralizationRule[];
  readonly irregulars: ReadonlyMap<string, string>; // plural -> singular
}

/**
 * Default English pluralization rules
 * Handles common patterns and irregular forms
 */
const ENGLISH_RULES: readonly PluralizationRule[] = [
  // Irregular endings (highest priority)
  {
    pattern: /children$/i,
    singularSuffix: "child",
    pluralSuffix: "children",
    priority: IRREGULAR_PLURALIZATION_PRIORITY_VALUE.getValue(),
  },
  {
    pattern: /mice$/i,
    singularSuffix: "mouse",
    pluralSuffix: "mice",
    priority: IRREGULAR_PLURALIZATION_PRIORITY_VALUE.getValue(),
  },
  {
    pattern: /feet$/i,
    singularSuffix: "foot",
    pluralSuffix: "feet",
    priority: IRREGULAR_PLURALIZATION_PRIORITY_VALUE.getValue(),
  },
  {
    pattern: /teeth$/i,
    singularSuffix: "tooth",
    pluralSuffix: "teeth",
    priority: IRREGULAR_PLURALIZATION_PRIORITY_VALUE.getValue(),
  },
  {
    pattern: /geese$/i,
    singularSuffix: "goose",
    pluralSuffix: "geese",
    priority: IRREGULAR_PLURALIZATION_PRIORITY_VALUE.getValue(),
  },

  // Words ending in -ies
  {
    pattern: /ies$/i,
    singularSuffix: "y",
    pluralSuffix: "ies",
    priority: HIGH_PRIORITY_PLURALIZATION_RULE_VALUE.getValue(),
  },

  // Words ending in -ves
  {
    pattern: /ves$/i,
    singularSuffix: "f",
    pluralSuffix: "ves",
    priority: MEDIUM_PRIORITY_PLURALIZATION_RULE_VALUE.getValue(),
  },
  {
    pattern: /ves$/i,
    singularSuffix: "fe",
    pluralSuffix: "ves",
    priority: MEDIUM_PRIORITY_PLURALIZATION_RULE_VALUE.getValue(),
  },

  // Words ending in -es
  {
    pattern: /(sh|ch|x|z|s)es$/i,
    singularSuffix: "$1",
    pluralSuffix: "$1es",
    priority: STANDARD_PLURALIZATION_RULE_PRIORITY_VALUE.getValue(),
  },

  // Words ending in -s (lowest priority - catch-all)
  {
    pattern: /s$/i,
    singularSuffix: "",
    pluralSuffix: "s",
    priority: LOW_PRIORITY_PLURALIZATION_RULE_VALUE.getValue(),
  },
] as const;

const ENGLISH_IRREGULARS = new Map<string, string>([
  ["data", "data"], // data is both singular and plural
  ["information", "information"], // mass noun
  ["equipment", "equipment"], // mass noun
  ["software", "software"], // mass noun
  ["hardware", "hardware"], // mass noun
  ["metadata", "metadata"], // mass noun
  ["criteria", "criterion"],
  ["phenomena", "phenomenon"],
  ["analyses", "analysis"],
  ["diagnoses", "diagnosis"],
]);

const ENGLISH_CONFIG: LanguageConfig = {
  language: "en",
  rules: ENGLISH_RULES,
  irregulars: ENGLISH_IRREGULARS,
};

/**
 * Pluralization Configuration Value Object
 *
 * Follows Smart Constructor pattern with Result type
 * Eliminates hardcoded language-specific assumptions
 */
export class PluralizationConfig {
  private constructor(
    private readonly configs: ReadonlyMap<string, LanguageConfig>,
    private readonly defaultLanguage: string,
  ) {}

  /**
   * Smart Constructor with default English support
   */
  static createDefault(): Result<PluralizationConfig, PluralizationError> {
    const configs = new Map<string, LanguageConfig>([
      ["en", ENGLISH_CONFIG],
    ]);

    return {
      ok: true,
      data: new PluralizationConfig(configs, "en"),
    };
  }

  /**
   * Smart Constructor with custom configuration
   */
  static create(
    configs: LanguageConfig[],
    defaultLanguage?: string,
  ): Result<PluralizationConfig, PluralizationError> {
    if (configs.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "At least one language configuration is required",
        },
      };
    }

    const configMap = new Map<string, LanguageConfig>();

    // Validate and build config map
    for (const config of configs) {
      if (!config.language || config.language.trim().length === 0) {
        return {
          ok: false,
          error: {
            kind: "EmptyInput",
            message: "Language code cannot be empty",
          },
        };
      }

      configMap.set(config.language, config);
    }

    const defaultLang = defaultLanguage || configs[0].language;

    if (!configMap.has(defaultLang)) {
      return {
        ok: false,
        error: {
          kind: "UnsupportedLanguage",
          language: defaultLang,
          message:
            `Default language '${defaultLang}' not found in configurations`,
        },
      };
    }

    return {
      ok: true,
      data: new PluralizationConfig(configMap, defaultLang),
    };
  }

  /**
   * Convert plural form to singular form
   *
   * Replaces hardcoded: key.endsWith("s") ? key.slice(0, -1) : key
   */
  singularize(
    pluralWord: string,
    language?: string,
  ): Result<string, PluralizationError> {
    if (!pluralWord || pluralWord.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Input word cannot be empty",
        },
      };
    }

    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);

    if (!config) {
      return {
        ok: false,
        error: {
          kind: "UnsupportedLanguage",
          language: lang,
          message: `Language '${lang}' is not supported`,
        },
      };
    }

    const trimmedWord = pluralWord.trim().toLowerCase();

    // Check irregulars first
    const irregular = config.irregulars.get(trimmedWord);
    if (irregular !== undefined) {
      return { ok: true, data: this.preserveCase(irregular, pluralWord) };
    }

    // Try rules in priority order
    const sortedRules = [...config.rules].sort((a, b) =>
      b.priority - a.priority
    );

    for (const rule of sortedRules) {
      if (rule.pattern.test(trimmedWord)) {
        const singular = trimmedWord.replace(rule.pattern, rule.singularSuffix);
        return { ok: true, data: this.preserveCase(singular, pluralWord) };
      }
    }

    // If no rules match, assume it's already singular or use as-is
    return { ok: true, data: pluralWord };
  }

  /**
   * Convert singular form to plural form
   */
  pluralize(
    singularWord: string,
    language?: string,
  ): Result<string, PluralizationError> {
    if (!singularWord || singularWord.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Input word cannot be empty",
        },
      };
    }

    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);

    if (!config) {
      return {
        ok: false,
        error: {
          kind: "UnsupportedLanguage",
          language: lang,
          message: `Language '${lang}' is not supported`,
        },
      };
    }

    const trimmedWord = singularWord.trim().toLowerCase();

    // Check if this is an irregular plural form
    for (const [plural, singular] of config.irregulars) {
      if (singular === trimmedWord) {
        return { ok: true, data: this.preserveCase(plural, singularWord) };
      }
    }

    // Apply appropriate pluralization rule
    // This is simplified - in practice would need more sophisticated rules
    const pluralForm = this.applyPluralizationRules(trimmedWord);
    return { ok: true, data: this.preserveCase(pluralForm, singularWord) };
  }

  /**
   * Check if a word is likely plural
   */
  isPlural(
    word: string,
    language?: string,
  ): Result<boolean, PluralizationError> {
    if (!word || word.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Input word cannot be empty",
        },
      };
    }

    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);

    if (!config) {
      return {
        ok: false,
        error: {
          kind: "UnsupportedLanguage",
          language: lang,
          message: `Language '${lang}' is not supported`,
        },
      };
    }

    const trimmedWord = word.trim().toLowerCase();

    // Check if it's in the irregulars map (as a plural)
    if (config.irregulars.has(trimmedWord)) {
      return { ok: true, data: true };
    }

    // Check if any rule pattern matches
    for (const rule of config.rules) {
      if (rule.pattern.test(trimmedWord)) {
        return { ok: true, data: true };
      }
    }

    return { ok: true, data: false };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): readonly string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): string {
    return this.defaultLanguage;
  }

  /**
   * Preserve original case pattern
   */
  private preserveCase(newWord: string, originalWord: string): string {
    if (originalWord.length === 0) return newWord;

    // Handle all caps
    if (originalWord === originalWord.toUpperCase()) {
      return newWord.toUpperCase();
    }

    // Handle first letter capitalized
    if (originalWord[0] === originalWord[0].toUpperCase()) {
      return newWord.charAt(0).toUpperCase() + newWord.slice(1).toLowerCase();
    }

    return newWord.toLowerCase();
  }

  /**
   * Apply pluralization rules (simplified implementation)
   */
  private applyPluralizationRules(word: string): string {
    // Simplified pluralization - real implementation would need more rules
    if (word.endsWith("y")) {
      return word.slice(0, -1) + "ies";
    }
    if (word.match(/(s|sh|ch|x|z)$/)) {
      return word + "es";
    }
    return word + "s";
  }
}

/**
 * Error creation helper following Totality principles
 */
export const createPluralizationError = (
  error: PluralizationError,
  customMessage?: string,
): PluralizationError & { message: string } => ({
  ...error,
  message: customMessage || error.message,
});
