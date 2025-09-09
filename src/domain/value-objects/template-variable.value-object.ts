/**
 * Template Variable Value Objects
 * Extracted from template-variable-resolver.ts for better domain separation
 * Represents different types of template variables following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { PropertyPath } from "../models/property-path.ts";

/**
 * Template Variable Types - Discriminated Union following Totality principle
 */
export type TemplateVariable =
  | {
    kind: "SimpleVariable";
    name: string;
    placeholder: string;
    defaultValue?: string;
  }
  | {
    kind: "PathVariable";
    name: string;
    path: PropertyPath;
    placeholder: string;
    defaultValue?: string;
  }
  | {
    kind: "ConditionalVariable";
    name: string;
    condition: string;
    trueValue: string;
    falseValue: string;
    placeholder: string;
  };

/**
 * Simple Template Variable Value Object
 */
export class SimpleTemplateVariable {
  private constructor(
    public readonly kind: "SimpleVariable",
    public readonly name: string,
    public readonly placeholder: string,
    public readonly defaultValue?: string,
  ) {}

  static create(
    name: string,
    placeholder: string,
    defaultValue?: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: name,
          expectedFormat: "valid identifier (letters, numbers, underscore)",
        }),
      };
    }

    if (!placeholder || placeholder.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "placeholder",
        }),
      };
    }

    return {
      ok: true,
      data: new SimpleTemplateVariable(
        "SimpleVariable",
        name,
        placeholder,
        defaultValue,
      ),
    };
  }
}

/**
 * Path Template Variable Value Object
 */
export class PathTemplateVariable {
  private constructor(
    public readonly kind: "PathVariable",
    public readonly name: string,
    public readonly path: PropertyPath,
    public readonly placeholder: string,
    public readonly defaultValue?: string,
  ) {}

  static create(
    name: string,
    path: PropertyPath,
    placeholder: string,
    defaultValue?: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "name",
        }),
      };
    }

    if (!placeholder || placeholder.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "placeholder",
        }),
      };
    }

    return {
      ok: true,
      data: new PathTemplateVariable(
        "PathVariable",
        name,
        path,
        placeholder,
        defaultValue,
      ),
    };
  }
}

/**
 * Conditional Template Variable Value Object
 */
export class ConditionalTemplateVariable {
  private constructor(
    public readonly kind: "ConditionalVariable",
    public readonly name: string,
    public readonly condition: string,
    public readonly trueValue: string,
    public readonly falseValue: string,
    public readonly placeholder: string,
  ) {}

  static create(
    name: string,
    condition: string,
    trueValue: string,
    falseValue: string,
    placeholder: string,
  ): Result<TemplateVariable, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "name",
        }),
      };
    }

    if (!condition || condition.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "condition",
        }),
      };
    }

    if (!trueValue || trueValue.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "trueValue",
        }),
      };
    }

    if (!falseValue || falseValue.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "falseValue",
        }),
      };
    }

    if (!placeholder || placeholder.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "placeholder",
        }),
      };
    }

    return {
      ok: true,
      data: new ConditionalTemplateVariable(
        "ConditionalVariable",
        name,
        condition,
        trueValue,
        falseValue,
        placeholder,
      ),
    };
  }
}
