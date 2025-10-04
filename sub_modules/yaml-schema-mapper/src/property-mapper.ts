/**
 * Property name mapping logic
 *
 * Maps property names from input data to schema-defined property names
 * using various strategies including exact match, case-insensitive, and heuristics.
 */

import type { SchemaProperty } from "./types.ts";
import { MappingWarning, WarningCode } from "./types.ts";

/**
 * Property mapping result
 */
export interface PropertyMappingResult {
  schemaKey: string;
  inputKey: string;
  strategy: "exact" | "x-map-from" | "case-insensitive" | "heuristic";
}

/**
 * Maps a single property from input to schema
 */
export function mapProperty(
  inputKeys: string[],
  schemaKey: string,
  schemaProperty: SchemaProperty,
  options?: { unicodeNormalization?: "NFC" | "NFD" | "none" },
): { result: PropertyMappingResult | null; warnings: MappingWarning[] } {
  const warnings: MappingWarning[] = [];
  const normalization = options?.unicodeNormalization ?? "none";

  // Normalize keys if needed
  const normalizedInputKeys = inputKeys.map((key) =>
    normalization !== "none" ? key.normalize(normalization) : key
  );
  const normalizedSchemaKey = normalization !== "none"
    ? schemaKey.normalize(normalization)
    : schemaKey;

  // Strategy 1: x-map-from directive (highest priority)
  if (schemaProperty["x-map-from"]) {
    const mapFrom = schemaProperty["x-map-from"];
    const sources = Array.isArray(mapFrom) ? mapFrom : [mapFrom];

    for (const source of sources) {
      const normalizedSource = normalization !== "none"
        ? source.normalize(normalization)
        : source;
      const index = normalizedInputKeys.indexOf(normalizedSource);
      if (index !== -1) {
        return {
          result: {
            schemaKey,
            inputKey: inputKeys[index],
            strategy: "x-map-from",
          },
          warnings,
        };
      }
    }
    // x-map-from specified but not found - not an error, continue to other strategies
  }

  // Strategy 2: Exact match
  const exactIndex = normalizedInputKeys.indexOf(normalizedSchemaKey);
  if (exactIndex !== -1) {
    return {
      result: {
        schemaKey,
        inputKey: inputKeys[exactIndex],
        strategy: "exact",
      },
      warnings,
    };
  }

  // Strategy 3: Case-insensitive match
  const lowerSchemaKey = normalizedSchemaKey.toLowerCase();
  const caseInsensitiveMatches: number[] = [];
  normalizedInputKeys.forEach((key, index) => {
    if (key.toLowerCase() === lowerSchemaKey) {
      caseInsensitiveMatches.push(index);
    }
  });

  if (caseInsensitiveMatches.length === 1) {
    return {
      result: {
        schemaKey,
        inputKey: inputKeys[caseInsensitiveMatches[0]],
        strategy: "case-insensitive",
      },
      warnings,
    };
  } else if (caseInsensitiveMatches.length > 1) {
    // Multiple case-insensitive matches - ambiguous
    warnings.push({
      code: WarningCode.PROPERTY_AMBIGUOUS,
      message: `Multiple case-insensitive matches for property '${schemaKey}'`,
      path: schemaKey,
      severity: "error",
      details: {
        candidates: caseInsensitiveMatches.map((i) => inputKeys[i]),
        suggestion:
          "Use x-map-from directive to specify explicitly or ensure property names have unique case-insensitive forms",
      },
    });
    return { result: null, warnings };
  }

  // Strategy 4: Heuristic matching (convention conversion)
  const heuristicMatches: number[] = [];
  const schemaKeyVariants = generateConventionVariants(normalizedSchemaKey);

  normalizedInputKeys.forEach((key, index) => {
    const inputKeyVariants = generateConventionVariants(key);
    // Check if any variant of input key matches any variant of schema key
    for (const schemaVariant of schemaKeyVariants) {
      for (const inputVariant of inputKeyVariants) {
        if (schemaVariant === inputVariant) {
          heuristicMatches.push(index);
          return;
        }
      }
    }
  });

  if (heuristicMatches.length === 1) {
    return {
      result: {
        schemaKey,
        inputKey: inputKeys[heuristicMatches[0]],
        strategy: "heuristic",
      },
      warnings,
    };
  } else if (heuristicMatches.length > 1) {
    // Multiple heuristic matches - ambiguous
    warnings.push({
      code: WarningCode.PROPERTY_AMBIGUOUS,
      message: `Multiple heuristic matches for property '${schemaKey}'`,
      path: schemaKey,
      severity: "error",
      details: {
        candidates: heuristicMatches.map((i) => inputKeys[i]),
        suggestion: "Use x-map-from directive to specify explicitly",
      },
    });
    return { result: null, warnings };
  }

  // No match found
  return { result: null, warnings };
}

/**
 * Generates convention variants for a property name
 */
function generateConventionVariants(name: string): string[] {
  const variants = new Set<string>();

  // Add original
  variants.add(name);

  // Add lowercase version for comparison
  const lower = name.toLowerCase();
  variants.add(lower);

  // Convert to words (split by common delimiters)
  const words = name
    .split(/[-_\s]+/)
    .filter((w) => w.length > 0);

  // Handle PascalCase/camelCase
  const camelWords: string[] = [];
  for (const word of words) {
    // Split PascalCase/camelCase into words
    const splitWords = word.split(/(?=[A-Z])/).filter((w) => w.length > 0);
    camelWords.push(...splitWords);
  }

  const allWords = camelWords.length > words.length ? camelWords : words;
  const lowerWords = allWords.map((w) => w.toLowerCase());

  if (lowerWords.length > 0) {
    // camelCase
    variants.add(
      lowerWords[0] +
        lowerWords.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(""),
    );

    // PascalCase
    variants.add(
      lowerWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""),
    );

    // snake_case
    variants.add(lowerWords.join("_"));

    // kebab-case
    variants.add(lowerWords.join("-"));

    // lowercase no separator
    variants.add(lowerWords.join(""));
  }

  return Array.from(variants);
}

/**
 * Validates property name for potential issues
 */
export function validatePropertyName(
  name: string,
): MappingWarning[] {
  const warnings: MappingWarning[] = [];

  // Check for empty string
  if (name === "") {
    warnings.push({
      code: WarningCode.EMPTY_PROPERTY_NAME,
      message: "Empty property name found",
      path: name,
      severity: "error",
      details: {
        suggestion:
          "Use x-map-from directive to map from empty string if intentional",
      },
    });
  }

  // Check for emoji
  const emojiRegex = /\p{Emoji}/u;
  if (emojiRegex.test(name)) {
    warnings.push({
      code: WarningCode.EMOJI_PROPERTY,
      message: `Property name contains emoji: '${name}'`,
      path: name,
      severity: "warning",
      details: {
        suggestion:
          "Avoid using emoji in property names for better compatibility",
      },
    });
  }

  return warnings;
}
