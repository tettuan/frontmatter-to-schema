import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
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
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-directive",
        value: props,
        message: "Directive props must be provided",
      }));
    }

    const { targetPath, sourcePath, mergeArrays, targetIsArray } = props;

    if (!targetPath || typeof targetPath !== "string") {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-target-path",
        value: targetPath,
        message: "Target path must be a non-empty string",
      }));
    }

    if (!sourcePath || typeof sourcePath !== "string") {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-source-path",
        value: sourcePath,
        message: "Source path must be a non-empty string",
      }));
    }

    const normalizedTarget = targetPath.trim();
    const normalizedSource = sourcePath.trim();

    if (normalizedTarget.length === 0) {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-target-path",
        value: targetPath,
        message: "Target path cannot be empty",
      }));
    }

    if (normalizedSource.length === 0) {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-source-path",
        value: sourcePath,
        message: "Source path cannot be empty",
      }));
    }

    const targetPathResult = PropertyPath.create(normalizedTarget);
    if (!targetPathResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-target-path",
        value: normalizedTarget,
        message: `Invalid target path '${normalizedTarget}'`,
      }));
    }

    const sourcePathResult = PropertyPath.create(normalizedSource);
    if (!sourcePathResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-source-path",
        value: normalizedSource,
        message: `Invalid source path '${normalizedSource}'`,
      }));
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
