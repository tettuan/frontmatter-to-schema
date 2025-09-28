import { ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { Schema } from "../entities/schema.ts";
import { SchemaProperty } from "../value-objects/schema-property-types.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";

export interface BasePropertyRule {
  readonly field: string;
  readonly defaultValue: unknown;
}

export class BasePropertyPopulator {
  populate(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData, SchemaError & { message: string }> {
    const baseProperties = this.extractBaseProperties(schema);

    if (baseProperties.length === 0) {
      // No base properties defined, return original data
      return ok(data);
    }

    // Create new data object with base properties populated
    const currentData = data.getData();
    const newData: Record<string, unknown> = { ...currentData };

    for (const rule of baseProperties) {
      // Only set if not already present in frontmatter
      if (!(rule.field in newData)) {
        if (rule.defaultValue === undefined) {
          return ErrorHandler.schema({
            operation: "populate",
            method: "validateBaseProperty",
          }).invalidSchema(
            `Base property '${rule.field}' defined but no default value specified`,
          );
        }
        newData[rule.field] = rule.defaultValue;
      }
    }

    const result = FrontmatterDataFactory.fromObject(newData);
    if (!result.ok) {
      // Convert FrontmatterError to SchemaError
      return ErrorHandler.schema({
        operation: "populate",
        method: "createFrontmatterData",
      }).invalidSchema(
        `Failed to create frontmatter data: ${
          result.error.message || "Unknown error"
        }`,
      );
    }

    return ok(result.data);
  }

  private extractBaseProperties(schema: Schema): BasePropertyRule[] {
    const rules: BasePropertyRule[] = [];
    const definition = schema.getDefinition();
    const rawSchema = definition.getRawSchema();

    this.extractFromProperties(rawSchema, rules, "");
    return rules;
  }

  private extractFromProperties(
    schemaNode: SchemaProperty,
    rules: BasePropertyRule[],
    path: string,
  ): void {
    // Use exhaustive pattern matching for schema types
    switch (schemaNode.kind) {
      case "object":
        // Process object properties
        for (
          const [key, propertyDef] of Object.entries(schemaNode.properties)
        ) {
          const fieldPath = path ? `${path}.${key}` : key;

          // Check if this property has a default value
          if (propertyDef.default !== undefined) {
            // CRITICAL: Handle standard JSON Schema default properties
            // This enables template variable replacement for schema defaults
            // Without this, variables like {version}, {description}, {level} remain unreplaced
            rules.push({
              field: fieldPath,
              defaultValue: propertyDef.default,
            });
          }

          // Recursively check nested properties
          this.extractFromProperties(propertyDef, rules, fieldPath);
        }
        break;

      case "array":
        // For arrays, check if items are objects with base properties
        if (!("$ref" in schemaNode.items)) {
          this.extractFromProperties(schemaNode.items, rules, path);
        }
        break;

      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "enum":
      case "ref":
      case "null":
      case "any":
        // Primitive types and refs don't have nested properties
        break;
    }
  }
}
