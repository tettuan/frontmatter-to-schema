import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * CommandId value object representing a command identifier in c1:c2:c3 format
 *
 * @example
 * ```typescript
 * const commandId = CommandId.create("git", "commit", "refinement-issue");
 * if (commandId.ok) {
 *   const fullId = commandId.data.toFullId(); // "git:commit:refinement-issue"
 * }
 * ```
 */
export class CommandId {
  private constructor(
    private readonly c1: string,
    private readonly c2: string,
    private readonly c3: string,
  ) {}

  static create(
    c1: string,
    c2: string,
    c3: string,
  ): Result<CommandId, ValidationError & { message: string }> {
    // Validate c1
    const c1ValidationResult = this.validateComponent(c1, "c1");
    if (!c1ValidationResult.ok) {
      return c1ValidationResult;
    }

    // Validate c2
    const c2ValidationResult = this.validateComponent(c2, "c2");
    if (!c2ValidationResult.ok) {
      return c2ValidationResult;
    }

    // Validate c3
    const c3ValidationResult = this.validateComponent(c3, "c3");
    if (!c3ValidationResult.ok) {
      return c3ValidationResult;
    }

    return ok(
      new CommandId(
        c1ValidationResult.data,
        c2ValidationResult.data,
        c3ValidationResult.data,
      ),
    );
  }

  private static validateComponent(
    component: string,
    fieldName: string,
  ): Result<string, ValidationError & { message: string }> {
    if (!component || component.trim() === "") {
      return err(createError({
        kind: "EmptyInput",
      }, `Component ${fieldName} cannot be empty`));
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validPattern = /^[a-zA-Z0-9\-_]+$/;
    if (!validPattern.test(component)) {
      return err(createError({
        kind: "PatternMismatch",
        value: component,
        pattern: validPattern.source,
      }, `Component ${fieldName} contains invalid characters`));
    }

    return ok(component.trim().toLowerCase());
  }

  static fromFrontmatter(
    frontmatter: Record<string, unknown>,
  ): Result<CommandId, ValidationError & { message: string }> {
    const c1 = frontmatter.c1;
    const c2 = frontmatter.c2;
    const c3 = frontmatter.c3;

    if (typeof c1 !== "string") {
      return err(createError({
        kind: "MissingRequired",
        field: "c1",
      }));
    }

    if (typeof c2 !== "string") {
      return err(createError({
        kind: "MissingRequired",
        field: "c2",
      }));
    }

    if (typeof c3 !== "string") {
      return err(createError({
        kind: "MissingRequired",
        field: "c3",
      }));
    }

    return CommandId.create(c1, c2, c3);
  }

  toFullId(): string {
    return `${this.c1}:${this.c2}:${this.c3}`;
  }

  getC1(): string {
    return this.c1;
  }

  getC2(): string {
    return this.c2;
  }

  getC3(): string {
    return this.c3;
  }

  equals(other: CommandId): boolean {
    return this.c1 === other.c1 && this.c2 === other.c2 && this.c3 === other.c3;
  }

  toString(): string {
    return this.toFullId();
  }
}
