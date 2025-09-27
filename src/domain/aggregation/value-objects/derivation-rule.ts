import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Derivation Rule (Legacy Compatibility)
 *
 * Represents a rule for deriving data from source properties.
 * This maintains compatibility during transition to 3-domain architecture.
 */
export class DerivationRule {
  constructor(
    private readonly sourcePath: string,
    private readonly targetField: string,
    private readonly unique: boolean = false,
  ) {}

  static create(
    sourcePath: string,
    targetField: string,
    unique: boolean = false,
  ): Result<DerivationRule, DomainError & { message: string }> {
    if (!sourcePath || !targetField) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "Source path and target field are required for derivation rule",
      }));
    }

    return ok(new DerivationRule(sourcePath, targetField, unique));
  }

  getBasePath(): string {
    // Extract base path for derivation (e.g., "commands" from "commands[].c1")
    if (this.sourcePath.includes("[]")) {
      return this.sourcePath.split("[]")[0];
    }
    return this.sourcePath;
  }

  getPropertyPath(): string {
    // Extract property path (e.g., "c1" from "commands[].c1")
    if (this.sourcePath.includes("[].")) {
      return this.sourcePath.split("[].")[1];
    }
    return this.sourcePath;
  }

  getTargetField(): string {
    return this.targetField;
  }

  isUnique(): boolean {
    return this.unique;
  }

  getSourcePath(): string {
    return this.sourcePath;
  }
}
