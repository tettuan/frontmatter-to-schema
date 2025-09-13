import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

export class DerivationRule {
  private constructor(
    private readonly sourceExpression: string,
    private readonly targetField: string,
    private readonly unique: boolean,
  ) {}

  static create(
    sourceExpression: string,
    targetField: string,
    unique: boolean = false,
  ): Result<DerivationRule, ValidationError & { message: string }> {
    if (!sourceExpression || sourceExpression.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Source expression cannot be empty",
      ));
    }

    if (!targetField || targetField.trim().length === 0) {
      return err(createError(
        { kind: "EmptyInput" },
        "Target field cannot be empty",
      ));
    }

    const trimmedExpression = sourceExpression.trim();
    const trimmedField = targetField.trim();

    return ok(new DerivationRule(trimmedExpression, trimmedField, unique));
  }

  getSourceExpression(): string {
    return this.sourceExpression;
  }

  getTargetField(): string {
    return this.targetField;
  }

  isUnique(): boolean {
    return this.unique;
  }

  isArrayExpression(): boolean {
    return this.sourceExpression.includes("[]");
  }

  getBasePath(): string {
    const parts = this.sourceExpression.split("[]");
    return parts[0];
  }

  getPropertyPath(): string {
    const parts = this.sourceExpression.split("[]");
    if (parts.length > 1 && parts[1].startsWith(".")) {
      return parts[1].substring(1);
    }
    return "";
  }

  toString(): string {
    return `${this.sourceExpression} -> ${this.targetField}${
      this.unique ? " (unique)" : ""
    }`;
  }
}
