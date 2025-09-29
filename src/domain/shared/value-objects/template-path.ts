import { Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";

/**
 * Value object representing a template file path with metadata
 */
export class TemplatePath {
  private constructor(
    private readonly _path: string,
    private readonly _type: "container" | "items",
    private readonly _source: "x-template" | "x-template-items",
  ) {}

  static create(
    path: string,
    type: "container" | "items",
    source: "x-template" | "x-template-items",
  ): Result<TemplatePath, DomainError> {
    if (!path || path.trim().length === 0) {
      return Result.error(
        new DomainError(
          "Template path cannot be empty",
          "INVALID_TEMPLATE_PATH",
          { path, type, source },
        ),
      );
    }

    if (!path.endsWith(".json")) {
      return Result.error(
        new DomainError(
          "Template path must have .json extension",
          "INVALID_TEMPLATE_PATH",
          { path, type, source },
        ),
      );
    }

    // Validate type-source consistency
    if (type === "container" && source !== "x-template") {
      return Result.error(
        new DomainError(
          "Container template must use x-template source",
          "INVALID_TEMPLATE_PATH",
          { path, type, source },
        ),
      );
    }

    if (type === "items" && source !== "x-template-items") {
      return Result.error(
        new DomainError(
          "Items template must use x-template-items source",
          "INVALID_TEMPLATE_PATH",
          { path, type, source },
        ),
      );
    }

    return Result.ok(new TemplatePath(path.trim(), type, source));
  }

  get path(): string {
    return this._path;
  }

  get type(): "container" | "items" {
    return this._type;
  }

  get source(): "x-template" | "x-template-items" {
    return this._source;
  }

  isContainer(): boolean {
    return this._type === "container";
  }

  isItems(): boolean {
    return this._type === "items";
  }

  equals(other: TemplatePath): boolean {
    return (
      this._path === other._path &&
      this._type === other._type &&
      this._source === other._source
    );
  }

  toString(): string {
    return `TemplatePath(${this._path}, ${this._type}, ${this._source})`;
  }
}
