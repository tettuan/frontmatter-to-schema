import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Represents the analyzed structure of a template
 * Following DDD value object pattern with Totality principles
 */
export class TemplateStructure {
  private constructor(
    private readonly arrayExpansionKeys: ArrayExpansionKey[],
    private readonly variableReferences: VariableReference[],
    private readonly staticContent: string[],
  ) {}

  /**
   * Smart Constructor following Totality pattern
   */
  static create(
    arrayKeys: ArrayExpansionKey[],
    variables: VariableReference[],
    staticContent: string[],
  ): Result<TemplateStructure, TemplateError & { message: string }> {
    // Validation: ensure no duplicate array keys
    const keyNames = arrayKeys.map((k) => k.templateKey);
    const uniqueKeys = new Set(keyNames);
    if (keyNames.length !== uniqueKeys.size) {
      return ErrorHandler.template({
        operation: "create",
        method: "validateArrayKeys",
      }).structureInvalid(
        "template",
        "Duplicate array expansion keys detected",
      );
    }

    return ok(new TemplateStructure(arrayKeys, variables, staticContent));
  }

  /**
   * Get array expansion keys for dynamic data composition
   */
  getArrayExpansionKeys(): ArrayExpansionKey[] {
    return [...this.arrayExpansionKeys];
  }

  /**
   * Get variable references for resolution
   */
  getVariableReferences(): VariableReference[] {
    return [...this.variableReferences];
  }

  /**
   * Check if template contains array expansions
   */
  hasArrayExpansions(): boolean {
    return this.arrayExpansionKeys.length > 0;
  }

  /**
   * Check if template contains variable references
   */
  hasVariableReferences(): boolean {
    return this.variableReferences.length > 0;
  }

  /**
   * Get static content parts
   */
  getStaticContent(): string[] {
    return [...this.staticContent];
  }
}

/**
 * Represents a key where array expansion occurs in template
 */
export class ArrayExpansionKey {
  private constructor(
    public readonly templateKey: string,
    public readonly expansionMarker: string,
    public readonly targetPath: string,
  ) {}

  static create(
    templateKey: string,
    expansionMarker: string,
    targetPath: string,
  ): Result<ArrayExpansionKey, TemplateError & { message: string }> {
    if (!templateKey.trim()) {
      return ErrorHandler.template({
        operation: "ArrayExpansionKey.create",
        method: "validateTemplateKey",
      }).structureInvalid(templateKey, "Template key cannot be empty");
    }

    if (!expansionMarker.trim()) {
      return ErrorHandler.template({
        operation: "ArrayExpansionKey.create",
        method: "validateExpansionMarker",
      }).structureInvalid(expansionMarker, "Expansion marker cannot be empty");
    }

    return ok(new ArrayExpansionKey(templateKey, expansionMarker, targetPath));
  }
}

/**
 * Represents a variable reference in template
 */
export class VariableReference {
  private constructor(
    public readonly placeholder: string,
    public readonly variablePath: string,
    public readonly position: number,
  ) {}

  static create(
    placeholder: string,
    variablePath: string,
    position: number,
  ): Result<VariableReference, TemplateError & { message: string }> {
    if (!placeholder.trim()) {
      return ErrorHandler.template({
        operation: "VariableReference.create",
        method: "validatePlaceholder",
      }).structureInvalid(placeholder, "Placeholder cannot be empty");
    }

    if (!variablePath.trim()) {
      return ErrorHandler.template({
        operation: "VariableReference.create",
        method: "validateVariablePath",
      }).structureInvalid(variablePath, "Variable path cannot be empty");
    }

    if (position < 0) {
      return ErrorHandler.template({
        operation: "VariableReference.create",
        method: "validatePosition",
      }).structureInvalid(`${position}`, "Position cannot be negative");
    }

    return ok(new VariableReference(placeholder, variablePath, position));
  }
}
