import { ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";

export interface ResolvedSchema {
  readonly definition: SchemaDefinition;
}

export type SchemaState = {
  kind: "resolved";
  path: SchemaPath;
  definition: SchemaDefinition;
};

export class Schema {
  private constructor(private readonly state: SchemaState) {}

  static create(
    path: SchemaPath,
    definition: SchemaDefinition,
  ): Result<Schema, SchemaError & { message: string }> {
    const state: SchemaState = {
      kind: "resolved",
      path,
      definition,
    };

    return ok(new Schema(state));
  }

  getPath(): SchemaPath {
    return this.state.path;
  }

  getDefinition(): SchemaDefinition {
    return this.state.definition;
  }

  getRawSchemaObject(): unknown {
    return this.state.definition.getRawSchemaObject();
  }

  getRawSchema(): unknown {
    return this.state.definition.getRawSchema();
  }

  extractSchemaDirectives(): Result<
    unknown,
    SchemaError & { message: string }
  > {
    return ok({
      templatePath: this.state.definition.getTemplatePath(),
      templateFormat: this.state.definition.getTemplateFormat(),
    });
  }

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    return this.state.definition.getTemplatePath();
  }

  getTemplateFormat(): Result<
    "json" | "yaml" | "markdown",
    SchemaError & { message: string }
  > {
    return this.state.definition.getTemplateFormat();
  }

  hasFrontmatterPart(): boolean {
    return this.state.definition.hasFrontmatterPart();
  }

}
