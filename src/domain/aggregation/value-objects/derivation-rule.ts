import { ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

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
      return ErrorHandler.validation({
        operation: "create",
        method: "validateSourceExpression",
      }).emptyInput();
    }

    if (!targetField || targetField.trim().length === 0) {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateTargetField",
      }).emptyInput();
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
