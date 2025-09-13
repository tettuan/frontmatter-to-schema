import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

export class TemplatePath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<TemplatePath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({ kind: "EmptyInput" }));
    }

    const trimmed = path.trim();
    if (
      !trimmed.endsWith(".json") && !trimmed.endsWith(".yaml") &&
      !trimmed.endsWith(".yml")
    ) {
      return err(createError({
        kind: "InvalidFormat",
        format: "template path",
        value: trimmed,
      }, "Template path must end with .json, .yaml, or .yml"));
    }

    return ok(new TemplatePath(trimmed));
  }

  getValue(): string {
    return this.value;
  }

  isAbsolute(): boolean {
    return this.value.startsWith("/");
  }

  isRelative(): boolean {
    return !this.isAbsolute();
  }

  getFileName(): string {
    const parts = this.value.split("/");
    return parts[parts.length - 1];
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash === -1 ? "." : this.value.substring(0, lastSlash);
  }

  getFormat(): "json" | "yaml" {
    return this.value.endsWith(".json") ? "json" : "yaml";
  }

  resolve(basePath: string): TemplatePath {
    if (this.isAbsolute()) {
      return this;
    }
    const resolved = basePath.endsWith("/")
      ? basePath + this.value
      : `${basePath}/${this.value}`;
    return new TemplatePath(resolved);
  }

  toString(): string {
    return this.value;
  }
}
