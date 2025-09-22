import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { PropertyPath } from "../extractors/property-extractor.ts";

export interface ExtractFromDirectiveProps {
  readonly targetPath: string;
  readonly sourcePath: string;
  readonly mergeArrays?: boolean;
  readonly targetIsArray?: boolean;
}

export class ExtractFromDirective {
  private constructor(
    private readonly targetPath: string,
    private readonly sourcePath: string,
    private readonly targetPropertyPath: PropertyPath,
    private readonly sourcePropertyPath: PropertyPath,
    private readonly mergeArrays: boolean,
    private readonly targetIsArray: boolean,
  ) {}

  static create(
    props: ExtractFromDirectiveProps,
  ): Result<ExtractFromDirective, DomainError & { message: string }> {
    if (!props || typeof props !== "object") {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateProps",
      }).invalidFormat(
        "extract-from-directive",
        props,
        undefined,
        "Directive props must be provided",
      );
    }

    const { targetPath, sourcePath, mergeArrays, targetIsArray } = props;

    if (!targetPath || typeof targetPath !== "string") {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateTargetPath",
      }).invalidFormat(
        "extract-from-target-path",
        targetPath,
        undefined,
        "Target path must be a non-empty string",
      );
    }

    if (!sourcePath || typeof sourcePath !== "string") {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateSourcePath",
      }).invalidFormat(
        "extract-from-source-path",
        sourcePath,
        undefined,
        "Source path must be a non-empty string",
      );
    }

    const normalizedTarget = targetPath.trim();
    const normalizedSource = sourcePath.trim();

    if (normalizedTarget.length === 0) {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateTargetLength",
      }).emptyInput();
    }

    if (normalizedSource.length === 0) {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateSourceLength",
      }).emptyInput();
    }

    const targetPathResult = PropertyPath.create(normalizedTarget);
    if (!targetPathResult.ok) {
      return ErrorHandler.validation({
        operation: "create",
        method: "createTargetPath",
      }).invalidFormat(
        "extract-from-target-path",
        normalizedTarget,
        undefined,
        `Invalid target path '${normalizedTarget}'`,
      );
    }

    const sourcePathResult = PropertyPath.create(normalizedSource);
    if (!sourcePathResult.ok) {
      return ErrorHandler.validation({
        operation: "create",
        method: "createSourcePath",
      }).invalidFormat(
        "extract-from-source-path",
        normalizedSource,
        undefined,
        `Invalid source path '${normalizedSource}'`,
      );
    }

    return ok(
      new ExtractFromDirective(
        normalizedTarget,
        normalizedSource,
        targetPathResult.data,
        sourcePathResult.data,
        mergeArrays === true,
        targetIsArray === true,
      ),
    );
  }

  getTargetPath(): string {
    return this.targetPath;
  }

  getSourcePath(): string {
    return this.sourcePath;
  }

  /**
   * @deprecated Use getSourcePath() instead. Retained for backward compatibility during refactor.
   */
  getPath(): string {
    return this.getSourcePath();
  }

  getTargetSegments(): readonly string[] {
    return this.targetPropertyPath.getSegments();
  }

  getSourceSegments(): readonly string[] {
    return this.sourcePropertyPath.getSegments();
  }

  hasTargetArrayExpansion(): boolean {
    return this.targetPropertyPath.hasArrayExpansion();
  }

  hasSourceArrayExpansion(): boolean {
    return this.sourcePropertyPath.hasArrayExpansion();
  }

  shouldMergeArrays(): boolean {
    return this.mergeArrays;
  }

  isTargetArray(): boolean {
    return this.targetIsArray;
  }

  getTargetPropertyPath(): PropertyPath {
    return this.targetPropertyPath;
  }

  getSourcePropertyPath(): PropertyPath {
    return this.sourcePropertyPath;
  }
}
