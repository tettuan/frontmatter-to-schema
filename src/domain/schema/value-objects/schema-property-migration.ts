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
import { DirectiveRegistryInitializer } from "../services/directive-registry-initializer.ts";
import { LegacySchemaProperty } from "../interfaces/directive-handler.ts";

// Note: LegacySchemaProperty interface is now imported from directive-handler.ts
// This eliminates duplicate interface definitions and centralizes the legacy type
// Re-export for backward compatibility with existing imports
export type { LegacySchemaProperty } from "../interfaces/directive-handler.ts";

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

    // Type assertion helper for safer casting (unused in current implementation)
    // const _safeCast = <T>(value: unknown): T | undefined => {
    //   return value as T;
    // };

    // Extract extensions first
    const extensions = this.extractExtensions(legacySchema);

    // Handle $ref case
    if (typeof legacySchema.$ref === "string") {
      return ok(SchemaPropertyFactory.createRef(legacySchema.$ref, extensions));
    }

    // Handle enum case
    if (Array.isArray(legacySchema.enum)) {
      const baseType = this.determineEnumBaseType(
        typeof legacySchema.type === "string" ? legacySchema.type : undefined,
      );
      return ok(
        SchemaPropertyFactory.createEnum(
          legacySchema.enum,
          baseType,
          extensions,
        ),
      );
    }

    // Handle typed schemas
    if (typeof legacySchema.type === "string") {
      return this.migrateTypedSchema(legacySchema, extensions);
    }

    // Handle object without explicit type (has properties)
    if (
      legacySchema.properties && typeof legacySchema.properties === "object"
    ) {
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

  /**
   * Extract extensions using DirectiveRegistry (replaces hardcoded if-conditions)
   * Following DDD and Totality principles with registry pattern
   */
  private static extractExtensions(
    legacy: LegacySchemaProperty,
  ): SchemaExtensions {
    // Try to use DirectiveRegistry if available
    const registryResult = DirectiveRegistryInitializer.getRegistry();
    if (registryResult.ok) {
      const extractionResult = registryResult.data.extractAllExtensions(legacy);
      if (extractionResult.ok) {
        return extractionResult.data;
      }
      // If registry extraction fails, fall back to legacy method with logging
      console.warn(
        `DirectiveRegistry extraction failed: ${extractionResult.error.message}. Falling back to legacy extraction.`,
      );
    } else {
      // Registry not initialized, use fallback
      console.warn(
        `DirectiveRegistry not available: ${registryResult.error.message}. Using legacy extraction method.`,
      );
    }

    // Fallback to legacy hardcoded method (for backward compatibility during transition)
    return this.extractExtensionsLegacy(legacy);
  }

  /**
   * Legacy extension extraction method (DEPRECATED - for transition only)
   * This method contains the original hardcoded if-conditions
   * TODO: Remove this method once DirectiveRegistry is fully integrated
   */
  private static extractExtensionsLegacy(
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
    const legacyType = legacy.type as string; // We already checked it's a string in caller
    switch (legacyType) {
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
          `Unknown schema type: ${legacyType}`,
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

    if (
      legacy.items && typeof legacy.items === "object" &&
      "$ref" in legacy.items && typeof (legacy.items as any).$ref === "string"
    ) {
      items = { $ref: (legacy.items as any).$ref };
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
        Array.isArray(legacy.required) ? legacy.required : [],
        this.extractObjectConstraints(legacy),
        extensions,
      ));
    }

    const propertiesResult = this.migrateProperties(
      legacy.properties as { readonly [key: string]: LegacySchemaProperty },
    );
    if (!propertiesResult.ok) {
      return err(propertiesResult.error);
    }

    return ok(SchemaPropertyFactory.createObject(
      propertiesResult.data,
      Array.isArray(legacy.required) ? legacy.required : [],
      this.extractObjectConstraints(legacy),
      extensions,
    ));
  }

  private static extractStringConstraints(
    legacy: LegacySchemaProperty,
  ): StringConstraints {
    return {
      pattern: typeof legacy.pattern === "string" ? legacy.pattern : undefined,
      minLength: typeof legacy.minLength === "number"
        ? legacy.minLength
        : undefined,
      maxLength: typeof legacy.maxLength === "number"
        ? legacy.maxLength
        : undefined,
      format: typeof legacy.format === "string" ? legacy.format : undefined,
    };
  }

  private static extractNumberConstraints(
    legacy: LegacySchemaProperty,
  ): NumberConstraints {
    return {
      minimum: typeof legacy.minimum === "number" ? legacy.minimum : undefined,
      maximum: typeof legacy.maximum === "number" ? legacy.maximum : undefined,
      exclusiveMinimum: typeof legacy.exclusiveMinimum === "boolean"
        ? legacy.exclusiveMinimum
        : undefined,
      exclusiveMaximum: typeof legacy.exclusiveMaximum === "boolean"
        ? legacy.exclusiveMaximum
        : undefined,
      multipleOf: typeof legacy.multipleOf === "number"
        ? legacy.multipleOf
        : undefined,
    };
  }

  private static extractArrayConstraints(
    legacy: LegacySchemaProperty,
  ): ArrayConstraints {
    return {
      minItems: typeof legacy.minItems === "number"
        ? legacy.minItems
        : undefined,
      maxItems: typeof legacy.maxItems === "number"
        ? legacy.maxItems
        : undefined,
      uniqueItems: typeof legacy.uniqueItems === "boolean"
        ? legacy.uniqueItems
        : undefined,
    };
  }

  private static extractObjectConstraints(
    legacy: LegacySchemaProperty,
  ): ObjectConstraints {
    let additionalProperties: boolean | NewSchemaProperty | undefined;
    if (typeof legacy.additionalProperties === "boolean") {
      additionalProperties = legacy.additionalProperties;
    } else if (
      legacy.additionalProperties &&
      typeof legacy.additionalProperties === "object"
    ) {
      const migrationResult = this.migrate(legacy.additionalProperties);
      if (migrationResult.ok) {
        additionalProperties = migrationResult.data;
      }
    }

    return {
      minProperties: typeof legacy.minProperties === "number"
        ? legacy.minProperties
        : undefined,
      maxProperties: typeof legacy.maxProperties === "number"
        ? legacy.maxProperties
        : undefined,
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
   * Enhanced to use DirectiveRegistry when available
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

    // TODO: Future enhancement - use DirectiveRegistry to dynamically build legacy properties
    // This would eliminate hardcoded property mappings entirely

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
