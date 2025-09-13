import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

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
          return err(createError({
            kind: "InvalidSchema",
            message:
              `Base property '${rule.field}' defined but no default value specified`,
          }));
        }
        newData[rule.field] = rule.defaultValue;
      }
    }

    const result = FrontmatterData.create(newData);
    if (!result.ok) {
      // Convert FrontmatterError to SchemaError
      return err(createError({
        kind: "InvalidSchema",
        message: `Failed to create frontmatter data: ${
          result.error.message || "Unknown error"
        }`,
      }));
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
    schemaNode: any,
    rules: BasePropertyRule[],
    path: string,
  ): void {
    if (!schemaNode || typeof schemaNode !== "object") {
      return;
    }

    const properties = schemaNode.properties;
    if (properties && typeof properties === "object") {
      for (const [key, propertyDef] of Object.entries(properties)) {
        if (typeof propertyDef === "object" && propertyDef !== null) {
          const prop = propertyDef as any;
          const fieldPath = path ? `${path}.${key}` : key;

          // Check if this is a base property
          if (prop["x-base-property"] === true) {
            rules.push({
              field: fieldPath,
              defaultValue: prop["x-default-value"],
            });
          }

          // Recursively check nested properties
          this.extractFromProperties(prop, rules, fieldPath);
        }
      }
    }
  }
}
