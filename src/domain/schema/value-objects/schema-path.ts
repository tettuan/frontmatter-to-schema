import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

export class SchemaPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<SchemaPath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({ kind: "EmptyInput" }));
    }

    const trimmed = path.trim();
    if (!trimmed.endsWith(".json")) {
      return err(createError({
        kind: "InvalidFormat",
        format: "schema path",
        value: trimmed,
      }, "Schema path must end with .json"));
    }

    return ok(new SchemaPath(trimmed));
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

  resolve(basePath: string): SchemaPath {
    if (this.isAbsolute()) {
      return this;
    }
    const resolved = basePath.endsWith("/")
      ? basePath + this.value
      : `${basePath}/${this.value}`;
    return new SchemaPath(resolved);
  }

  toString(): string {
    return this.value;
  }
}
