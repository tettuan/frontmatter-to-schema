import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { defaultSchemaExtensionRegistry } from "./schema-extension-registry.ts";
import {
  ArrayConstraints,
  NumberConstraints,
  ObjectConstraints,
  RefSchema,
  SchemaExtensions,
  SchemaProperties as NewSchemaProperties,
  SchemaProperty as NewSchemaProperty,
  SchemaPropertyFactory,
  StringConstraints,
} from "./schema-property-types.ts";

/**
 * Legacy schema property interface (for migration only)
 * This represents the old optional properties approach that violates Totality
 */
export interface LegacySchemaProperty {
  readonly type?: string;
  readonly description?: string;
  readonly properties?: { readonly [key: string]: LegacySchemaProperty };
  readonly items?: LegacySchemaProperty | { readonly $ref: string };
  readonly $ref?: string;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: boolean;
  readonly exclusiveMaximum?: boolean;
  readonly multipleOf?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly format?: string;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly additionalProperties?: boolean | LegacySchemaProperty;
  readonly "x-template"?: string;
  readonly "x-frontmatter-part"?: boolean;
  readonly "x-derived-from"?: string;
  readonly "x-derived-unique"?: boolean;
  readonly "x-template-items"?: string;
  readonly "x-flatten-arrays"?: string;
  readonly "x-template-format"?: "json" | "yaml" | "markdown"; // User-requested: output format specification
  readonly "x-jmespath-filter"?: string; // JMESPath filtering expression
  readonly default?: unknown; // Standard JSON Schema default property
}

/**
 * Migration utility to convert legacy schema properties to Totality-compliant discriminated unions
 */
export class SchemaPropertyMigration {
  /**
   * Convert legacy schema property to new discriminated union
   * Handles all the complex logic of determining schema type from optional properties
   */
  static migrate(
    legacy: unknown,
  ): Result<NewSchemaProperty, SchemaError & { message: string }> {
    if (!legacy || typeof legacy !== "object") {
      return ErrorHandler.schema({ operation: "migrate", method: "validate" })
        .invalid(
          "Schema must be an object",
        );
    }

    const legacySchema = legacy as LegacySchemaProperty;

    // Extract extensions first
    const extensions = this.extractExtensions(legacySchema);

    // Handle $ref case
    if (legacySchema.$ref) {
      return ok(SchemaPropertyFactory.createRef(legacySchema.$ref, extensions));
    }

    // Handle enum case
    if (legacySchema.enum) {
      const baseType = this.determineEnumBaseType(legacySchema.type);
      return ok(
        SchemaPropertyFactory.createEnum(
          legacySchema.enum,
          baseType,
          extensions,
        ),
      );
    }

    // Handle typed schemas
    if (legacySchema.type) {
      return this.migrateTypedSchema(legacySchema, extensions);
    }

    // Handle object without explicit type (has properties)
    if (legacySchema.properties) {
      return this.migrateObjectSchema(legacySchema, extensions);
    }

    // Default to any type if no clear indication
    return ok(SchemaPropertyFactory.createAny(extensions));
  }

  /**
   * Migrate a collection of properties
   */
  static migrateProperties(
    legacyProperties: { readonly [key: string]: LegacySchemaProperty },
  ): Result<NewSchemaProperties, SchemaError & { message: string }> {
    const migratedProperties: { [key: string]: NewSchemaProperty } = {};

    for (const [key, legacyProp] of Object.entries(legacyProperties)) {
      const migrationResult = this.migrate(legacyProp);
      if (!migrationResult.ok) {
        return ErrorHandler.schema({
          operation: "migrateProperties",
          method: "migrate",
        }).invalid(
          `Failed to migrate property '${key}': ${migrationResult.error.message}`,
        );
      }
      migratedProperties[key] = migrationResult.data;
    }

    return ok(migratedProperties);
  }

  private static extractExtensions(
    legacy: LegacySchemaProperty,
  ): SchemaExtensions {
    const registry = defaultSchemaExtensionRegistry;
    const extensions = {} as Record<string, unknown>;

    // Check for extensions object first (legacy format)
    const extensionsObj = (legacy as any).extensions;
    if (extensionsObj && typeof extensionsObj === "object") {
      // Extract from extensions object
      if (extensionsObj["x-template"] !== undefined) {
        extensions[registry.getTemplateKey().getValue()] =
          extensionsObj["x-template"];
      }
      if (extensionsObj["x-frontmatter-part"] !== undefined) {
        extensions[registry.getFrontmatterPartKey().getValue()] =
          extensionsObj["x-frontmatter-part"];
      }
      if (extensionsObj["x-derived-from"] !== undefined) {
        extensions[registry.getDerivedFromKey().getValue()] =
          extensionsObj["x-derived-from"];
      }
      if (extensionsObj["x-derived-unique"] !== undefined) {
        extensions[registry.getDerivedUniqueKey().getValue()] =
          extensionsObj["x-derived-unique"];
      }
      if (extensionsObj["x-template-items"] !== undefined) {
        extensions[registry.getTemplateItemsKey().getValue()] =
          extensionsObj["x-template-items"];
      }
      if (extensionsObj["x-template-format"] !== undefined) {
        extensions[registry.getTemplateFormatKey().getValue()] =
          extensionsObj["x-template-format"];
      }
      if (extensionsObj["x-jmespath-filter"] !== undefined) {
        extensions[registry.getJmespathFilterKey().getValue()] =
          extensionsObj["x-jmespath-filter"];
      }
      if (extensionsObj["x-flatten-arrays"] !== undefined) {
        extensions[registry.getFlattenArraysKey().getValue()] =
          extensionsObj["x-flatten-arrays"];
      }
      if (extensionsObj.description !== undefined) {
        extensions.description = extensionsObj.description;
      }
    }

    // Extract direct properties (standard JSON Schema extension pattern)
    // These take precedence over extensions object if both exist
    if (legacy["x-template"] !== undefined) {
      extensions[registry.getTemplateKey().getValue()] = legacy["x-template"];
    }
    if (legacy["x-frontmatter-part"] !== undefined) {
      extensions[registry.getFrontmatterPartKey().getValue()] =
        legacy["x-frontmatter-part"];
    }
    if (legacy["x-derived-from"] !== undefined) {
      extensions[registry.getDerivedFromKey().getValue()] =
        legacy["x-derived-from"];
    }
    if (legacy["x-derived-unique"] !== undefined) {
      extensions[registry.getDerivedUniqueKey().getValue()] =
        legacy["x-derived-unique"];
    }
    if (legacy["x-template-items"] !== undefined) {
      extensions[registry.getTemplateItemsKey().getValue()] =
        legacy["x-template-items"];
    }
    if (legacy["x-template-format"] !== undefined) {
      extensions[registry.getTemplateFormatKey().getValue()] =
        legacy["x-template-format"];
    }
    if (legacy["x-jmespath-filter"] !== undefined) {
      extensions[registry.getJmespathFilterKey().getValue()] =
        legacy["x-jmespath-filter"];
    }
    if (legacy["x-flatten-arrays"] !== undefined) {
      extensions[registry.getFlattenArraysKey().getValue()] =
        legacy["x-flatten-arrays"];
    }

    // Description property
    if (legacy.description !== undefined) {
      extensions.description = legacy.description;
    }

    return extensions as SchemaExtensions;
  }

  private static determineEnumBaseType(
    type?: string,
  ): "string" | "number" | "integer" | "boolean" | undefined {
    switch (type) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "integer":
        return "integer";
      case "boolean":
        return "boolean";
      default:
        return undefined;
    }
  }

  private static migrateTypedSchema(
    legacy: LegacySchemaProperty,
    extensions: SchemaExtensions,
  ): Result<NewSchemaProperty, SchemaError & { message: string }> {
    switch (legacy.type) {
      case "string":
        return ok(SchemaPropertyFactory.createString(
          this.extractStringConstraints(legacy),
          extensions,
          legacy.default, // Pass the default value
        ));

      case "number":
        return ok(SchemaPropertyFactory.createNumber(
          this.extractNumberConstraints(legacy),
          extensions,
          legacy.default, // Pass the default value
        ));

      case "integer":
        return ok(SchemaPropertyFactory.createInteger(
          this.extractNumberConstraints(legacy),
          extensions,
          legacy.default, // Pass the default value
        ));

      case "boolean":
        return ok(
          SchemaPropertyFactory.createBoolean(extensions, legacy.default),
        );

      case "array":
        return this.migrateArraySchema(legacy, extensions);

      case "object":
        return this.migrateObjectSchema(legacy, extensions);

      case "null":
        return ok(SchemaPropertyFactory.createNull(extensions));

      default:
        return ErrorHandler.schema({
          operation: "migrateByType",
          method: "validate",
        }).invalid(
          `Unknown schema type: ${legacy.type}`,
        );
    }
  }

  private static migrateArraySchema(
    legacy: LegacySchemaProperty,
    extensions: SchemaExtensions,
  ): Result<NewSchemaProperty, SchemaError & { message: string }> {
    if (!legacy.items) {
      return ErrorHandler.schema({
        operation: "migrateArray",
        method: "validate",
      }).invalid(
        "Array schema must define items",
      );
    }

    let items: NewSchemaProperty | RefSchema;

    if ("$ref" in legacy.items && legacy.items.$ref) {
      items = { $ref: legacy.items.$ref };
    } else {
      const itemsResult = this.migrate(legacy.items);
      if (!itemsResult.ok) {
        return ErrorHandler.schema({
          operation: "migrateArray",
          method: "migrateItems",
        }).invalid(
          `Failed to migrate array items: ${itemsResult.error.message}`,
        );
      }
      items = itemsResult.data;
    }

    return ok(SchemaPropertyFactory.createArray(
      items,
      this.extractArrayConstraints(legacy),
      extensions,
    ));
  }

  private static migrateObjectSchema(
    legacy: LegacySchemaProperty,
    extensions: SchemaExtensions,
  ): Result<NewSchemaProperty, SchemaError & { message: string }> {
    if (!legacy.properties) {
      // Object without properties
      return ok(SchemaPropertyFactory.createObject(
        {},
        legacy.required || [],
        this.extractObjectConstraints(legacy),
        extensions,
      ));
    }

    const propertiesResult = this.migrateProperties(legacy.properties);
    if (!propertiesResult.ok) {
      return err(propertiesResult.error);
    }

    return ok(SchemaPropertyFactory.createObject(
      propertiesResult.data,
      legacy.required || [],
      this.extractObjectConstraints(legacy),
      extensions,
    ));
  }

  private static extractStringConstraints(
    legacy: LegacySchemaProperty,
  ): StringConstraints {
    return {
      pattern: legacy.pattern,
      minLength: legacy.minLength,
      maxLength: legacy.maxLength,
      format: legacy.format,
    };
  }

  private static extractNumberConstraints(
    legacy: LegacySchemaProperty,
  ): NumberConstraints {
    return {
      minimum: legacy.minimum,
      maximum: legacy.maximum,
      exclusiveMinimum: legacy.exclusiveMinimum,
      exclusiveMaximum: legacy.exclusiveMaximum,
      multipleOf: legacy.multipleOf,
    };
  }

  private static extractArrayConstraints(
    legacy: LegacySchemaProperty,
  ): ArrayConstraints {
    return {
      minItems: legacy.minItems,
      maxItems: legacy.maxItems,
      uniqueItems: legacy.uniqueItems,
    };
  }

  private static extractObjectConstraints(
    legacy: LegacySchemaProperty,
  ): ObjectConstraints {
    let additionalProperties: boolean | NewSchemaProperty | undefined;
    if (typeof legacy.additionalProperties === "boolean") {
      additionalProperties = legacy.additionalProperties;
    } else if (legacy.additionalProperties) {
      const migrationResult = this.migrate(legacy.additionalProperties);
      if (migrationResult.ok) {
        additionalProperties = migrationResult.data;
      }
    }

    return {
      minProperties: legacy.minProperties,
      maxProperties: legacy.maxProperties,
      additionalProperties,
    };
  }
}

/**
 * Backward compatibility utility
 * Converts new schema property back to legacy format for existing code that hasn't been migrated yet
 */
export class SchemaPropertyLegacyAdapter {
  /**
   * Convert new schema property back to legacy format
   * This is a temporary measure during migration
   */
  static toLegacy(schema: NewSchemaProperty): LegacySchemaProperty {
    const registry = defaultSchemaExtensionRegistry;
    const base: LegacySchemaProperty = {
      description: schema.extensions?.description,
      "x-template": schema.extensions?.[registry.getTemplateKey().getValue()] as
        | string
        | undefined,
      "x-frontmatter-part": schema.extensions
        ?.[registry.getFrontmatterPartKey().getValue()] as boolean | undefined,
      "x-derived-from": schema.extensions
        ?.[registry.getDerivedFromKey().getValue()] as string | undefined,
      "x-derived-unique": schema.extensions
        ?.[registry.getDerivedUniqueKey().getValue()] as boolean | undefined,
      "x-template-items": schema.extensions
        ?.[registry.getTemplateItemsKey().getValue()] as string | undefined,
      "x-template-format": schema.extensions
        ?.[registry.getTemplateFormatKey().getValue()] as
          | "json"
          | "yaml"
          | "markdown"
          | undefined,
      "x-jmespath-filter": schema.extensions
        ?.[registry.getJmespathFilterKey().getValue()] as string | undefined,
      "x-flatten-arrays": schema.extensions
        ?.[registry.getFlattenArraysKey().getValue()] as string | undefined,
    };

    switch (schema.kind) {
      case "string":
        return {
          ...base,
          type: "string",
          ...schema.constraints,
        };

      case "number":
        return {
          ...base,
          type: "number",
          ...schema.constraints,
        };

      case "integer":
        return {
          ...base,
          type: "integer",
          ...schema.constraints,
        };

      case "boolean":
        return {
          ...base,
          type: "boolean",
        };

      case "array": {
        const items: LegacySchemaProperty | { readonly $ref: string } =
          "$ref" in schema.items ? schema.items : this.toLegacy(schema.items);

        return {
          ...base,
          type: "array",
          items,
          ...schema.constraints,
        };
      }

      case "object": {
        const legacyProperties: { [key: string]: LegacySchemaProperty } = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          legacyProperties[key] = this.toLegacy(prop);
        }

        // Handle constraints and construct result object
        const result: LegacySchemaProperty = {
          ...base,
          type: "object",
          properties: legacyProperties,
          required: schema.required,
          ...(schema.constraints?.minProperties !== undefined &&
            { minProperties: schema.constraints.minProperties }),
          ...(schema.constraints?.maxProperties !== undefined &&
            { maxProperties: schema.constraints.maxProperties }),
          ...(schema.constraints?.additionalProperties !== undefined && {
            additionalProperties:
              typeof schema.constraints.additionalProperties === "boolean"
                ? schema.constraints.additionalProperties
                : this.toLegacy(schema.constraints.additionalProperties),
          }),
        };

        return result;
      }

      case "ref":
        return {
          ...base,
          $ref: schema.ref,
        };

      case "enum":
        return {
          ...base,
          type: schema.baseType,
          enum: schema.values,
        };

      case "null":
        return {
          ...base,
          type: "null",
        };

      case "any":
        return {
          ...base,
        };
    }
  }
}
