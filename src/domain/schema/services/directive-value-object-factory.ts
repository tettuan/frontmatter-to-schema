import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import {
  DIRECTIVE_NAMES,
  DirectiveName,
} from "../constants/directive-names.ts";
import { FlattenArraysDirective } from "../value-objects/flatten-arrays-directive.ts";
import { FrontmatterPartDirective } from "../value-objects/frontmatter-part-directive.ts";
import { DerivedFromDirective } from "../value-objects/derived-from-directive.ts";
import { DerivedUniqueDirective } from "../value-objects/derived-unique-directive.ts";
import { JmesPathFilterDirective } from "../value-objects/jmespath-filter-directive.ts";
import { TemplateFormatDirective } from "../value-objects/template-format-directive.ts";
import { TemplateItemsDirective } from "../value-objects/template-items-directive.ts";
import { TemplateDirective } from "../value-objects/template-directive.ts";

/**
 * Base interface for all directive value objects.
 */
export interface DirectiveValueObject {
  toString(): string;
}

/**
 * Factory for creating directive value objects from raw values.
 * Centralizes directive creation logic and eliminates duplication.
 */
export class DirectiveValueObjectFactory {
  private constructor() {}

  /**
   * Creates a factory instance.
   */
  static create(): DirectiveValueObjectFactory {
    return new DirectiveValueObjectFactory();
  }

  /**
   * Creates a directive value object from a directive type and raw value.
   */
  createDirective(
    directiveType: DirectiveName,
    value: unknown,
  ): Result<DirectiveValueObject, SchemaError> {
    switch (directiveType) {
      case DIRECTIVE_NAMES.FRONTMATTER_PART:
        return FrontmatterPartDirective.create(value);

      case DIRECTIVE_NAMES.FLATTEN_ARRAYS:
        return FlattenArraysDirective.create(value);

      case DIRECTIVE_NAMES.DERIVED_FROM:
        return DerivedFromDirective.create(value);

      case DIRECTIVE_NAMES.DERIVED_UNIQUE:
        return DerivedUniqueDirective.create(value);

      case DIRECTIVE_NAMES.JMESPATH_FILTER:
        return JmesPathFilterDirective.create(value);

      case DIRECTIVE_NAMES.TEMPLATE_FORMAT:
        return TemplateFormatDirective.create(value);

      case DIRECTIVE_NAMES.TEMPLATE_ITEMS:
        return TemplateItemsDirective.create(value);

      case DIRECTIVE_NAMES.TEMPLATE:
        return TemplateDirective.create(value);

      default:
        return Result.error(
          new SchemaError(
            `Unsupported directive type: ${directiveType}`,
            "UNSUPPORTED_DIRECTIVE",
            { directiveType, value },
          ),
        );
    }
  }

  /**
   * Validates a directive value without creating the object.
   * Useful for validation-only scenarios.
   */
  validateDirective(
    directiveType: DirectiveName,
    value: unknown,
  ): Result<void, SchemaError> {
    return this.createDirective(directiveType, value).map(() => undefined);
  }
}
