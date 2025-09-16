import { defaultSchemaExtensionRegistry } from "../../src/domain/schema/value-objects/schema-extension-registry.ts";
import { SchemaProperty } from "../../src/domain/schema/value-objects/schema-property-types.ts";

/**
 * Test helper for building schema properties without hardcoding extension keys.
 * Follows DDD and Totality principles by using the domain's SchemaExtensionRegistry.
 *
 * This builder eliminates hardcoded strings in tests and ensures all tests
 * use the same extension keys as production code.
 */
export class TestSchemaBuilder {
  private kind: SchemaProperty["kind"];
  private properties: Record<string, SchemaProperty> = {};
  private required: string[] = [];
  private items?: SchemaProperty;
  private defaultValue?: unknown;
  private extensions: Record<string, unknown> = {};
  private readonly registry = defaultSchemaExtensionRegistry;

  constructor(kind: SchemaProperty["kind"] = "object") {
    this.kind = kind;
    if (kind === "array") {
      this.items = { kind: "string" };
    }
  }

  /**
   * Add x-frontmatter-part extension
   */
  withFrontmatterPart(value: boolean = true): this {
    this.extensions[this.registry.getFrontmatterPartKey().getValue()] = value;
    return this;
  }

  /**
   * Add x-template extension
   */
  withTemplate(template: string): this {
    this.extensions[this.registry.getTemplateKey().getValue()] = template;
    return this;
  }

  /**
   * Add x-template-items extension
   */
  withTemplateItems(template: string): this {
    this.extensions[this.registry.getTemplateItemsKey().getValue()] = template;
    return this;
  }

  /**
   * Add x-derived-from extension
   */
  withDerivedFrom(source: string): this {
    this.extensions[this.registry.getDerivedFromKey().getValue()] = source;
    return this;
  }

  /**
   * Add x-derived-unique extension
   */
  withDerivedUnique(value: boolean = true): this {
    this.extensions[this.registry.getDerivedUniqueKey().getValue()] = value;
    return this;
  }

  /**
   * Add x-jmespath-filter extension
   */
  withJmespathFilter(filter: string): this {
    this.extensions[this.registry.getJmespathFilterKey().getValue()] = filter;
    return this;
  }

  /**
   * Add x-template-format extension
   */
  withTemplateFormat(format: "json" | "yaml" | "markdown"): this {
    this.extensions[this.registry.getTemplateFormatKey().getValue()] = format;
    return this;
  }

  /**
   * Add x-base-property extension
   */
  withBaseProperty(value: boolean = true): this {
    this.extensions[this.registry.getBasePropertyKey().getValue()] = value;
    return this;
  }

  /**
   * Add x-default-value extension
   */
  withDefaultValue(value: unknown): this {
    this.extensions[this.registry.getDefaultValueKey().getValue()] = value;
    return this;
  }

  /**
   * Add description
   */
  withDescription(description: string): this {
    this.extensions.description = description;
    return this;
  }

  /**
   * Add a property (for object schemas)
   */
  withProperty(name: string, property: SchemaProperty): this {
    if (this.kind !== "object") {
      throw new Error("Cannot add properties to non-object schema");
    }
    this.properties[name] = property;
    return this;
  }

  /**
   * Add required field (for object schemas)
   */
  withRequired(fields: string[]): this {
    if (this.kind !== "object") {
      throw new Error("Cannot add required fields to non-object schema");
    }
    this.required = fields;
    return this;
  }

  /**
   * Set items (for array schemas)
   */
  withItems(items: SchemaProperty): this {
    if (this.kind !== "array") {
      throw new Error("Cannot set items on non-array schema");
    }
    this.items = items;
    return this;
  }

  /**
   * Set default value
   */
  withDefault(value: unknown): this {
    this.defaultValue = value;
    return this;
  }

  /**
   * Build the schema
   */
  build(): SchemaProperty {
    const hasExtensions = Object.keys(this.extensions).length > 0;

    switch (this.kind) {
      case "object": {
        const schema: any = {
          kind: "object",
          properties: this.properties,
          required: this.required,
        };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "array": {
        const schema: any = {
          kind: "array",
          items: this.items!,
        };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "string": {
        const schema: any = { kind: "string" };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "number": {
        const schema: any = { kind: "number" };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "boolean": {
        const schema: any = { kind: "boolean" };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "null": {
        const schema: any = { kind: "null" };
        if (hasExtensions) schema.extensions = this.extensions;
        return schema;
      }
      case "integer": {
        const schema: any = { kind: "integer" };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "ref": {
        const schema: any = { kind: "ref", ref: "" };
        if (hasExtensions) schema.extensions = this.extensions;
        return schema;
      }
      case "enum": {
        const schema: any = { kind: "enum", enum: [] };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      case "any": {
        const schema: any = { kind: "any" };
        if (hasExtensions) schema.extensions = this.extensions;
        if (this.defaultValue !== undefined) schema.default = this.defaultValue;
        return schema;
      }
      default: {
        const _exhaustive: never = this.kind;
        throw new Error(`Unhandled schema kind: ${_exhaustive}`);
      }
    }
  }

  /**
   * Static factory methods for common test scenarios
   */
  static createFrontmatterSchema(): SchemaProperty {
    return new TestSchemaBuilder("object")
      .withFrontmatterPart(true)
      .build();
  }

  static createTemplateSchema(template: string): SchemaProperty {
    return new TestSchemaBuilder("object")
      .withTemplate(template)
      .build();
  }

  static createDerivedSchema(source: string, unique = false): SchemaProperty {
    return new TestSchemaBuilder("object")
      .withDerivedFrom(source)
      .withDerivedUnique(unique)
      .build();
  }

  static createBasePropertySchema(defaultValue?: unknown): SchemaProperty {
    const builder = new TestSchemaBuilder("object")
      .withBaseProperty(true);

    if (defaultValue !== undefined) {
      builder.withDefaultValue(defaultValue);
    }

    return builder.build();
  }
}
