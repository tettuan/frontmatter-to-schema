import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

export interface LegacySchemaProperty {
  type: string;
  properties?: Record<string, unknown>;
  items?: unknown;
  [key: string]: unknown;
}

export class SchemaDefinition {
  private constructor(
    private readonly schema: LegacySchemaProperty,
  ) {}

  static create(
    rawSchema: unknown,
  ): Result<SchemaDefinition, SchemaError & { message: string }> {
    if (typeof rawSchema !== "object" || rawSchema === null) {
      return err({
        kind: "InvalidSchema",
        message: "Schema must be an object",
      });
    }

    const schema = rawSchema as LegacySchemaProperty;
    if (!schema.type || typeof schema.type !== "string") {
      return err({
        kind: "InvalidSchema",
        message: "Schema must have a type property",
      });
    }

    return ok(new SchemaDefinition(schema));
  }

  static createLegacy(
    rawSchema: LegacySchemaProperty,
  ): Result<SchemaDefinition, SchemaError & { message: string }> {
    return this.create(rawSchema);
  }

  static fromSchemaProperty(schema: LegacySchemaProperty): SchemaDefinition {
    return new SchemaDefinition(schema);
  }

  getKind(): string {
    return this.schema.type;
  }

  getType(): Result<string, SchemaError & { message: string }> {
    return ok(this.schema.type);
  }

  getProperties(): Result<
    Record<string, unknown>,
    SchemaError & { message: string }
  > {
    if (this.schema.type === "object" && this.schema.properties) {
      return ok(this.schema.properties);
    }
    return err({
      kind: "PropertiesNotDefined",
      message: "Schema is not an object type or has no properties",
    });
  }

  getProperty(key: string): Result<unknown, SchemaError & { message: string }> {
    if (this.schema.properties && key in this.schema.properties) {
      return ok(this.schema.properties[key]);
    }
    return err({
      kind: "PropertyNotFound",
      path: key,
      message: `Property ${key} not found`,
    });
  }

  hasProperty(key: string): boolean {
    return !!(this.schema.properties && key in this.schema.properties);
  }

  getExtension(
    key: string,
  ): Result<unknown, SchemaError & { message: string }> {
    if (key in this.schema) {
      return ok(this.schema[key]);
    }
    return err({
      kind: "InvalidSchema",
      message: `Extension ${key} not found`,
    });
  }

  hasExtension(key: string): boolean {
    return key in this.schema;
  }

  toRaw(): LegacySchemaProperty {
    return this.schema;
  }

  getRawSchemaObject(): LegacySchemaProperty {
    return this.schema;
  }

  getRawSchema(): LegacySchemaProperty {
    return this.schema;
  }

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    const templateExtension = this.schema["x-template"];
    if (typeof templateExtension === "string") {
      return ok(templateExtension);
    }
    return err({
      kind: "TemplateNotDefined",
      message: "x-template extension not found",
    });
  }

  getTemplateFormat(): Result<
    "json" | "yaml" | "markdown",
    SchemaError & { message: string }
  > {
    const formatExtension = this.schema["x-template-format"];
    if (typeof formatExtension === "string") {
      if (
        formatExtension === "json" || formatExtension === "yaml" ||
        formatExtension === "markdown"
      ) {
        return ok(formatExtension);
      }
    }
    return ok("json"); // default format
  }

  hasFrontmatterPart(): boolean {
    const hasPart = this.schema["x-frontmatter-part"];
    return hasPart === true;
  }

  getDerivedFrom(): Result<string, SchemaError & { message: string }> {
    const derivedFrom = this.schema["x-derived-from"];
    if (typeof derivedFrom === "string") {
      return ok(derivedFrom);
    }
    return err({
      kind: "DerivedFromNotDefined",
      message: "x-derived-from extension not found",
    });
  }

  isDerivedUnique(): boolean {
    const unique = this.schema["x-derived-unique"];
    return unique === true;
  }
}
