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

  getType(): string | undefined {
    return this.schema.type;
  }

  getProperties(): SchemaProperties | undefined {
    return this.schema.properties;
  }

  getRequired(): readonly string[] {
    return this.schema.required || [];
  }

  getTemplatePath(): string | undefined {
    return this.templatePath;
  }

  hasRef(): boolean {
    return this.schema.$ref !== undefined;
  }

  getRef(): string | undefined {
    return this.schema.$ref;
  }

  hasFrontmatterPart(): boolean {
    return this.schema["x-frontmatter-part"] === true;
  }

  getDerivedFrom(): string | undefined {
    return this.schema["x-derived-from"];
  }

  isDerivedUnique(): boolean {
    return this.schema["x-derived-unique"] === true;
  }

  getItems(): SchemaProperty | { readonly $ref: string } | undefined {
    return this.schema.items;
  }

  getRawSchema(): SchemaProperty {
    return this.schema;
  }

  findProperty(path: string): SchemaProperty | undefined {
    const parts = path.split(".");
    let current: SchemaProperty = this.schema;

    for (const part of parts) {
      if (part === "[]") {
        current = current.items as SchemaProperty;
        if (!current) return undefined;
      } else if (current.properties && current.properties[part]) {
        current = current.properties[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
