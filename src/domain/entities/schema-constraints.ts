/**
 * Schema Constraints Domain Entity
 *
 * Extracts and evaluates constraints from JSON Schema for file pre-filtering
 * Part of the Schema Management Context in DDD
 * Follows Totality principles with Result types and Smart Constructors
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { SchemaExtensions } from "../schema/value-objects/schema-extensions.ts";
import { SafeFrontmatterData, SafeRecord } from "./safe-record.ts";

/**
 * Constraint rule types following discriminated union pattern
 */
export type ConstraintRule =
  | { kind: "Const"; path: string; value: string }
  | { kind: "Enum"; path: string; values: string[] }
  | { kind: "Pattern"; path: string; regex: RegExp };

/**
 * JSONPath navigation helper (Smart Constructor)
 */
class JSONPath {
  private constructor(readonly path: string, readonly segments: string[]) {}

  static create(
    path: string,
  ): Result<JSONPath, DomainError & { message: string }> {
    if (!path || path.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "JSONPath cannot be empty",
        ),
      };
    }

    const segments = path.split(".");
    if (segments.some((seg) => seg.length === 0)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: path,
            expectedFormat: "dot-separated-path",
          },
          `Invalid JSONPath format: ${path}`,
        ),
      };
    }

    return { ok: true, data: new JSONPath(path, segments) };
  }

  /**
   * Extract value from object following the path
   * Handles arrays by checking the first element
   * Special handling for frontmatter traceability arrays
   */
  extract(data: unknown): unknown {
    if (!data || typeof data !== "object") {
      return undefined;
    }

    // Special handling for frontmatter data with traceability array
    if (this.segments[0] === "traceability" && !Array.isArray(data)) {
      const frontmatterResult = SafeFrontmatterData.fromFrontmatter(data);
      if (frontmatterResult.ok) {
        const frontmatterData = frontmatterResult.data;
        return frontmatterData.getPathWithTraceability(this.segments);
      }
    }

    // Regular path extraction using SafeRecord
    const recordResult = SafeRecord.from(data);
    if (recordResult.ok) {
      return recordResult.data.getPath(this.segments);
    }

    // Fallback for non-object data
    return undefined;
  }
}

/**
 * Schema Constraints Entity (Smart Constructor)
 * Extracts constraint rules from JSON Schema and evaluates file data
 */
export class SchemaConstraints {
  private constructor(readonly constraints: ConstraintRule[]) {}

  /**
   * Extract constraints from JSON Schema
   */
  static extract(
    schema: unknown,
  ): Result<SchemaConstraints, DomainError & { message: string }> {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(schema),
            expectedFormat: "object",
          },
          "Schema must be an object",
        ),
      };
    }

    const schemaResult = SafeRecord.from(schema);
    if (!schemaResult.ok) {
      return { ok: false, error: schemaResult.error };
    }
    const schemaObj = schemaResult.data;
    const constraints: ConstraintRule[] = [];

    try {
      // Extract constraints recursively from schema properties
      extractConstraintsRecursive(schemaObj.toObject(), "", constraints);
      return { ok: true, data: new SchemaConstraints(constraints) };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "ParseError", input: String(schema) },
          `Failed to extract constraints: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Check if file data should be processed based on constraints
   */
  shouldProcessFile(
    data: unknown,
  ): Result<
    { shouldProcess: boolean; reason?: string },
    DomainError & { message: string }
  > {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data),
            expectedFormat: "object",
          },
          "File data must be an object",
        ),
      };
    }

    for (const constraint of this.constraints) {
      const pathResult = JSONPath.create(constraint.path);
      if (!pathResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: constraint.path,
              expectedFormat: "valid-json-path",
            },
            `Invalid constraint path: ${constraint.path}`,
          ),
        };
      }

      const value = pathResult.data.extract(data);

      switch (constraint.kind) {
        case "Const": {
          if (value !== constraint.value) {
            return {
              ok: true,
              data: {
                shouldProcess: false,
                reason:
                  `Field '${constraint.path}' value '${value}' does not match required constant '${constraint.value}'`,
              },
            };
          }
          break;
        }
        case "Enum": {
          if (!constraint.values.includes(String(value))) {
            return {
              ok: true,
              data: {
                shouldProcess: false,
                reason:
                  `Field '${constraint.path}' value '${value}' is not in allowed values: ${
                    constraint.values.join(", ")
                  }`,
              },
            };
          }
          break;
        }
        case "Pattern": {
          if (typeof value !== "string" || !constraint.regex.test(value)) {
            return {
              ok: true,
              data: {
                shouldProcess: false,
                reason:
                  `Field '${constraint.path}' value '${value}' does not match pattern ${constraint.regex.source}`,
              },
            };
          }
          break;
        }
      }
    }

    return { ok: true, data: { shouldProcess: true } };
  }

  /**
   * Get all constraint paths for debugging
   */
  getConstraintPaths(): string[] {
    return this.constraints.map((c) => c.path);
  }
}

/**
 * Recursive constraint extraction helper
 */
function extractConstraintsRecursive(
  schema: Record<string, unknown>,
  basePath: string,
  constraints: ConstraintRule[],
): void {
  // Handle current level constraints
  extractConstraintsFromLevel(schema, basePath, constraints);

  // Handle properties object using SafeRecord
  const schemaRecord = SafeRecord.from(schema);
  if (!schemaRecord.ok) return;

  const properties = schemaRecord.data.get("properties");
  if (
    properties && typeof properties === "object" && !Array.isArray(properties)
  ) {
    const propertiesRecord = SafeRecord.from(properties);
    if (!propertiesRecord.ok) return;

    for (
      const [key, propSchema] of Object.entries(
        propertiesRecord.data.toObject(),
      )
    ) {
      if (!propSchema || typeof propSchema !== "object") continue;

      const propResult = SafeRecord.from(propSchema);
      if (!propResult.ok) continue;
      const prop = propResult.data;

      // Special handling for x-frontmatter-part arrays
      // For these, we look for "traceability" array in the frontmatter
      if (prop.getBoolean(SchemaExtensions.FRONTMATTER_PART) === true) {
        // This is a frontmatter array - use "traceability" as the base path
        const items = prop.get("items");
        if (items && typeof items === "object" && !Array.isArray(items)) {
          const itemsResult = SafeRecord.from(items);
          if (itemsResult.ok) {
            extractConstraintsRecursive(
              itemsResult.data.toObject(),
              "traceability",
              constraints,
            );
          }
        }
      } else {
        // Regular property handling
        const currentPath = basePath ? `${basePath}.${key}` : key;

        // Extract constraints at this level
        extractConstraintsFromLevel(prop.toObject(), currentPath, constraints);

        // Handle array items (for non-frontmatter arrays)
        const items = prop.get("items");
        if (items && typeof items === "object" && !Array.isArray(items)) {
          const itemsResult = SafeRecord.from(items);
          if (itemsResult.ok) {
            extractConstraintsRecursive(
              itemsResult.data.toObject(),
              currentPath,
              constraints,
            );
          }
        }

        // Recurse into nested properties
        if (prop.has("properties")) {
          extractConstraintsRecursive(
            prop.toObject(),
            currentPath,
            constraints,
          );
        }
      }
    }
  }
}

/**
 * Extract constraints from a single schema level
 */
function extractConstraintsFromLevel(
  schema: Record<string, unknown>,
  path: string,
  constraints: ConstraintRule[],
): void {
  // Extract const constraints
  if (schema.const !== undefined) {
    constraints.push({
      kind: "Const",
      path: path,
      value: String(schema.const),
    });
  }

  // Extract enum constraints
  if (schema.enum && Array.isArray(schema.enum)) {
    constraints.push({
      kind: "Enum",
      path: path,
      values: schema.enum.map((v) => String(v)),
    });
  }

  // Extract pattern constraints
  if (schema.pattern && typeof schema.pattern === "string") {
    try {
      constraints.push({
        kind: "Pattern",
        path: path,
        regex: new RegExp(schema.pattern),
      });
    } catch {
      // Invalid regex pattern, skip
    }
  }

  // Handle allOf schemas (Issue #592 fix)
  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const subSchema of schema.allOf) {
      if (
        subSchema && typeof subSchema === "object" && !Array.isArray(subSchema)
      ) {
        const subSchemaResult = SafeRecord.from(subSchema);
        if (subSchemaResult.ok) {
          extractConstraintsRecursive(
            subSchemaResult.data.toObject(),
            path,
            constraints,
          );
        }
      }
    }
  }
}
