/**
 * TypeScript-based schema matching with approximate distance algorithm
 * Phase 2: Schema mapping phase implementation
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { FrontMatterData } from "../frontmatter/typescript-extractor.ts";

export interface SchemaProperty {
  readonly path: string;
  readonly type: string;
  readonly description?: string;
  readonly required: boolean;
}

export interface SchemaMatchResult {
  readonly path: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly matchedProperty: SchemaProperty;
}

export interface MappedSchemaData {
  readonly matches: SchemaMatchResult[];
  readonly unmatchedKeys: string[];
  readonly missingRequiredKeys: string[];
  readonly schemaCompliantData: Record<string, unknown>;
}

export class TypeScriptSchemaMatcher {
  /**
   * Phase 2-1: Schema expansion - recursively traverse JSON Schema
   * Expand schema into flat path + type information structure
   */
  expandSchema(
    schema: unknown,
  ): Result<SchemaProperty[], DomainError & { message: string }> {
    try {
      if (!schema || typeof schema !== "object") {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: typeof schema,
            expectedFormat: "object",
          }, "Schema must be an object"),
        };
      }

      const schemaObj = schema as Record<string, unknown>;
      const properties: SchemaProperty[] = [];
      const required = (schemaObj.required as string[]) || [];

      this.expandSchemaRecursive(schemaObj, "", properties, required);

      return {
        ok: true,
        data: properties,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: String(schema),
            details: error instanceof Error ? error.message : String(error),
          },
          `Failed to expand schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Phase 2-2: Map frontmatter data to schema using hierarchical matching + similarity
   */
  mapToSchema(
    frontMatterData: FrontMatterData,
    schema: unknown,
  ): Result<MappedSchemaData, DomainError & { message: string }> {
    // First expand the schema
    const schemaExpansionResult = this.expandSchema(schema);
    if (!schemaExpansionResult.ok) {
      return schemaExpansionResult;
    }

    const schemaProperties = schemaExpansionResult.data;
    const frontMatterKeys = this.flattenFrontMatterData(frontMatterData.data);
    const matches: SchemaMatchResult[] = [];
    const unmatchedKeys: string[] = [];
    const schemaCompliantData: Record<string, unknown> = {};

    // Match each frontmatter key to schema properties
    for (const [fmKey, fmValue] of Object.entries(frontMatterKeys)) {
      const match = this.findBestMatch(fmKey, fmValue, schemaProperties);

      if (match && match.confidence > 0.3) { // Lowered confidence threshold for better matching
        matches.push(match);
        this.setNestedValue(schemaCompliantData, match.path, match.value);
      } else {
        unmatchedKeys.push(fmKey);
      }
    }

    // Check for missing required properties
    const missingRequiredKeys = schemaProperties
      .filter((prop) => prop.required)
      .filter((prop) => !matches.some((match) => match.path === prop.path))
      .map((prop) => prop.path);

    const result: MappedSchemaData = {
      matches,
      unmatchedKeys,
      missingRequiredKeys,
      schemaCompliantData,
    };

    return {
      ok: true,
      data: result,
    };
  }

  private expandSchemaRecursive(
    obj: Record<string, unknown>,
    currentPath: string,
    properties: SchemaProperty[],
    required: string[],
    _parentPath = "",
  ): void {
    if (obj.type === "object" && obj.properties) {
      const props = obj.properties as Record<string, unknown>;
      const objRequired = (obj.required as string[]) || required;

      for (const [key, value] of Object.entries(props)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const isRequired = objRequired.includes(key);

        if (value && typeof value === "object") {
          const valueObj = value as Record<string, unknown>;

          if (valueObj.type === "array" && valueObj.items) {
            // Handle array properties
            const arrayPath = `${newPath}[]`;
            properties.push({
              path: arrayPath,
              type: `array<${valueObj.items}>`,
              description: valueObj.description as string,
              required: isRequired,
            });

            // If array items are objects, expand them too
            if (valueObj.items && typeof valueObj.items === "object") {
              this.expandSchemaRecursive(
                valueObj.items as Record<string, unknown>,
                `${arrayPath}`,
                properties,
                [],
                newPath,
              );
            }
          } else if (valueObj.type === "object") {
            // Handle nested objects
            this.expandSchemaRecursive(
              valueObj,
              newPath,
              properties,
              objRequired,
              newPath,
            );
          } else {
            // Simple property
            properties.push({
              path: newPath,
              type: valueObj.type as string || "unknown",
              description: valueObj.description as string,
              required: isRequired,
            });
          }
        }
      }
    }
  }

  private flattenFrontMatterData(
    data: Record<string, unknown>,
    prefix = "",
  ): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        flattened[`${newKey}[]`] = value;
        value.forEach((item, index) => {
          if (item && typeof item === "object") {
            Object.assign(
              flattened,
              this.flattenFrontMatterData(
                item as Record<string, unknown>,
                `${newKey}[${index}]`,
              ),
            );
          }
        });
      } else if (value && typeof value === "object") {
        Object.assign(
          flattened,
          this.flattenFrontMatterData(
            value as Record<string, unknown>,
            newKey,
          ),
        );
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  private findBestMatch(
    frontMatterKey: string,
    frontMatterValue: unknown,
    schemaProperties: SchemaProperty[],
  ): SchemaMatchResult | null {
    let bestMatch: SchemaMatchResult | null = null;
    let bestConfidence = 0;

    for (const schemaProp of schemaProperties) {
      const confidence = this.calculateMatchConfidence(
        frontMatterKey,
        frontMatterValue,
        schemaProp,
      );

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          path: schemaProp.path,
          value: frontMatterValue,
          confidence,
          matchedProperty: schemaProp,
        };
      }
    }

    return bestMatch;
  }

  private calculateMatchConfidence(
    frontMatterKey: string,
    frontMatterValue: unknown,
    schemaProp: SchemaProperty,
  ): number {
    let confidence = 0;

    // 1. Parent hierarchy matching (strongest priority)
    const fmHierarchy = frontMatterKey.split(".");
    const schemaHierarchy = schemaProp.path.split(".");

    // Check if they share parent hierarchy
    const hierarchyMatch = this.calculateHierarchyMatch(
      fmHierarchy,
      schemaHierarchy,
    );
    confidence += hierarchyMatch * 0.5; // 50% weight for hierarchy

    // 2. Key name similarity (Levenshtein distance)
    const fmKeyName = fmHierarchy[fmHierarchy.length - 1].replace(/\[\]$/, "");
    const schemaKeyName = schemaHierarchy[schemaHierarchy.length - 1].replace(
      /\[\]$/,
      "",
    );
    const nameSimilarity = this.calculateStringSimilarity(
      fmKeyName,
      schemaKeyName,
    );
    confidence += nameSimilarity * 0.3; // 30% weight for name similarity

    // 3. Type compatibility check
    const typeMatch = this.checkTypeCompatibility(
      frontMatterValue,
      schemaProp.type,
    );
    if (!typeMatch) {
      return 0; // Reject if types don't match
    }
    confidence += 0.2; // 20% weight for type match

    return Math.min(confidence, 1.0); // Cap at 1.0
  }

  private calculateHierarchyMatch(
    fmHierarchy: string[],
    schemaHierarchy: string[],
  ): number {
    const minLength = Math.min(
      fmHierarchy.length - 1,
      schemaHierarchy.length - 1,
    );
    if (minLength <= 0) return 0;

    let matches = 0;
    for (let i = 0; i < minLength; i++) {
      if (fmHierarchy[i] === schemaHierarchy[i]) {
        matches++;
      }
    }

    return matches / minLength;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(
      str1.toLowerCase(),
      str2.toLowerCase(),
    );
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private checkTypeCompatibility(value: unknown, schemaType: string): boolean {
    const actualType = Array.isArray(value) ? "array" : typeof value;

    // Handle array types
    if (schemaType.startsWith("array")) {
      return actualType === "array";
    }

    // Handle basic types
    switch (schemaType) {
      case "string":
        return actualType === "string";
      case "number":
      case "integer":
        return actualType === "number";
      case "boolean":
        return actualType === "boolean";
      case "object":
        return actualType === "object" && !Array.isArray(value);
      default:
        return true; // Allow unknown types
    }
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i].replace(/\[\]$/, "");
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1].replace(/\[\]$/, "");
    current[finalKey] = value;
  }
}
