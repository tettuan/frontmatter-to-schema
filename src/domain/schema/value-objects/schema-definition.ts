import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";

export interface SchemaProperties {
  readonly [key: string]: SchemaProperty;
}

export interface SchemaProperty {
  readonly type?: string;
  readonly description?: string;
  readonly properties?: SchemaProperties;
  readonly items?: SchemaProperty | { readonly $ref: string };
  readonly $ref?: string;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly format?: string;
  readonly "x-template"?: string;
  readonly "x-frontmatter-part"?: boolean;
  readonly "x-derived-from"?: string;
  readonly "x-derived-unique"?: boolean;
}

export class SchemaDefinition {
  private constructor(
    private readonly schema: SchemaProperty,
    private readonly templatePath?: string,
  ) {}

  static create(
    rawSchema: unknown,
  ): Result<SchemaDefinition, SchemaError & { message: string }> {
    if (!rawSchema || typeof rawSchema !== "object") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Schema must be an object",
      }));
    }

    const schema = rawSchema as SchemaProperty;

    if (schema.type && typeof schema.type !== "string") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Schema type must be a string",
      }));
    }

    const templatePath = schema["x-template"];
    if (templatePath && typeof templatePath !== "string") {
      return err(createError({
        kind: "InvalidSchema",
        message: "x-template must be a string",
      }));
    }

    return ok(new SchemaDefinition(schema, templatePath));
  }

  getType(): Result<string, SchemaError & { message: string }> {
    if (this.schema.type) {
      return ok(this.schema.type);
    }
    return err(createError({ kind: "TypeNotDefined" }));
  }

  getProperties(): Result<SchemaProperties, SchemaError & { message: string }> {
    if (this.schema.properties) {
      return ok(this.schema.properties);
    }
    return err(createError({ kind: "PropertiesNotDefined" }));
  }

  getRequired(): readonly string[] {
    return this.schema.required || [];
  }

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    if (this.templatePath) {
      return ok(this.templatePath);
    }
    return err(createError({ kind: "TemplateNotDefined" }));
  }

  hasRef(): boolean {
    return this.schema.$ref !== undefined;
  }

  getRef(): Result<string, SchemaError & { message: string }> {
    if (this.schema.$ref) {
      return ok(this.schema.$ref);
    }
    return err(createError({ kind: "RefNotDefined" }));
  }

  hasFrontmatterPart(): boolean {
    return this.schema["x-frontmatter-part"] === true;
  }

  getDerivedFrom(): Result<string, SchemaError & { message: string }> {
    if (this.schema["x-derived-from"]) {
      return ok(this.schema["x-derived-from"]);
    }
    return err(createError({ kind: "DerivedFromNotDefined" }));
  }

  isDerivedUnique(): boolean {
    return this.schema["x-derived-unique"] === true;
  }

  getItems(): Result<
    SchemaProperty | { readonly $ref: string },
    SchemaError & { message: string }
  > {
    if (this.schema.items) {
      return ok(this.schema.items);
    }
    return err(createError({ kind: "ItemsNotDefined" }));
  }

  getRawSchema(): SchemaProperty {
    return this.schema;
  }

  findProperty(
    path: string,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    const parts = path.split(".");
    let current: SchemaProperty = this.schema;

    for (const part of parts) {
      if (part === "[]") {
        current = current.items as SchemaProperty;
        if (!current) {
          return err(createError({
            kind: "PropertyNotFound",
            path: path,
          }));
        }
      } else if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else {
        return err(createError({
          kind: "PropertyNotFound",
          path: path,
        }));
      }
    }

    return ok(current);
  }
}
