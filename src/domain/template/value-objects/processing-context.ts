import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";

/**
 * Verbosity mode configuration for template variable processing
 */
export type VerbosityMode =
  | { readonly kind: "normal" } // Replace null/undefined with empty strings
  | { readonly kind: "verbose" }; // Preserve template variables for debugging

/**
 * ProcessingContext encapsulates the context information needed for template variable processing.
 * Follows DDD Value Object pattern with immutability and validation.
 */
export class ProcessingContext {
  private constructor(
    private readonly _processingType: "single" | "array" | "expansion",
    private readonly _verbosityMode: VerbosityMode = { kind: "normal" },
    private readonly _arrayData?: unknown[],
    private readonly _itemTemplate?: unknown,
  ) {}

  /**
   * Smart Constructor for single item processing context
   */
  static forSingleItem(
    verbosityMode: VerbosityMode = { kind: "normal" },
  ): Result<
    ProcessingContext,
    TemplateError & { message: string }
  > {
    return ok(new ProcessingContext("single", verbosityMode));
  }

  /**
   * Smart Constructor for array processing context
   */
  static forArrayProcessing(
    arrayData: unknown[],
    verbosityMode: VerbosityMode = { kind: "normal" },
    itemTemplate?: unknown,
  ): Result<ProcessingContext, TemplateError & { message: string }> {
    if (!Array.isArray(arrayData)) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: "Array data must be an array for array processing context",
      }));
    }

    return ok(
      new ProcessingContext("array", verbosityMode, arrayData, itemTemplate),
    );
  }

  /**
   * Smart Constructor for array expansion processing context
   */
  static forArrayExpansion(
    arrayData: unknown[],
    verbosityMode: VerbosityMode = { kind: "normal" },
  ): Result<ProcessingContext, TemplateError & { message: string }> {
    if (!Array.isArray(arrayData)) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: "Array data must be an array for expansion context",
      }));
    }

    return ok(new ProcessingContext("expansion", verbosityMode, arrayData));
  }

  // Accessors following immutable value object pattern
  get processingType(): "single" | "array" | "expansion" {
    return this._processingType;
  }

  get verbosityMode(): VerbosityMode {
    return this._verbosityMode;
  }

  get arrayData(): readonly unknown[] | undefined {
    return this._arrayData ? [...this._arrayData] : undefined;
  }

  get itemTemplate(): unknown {
    return this._itemTemplate;
  }

  get hasArrayData(): boolean {
    return Array.isArray(this._arrayData) && this._arrayData.length > 0;
  }

  get isArrayExpansion(): boolean {
    return this._processingType === "expansion";
  }

  get isArrayProcessing(): boolean {
    return this._processingType === "array";
  }

  get isSingleItem(): boolean {
    return this._processingType === "single";
  }

  /**
   * Create a new context with different array data
   */
  withArrayData(arrayData: unknown[]): Result<
    ProcessingContext,
    TemplateError & { message: string }
  > {
    return ProcessingContext.forArrayProcessing(
      arrayData,
      this._verbosityMode,
      this._itemTemplate,
    );
  }

  /**
   * Value object equality based on content
   */
  equals(other: ProcessingContext): boolean {
    if (this._processingType !== other._processingType) return false;
    if (this._verbosityMode.kind !== other._verbosityMode.kind) return false;

    if (this._arrayData?.length !== other._arrayData?.length) return false;

    if (this._arrayData && other._arrayData) {
      for (let i = 0; i < this._arrayData.length; i++) {
        if (this._arrayData[i] !== other._arrayData[i]) return false;
      }
    }

    return this._itemTemplate === other._itemTemplate;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `ProcessingContext(${this._processingType}, ${this._verbosityMode.kind}, arrayLength=${
      this._arrayData?.length ?? 0
    })`;
  }
}
