import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
import {
  isRefSchema,
  RefSchema,
  SchemaExtensions,
  SchemaProperties,
  SchemaProperty,
  SchemaPropertyGuards,
  SchemaPropertyUtils,
} from "./schema-property-types.ts";
import {
  LegacySchemaProperty,
  SchemaPropertyMigration,
} from "./schema-property-migration.ts";

export class SchemaDefinition {
  private constructor(
    private readonly schema: SchemaProperty,
  ) {}

  static create(
    rawSchema: unknown,
  ): Result<SchemaDefinition, SchemaError & { message: string }> {
    // Migrate from legacy optional properties format to discriminated union
    const migrationResult = SchemaPropertyMigration.migrate(rawSchema);
    if (!migrationResult.ok) {
      return err(migrationResult.error);
    }

    return ok(new SchemaDefinition(migrationResult.data));
  }

  /**
   * Create from already-migrated SchemaProperty
   */
  static fromSchemaProperty(schema: SchemaProperty): SchemaDefinition {
    return new SchemaDefinition(schema);
  }

  /**
   * Legacy constructor for backward compatibility during migration
   * @deprecated Use create() instead
   */
  static createLegacy(
    rawSchema: LegacySchemaProperty,
  ): Result<SchemaDefinition, SchemaError & { message: string }> {
    return this.create(rawSchema);
  }

  /**
   * Get the kind of this schema property
   */
  getKind(): string {
    return this.schema.kind;
  }

  /**
   * Get type as string representation (for backward compatibility)
   */
  getType(): Result<string, SchemaError & { message: string }> {
    // Exhaustive switch - no default needed due to totality
    switch (this.schema.kind) {
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "array":
      case "object":
      case "null":
        return ok(this.schema.kind);
      case "ref":
        return err(createError({
          kind: "TypeNotDefined",
          message: "Reference schema does not have a direct type",
        }));
      case "enum":
        return ok(this.schema.baseType || "string");
      case "any":
        return err(createError({
          kind: "TypeNotDefined",
          message: "Any type schema does not have a specific type",
        }));
    }
  }

  /**
   * Get properties for object schemas
   */
  getProperties(): Result<SchemaProperties, SchemaError & { message: string }> {
    if (SchemaPropertyGuards.isObject(this.schema)) {
      return ok(this.schema.properties);
    }
    return err(createError({
      kind: "PropertiesNotDefined",
      message: `Schema of kind '${this.schema.kind}' does not have properties`,
    }));
  }

  /**
   * Get required properties for object schemas
   */
  getRequired(): readonly string[] {
    if (SchemaPropertyGuards.isObject(this.schema)) {
      return this.schema.required;
    }
    return [];
  }

  /**
   * Get template path from x-template extension
   */
  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getTemplate(this.schema);
  }

  /**
   * Check if schema has template directive
   */
  hasTemplate(): boolean {
    return SchemaPropertyUtils.hasTemplate(this.schema);
  }

  /**
   * Get template items path from x-template-items extension (user-requested feature)
   */
  getTemplateItems(): Result<string, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getTemplateItems(this.schema);
  }

  /**
   * Check if schema has template items directive
   */
  hasTemplateItems(): boolean {
    return SchemaPropertyUtils.hasTemplateItems(this.schema);
  }

  /**
   * Get template output format from x-template-format extension (user-requested feature)
   */
  getTemplateFormat(): Result<
    "json" | "yaml" | "markdown",
    SchemaError & { message: string }
  > {
    return SchemaPropertyUtils.getTemplateFormat(this.schema);
  }

  /**
   * Check if schema has template format directive
   */
  hasTemplateFormat(): boolean {
    return SchemaPropertyUtils.hasTemplateFormat(this.schema);
  }

  /**
   * Get JMESPath filter expression from x-jmespath-filter extension
   */
  getJMESPathFilter(): Result<string, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getJMESPathFilter(this.schema);
  }

  /**
   * Check if schema has JMESPath filter directive
   */
  hasJMESPathFilter(): boolean {
    return SchemaPropertyUtils.hasJMESPathFilter(this.schema);
  }

  /**
   * Check if schema is a reference
   */
  hasRef(): boolean {
    return SchemaPropertyGuards.isRef(this.schema);
  }

  /**
   * Get reference path for ref schemas
   */
  getRef(): Result<string, SchemaError & { message: string }> {
    if (SchemaPropertyGuards.isRef(this.schema)) {
      return ok(this.schema.ref);
    }
    return err(createError({
      kind: "RefNotDefined",
      message: `Schema of kind '${this.schema.kind}' is not a reference`,
    }));
  }

  /**
   * Check if schema has frontmatter part directive
   */
  hasFrontmatterPart(): boolean {
    return SchemaPropertyUtils.hasFrontmatterPart(this.schema);
  }

  /**
   * Get derived from path
   */
  getDerivedFrom(): Result<string, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getDerivedFrom(this.schema);
  }

  /**
   * Check if schema has derived from directive
   */
  hasDerivedFrom(): boolean {
    return SchemaPropertyUtils.hasDerivedFrom(this.schema);
  }

  /**
   * Check if schema is marked as derived unique
   */
  isDerivedUnique(): boolean {
    return SchemaPropertyUtils.isDerivedUnique(this.schema);
  }

  /**
   * Check if schema has extract-from directive
   */
  hasExtractFrom(): boolean {
    return SchemaPropertyUtils.hasExtractFrom(this.schema);
  }

  /**
   * Get extract-from path from schema
   */
  getExtractFrom(): Result<string, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getExtractFrom(this.schema);
  }

  /**
   * Check if schema has merge-arrays directive
   */
  hasMergeArrays(): boolean {
    return SchemaPropertyUtils.hasMergeArrays(this.schema);
  }

  /**
   * Get merge-arrays configuration from schema
   */
  getMergeArrays(): Result<boolean, SchemaError & { message: string }> {
    return SchemaPropertyUtils.getMergeArrays(this.schema);
  }

  /**
   * Get items schema for array schemas
   */
  getItems(): Result<
    SchemaProperty | RefSchema,
    SchemaError & { message: string }
  > {
    if (SchemaPropertyGuards.isArray(this.schema)) {
      return ok(this.schema.items);
    }
    return err(createError({
      kind: "ItemsNotDefined",
      message: `Schema of kind '${this.schema.kind}' does not have items`,
    }));
  }

  /**
   * Get enum values for enum schemas
   */
  getEnumValues(): Result<
    readonly unknown[],
    SchemaError & { message: string }
  > {
    if (SchemaPropertyGuards.isEnum(this.schema)) {
      return ok(this.schema.values);
    }
    return err(createError({
      kind: "EnumNotDefined",
      message: `Schema of kind '${this.schema.kind}' is not an enum`,
    }));
  }

  /**
   * Get the raw schema property (for backward compatibility)
   */
  getRawSchema(): SchemaProperty {
    return this.schema;
  }

  /**
   * Extract items schema from an array schema property using totality principles.
   * Uses exhaustive pattern matching instead of unsafe type assertions.
   */
  private extractItemsSchema(
    schemaProperty: SchemaProperty,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    if (!SchemaPropertyGuards.isArray(schemaProperty)) {
      return err(createError(
        {
          kind: "ItemsNotDefined",
        },
        `Schema of kind '${schemaProperty.kind}' does not define items for array type`,
      ));
    }

    // Handle $ref items (should not be processed directly)
    if (isRefSchema(schemaProperty.items)) {
      return err(createError({
        kind: "RefNotDefined",
      }, "Array items reference unresolved $ref - use resolved schema"));
    }

    return ok(schemaProperty.items);
  }

  /**
   * Find property at given path using exhaustive pattern matching
   * Replaces unsafe property access with totality-compliant navigation
   */
  findProperty(
    path: string,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    const parts = path.split(".");
    let current: SchemaProperty = this.schema;

    for (const part of parts) {
      if (part === "[]") {
        // Use safe extraction with exhaustive pattern matching
        const itemsResult = this.extractItemsSchema(current);
        if (!itemsResult.ok) {
          return err(createError(
            {
              kind: "PropertyNotFound",
              path: path,
            },
            `Cannot access array items at path '${path}': ${itemsResult.error.message}`,
          ));
        }
        current = itemsResult.data;
      } else {
        // Navigate to property using exhaustive switch
        const navigationResult = this.navigateToProperty(current, part);
        if (!navigationResult.ok) {
          return err(createError({
            kind: "PropertyNotFound",
            path: path,
          }, `Property '${part}' not found at path '${path}'`));
        }
        current = navigationResult.data;
      }
    }

    return ok(current);
  }

  /**
   * Navigate to a property within a schema using exhaustive pattern matching
   */
  private navigateToProperty(
    schema: SchemaProperty,
    propertyName: string,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    // Exhaustive switch on schema kind - no default needed
    switch (schema.kind) {
      case "object":
        if (schema.properties[propertyName]) {
          return ok(schema.properties[propertyName]);
        }
        return err(createError({
          kind: "PropertyNotFound",
          path: propertyName,
        }, `Property '${propertyName}' not found in object schema`));

      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "array":
      case "ref":
      case "enum":
      case "null":
      case "any":
        return err(createError({
          kind: "PropertyNotFound",
          path: propertyName,
        }, `Schema of kind '${schema.kind}' does not have properties`));
    }
  }

  /**
   * Check if this schema matches a specific kind
   */
  isKind<K extends SchemaProperty["kind"]>(
    kind: K,
  ): this is SchemaDefinition & {
    schema: Extract<SchemaProperty, { kind: K }>;
  } {
    return this.schema.kind === kind;
  }

  /**
   * Get description from extensions
   */
  getDescription(): string | undefined {
    return this.schema.extensions?.description;
  }

  /**
   * Check if schema has any extensions
   */
  hasExtensions(): boolean {
    return this.schema.extensions !== undefined;
  }

  /**
   * Get all extensions
   */
  getExtensions(): SchemaExtensions | undefined {
    return this.schema.extensions;
  }
}
