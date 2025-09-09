/**
 * ValidSchema value object
 * Extracted from schema-management.ts for better domain separation
 * Represents a validated schema with all required components
 * Follows Totality principles with Smart Constructor pattern
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";

/**
 * ValidSchema value object for schema validation and encapsulation
 * Ensures schema, template, and prompts are all present and valid
 */
export class ValidSchema {
  private constructor(
    readonly name: string,
    readonly schema: unknown,
    readonly template: unknown,
    readonly prompts: {
      extraction: string;
      mapping: string;
    },
  ) {}

  static create(
    name: string,
    schema: unknown,
    template: unknown,
    prompts: { extraction: string; mapping: string },
  ): Result<ValidSchema, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput", field: "name" }),
      };
    }

    if (!schema) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(schema),
          expectedFormat: "valid schema object",
        }),
      };
    }

    if (!template) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(template),
          expectedFormat: "valid template object",
        }),
      };
    }

    if (!prompts?.extraction || !prompts?.mapping) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "prompts",
          expectedFormat: "object with extraction and mapping fields",
        }),
      };
    }

    return {
      ok: true,
      data: new ValidSchema(name.trim(), schema, template, prompts),
    };
  }
}
